# supabase — servidor de pagos (1.1.1 · Etapa 2)

Esquema, funciones y pruebas **sin datos ni secretos**. No se publica en zarem.mx (`.github/workflows/pages.yml`).
Seguridad, secretos y orden de publicación: **`../SECURITY.md`**.

En 1.1.1 el catálogo sigue siendo `colegio_la_florida/db/*.json` (lo lee también el servidor) y **no hay stock ni
contabilidad**: Supabase solo guarda pedidos, pagos y eventos de Stripe.

| Archivo | Contenido |
|---|---|
| `migrations/0001_esquema_ecommerce.sql` | catálogo con variantes y stock, perfiles, pedidos — **reservado para Etapa 3** (stock / Odoo); su modelo es anterior al catálogo del colegio |
| `migrations/0002_pagos_stripe.sql` | **1.1.1:** `checkout_orders`, `checkout_items`, `payments`, `webhook_events` (RLS sin políticas: solo `service_role`) y las funciones atómicas `crear_pedido()`, `guardar_sesion()`, `registrar_evento_pago()` |
| `functions/_compartido/precios.js` | cálculo único del total en centavos (= `priceBag()` del navegador), con validación de entrada |
| `functions/_compartido/precios.test.mjs` | pruebas con el catálogo real: `node --test supabase/functions/_compartido/precios.test.mjs` |
| `functions/_compartido/servidor.ts` | secretos, CORS, clientes de Stripe y Supabase, lectura del catálogo |
| `functions/crear-checkout/` | bolsa → pedido «por-pagar» → Stripe Checkout (`{ url }`), o pedido en efectivo (`{ order, token }`) |
| `functions/webhook-stripe/` | único lugar que marca «pagado»: firma, idempotencia, importe |
| `functions/estado-pedido/` | estado de un pedido para `colegio_la_florida/pedido/` (token de un solo pedido, sin datos personales) |

## Flujo

```
bolsa/ ── { school, lines[id, talla, nombre, qty], shippingId, paymentId, customer } ──▶ crear-checkout
            · relee productos.json + tienda.json de SITE_URL · precios.js (centavos)
            · crear_pedido() → checkout_orders + checkout_items + payments (por-pagar)
            · tarjeta / OXXO → Checkout Session con price_data (un precio por talla, sin Products en Stripe)
            · efectivo → sin Stripe: se paga al recoger
Stripe ── evento firmado ──▶ webhook-stripe → registrar_evento_pago()
            completed + paid / async_payment_succeeded → pagado
            completed + unpaid (OXXO) → esperando-oxxo · async_payment_failed / expired → cancelado
            charge.refunded (total) → reembolsado · charge.dispute.created → disputa
pedido/?pedido=…&t=… ──▶ estado-pedido (lectura)
```

## Estados

| `checkout_orders.status` | `payments.status` |
|---|---|
| `por-pagar` → `pagado` · `cancelado` · `reembolsado` | `abierto` · `esperando-oxxo` · `pagado` · `fallido` · `expirado` · `reembolsado` · `disputa` |

`en-confeccion`, `enviado`, `entregado`, stock y CFDI llegan con la Etapa 3.

## Comandos

```
supabase link --project-ref <proyecto-de-pruebas>
supabase db push
supabase secrets set --env-file supabase/functions/.env        # ver ../.env.example; el archivo está en .gitignore
supabase functions deploy crear-checkout estado-pedido webhook-stripe --no-verify-jwt
stripe listen --forward-to https://<proyecto>.supabase.co/functions/v1/webhook-stripe   # pruebas locales del webhook
```
