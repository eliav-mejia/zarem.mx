# zarem.mx

Zarem, **casa de confección**: una tienda de uniformes por colegio, cada una en su carpeta (`zarem.mx/<colegio>/`).
`zarem.mx/` es una sola pantalla sin scroll con una tarjeta por colegio. Hoy: **Colegio La Florida**
(`/colegio_la_florida/`, tienda completa) y **CUM** (`/cum/`, próximamente).

Tienda del Colegio La Florida: uniformes oficiales (diario, deportes y kinder).
Las familias eligen prenda y talla desde el celular, añaden el bordado del nombre del alumno y pagan con tarjeta,
en OXXO o en efectivo al recoger en tienda.

**Variante C/D** de `../ARQUITECTURA-WEB-ETAPAS.md` con **módulo de ecommerce**: React + Tailwind por CDN, sin build, datos
simulados en `colegio_la_florida/db/`, una capa de datos (`db`) y una función de precios (`priceBag`) en `js/tienda.jsx`. Mismo
contrato que la plantilla (`../_plataforma/etapas/etapa-1-arquitectura-base/plantilla-react-tailwind/`).

**Estado: 1.2.0 · Etapa 1.** Precios, tallas, dirección de la tienda y textos legales son de ejemplo; la bolsa y los
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

Las originales en PNG / JPG (≈ 11 MB) están junto a su WebP y **no se publican** (`.gitignore`). El sitio usa `img/<carpeta>/*.webp`
(≈ 0,5 MB en total), convertidas con:

```
ffmpeg -i img/seccion/Diario_Femenil.png -c:v libwebp -quality 82 img/seccion/diario-nina.webp
```

| WebP | Original | Se usa en |
|---|---|---|
| `florida-edificio` | `b205a4_…~mv2.jpg` (fuera de Git) | tarjeta Colegio La Florida en `zarem.mx/`, `og:image` del inicio |
| `patio-grupo` | `Niños-Colegio-Florida-1002.png` | héroe de `/colegio_la_florida/`, imagen para redes (`og:image`) |
| `diario-nina` | `Diario_Femenil.png` | panel Niña |
| `diario-nino` | `Diario_Varonil.png` | panel Niño; suéter cerrado |
| `deportes-nina` / `deportes-nino` | `Deportes_Femenil2.png` / `Deportes_Varonil.png` | banda Deportes |
| `polo-escudo` | `polo-hombre-diario3-hd.png` | detalle del escudo |
| `jumper-nina` | `Jumper-diario-niña.jpg` | jumper |
| `polo-diario-nino` / `polo-diario-nina` | `polo-diario-hombre.png` / `polo-diario-mujer.png` | polo diario niño / niña |
| `sueter-abierto-nina` | `sudadera_abierta-diario-mujer.jpg` | suéter abierto niña |
| `calcetas-blancas` / `calcetas-grises` | `Calcetas-diario-blancas.jpg` / `Calcetas-diario-grises.jpg` | calcetas niña / niño |
| `pantalon-diario-nino` | `pantalon-diario-hombre.png` | pantalón de diario niño |
| `cinturon-nino` | `Cinturon-diario-hombre.jpg` | cinturón niño |
| `sudadera-relieve` | `Sudadera_relieve-deportes-unisex.png` | sudadera con relieve |
| `chamarra-deportes` | `chamarra_abierta-deportes-unisex.jpg` | chamarra de deportes |
| `pants-deportes` | `pants-deportes-unisex (2).png` | pants de deportes |
| `playera-amigos-de-jesus` | `Gemini_Generated_Image_ygeeo2….jpg` | playera Amigos de Jesús, línea Kinder |
| `sin-foto` | (generada con ffmpeg) | prendas sin foto todavía |
| `patio-abrazo` | `Patio.png` | «Sin filas» |

Varias prendas comparten foto: en `productos.json`, `focus` (posición) y `zoom` encuadran cada prenda en su tarjeta.
Cuando haya foto propia por prenda, basta con cambiar `image` y dejar `focus: "50% 50%"`, `zoom: 1`.

## Estructura de carpetas

```
zarem.mx/
├── CNAME · .nojekyll · .gitignore · .env.example · robots.txt · sitemap.xml
├── README.md                     este archivo
├── index.html                    zarem.mx/: una pantalla, una tarjeta por colegio (CLIENTS), logo «Casa de confección»
├── 404.html                      página no encontrada + redirecciones (MOVED; /pages/* → /colegio_la_florida/*)
├── cum/index.html                CUM: «próximamente» (logo y menú ya personalizados)
│
├── css/site.css                  UNA hoja de estilos
├── js/
│   ├── tailwind.config.js        paleta y tipografías
│   ├── layout.jsx                TODAS las páginas: CLIENTS (colegios) y CLIENT (el abierto según la URL), BRAND,
│   │                             cabecera, menú lateral «Colegios» (carpeta por colegio), pie, bolsa (bag),
│   │                             useParallax, useReveal, WhatsApp, cookies, PageHero, LegalPage, renderPage()
│   └── tienda.jsx                capa de datos `db`, useCatalog, priceBag (bordado, envío), Photo (encuadre),
│                                 ProductCard, ProductPage, BagDrawer, ORDER_ENDPOINT
│
├── img/portada/*.webp           escenas: modelos actuando con uniforme, bodegón de producto, fotos de los colegios
├── img/seccion/*.webp           modelos con uniforme (estudio o pose)
├── img/producto/*.webp          prenda sola: doblada, colgada o extendida
│                                (originales PNG / JPG junto a cada WebP, fuera de Git)
├── supabase/                     BASE DE DATOS REAL (Etapa 2): esquema + RLS + stock por variante — ver supabase/README.md
├── tools/generar-paginas-producto.py   crea colegio_la_florida/tienda/<slug>/ y sitemap.xml
│
├── colegio_la_florida/           TIENDA DEL COLEGIO LA FLORIDA (todo lo de la escuela vive aquí)
│   ├── index.html                inicio: héroe parallax, Niña/Niño, CATÁLOGO completo (#catalogo: línea →
│   │                             subcategorías → 19 tarjetas con foto, tallas y precio), deportes, escudo, «Sin filas»
│   ├── db/                       BASE DE DATOS SIMULADA — ver colegio_la_florida/db/README.md
│   │   ├── colecciones.json      líneas (diario, deportes, kinder) y tipos de prenda
│   │   ├── productos.json        19 prendas, 246 variantes (talla, folio de Odoo, precio con IVA); generado desde Catalogo.xlsx
│   │   └── tienda.json           bordado, métodos de entrega y formas de pago permitidas en cada uno
│   ├── tienda/                   filtros ?corte=nina|nino, ?linea=diario|deportes|kinder, ?tipo=<subcategoría>
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
| `colegio_la_florida/`: `index.html`, `tienda/`, `tienda/<slug>/`, `bolsa/`, `como-comprar/` | ✓ | ✓ |
| `colegio_la_florida/`: `contacto/`, `terminos/`, `privacidad/` · `index.html` · `cum/` · `404.html` | ✓ | |

## Cómo funciona la compra (Etapa 1)

1. Ficha: talla (+ nombre a bordar) + cantidad → `bag.add()` guarda `{ productId, size, name, qty }` en `za-bolsa-<colegio>` y abre el cajón.
2. Bolsa: `priceBag()` recalcula desde el catálogo: prendas + bordado ($60 por prenda con nombre) + envío
   (gratis en tienda; $149 a domicilio, gratis desde $2,000).
3. Forma de pago según la entrega (`tienda.json`): **recoger en tienda → tarjeta o efectivo**; **domicilio → tarjeta u OXXO**.
4. Confirmar: `db.createOrder()` guarda el pedido en `za-pedidos` y abre WhatsApp; la tienda responde con la liga de
   pago o la ficha de OXXO. Etapa 2: Edge Function + Stripe / Mercado Pago (ver `supabase/README.md`).

## Cambios habituales

- **Teléfono, WhatsApp, email, dirección y horario de la tienda**: `BRAND` en `js/layout.jsx` (todos `[verificar]`).
- **Colegios** (tarjetas del inicio, logo, menú lateral): `CLIENTS` en `js/layout.jsx` — `name`, `base` (carpeta),
  `cover` (foto de la tarjeta), `menu` (páginas que se despliegan en «Colegios»), `soon` (sin tienda aún).
  Un colegio nuevo = una entrada en `CLIENTS` + su carpeta. Pie: `footerColumns()` en `js/layout.jsx`.
- **Fotos**: `img/portada/` (escenas con modelos actuando y bodegón: producto puesto en escena), `img/seccion/` (modelos
  con uniforme), `img/producto/` (prenda suelta, doblada o colgada). Original y WebP van juntos en la misma carpeta.
- **Prendas, precios, tallas**: se editan en `Catalogo.xlsx` (Odoo, `builds/Odoo/Odoo_catalogues/zarem.mx/`) y se importan con
  `~/.venvs/xl/bin/python tools/importar-catalogo.py` (necesita openpyxl); foto, textos, línea y tipo de cada prenda: `PRODUCTS`
  en ese script. Después `python tools/generar-paginas-producto.py`. El script también escribe la URL de la foto en la columna
  `imagen` del catálogo.
- **Bordado, envíos, formas de pago**: `colegio_la_florida/db/tienda.json` (y el texto de `colegio_la_florida/terminos/`).
- **Guía de tallas**: `SIZES` en `colegio_la_florida/como-comprar/index.html`.
- **Velocidad del parallax**: atributo `data-speed` de cada `.parallax` (0 = fija; 0.25 = la más marcada del sitio).

## Claves de almacenamiento local

`za-bolsa-<id del colegio>` (una bolsa por colegio) · `za-pedidos` (pedidos enviados desde este navegador) · `za-cookies`.

## Hoja de ruta (ver `../ARQUITECTURA-WEB-ETAPAS.md`)

| Etapa | Zarem · Colegio La Florida |
|---|---|
| 1 | Este sitio. Pendiente del cliente: precios y tallas reales, dirección y horario de la tienda, foto por prenda, nombre oficial del colegio («Colegio Teresiano La Florida» en el escudo) y autorización para usar escudo y fotos |
| 2 | Supabase: stock por talla, pago en línea (tarjeta y OXXO con Stripe / Mercado Pago), aviso automático de «pedido listo» |
| 3 | Odoo: inventario del taller y CFDI 4.0 |
| 5 | WhatsApp Business API para avisos; preventa del siguiente ciclo escolar |

## Versiones

### 1.3.0 — 2026-10-10 · Catálogo real desde Odoo
- `productos.json` se genera desde `Catalogo.xlsx` (`tools/importar-catalogo.py`): 19 prendas y 246 variantes, cada talla
  con su folio de Odoo y su precio. Polo diario, polo deportes y calcetas por separado para niña y niño.
- Precio por talla: tarjetas con «Desde $…», la ficha muestra el precio y el folio de la talla elegida; bolsa y pedido
  usan el precio de cada talla.
- Nueva línea Kinder (bata, playera y chamarra Amigos de Jesús). Paquetes desactivados (no están en Odoo).
- Fichas antiguas redirigidas desde `404.html`. Portada del colegio con foto de estudio.

### 1.2.0 — 2026-10-10 · Zarem, casa de confección: un sitio, una tienda por colegio
- `zarem.mx/` pasa a ser una pantalla sin scroll con dos tarjetas: Colegio La Florida (foto del edificio) y CUM.
- Toda la tienda del Colegio La Florida se mueve a `/colegio_la_florida/` (antes `/` y `/pages/*`; datos en
  `colegio_la_florida/db/`). `404.html` redirige las ligas viejas `/pages/*`.
- El logo se personaliza: «Casa de confección» sin colegio, nombre del colegio dentro de su tienda.
- Menú lateral con la categoría «Colegios»: cada colegio se despliega como carpeta con sus páginas.
- Bolsa separada por colegio (`za-bolsa-<id>`); CUM con página «próximamente».
- Inicio del colegio con el catálogo completo por línea y subcategoría; tarjetas con rango de tallas; filtro
  de subcategoría (`?tipo=`) en la tienda; `js/tienda.jsx` usa `CLIENT.base` (sin rutas fijas del colegio).
- Corregido: «Cómo comprar» se salía de la pantalla en el celular (tabla de tallas).

### 1.1.0 — 2026-10-08 · Tienda del Colegio La Florida, estilo minimalista de moda
- El sitio pasa a ser la tienda de uniformes del Colegio La Florida (sustituye la página única anterior de zarem.mx).
- Diseño minimalista (estilo Zara): fotos de borde a borde, parallax, etiquetas en mayúsculas, cabecera sobre la foto.
- 11 prendas y 4 paquetes con fotos reales en WebP, encuadre por prenda, bordado de nombre, entrega en tienda o
  domicilio, pago con tarjeta, OXXO o efectivo según la entrega.
- Páginas Cómo comprar (pasos, entrega, pagos, tallas, bordado, cambios), contacto, términos y privacidad.

### 1.0.0 — 2026-10-08 · Primera versión (no publicada)
- Sitio de marca de uniformes corporativos, hospitalidad y salud, en tonos azules. Sustituido por la 1.1.0.
