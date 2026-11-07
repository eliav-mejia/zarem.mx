// POST /functions/v1/estado-pedido  { order, token }  →  { id, status, total_cents, payment_method, shipping_id, items }
// Read-only. The buyer proves the order is theirs with the token from success_url (only its sha256 is stored).
// Returns no personal data (no names, email, phone or address) so a leaked link exposes as little as possible.
import { admin, cors, json, sha256, SITE_URL } from "../_compartido/servidor.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST" || req.headers.get("origin") !== SITE_URL) return json(req, 403, { error: "origen" });

  let body: { order?: unknown; token?: unknown };
  try { body = JSON.parse((await req.text()).slice(0, 1000)); } catch { return json(req, 400, { error: "json" }); }
  const order = String(body.order ?? "");
  const token = String(body.token ?? "");
  if (!/^ZA-[0-9A-F]{10}$/.test(order) || token.length < 20) return json(req, 404, { error: "no-encontrado" });

  const { data, error } = await admin.from("checkout_orders")
    .select("id, status, total_cents, payment_method, shipping_id, lookup_hash, checkout_items(name, size, qty, unit_cents, embroidery_name), payments(status)")
    .eq("id", order).maybeSingle();
  // Same answer for "does not exist" and "wrong token": no way to probe order ids.
  if (error || !data || data.lookup_hash !== await sha256(token)) return json(req, 404, { error: "no-encontrado" });

  const { lookup_hash: _, checkout_items, payments, ...rest } = data as Record<string, any>;
  return json(req, 200, {
    ...rest,
    payment_status: payments?.status ?? null,
    items: (checkout_items ?? []).map((i: any) => ({ name: i.name, size: i.size, qty: i.qty, unit_cents: i.unit_cents, embroidery: Boolean(i.embroidery_name) })),
  });
});
