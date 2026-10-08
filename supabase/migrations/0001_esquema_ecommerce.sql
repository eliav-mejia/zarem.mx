-- zarem.mx · Etapa 2 · esquema inicial de ecommerce (Supabase / PostgreSQL)
-- Sin datos ni secretos. Mismo modelo que public/db/*.json, con variantes reales (color × talla) y stock.
-- Regla: el navegador solo LEE catálogo. Pedidos, precios y stock los escribe una Edge Function con service_role.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- CATÁLOGO (lectura pública)
create table lines (
    id text primary key,                      -- corporativo · hospitalidad · salud
    label text not null,
    description text,
    sectors text[] not null default '{}'
);

create table product_types (
    id text primary key,
    label text not null,
    sort_order int not null default 0
);

create table fabrics (
    id text primary key,
    name text not null,
    composition text, weight text, feel text, care text, origin text
);

create table colors (
    id text primary key,
    name text not null,
    hex text not null check (hex ~ '^#[0-9a-fA-F]{6}$')
);

create table fabric_colors (
    fabric_id text references fabrics on delete cascade,
    color_id text references colors on delete restrict,
    primary key (fabric_id, color_id)
);

create table products (
    id text primary key,                      -- za-001 (permanente: lo guardan bolsas y pedidos)
    slug text unique not null,
    sku text unique not null,
    line_id text not null references lines,
    type_id text not null references product_types,
    shape text,
    fit text not null check (fit in ('dama', 'caballero', 'unisex')),
    name text not null,
    short text, description text,
    fabric_ids text[] not null default '{}',
    features text[] not null default '{}',
    price_mxn numeric(10,2) not null check (price_mxn > 0),     -- con IVA
    availability text not null default 'existencia' check (availability in ('existencia', 'sobre-pedido')),
    lead_days int not null default 2,
    embroidery boolean not null default false,
    active boolean not null default true,
    featured boolean not null default false,
    updated_at timestamptz not null default now()
);

-- Una fila por combinación vendible. sizes / color_ids del JSON se convierten en estas filas.
create table product_variants (
    id uuid primary key default gen_random_uuid(),
    product_id text not null references products on delete cascade,
    color_id text not null references colors,
    size text not null,
    sku text unique not null,                 -- ZD-SAC-01-MARINO-32
    stock int not null default 0 check (stock >= 0),
    unique (product_id, color_id, size)
);

create table shop_rules (
    id boolean primary key default true check (id),   -- una sola fila
    volume_tiers jsonb not null,              -- [{ "min_qty": 10, "pct": 5 }, …]
    embroidery_mxn numeric(10,2) not null,
    embroidery_setup_mxn numeric(10,2) not null,
    shipping jsonb not null,                  -- [{ "id": "cdmx", "cost_mxn": 149, "free_from_mxn": 2500, … }]
    company_from_qty int not null default 100
);

-- ---------------------------------------------------------------- CLIENTES Y PEDIDOS (privado)
create table profiles (
    id uuid primary key references auth.users on delete cascade,
    full_name text, phone text, company text,
    rfc text,                                 -- solo si pide factura (Etapa 3: CFDI)
    is_admin boolean not null default false,
    created_at timestamptz not null default now()
);

create table orders (
    id text primary key,                      -- ZA-XXXXXXX
    user_id uuid references auth.users,       -- null = compra como invitado (la crea la Edge Function)
    email text not null,
    status text not null default 'por-pagar'
        check (status in ('por-pagar', 'pagado', 'en-confeccion', 'enviado', 'entregado', 'cancelado', 'reembolsado')),
    shipping_id text not null,
    shipping_address jsonb,
    invoice_rfc text,
    pieces int not null,
    subtotal numeric(10,2) not null,
    discount numeric(10,2) not null default 0,
    embroidery numeric(10,2) not null default 0,
    shipping numeric(10,2) not null default 0,
    total numeric(10,2) not null,
    payment_provider text,                    -- stripe · mercadopago
    payment_ref text unique,                  -- idempotencia del webhook
    notes text,
    created_at timestamptz not null default now()
);

create table order_items (
    id uuid primary key default gen_random_uuid(),
    order_id text not null references orders on delete cascade,
    variant_id uuid not null references product_variants,
    name text not null, sku text not null, color text not null, size text not null,
    embroidery boolean not null default false,
    qty int not null check (qty > 0),
    unit_mxn numeric(10,2) not null           -- precio leído de products en el servidor, nunca del navegador
);

create table company_requests (
    id text primary key,                      -- EMP-XXXXXXX
    company text not null, contact text not null, role text,
    email text not null, phone text not null,
    staff int, lines text[] not null default '{}',
    needed_by date, notes text,
    status text not null default 'nueva' check (status in ('nueva', 'contactada', 'propuesta', 'ganada', 'perdida')),
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table lines enable row level security;
alter table product_types enable row level security;
alter table fabrics enable row level security;
alter table colors enable row level security;
alter table fabric_colors enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table shop_rules enable row level security;
alter table profiles enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table company_requests enable row level security;

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;

-- Catálogo: lectura pública; escritura solo admin.
create policy "catálogo público" on lines for select using (true);
create policy "catálogo público" on product_types for select using (true);
create policy "catálogo público" on fabrics for select using (true);
create policy "catálogo público" on colors for select using (true);
create policy "catálogo público" on fabric_colors for select using (true);
create policy "catálogo público" on products for select using (active or is_admin());
create policy "catálogo público" on product_variants for select using (true);
create policy "reglas públicas" on shop_rules for select using (true);
create policy "admin escribe" on products for all using (is_admin()) with check (is_admin());
create policy "admin escribe" on product_variants for all using (is_admin()) with check (is_admin());

-- Perfil: cada quien el suyo.
create policy "perfil propio" on profiles for select using (id = auth.uid() or is_admin());
create policy "perfil propio" on profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_admin = false);

-- Pedidos: el cliente solo LEE los suyos. Insertar / cambiar estado = Edge Function con service_role (salta RLS).
create policy "pedidos propios" on orders for select using (user_id = auth.uid() or is_admin());
create policy "líneas propias" on order_items for select using (
    exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin())));

-- Solicitudes de empresa: solo admin (las inserta el Worker / Edge Function).
create policy "solo admin" on company_requests for select using (is_admin());

-- ---------------------------------------------------------------- STOCK
-- Descuenta stock al pagar (lo llama el webhook, dentro de su transacción). Falla si no alcanza.
create or replace function reserve_stock(p_order text) returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
    for r in select variant_id, sum(qty) q from order_items where order_id = p_order group by variant_id loop
        update product_variants set stock = stock - r.q where id = r.variant_id and stock >= r.q;
        if not found then raise exception 'sin stock para la variante %', r.variant_id; end if;
    end loop;
end $$;
revoke execute on function reserve_stock(text) from public, anon, authenticated;
