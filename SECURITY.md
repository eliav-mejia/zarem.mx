# Seguridad · zarem.mx 1.1.1 (Etapa 2 · pagos seguros)

La 1.1.0 era un sitio estático: no cobraba ni guardaba datos fuera del navegador. La **1.1.1** convierte la tienda en
ecommerce activo con **Stripe** como pasarela, **sin otras integraciones**: no hay stock, no hay contabilidad ni CFDI, no
hay Odoo (Etapa 3). Este documento fija las reglas para que el repositorio y el cobro sean seguros.

> Este archivo es público (vive en el repositorio, no en el sitio). No contiene claves, cuentas ni datos de clientes.
> Riesgos, decisiones y accesos internos: `_interno/` (fuera de Git).

## 1. Arquitectura y fronteras de confianza

```
navegador (zarem.mx, GitHub Pages)              servidor (Supabase Edge Functions)            Stripe
──────────────────────────────────              ──────────────────────────────────            ──────
bolsa: ids + talla + nombre + cantidad ──POST──▶ crear-checkout
                                                 · valida entrada y origen
                                                 · relee productos.json + tienda.json
                                                 · calcula en centavos (precios.js)
                                                 · crear_pedido() → por-pagar
                                                 · Checkout Session (price_data) ──────────▶ página de pago alojada
◀──────────────────────────────── { url } ──────                                             (tarjeta 3DS / OXXO)
redirige a checkout.stripe.com ─────────────────────────────────────────────────────────────▶
                                                 webhook-stripe ◀──── evento firmado ─────── Stripe
                                                 · firma whsec + idempotencia
                                                 · importe = pedido → pagado
pedido/?pedido=…&t=… ──POST──▶ estado-pedido (solo lectura, sin datos personales)
```

| Regla | Dónde se cumple |
|---|---|
| El navegador **nunca** envía precios; el servidor ignora cualquier importe que reciba | `supabase/functions/_compartido/precios.js` |
| Solo el **webhook firmado** marca un pedido como pagado; la página `pedido/` solo lee | `webhook-stripe`, `registrar_evento_pago()` |
| La tarjeta nunca pasa por zarem.mx: Checkout alojado, sin Stripe.js ni campos de tarjeta → **PCI SAQ A** | arquitectura |
| Las tablas de pedidos y pagos no tienen políticas RLS para `anon` / `authenticated` | `0002_pagos_stripe.sql` |
| El sitio público no contiene código de servidor, scripts ni documentación del repositorio | `.github/workflows/pages.yml` |

## 2. Secretos

| Secreto | Dónde vive | Nunca en |
|---|---|---|
| `STRIPE_SECRET_KEY` (**restringida**, `rk_…`) | Secretos de Supabase (`supabase secrets set`) | repo, sitio, chat, correo, capturas |
| `STRIPE_WEBHOOK_SECRET` (`whsec_…`) | Secretos de Supabase | igual |
| `SUPABASE_SERVICE_ROLE_KEY` | Inyectada por Supabase en las Edge Functions | navegador, repo, `.env` compartidos |
| `SITE_URL`, `STRIPE_LIVEMODE` | Secretos de Supabase (no son sensibles, pero se configuran igual) | — |

- Lo único que conoce el navegador es `PAYMENTS_ENDPOINT` (URL pública de las funciones). No hay claves en `js/`.
- **Una clave por modo:** `rk_test_…` + `whsec_` de prueba en el proyecto de pruebas; `rk_live_…` + `whsec_` de producción solo en producción.
- `.env`, `supabase/functions/.env`, `.dev.vars`, `*.pem`, `*.key` y `supabase/.temp/` están en `.gitignore`.
- El despliegue falla si encuentra algo con forma de clave de Stripe, JWT o llave privada (paso *Secret scan* de `pages.yml`).
  Activa también **Secret scanning** y **Push protection** en *Settings → Code security* de GitHub.

### Permisos de la clave restringida

| Recurso de Stripe | Permiso |
|---|---|
| Checkout Sessions | Escritura |
| PaymentIntents, Charges, Refunds, Disputes | Lectura |
| Todo lo demás | Ninguno |

Los reembolsos se hacen desde el Dashboard de Stripe (con MFA), no desde código.

### Si una clave se filtra

1. **Rotar** en Stripe (*Developers → API keys → Roll key*) o el secreto del endpoint del webhook; actualizar con `supabase secrets set`.
2. Revisar en Stripe los registros de API y los pagos de las últimas 72 h.
3. Si llegó a Git: la rotación es lo que protege, no borrar el commit. Después, limpiar el historial (`git filter-repo`) y forzar el push.
4. Anotar el incidente en `_interno/` (qué, cuándo, cómo se detectó, qué se rotó).

## 3. Controles del cobro

| Riesgo | Control |
|---|---|
| Precio, bordado o envío alterados en el navegador | Recalculados en servidor desde el catálogo publicado (`SITE_URL`, nunca una URL del cliente), en centavos enteros |
| Talla, prenda o forma de pago inventadas | Se rechazan: deben existir en `productos.json` / `tienda.json` y la forma de pago debe estar permitida para esa entrega |
| Cobro con un importe distinto al pedido | `crear-checkout` compara `amount_total`; el webhook lo vuelve a comparar y marca `disputa` si no coincide |
| Webhook falso o repetido | Firma con el cuerpo crudo (`constructEventAsync`) + `webhook_events` (PK = `event.id`) en la misma transacción |
| Eventos de prueba en producción | `STRIPE_LIVEMODE`: los eventos del otro modo se ignoran |
| Sesión duplicada por doble clic o reintento | `Idempotency-Key: checkout-<pedido>` |
| Redirección abierta | `success_url` / `cancel_url` salen de `SITE_URL`; el navegador solo sigue URLs de `https://checkout.stripe.com/` |
| Llamadas desde otros sitios | `crear-checkout` y `estado-pedido` exigen `Origin = SITE_URL` (CORS sin comodines) |
| Abuso (pedidos basura) | Cuerpo ≤ 16 KB, ≤ 30 líneas, ≤ 20 piezas por línea, máximo 3 pedidos por pagar por correo y hora (`crear_pedido`) |
| Consultar pedidos ajenos | `estado-pedido` exige el token de un solo pedido (se guarda solo su SHA-256), misma respuesta para «no existe» y «token incorrecto», y no devuelve datos personales |
| Fraude con tarjeta | 3DS dinámico y Radar de Stripe; MFA obligatorio en la cuenta de Stripe |
| Inyección en el nombre a bordar | Solo letras, espacios, punto, apóstrofo y guion; máximo 24 caracteres |

**Pendiente (fuera de 1.1.1):** límite por IP y Turnstile con un Worker de Cloudflare delante de `crear-checkout`
(Etapa 4), CSP en cabeceras (requiere quitar Babel del navegador, Variante E).

## 4. Datos personales (LFPDPPP)

Un pedido guarda nombre del tutor, correo, teléfono, nombre y grado del alumno (un menor), nombre a bordar y, con envío,
la dirección. Reglas:

- Solo se piden con el consentimiento del aviso de privacidad (casilla obligatoria; el servidor la verifica).
- Los registros de las Edge Functions solo llevan el id del pedido y del evento: **nunca** nombres, correo ni dirección.
- `estado-pedido` y la página `pedido/` (`noindex`, `no-referrer`) no muestran datos personales.
- Nadie del equipo exporta pedidos a hojas de cálculo o chats; se consultan en Supabase con MFA.
- Conservación: se define con el cliente y se documenta en el aviso de privacidad antes de cobrar en producción.

## 5. Publicar la 1.1.1 (orden obligatorio)

1. Proyecto de Supabase **de pruebas**: `supabase db push` (aplica `0001` y `0002`).
2. Secretos de prueba: `supabase secrets set --env-file supabase/functions/.env` (ver `.env.example`).
3. `supabase functions deploy crear-checkout estado-pedido webhook-stripe --no-verify-jwt`
   (son públicas: la protección es la validación, el origen y la firma, no un JWT).
4. En Stripe (modo prueba) crear el endpoint `…/functions/v1/webhook-stripe` con los eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`.
5. Poner `PAYMENTS_ENDPOINT` en `js/tienda.jsx` **en una rama** y pasar la lista de la sección 6.
6. Repetir 1–4 en producción con claves `live`, `STRIPE_LIVEMODE=true` y MFA en Stripe, Supabase y GitHub.
7. Fusionar a `main` (despliega el sitio).

## 6. Lista de verificación (modo prueba)

- [ ] `node --test supabase/functions/_compartido/precios.test.mjs` en verde.
- [ ] Tarjeta `4242 4242 4242 4242` → pedido `pagado` solo después del webhook.
- [ ] Tarjeta con 3DS (`4000 0025 0000 3155`) y tarjeta rechazada (`4000 0000 0000 0002`).
- [ ] OXXO: pedido «esperando OXXO», luego `pagado`; ficha vencida → `cancelado`.
- [ ] Sesión abandonada → `expirado` / `cancelado` al vencer.
- [ ] Petición con precios o `unit_cents` manipulados → mismo total de catálogo.
- [ ] `stripe events resend` del mismo evento → sin efectos dobles; webhook sin firma → 400.
- [ ] `estado-pedido` con token incorrecto → 404; respuesta sin datos personales.
- [ ] `crear-checkout` desde otro origen → 403; 4.º pedido por pagar del mismo correo en una hora → 429.
- [ ] El sitio publicado no sirve `/supabase/…`, `/tools/…`, `/README.md` ni `/SECURITY.md` (404).
- [ ] Ninguna clave en el repositorio (`git log -p | grep -E 'rk_|sk_|whsec_'` vacío).

## 7. Reportar un problema de seguridad

Escribe al contacto de `BRAND.email` (`js/layout.jsx`) con el asunto «Seguridad zarem.mx». No abras un *issue* público ni
incluyas datos de clientes.
