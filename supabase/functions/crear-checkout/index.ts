// POST /functions/v1/crear-checkout  (public, called from <school>/bolsa/)
// In:  { school, lines: [{ productId, size, name, qty }], shippingId, paymentId, customer: {...} }
// Out: { url }               tarjeta / oxxo → Stripe Checkout (hosted page; card data never touches zarem.mx)
//      { order, token }      efectivo → order saved, pay at pickup (no Stripe)
// The browser sends ids and quantities only. Prices are re-read from the catalogue and computed here (precios.js).
import { priceOrder, PricingError } from "../_compartido/precios.js";
import { admin, catalogue, cors, json, randomToken, SCHOOLS, sha256, SITE_URL, stripe } from "../_compartido/servidor.ts";

const MAX_BODY = 16_000; // bytes
const str = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

function customerOf(raw: Record<string, unknown>, delivery: boolean) {
  const c = {
    parent: str(raw.parent, 80), email: str(raw.email, 254).toLowerCase(), phone: str(raw.phone, 20),
    student: str(raw.student, 80), grade: str(raw.grade, 40), notes: str(raw.notes, 400),
  };
  if (!c.parent || !c.student || !EMAIL.test(c.email) || !/^[+\d][\d\s-]{7,19}$/.test(c.phone)) return null;
  if (raw.consent !== true) return null;
  if (!delivery) return { ...c, address: null };
  const address = { street: str(raw.street, 120), colonia: str(raw.colonia, 80), zip: str(raw.zip, 5), city: str(raw.city, 80) };
  if (!address.street || !address.colonia || !/^\d{5}$/.test(address.zip) || !address.city) return null;
  return { ...c, address };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "metodo" });
  if (req.headers.get("origin") !== SITE_URL) return json(req, 403, { error: "origen" });

  const text = await req.text();
  if (text.length > MAX_BODY) return json(req, 413, { error: "demasiado-grande" });
  let body: Record<string, any>;
  try { body = JSON.parse(text); } catch { return json(req, 400, { error: "json" }); }

  const school = String(body.school ?? "");
  if (!SCHOOLS.has(school)) return json(req, 400, { error: "colegio" });

  let priced;
  try {
    const [productos, rules] = await catalogue(school);
    priced = priceOrder({ lines: body.lines, shippingId: body.shippingId, paymentId: body.paymentId }, productos as any, rules as any);
  } catch (e) {
    if (e instanceof PricingError) return json(req, 422, { error: e.code });
    console.error("catálogo", (e as Error).message);
    return json(req, 503, { error: "catalogo" });
  }

  const customer = customerOf(body.customer ?? {}, priced.shipping.id === "domicilio");
  if (!customer) return json(req, 422, { error: "datos" });

  // 1 · Order + lines + payment row, atomically (crear_pedido in 0002).
  const token = randomToken();
  const { data: orderId, error } = await admin.rpc("crear_pedido", {
    p: {
      school, payment: priced.payment, shipping: priced.shipping.id,
      parent: customer.parent, email: customer.email, phone: customer.phone,
      student: customer.student, grade: customer.grade, notes: customer.notes, address: customer.address,
      pieces: priced.pieces, subtotal_cents: priced.subtotal_cents, embroidery_cents: priced.embroidery_cents,
      shipping_cents: priced.shipping_cents, total_cents: priced.total_cents, lines: priced.lines,
    },
    p_lookup_hash: await sha256(token),
  });
  if (error) {
    if (error.code === "P0429") return json(req, 429, { error: "demasiados-pedidos" });
    console.error("crear_pedido", error.code);   // never log customer data
    return json(req, 500, { error: "pedido" });
  }

  if (priced.payment === "efectivo") return json(req, 200, { order: orderId, token });

  // 2 · Stripe Checkout Session with inline price_data (no Product/Price per variant: ADR-E2-S1).
  const lineItems = priced.lines.map((l) => ({
    quantity: l.qty,
    price_data: {
      currency: "mxn",
      unit_amount: l.unit_cents,
      product_data: { name: `${l.name} · Talla ${l.size}`, metadata: { sku: l.sku, product_id: l.product_id } },
    },
  }));
  if (priced.embroidery_cents > 0) {
    lineItems.push({
      quantity: priced.embPieces,
      price_data: { currency: "mxn", unit_amount: priced.embroidery_unit_cents, product_data: { name: "Bordado de nombre", metadata: { sku: "BORDADO", product_id: "bordado" } } },
    });
  }
  const back = `${SITE_URL}/${school}`;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "mxn",
      locale: "es-419",
      client_reference_id: orderId,
      customer_email: customer.email,
      payment_method_types: priced.payment === "oxxo" ? ["oxxo"] : ["card"],
      payment_method_options: priced.payment === "oxxo" ? { oxxo: { expires_after_days: 3 } } : undefined,
      line_items: lineItems,
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount", display_name: priced.shipping.label,
          fixed_amount: { amount: priced.shipping_cents, currency: "mxn" },
        },
      }],
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,      // 1 h to pay (Stripe: 30 min – 24 h)
      metadata: { order_id: orderId, school },
      payment_intent_data: { metadata: { order_id: orderId, school } },
      success_url: `${back}/pedido/?pedido=${orderId}&t=${token}`,
      cancel_url: `${back}/bolsa/?cancelado=${orderId}`,
    }, { idempotencyKey: `checkout-${orderId}` });

    await admin.rpc("guardar_sesion", { p_order_id: orderId, p_session_id: session.id, p_livemode: session.livemode });
    if (session.amount_total !== priced.total_cents) {
      console.error("total distinto", orderId);              // should never happen: same cents on both sides
      await stripe.checkout.sessions.expire(session.id);
      return json(req, 500, { error: "total" });
    }
    return json(req, 200, { url: session.url });
  } catch (e) {
    console.error("stripe", orderId, (e as { type?: string }).type ?? "error");
    return json(req, 502, { error: "pasarela" });
  }
});
