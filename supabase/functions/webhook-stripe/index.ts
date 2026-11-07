// POST /functions/v1/webhook-stripe  (called by Stripe only; deploy with --no-verify-jwt)
// The ONLY place that marks an order as paid. Signature verified with the raw body, idempotent per event.id
// (registrar_evento_pago in 0002), amount compared with the order. No stock and no accounting in 1.1.1.
import type Stripe from "npm:stripe@17.7.0";
import { admin, cryptoProvider, stripe } from "../_compartido/servidor.ts";

const WHSEC = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const LIVE = Deno.env.get("STRIPE_LIVEMODE") === "true";   // events from the other mode are ignored

type Update = { order?: string; session?: string; pi?: string; amount?: number; status: string };

function toUpdate(event: Stripe.Event): Update | null {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const order = s.metadata?.order_id ?? s.client_reference_id;
      if (!order) return null;
      const status =
        event.type === "checkout.session.expired" ? "expirado"
        : event.type === "checkout.session.async_payment_failed" ? "fallido"
        : s.payment_status === "paid" ? "pagado"
        : "esperando-oxxo";                                    // completed + unpaid = OXXO voucher issued
      return { order, session: s.id, pi: typeof s.payment_intent === "string" ? s.payment_intent : undefined, amount: s.amount_total ?? undefined, status };
    }
    // Refunds and disputes do not carry our metadata reliably: the order is found by its PaymentIntent.
    case "charge.refunded": {
      const c = event.data.object as Stripe.Charge;
      // Partial refunds are recorded in Stripe only; the order changes to «reembolsado» when fully refunded.
      return c.refunded && typeof c.payment_intent === "string" ? { pi: c.payment_intent, status: "reembolsado" } : null;
    }
    case "charge.dispute.created": {
      const d = event.data.object as Stripe.Dispute;
      return typeof d.payment_intent === "string" ? { pi: d.payment_intent, status: "disputa" } : null;
    }
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método", { status: 405 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("sin firma", { status: 400 });

  const body = await req.text();                              // raw body: needed for the signature
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WHSEC, undefined, cryptoProvider);
  } catch {
    return new Response("firma inválida", { status: 400 });
  }
  if (event.livemode !== LIVE) return new Response("otro modo", { status: 200 });

  const u = toUpdate(event);
  if (!u) return new Response("ignorado", { status: 200 });
  if (!u.order && u.pi) {
    const { data } = await admin.from("payments").select("order_id").eq("payment_intent", u.pi).maybeSingle();
    u.order = data?.order_id;
  }
  if (!u.order) return new Response("sin pedido", { status: 200 });   // not ours (e.g. a manual charge)

  const { data: applied, error } = await admin.rpc("registrar_evento_pago", {
    p_event_id: event.id, p_type: event.type, p_order_id: u.order,
    p_session_id: u.session ?? null, p_payment_intent: u.pi ?? null, p_livemode: event.livemode,
    p_amount_cents: u.amount ?? null, p_status: u.status,
  });
  if (error) {
    console.error("webhook", event.id, error.code);           // 500 → Stripe retries with backoff
    return new Response("error", { status: 500 });
  }
  console.log("webhook", event.id, event.type, u.order, applied ? "aplicado" : "repetido");
  return new Response("ok", { status: 200 });
});
