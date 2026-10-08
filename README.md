# zarem.mx

Zarem: marca de uniformes moderna y elegante, con confección de sastrería hecha en su taller de la Ciudad de México.
Tienda en línea por pieza o por volumen (corporativo, hospitalidad, salud), programa para empresas y página del taller.

**Variante C/D** de `../ARQUITECTURA-WEB-ETAPAS.md` con **módulo de ecommerce**: React + Tailwind por CDN, sin build, datos
simulados en `public/db/`, una capa de datos (`db`) y una función de precios (`priceBag`) en `js/tienda.jsx`. Es el
primer sitio que sigue la arquitectura de ecommerce de la plantilla
(`../_plataforma/etapa-1-arquitectura-base/plantilla-react-tailwind/`), así que migrarlo a la Variante E es copiar
datos y tokens.

**Estado: 1.0.0 · Etapa 1.** Catálogo, precios, tallas, reglas comerciales y textos legales son de ejemplo; la bolsa y los
pedidos se guardan solo en el navegador y el pedido se confirma por WhatsApp. Revisar todos los `[marcadores]` y
`[verificar]` con el cliente antes de publicar.

## Probar en local

```
py -m http.server 8128        # desde esta carpeta → http://localhost:8128
```

Las rutas son absolutas (`/css/site.css`), así que hay que servir desde la raíz; abrir el HTML con doble clic no funciona.

## Identidad (tonos azules)

| Token | Color | Uso |
|---|---|---|
| `white` | `#ffffff` | fondo, tarjetas |
| `noche` | `#0b1b34` | azul medianoche: texto, botones oscuros, secciones con sarga (`.twill`), pie |
| `zafiro` | `#1e3a6e` | botón principal (`.btn-blue`), estados activos, contador de la bolsa |
| `acero` | `#4a6fa5` · `300 #8fb0dc` | acentos: palabra en cursiva (`.accent`), hilván (`.stitch`) |
| `hielo` | `50 #f6f9fd` · `100 #ebf1f9` · `200 #d6e3f2` | secciones suaves, fondo de prendas (`.ice-wash`) |
| `acero-600` | `#5a6b85` | texto secundario |

Tipografías: **Bodoni Moda** (títulos, aire de etiqueta de sastre) · **Manrope** (texto).
Tokens en `js/tailwind.config.js` y `:root` de `css/site.css`.
Componentes: `.btn-dark / .btn-blue / .btn-ice / .btn-line / .btn-ghost-light`, `.field`, `.kicker`, `.accent`, `.stitch`,
`.stitch-under`, `.twill`, `.ice-wash`, `.reveal`.

## Estructura de carpetas

```
zarem.mx/
├── CNAME · .nojekyll · .gitignore · .env.example · robots.txt · sitemap.xml
├── README.md                     este archivo
├── index.html                    inicio: héroe, promesas, líneas, esenciales, taller, empresas, showroom
├── 404.html                      página no encontrada + redirecciones (MOVED)
│
├── css/site.css                  UNA hoja de estilos
├── js/
│   ├── tailwind.config.js        paleta y tipografías
│   ├── layout.jsx                TODAS las páginas: BRAND, NAV_LINKS, cabecera, pie, bolsa (bag), WhatsApp,
│   │                             cookies, PageHero, SectionTitle, LegalPage, renderPage()
│   └── tienda.jsx                capa de datos `db`, useCatalog, priceBag (volumen, bordado, envío), Garment (prenda SVG),
│                                 Swatch, ProductCard, VolumeTable, ProductPage, BagDrawer, LEAD_ENDPOINT
│
├── public/db/                    BASE DE DATOS SIMULADA — ver public/db/README.md
│   ├── colecciones.json          líneas y tipos de prenda
│   ├── productos.json            12 prendas: corte, telas, colores, tallas, precio con IVA, disponibilidad
│   ├── telas.json                6 telas con composición, origen, cuidados y colores
│   └── tienda.json               reglas: descuento por volumen, bordado, métodos de envío
├── supabase/                     BASE DE DATOS REAL (Etapa 2): esquema + RLS + stock por variante — ver supabase/README.md
├── img/favicon.svg
├── tools/generar-paginas-producto.py   crea pages/tienda/<slug>/ y sitemap.xml desde productos.json
│
├── pages/
│   ├── tienda/                   /pages/tienda/  filtros ?linea= ?tipo= ?corte=, orden
│   ├── tienda/<slug>/            ficha (generada), color en ?color=
│   ├── bolsa/                    bolsa + datos de entrega y factura → pedido por WhatsApp (noindex)
│   ├── empresas/                 programa para empresas + solicitud (#solicitud)
│   ├── confeccion/               taller, #telas, #tallas, #cuidados
│   ├── contacto/                 showroom + formulario → WhatsApp; ?asunto=pedido|medidas|empresa|ajuste
│   ├── terminos/                 #precios #pedidos #envios #cambios #garantia #empresas
│   └── privacidad/               aviso de privacidad (LFPDPPP)
│
├── _docs/src/v1.0.0.html         PÚBLICO: documento de versión
└── _interno/                     LOCAL, NO SE PUBLICA (.gitignore)
```

## Qué carga cada página

| Página | layout.jsx | tienda.jsx |
|---|:-:|:-:|
| `index.html`, `tienda/`, `tienda/<slug>/`, `bolsa/`, `empresas/`, `confeccion/` | ✓ | ✓ |
| `contacto/`, `terminos/`, `privacidad/`, `404.html` | ✓ | |

Orden: `tailwind.config.js` (en el `<head>`) → `layout.jsx` → `tienda.jsx` → script de la página (`renderPage(...)`).

## Cómo funciona la compra (Etapa 1)

1. Ficha: color + talla (+ bordado) + cantidad → `bag.add()` guarda la variante en `za-bolsa` y abre el `BagDrawer`.
2. Bolsa: `priceBag()` recalcula todo desde el catálogo (nunca guarda precios): descuento por **total de piezas**
   (5 % desde 10, 10 % desde 25, 15 % desde 50), bordado por pieza + digitalización, envío gratis según método.
3. Confirmar: `db.createOrder()` guarda el pedido en `za-pedidos` y abre WhatsApp con el detalle; el taller confirma
   existencias y envía la liga de pago.
4. Etapa 2: `db.createOrder()` llama a una Edge Function que relee precios, crea el pedido y devuelve la URL de pago
   (ver `supabase/README.md`). Los componentes no cambian.

## Cambios habituales

- **Teléfono, WhatsApp, emails, dirección, horario**: `BRAND` en `js/layout.jsx` (todos `[verificar]`).
- **Menú / pie**: `NAV_LINKS` y `FOOTER_COLUMNS` en `js/layout.jsx`.
- **Prendas, telas, colores**: `public/db/*.json`. Tras añadir una prenda: `python tools/generar-paginas-producto.py`.
- **Descuentos, bordado, envíos**: `public/db/tienda.json` (y el texto de `pages/terminos/#precios`).
- **Guía de tallas y proceso del taller**: `SIZE_TABLES` y `PROCESS` en `pages/confeccion/index.html`.
- **Recibir pedidos y solicitudes también en una hoja o base de datos**: `LEAD_ENDPOINT` en `js/tienda.jsx`.
- **Redirecciones**: `MOVED` en `404.html`.

## Claves de almacenamiento local

`za-bolsa` (bolsa) · `za-pedidos` (pedidos enviados desde este navegador) · `za-solicitudes` (empresas) · `za-cookies`.

## Hoja de ruta (ver `../ARQUITECTURA-WEB-ETAPAS.md`)

| Etapa | Zarem |
|---|---|
| 1 | Este sitio. Pendiente del cliente: fotos por prenda y color, catálogo y precios reales, tabla de tallas del taller, reglas comerciales, dirección del showroom |
| 2 | Supabase (`supabase/migrations/`): stock por talla, checkout con Stripe / Mercado Pago, cuentas de empresa con colaboradores y recompra |
| 3 | Odoo: órdenes de producción del taller, inventario de telas, CFDI 4.0 automático |
| 5 | n8n (aviso de pedido al taller), WhatsApp Business API, Meta Pixel / CAPI con consentimiento |

## Versiones

### 1.0.0 — 2026-10-08 · Primera versión (Etapa 1, Variante C/D + ecommerce)
- 12 prendas en 3 líneas y 9 tipos, 6 telas con 14 colores; prendas ilustradas en SVG en el color elegido.
- Bolsa por variante (color × talla × bordado) sincronizada entre pestañas, cajón «agregado a tu bolsa».
- Descuento automático por volumen, bordado con digitalización, 3 métodos de entrega con umbral de envío gratis, factura.
- Programa para empresas, taller con guía de tallas, fichas con schema.org `Product` / `Offer`, `sitemap.xml`.
- Esquema Supabase con variantes, stock, pedidos y RLS listo para la Etapa 2.
