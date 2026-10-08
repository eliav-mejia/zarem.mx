# public/db — base de datos simulada (Etapa 1)

JSON editados a mano que sustituyen a la base de datos hasta la Etapa 2. **Son públicos**: nunca pongas aquí costos,
márgenes, precios especiales de empresa ni datos de clientes.

| Archivo | «Tabla» (Supabase, Etapa 2) | Lo usa |
|---|---|---|
| `colecciones.json` | `lines`, `product_types` | filtros, inicio, ruta de la ficha, empresas |
| `productos.json` | `products` (+ `product_variants` por color y talla) | tienda, fichas, bolsa, inicio |
| `telas.json` | `fabrics`, `colors` | colores de cada prenda, ficha, página Confección |
| `tienda.json` | `shop_rules` (volumen, bordado, envíos) | ficha, bolsa, inicio, empresas |

## products

| Campo | Notas |
|---|---|
| `id` | permanente (`za-001`…); la bolsa lo guarda |
| `slug` | URL `/pages/tienda/<slug>/` |
| `line_id` / `type_id` | de `colecciones.json`; `shape` (opcional) cambia la ilustración (p. ej. `bata`) |
| `fit` | `dama` · `caballero` · `unisex` (los unisex salen en ambos filtros) |
| `fabric_ids` / `color_ids` | cada color debe existir en alguna tela de `telas.json`; el primero es el de la tarjeta |
| `sizes` | lista de tallas en orden; una sola talla (`Unitalla`) se preselecciona |
| `price_mxn` | precio por pieza **con IVA**, antes del descuento por volumen |
| `availability` / `lead_days` | `existencia` (sale en 2 días) o `sobre-pedido` (días hábiles) |
| `embroidery` | si admite bordado de logotipo o nombre |
| `active` / `featured` | ocultar / destacar en el inicio |

Tras añadir un producto o cambiar `slug`, `name`, `short`, `description` o `price_mxn`:
`python tools/generar-paginas-producto.py` (fichas + `sitemap.xml`).

## tienda.json

- `volume_tiers`: descuento por **total de piezas de la bolsa** (todas las prendas, tallas y colores).
- `embroidery_mxn` por pieza + `embroidery_setup_mxn` una vez por pedido.
- `shipping`: métodos con costo y umbral de envío gratis (se mide después del descuento).
- `company_from_qty`: a partir de cuántas piezas se sugiere el programa para empresas.

Las mismas reglas están implementadas en `priceBag()` (`js/tienda.jsx`) y en la plantilla
(`_plataforma/etapa-1-arquitectura-base/plantilla-react-tailwind/src/modulos/ecommerce/precios.js`, con pruebas).
