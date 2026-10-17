# SEO — zarem.mx

Guía de referencia: `builds/seo/seo-guide.pdf` (estructura HTML, meta etiquetas, H1–H3, nav + ul, alt de imágenes).
Este documento resume cómo se aplica en zarem.mx. Actualizado 2026-10-16.

## Estrategia

Zarem vende uniformes escolares oficiales por colegio. Cada colegio es una tienda propia bajo `/<colegio>/`,
así cada uno posiciona por su nombre.

| Sección | Público | Búsquedas objetivo |
|---|---|---|
| Portada `/` | Familias | Zarem, uniformes escolares, casa de confección |
| `/colegio_la_florida/` y `/tienda/` | Familias del Colegio La Florida | uniformes Colegio La Florida, polo, suéter, jumper, deportes, kinder |
| Fichas `/colegio_la_florida/tienda/<prenda>/` (21) | Familias que buscan una prenda | "<prenda> Colegio La Florida", tallas, precio |
| `/como-comprar/`, `/contacto/` | Familias decidiendo | cómo comprar, tallas, pago con tarjeta / OXXO, dirección de la tienda |
| `/cum/` | Familias del CUM | uniformes CUM (próximamente) |

Para un colegio nuevo: copiar la estructura de `colegio_la_florida/`, sumar sus URLs a `STATIC_PAGES` del generador y
usar el nombre completo del colegio en `<title>`, `<h1>` y descripción.

## Reglas para cada página

1. `<html lang="es-MX">`, `charset`, `viewport`.
2. `<title>` de **50–60 caracteres**: `<Página> · Uniformes <Colegio> · Zarem`.
3. `<meta name="description">` de **150–160 caracteres**, única.
4. `<link rel="canonical">` absoluta `https://zarem.mx/...` con barra final.
5. Open Graph + `twitter:card` (tabla abajo).
6. JSON-LD estático en el `<head>`.
7. Un solo `<h1>` renderizado; `<h2>` y `<h3>` en orden (las tarjetas de producto son `<h3>` bajo un `<h2>`).
8. React renderiza en el navegador: `<div id="root">` lleva un `<noscript>` con `<h1>`, resumen y enlaces.
9. Menús y migas como `<nav>` + `<ul>`/`<ol>` (`js/layout.jsx`, `js/tienda.jsx`).
10. Imágenes con `alt` descriptivo y nombre de archivo descriptivo (`colegio-la-florida-playera-polo-diario-nino.webp`).
11. Bolsa, pedido y 404: `noindex`, sin canonical, fuera del sitemap.

## Etiquetas usadas

| Tipo de página | og:type | twitter:card | JSON-LD | Dónde se genera |
|---|---|---|---|---|
| Portada | website | summary_large_image | `Organization` + `WebSite` | a mano, `index.html` |
| Páginas del colegio, CUM, legales | website | summary_large_image | `BreadcrumbList` | a mano |
| Ficha de prenda | product | summary_large_image | `Product` (precio MXN u `AggregateOffer` por talla, disponibilidad, audiencia) + `BreadcrumbList` | `tools/generar-paginas-producto.py` |

Comunes: `og:site_name` = Zarem, `og:locale` = es_MX, `og:image` = foto de la prenda o de portada.

## Archivos de rastreo

- `robots.txt`: bloquea crawlers de entrenamiento de IA y `/colegio_la_florida/bolsa/`; anuncia el sitemap.
- `sitemap.xml`: lo reescribe `tools/generar-paginas-producto.py` (páginas estáticas + fichas activas).

## Mantenimiento

| Cambio | Ejecuta |
|---|---|
| Prenda nueva o editada en `db/productos.json` | `python tools/generar-paginas-producto.py` (fichas + sitemap) |
| Página nueva | reglas 1–11 a mano y añadirla a `STATIC_PAGES` |

Tras publicar: enviar `https://zarem.mx/sitemap.xml` en Google Search Console y validar en
<https://search.google.com/test/rich-results>.

## Pendiente

- `BRAND` en `js/layout.jsx` tiene teléfono, dirección y email marcados `[verificar]`. Al confirmarlos, añadir
  `ClothingStore` con `address`, `telephone` y `openingHours` en `/colegio_la_florida/contacto/` y crear el perfil de
  Google Business con los mismos datos (nombre, dirección y teléfono idénticos en todas partes).
- `/cum/` es una página "próximamente": ampliar su contenido cuando abra la tienda.
