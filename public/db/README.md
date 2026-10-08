# public/db — base de datos simulada (Etapa 1)

JSON editados a mano que sustituyen a la base de datos hasta la Etapa 2. **Son públicos**: nunca pongas aquí costos,
márgenes ni datos de familias o alumnos.

| Archivo | «Tabla» (Supabase, Etapa 2) | Lo usa |
|---|---|---|
| `colecciones.json` | `lines`, `product_types` | filtros de la tienda, ruta de la ficha |
| `productos.json` | `products` (+ `product_variants` por talla) | tienda, fichas, bolsa, inicio |
| `tienda.json` | `shop_rules` (bordado, envíos, pagos) | ficha, bolsa, Cómo comprar |

## products

| Campo | Notas |
|---|---|
| `id` | permanente (`cl-001`…); la bolsa lo guarda |
| `slug` | URL `/pages/tienda/<slug>/` |
| `line_id` / `type_id` | `diario` · `deportes` · `paquetes` / tipos de `colecciones.json` |
| `fit` | `nina` · `nino` · `unisex` (los unisex salen en ambos filtros) |
| `price_mxn` | precio por pieza **con IVA** |
| `image` · `focus` · `zoom` | foto WebP; `focus` = `object-position` («x% y%») y `zoom` = escala para encuadrar la prenda |
| `sizes` | tallas en orden; una sola talla se preselecciona |
| `embroidery` | si admite bordado del nombre del alumno |
| `includes` | solo paquetes: ids de las prendas incluidas (se muestran tachadas con su precio suelto) |
| `active` / `featured` | ocultar / destacar en «Esenciales» |

Tras añadir un producto o cambiar `slug`, `name`, `short`, `description`, `price_mxn` o `image`:
`python tools/generar-paginas-producto.py` (fichas + `sitemap.xml`).

## tienda.json

- `embroidery_mxn`: por prenda con nombre.
- `shipping[].payments`: formas de pago permitidas con cada entrega (tienda → tarjeta, efectivo; domicilio → tarjeta, OXXO).
