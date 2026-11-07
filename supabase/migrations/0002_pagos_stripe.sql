-- zarem.mx · 1.1.1 · Etapa 2 · pagos seguros con Stripe (Supabase / PostgreSQL)
-- Sin datos ni secretos. Independiente de 0001: en 1.1.1 el catálogo sigue en colegio_la_florida/db/*.json y
-- NO hay stock ni contabilidad (Etapa 3). Solo pedidos, pagos y eventos de la pasarela.
-- Regla: el navegador no lee ni escribe estas tablas. Todo pasa por Edge Functions con service_role, y las escrituras
-- que deben ser atómicas van en las funciones de abajo (supabase-js no abre transacciones).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- PEDIDOS
create table checkout_orders (
    id text primary key,                          -- ZA-XXXXXXXX (lo genera crear_pedido)
    school text not null,                         -- colegio_la_florida
    status text not null default 'por-pagar'
        check (status in ('por-pagar', 'pagado', 'cancelado', 'reembolsado')),
    payment_method text not null check (payment_method in ('tarjeta', 'oxxo', 'efectivo')),
    shipping_id text not null check (shipping_id in ('tienda', 'domicilio')),
    -- Datos personales (LFPDPPP; incluyen datos de un menor): solo lo necesario para entregar.
    parent_name text not null, email text not null, phone text not null,
    student_name text not null, student_grade text,
    shipping_address jsonb,                       -- solo con envío a domicilio
    notes text,
    -- Importes en CENTAVOS enteros, calculados en el servidor (_compartido/precios.js).
    pieces int not null check (pieces > 0),
    subtotal_cents int not null check (subtotal_cents >= 0),
    embroidery_cents int not null default 0 check (embroidery_cents >= 0),
    shipping_cents int not null default 0 check (shipping_cents >= 0),
    total_cents int not null check (total_cents > 0),
    currency text not null default 'mxn' check (currency = 'mxn'),
    lookup_hash text not null,                    -- sha256 del token que recibe el comprador para consultar SU pedido
    created_at timestamptz not null default now(),
    paid_at timestamptz,
    check (total_cents = subtotal_cents + embroidery_cents + shipping_cents),
    check ((shipping_id = 'domicilio') = (shipping_address is not null)),
    check (payment_method <> 'efectivo' or shipping_id = 'tienda'),
    check (payment_method <> 'oxxo' or shipping_id = 'domicilio')
);
create index checkout_orders_email_recent on checkout_orders (lower(email), created_at desc);

create table checkout_items (
    id bigint generated always as identity primary key,
    order_id text not null references checkout_orders on delete cascade,
    product_id text not null,                     -- cl-102 (productos.json)
    sku text not null,                            -- folio de Odoo de la talla
    name text not null, size text not null,
    embroidery_name text,                         -- nombre a bordar (dato de un menor)
    qty int not null check (qty between 1 and 20),
    unit_cents int not null check (unit_cents > 0) -- leído del catálogo en el servidor, nunca del navegador
);
create index checkout_items_order on checkout_items (order_id);

-- ---------------------------------------------------------------- PAGOS
create table payments (
    order_id text primary key references checkout_orders on delete cascade,
    provider text not null default 'stripe' check (provider = 'stripe'),
    session_id text unique,                       -- cs_…
    payment_intent text unique,                   -- pi_…
    livemode boolean,
    amount_cents int,
    status text not null default 'abierto'
        check (status in ('abierto', 'esperando-oxxo', 'pagado', 'fallido', 'expirado', 'reembolsado', 'disputa')),
    updated_at timestamptz not null default now()
);

-- Idempotencia del webhook: un evento de Stripe se aplica una sola vez (PK = event.id).
create table webhook_events (
    id text primary key,                          -- evt_…
    type text not null,
    order_id text,
    received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS: sin políticas = nadie salvo service_role
alter table checkout_orders enable row level security;
alter table checkout_items enable row level security;
alter table payments enable row level security;
alter table webhook_events enable row level security;
revoke all on checkout_orders, checkout_items, payments, webhook_events from anon, authenticated;

-- ---------------------------------------------------------------- crear_pedido
-- Inserta pedido + líneas + pago en una transacción. p = salida de precios.js + datos del comprador (ya validados).
-- Límite anti-abuso: máximo 3 pedidos «por-pagar» por correo en la última hora.
create or replace function crear_pedido(p jsonb, p_lookup_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare
    v_id text := 'ZA-' || upper(encode(gen_random_bytes(5), 'hex'));
    v_open int;
begin
    select count(*) into v_open from checkout_orders
     where lower(email) = lower(p->>'email') and status = 'por-pagar' and created_at > now() - interval '1 hour';
    if v_open >= 3 then raise exception 'demasiados pedidos abiertos' using errcode = 'P0429'; end if;

    insert into checkout_orders (id, school, payment_method, shipping_id, parent_name, email, phone, student_name,
                                 student_grade, shipping_address, notes, pieces, subtotal_cents, embroidery_cents,
                                 shipping_cents, total_cents, lookup_hash)
    values (v_id, p->>'school', p->>'payment', p->>'shipping', p->>'parent', p->>'email', p->>'phone', p->>'student',
            nullif(p->>'grade', ''), p->'address', nullif(p->>'notes', ''), (p->>'pieces')::int,
            (p->>'subtotal_cents')::int, (p->>'embroidery_cents')::int, (p->>'shipping_cents')::int,
            (p->>'total_cents')::int, p_lookup_hash);

    insert into checkout_items (order_id, product_id, sku, name, size, embroidery_name, qty, unit_cents)
    select v_id, l->>'product_id', l->>'sku', l->>'name', l->>'size', nullif(l->>'embroidery_name', ''),
           (l->>'qty')::int, (l->>'unit_cents')::int
      from jsonb_array_elements(p->'lines') l;

    if p->>'payment' <> 'efectivo' then insert into payments (order_id) values (v_id); end if;
    return v_id;
end $$;

-- ---------------------------------------------------------------- registrar_evento_pago
-- La llama webhook-stripe con el evento YA verificado (firma). Devuelve false si el evento ya se había aplicado.
-- p_status: pagado · esperando-oxxo · fallido · expirado · reembolsado · disputa
create or replace function registrar_evento_pago(
    p_event_id text, p_type text, p_order_id text, p_session_id text, p_payment_intent text,
    p_livemode boolean, p_amount_cents int, p_status text
) returns boolean language plpgsql security definer set search_path = public as $$
declare o checkout_orders;
begin
    insert into webhook_events (id, type, order_id) values (p_event_id, p_type, p_order_id) on conflict (id) do nothing;
    if not found then return false; end if;                       -- repetido: sin efectos

    select * into o from checkout_orders where id = p_order_id for update;
    if not found then raise exception 'pedido desconocido %', p_order_id; end if;

    -- El importe cobrado debe ser exactamente el del pedido (se comprueba con cada evento que trae importe).
    if p_status in ('pagado', 'esperando-oxxo') and p_amount_cents is distinct from o.total_cents then
        update payments set status = 'disputa', updated_at = now() where order_id = o.id;
        raise warning 'importe distinto en %: cobrado %, pedido %', o.id, p_amount_cents, o.total_cents;
        return true;
    end if;

    update payments set
        session_id = coalesce(p_session_id, session_id),
        payment_intent = coalesce(p_payment_intent, payment_intent),
        livemode = coalesce(p_livemode, livemode),
        amount_cents = coalesce(p_amount_cents, amount_cents),
        -- un pago ya «pagado» solo puede pasar a reembolsado o disputa
        status = case when status = 'pagado' and p_status not in ('reembolsado', 'disputa') then status else p_status end,
        updated_at = now()
     where order_id = o.id;

    update checkout_orders set
        status = case
            when p_status = 'pagado' and status = 'por-pagar' then 'pagado'
            when p_status in ('fallido', 'expirado') and status = 'por-pagar' then 'cancelado'
            when p_status = 'reembolsado' then 'reembolsado'
            else status end,
        paid_at = case when p_status = 'pagado' and paid_at is null then now() else paid_at end
     where id = o.id;
    return true;
end $$;

-- ---------------------------------------------------------------- guardar_sesion
create or replace function guardar_sesion(p_order_id text, p_session_id text, p_livemode boolean) returns void
language sql security definer set search_path = public as $$
    update payments set session_id = p_session_id, livemode = p_livemode, updated_at = now() where order_id = p_order_id;
$$;

-- Solo el servidor (service_role) ejecuta estas funciones.
revoke execute on function crear_pedido(jsonb, text) from public, anon, authenticated;
revoke execute on function registrar_evento_pago(text, text, text, text, text, boolean, int, text) from public, anon, authenticated;
revoke execute on function guardar_sesion(text, text, boolean) from public, anon, authenticated;
