# zarem.mx

Zarem: tienda en línea de los **uniformes oficiales del Colegio La Florida** (diario, deportes y paquetes completos).
Las familias eligen prenda y talla desde el celular, añaden el bordado del nombre del alumno y pagan con tarjeta,
en OXXO o en efectivo al recoger en tienda.

**Variante C/D** de `../ARQUITECTURA-WEB-ETAPAS.md` con **módulo de ecommerce**: React + Tailwind por CDN, sin build, datos
simulados en `public/db/`, una capa de datos (`db`) y una función de precios (`priceBag`) en `js/tienda.jsx`. Mismo
contrato que la plantilla (`../_plataforma/etapa-1-arquitectura-base/plantilla-react-tailwind/`).

**Estado: 1.1.0 · Etapa 1.** Precios, tallas, dirección de la tienda y textos legales son de ejemplo; la bolsa y los
pedidos se guardan solo en el navegador y el pedido se confirma por WhatsApp. Revisar todos los `[marcadores]` y
`[verificar]` con el cliente antes de anunciar el sitio.

## Probar en local

```
py -m http.server 8128        # desde esta carpeta → http://localhost:8128
```

Las rutas son absolutas (`/css/site.css`), así que hay que servir desde la raíz; abrir el HTML con doble clic no funciona.

## Identidad: minimalista de moda (estilo Zara)

- Página blanca, tinta casi negra, **fotos de borde a borde**, sin esquinas redondeadas ni sombras.
- Etiquetas diminutas en mayúsculas con tracking abierto (`.label`); títulos grandes y finos; logotipo Didone.
- Movimiento solo en las fotos: **parallax lento** (`.parallax` + `useParallax` en `js/layout.jsx`, velocidad por
  `data-speed`) y aparición suave (`.reveal`). Todo se desactiva con `prefers-reduced-motion`.
- La cabecera flota transparente sobre la foto del inicio (`renderPage(Page, { overlay: true })`) y se vuelve blanca al bajar.

| Token | Color | Uso |
|---|---|---|
| `paper` | `#ffffff` · `50 #f7f7f5` | fondo; fondo de fotos mientras cargan |
| `ink` | `#111111` · `500 #6b6b6b` · `400 #8c8c8c` | texto, botones, líneas fuertes |
| `line` | `#e6e6e6` | separadores |
| `florida.marino` / `florida.naranja` | `#1b2a4a` / `#e8742a` | colores del colegio: solo acentos (fondo de fotos oscuras, avisos) |

Tipografías: **Bodoni Moda** (solo el logotipo) · **Inter** 300/400/500 (todo lo demás).
Componentes: `.btn-ink / .btn-line / .btn-light`, `.field` (solo línea inferior), `.chip` (tallas), `.label`, `.link`,
`.crop`, `.parallax`, `.reveal`.

## Fotos

Las originales en PNG (≈ 11 MB) están en `img/` y **no se publican** (`.gitignore`). El sitio usa `img/fotos/*.webp`
(≈ 0,5 MB en total), convertidas con:

```
ffmpeg -i img/Diario_Femenil.png -c:v libwebp -quality 82 img/fotos/diario-nina.webp
```

| WebP | Original | Se usa en |
|---|---|---|
| `patio-grupo` | `Niños-Colegio-Florida-1002.png` | héroe del inicio, imagen para redes (`og:image`) |
| `diario-nina` | `Diario_Femenil.png` | panel Niña; blusa, cárdigan, jumper, mallas, paquete diario niña |
| `diario-nino` | `Diario_Varonil.png` | panel Niño; suéter, pantalón, paquete diario niño |
| `deportes-nina` / `deportes-nino` | `Deportes_Femenil2.png` / `Deportes_Varonil.png` | banda Deportes; chamarras, pants, paquetes |
| `polo-escudo` | `polo-hombre-diario3-hd.png` | detalle del escudo; polo |
| `patio-abrazo` | `Patio.png` | «Sin filas»; línea Paquetes |

Varias prendas comparten foto: en `productos.json`, `focus` (posición) y `zoom` encuadran cada prenda en su tarjeta.
Cuando haya foto propia por prenda, basta con cambiar `image` y dejar `focus: "50% 50%"`, `zoom: 1`.

## Estructura de carpetas

```
zarem.mx/
├── CNAME · .nojekyll · .gitignore · .env.example · robots.txt · sitemap.xml
├── README.md                     este archivo
├── index.html                    inicio: héroe parallax, Niña/Niño, esenciales, deportes, escudo, «Sin filas»
├── 404.html                      página no encontrada + redirecciones (MOVED)
│
├── css/site.css                  UNA hoja de estilos
├── js/
│   ├── tailwind.config.js        paleta y tipografías
│   ├── layout.jsx                TODAS las páginas: BRAND, MENU, cabecera, menú lateral, pie, bolsa (bag),
│   │                             useParallax, useReveal, WhatsApp, cookies, PageHero, LegalPage, renderPage()
│   └── tienda.jsx                capa de datos `db`, useCatalog, priceBag (bordado, envío), Photo (encuadre),
│                                 ProductCard, ProductPage, BagDrawer, ORDER_ENDPOINT
│
├── img/fotos/*.webp              fotos publicadas (las PNG originales quedan fuera de Git)
├── public/db/                    BASE DE DATOS SIMULADA — ver public/db/README.md
│   ├── colecciones.json          líneas (diario, deportes, paquetes) y tipos de prenda
│   ├── productos.json            15 artículos: 11 prendas + 4 paquetes, tallas, precio con IVA, foto y encuadre
│   └── tienda.json               bordado, métodos de entrega y formas de pago permitidas en cada uno
├── supabase/                     BASE DE DATOS REAL (Etapa 2): esquema + RLS + stock por variante — ver supabase/README.md
├── tools/generar-paginas-producto.py   crea pages/tienda/<slug>/ y sitemap.xml desde productos.json
│
├── pages/
│   ├── tienda/                   /pages/tienda/  filtros ?corte=nina|nino y ?linea=diario|deportes|paquetes
│   ├── tienda/<slug>/            ficha (generada)
│   ├── bolsa/                    bolsa + entrega + forma de pago + datos → pedido por WhatsApp (noindex)
│   ├── como-comprar/             #pasos #entrega #pagos #tallas #bordado #cambios
│   ├── contacto/                 tienda, horario, formulario → WhatsApp
│   ├── terminos/                 #precios #pagos #entregas #cambios #garantia
│   └── privacidad/               aviso de privacidad (LFPDPPP, datos de menores)
│
├── _docs/src/v1.1.0.html         PÚBLICO: documento de versión
└── _interno/                     LOCAL, NO SE PUBLICA (.gitignore)
```

## Qué carga cada página

| Página | layout.jsx | tienda.jsx |
|---|:-:|:-:|
| `index.html`, `tienda/`, `tienda/<slug>/`, `bolsa/`, `como-comprar/` | ✓ | ✓ |
| `contacto/`, `terminos/`, `privacidad/`, `404.html` | ✓ | |

## Cómo funciona la compra (Etapa 1)

1. Ficha: talla (+ nombre a bordar) + cantidad → `bag.add()` guarda `{ productId, size, name, qty }` en `za-bolsa` y abre el cajón.
2. Bolsa: `priceBag()` recalcula desde el catálogo: prendas + bordado ($60 por prenda con nombre) + envío
   (gratis en tienda; $149 a domicilio, gratis desde $2,000).
3. Forma de pago según la entrega (`tienda.json`): **recoger en tienda → tarjeta o efectivo**; **domicilio → tarjeta u OXXO**.
4. Confirmar: `db.createOrder()` guarda el pedido en `za-pedidos` y abre WhatsApp; la tienda responde con la liga de
   pago o la ficha de OXXO. Etapa 2: Edge Function + Stripe / Mercado Pago (ver `supabase/README.md`).

## Cambios habituales

- **Teléfono, WhatsApp, email, dirección y horario de la tienda**: `BRAND` en `js/layout.jsx` (todos `[verificar]`).
- **Menú lateral / pie**: `MENU`, `MENU_SECONDARY` y `FOOTER_COLUMNS` en `js/layout.jsx`.
- **Prendas, precios, tallas, fotos**: `public/db/productos.json`; después `python tools/generar-paginas-producto.py`.
- **Bordado, envíos, formas de pago**: `public/db/tienda.json` (y el texto de `pages/terminos/`).
- **Guía de tallas**: `SIZES` en `pages/como-comprar/index.html`.
- **Velocidad del parallax**: atributo `data-speed` de cada `.parallax` (0 = fija; 0.25 = la más marcada del sitio).

## Claves de almacenamiento local

`za-bolsa` (bolsa) · `za-pedidos` (pedidos enviados desde este navegador) · `za-cookies`.

## Hoja de ruta (ver `../ARQUITECTURA-WEB-ETAPAS.md`)

| Etapa | Zarem · Colegio La Florida |
|---|---|
| 1 | Este sitio. Pendiente del cliente: precios y tallas reales, dirección y horario de la tienda, foto por prenda, nombre oficial del colegio («Colegio Teresiano La Florida» en el escudo) y autorización para usar escudo y fotos |
| 2 | Supabase: stock por talla, pago en línea (tarjeta y OXXO con Stripe / Mercado Pago), aviso automático de «pedido listo» |
| 3 | Odoo: inventario del taller y CFDI 4.0 |
| 5 | WhatsApp Business API para avisos; preventa del siguiente ciclo escolar |

## Versiones

### 1.1.0 — 2026-10-08 · Tienda del Colegio La Florida, estilo minimalista de moda
- El sitio pasa a ser la tienda de uniformes del Colegio La Florida (sustituye la página única anterior de zarem.mx).
- Diseño minimalista (estilo Zara): fotos de borde a borde, parallax, etiquetas en mayúsculas, cabecera sobre la foto.
- 11 prendas y 4 paquetes con fotos reales en WebP, encuadre por prenda, bordado de nombre, entrega en tienda o
  domicilio, pago con tarjeta, OXXO o efectivo según la entrega.
- Páginas Cómo comprar (pasos, entrega, pagos, tallas, bordado, cambios), contacto, términos y privacidad.

### 1.0.0 — 2026-10-08 · Primera versión (no publicada)
- Sitio de marca de uniformes corporativos, hospitalidad y salud, en tonos azules. Sustituido por la 1.1.0.
