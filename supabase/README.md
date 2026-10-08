# supabase — base de datos real (Etapa 2)

Esquema sin datos ni secretos. **Nada de esto se usa en la Etapa 1**: hoy el sitio lee `public/db/*.json`.

| Archivo | Contenido |
|---|---|
| `migrations/0001_esquema_ecommerce.sql` | catálogo (líneas, tipos, telas, colores, productos, **variantes color × talla con stock**), reglas de tienda, perfiles, pedidos, líneas de pedido, solicitudes de empresa, RLS y `reserve_stock()` |

## Flujo de compra (Etapa 2)

```
navegador ── bolsa (ids + qty) ──▶ Edge Function «checkout»
                                     · relee precios y reglas de la BD (priceBag en servidor)
                                     · crea orders + order_items (status por-pagar)
                                     · crea sesión Stripe / Mercado Pago ──▶ URL de pago
pasarela ── webhook firmado ──▶ Edge Function «webhook»
                                     · verifica firma, idempotencia por payment_ref
                                     · reserve_stock(order) + status pagado
```

## Paso a Supabase sin tocar componentes

Solo cambia `db` en `js/tienda.jsx`:

| Hoy (JSON / localStorage) | Etapa 2 |
|---|---|
| `db.catalog()` → 4 JSON | `select` de `lines`, `product_types`, `products`, `fabrics` + `colors`, `shop_rules` (misma forma) |
| `db.createOrder()` → `za-pedidos` + WhatsApp | `fetch('/functions/v1/checkout')` → redirección a la pasarela |

Claves: ver `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` y las de pasarela **solo** en servidor.
