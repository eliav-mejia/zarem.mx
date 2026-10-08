// Shop only (index, /pages/tienda/, product pages, /pages/bolsa/, /pages/empresas/, /pages/confeccion/).
// Data layer (db), catalogue hook, pricing, garment illustration, cards, product page, bag drawer and orders.

// --- DATA LAYER ---
// The ONLY place that knows where data comes from. Today: static JSON in /public/db (Etapa 1).
// Etapa 2: replace the bodies of db.* with Supabase queries / Edge Functions and keep the same return shapes;
// nothing else changes (supabase/README.md).
const DB_BASE = '/public/db';
const jsonCache = {};
const loadJson = (name) => jsonCache[name] || (jsonCache[name] =
    fetch(`${DB_BASE}/${name}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); }));

// Where company requests (and, optionally, a copy of each order) are posted. null = WhatsApp only (Etapa 1).
// The endpoint is public: it must validate, limit size and rate-limit.
const LEAD_ENDPOINT = null;

const postLead = (payload) => LEAD_ENDPOINT
    ? fetch(LEAD_ENDPOINT, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }).catch(() => {})
    : Promise.resolve();

const db = {
    catalog: () => Promise.all([loadJson('colecciones'), loadJson('productos'), loadJson('telas'), loadJson('tienda')]).then(([c, p, f, rules]) => ({
        lines: c.lines,
        types: [...c.types].sort((a, b) => a.sort_order - b.sort_order),
        products: p.products.filter(x => x.active !== false),
        fabrics: f.fabrics,
        rules,
    })),

    // Etapa 1: the order is saved in this browser ('za-pedidos') and confirmed by WhatsApp; payment is arranged by hand.
    // Etapa 2: POST the bag (ids + qty only) to an Edge Function that re-prices it from the database, creates
    // `orders` / `order_items` and returns a Stripe / Mercado Pago checkout URL. Never trust browser prices.
    createOrder: async ({ customer, shippingId, priced }) => {
        const order = {
            id: `ZA-${Date.now().toString(36).toUpperCase()}`,
            created_at: new Date().toISOString(),
            status: 'por-confirmar',
            customer, shipping_id: shippingId,
            lines: priced.lines.map(l => ({ sku: l.product.sku, name: l.product.name, color: l.color?.name, size: l.size, embroidery: !!l.embroidery, qty: l.qty, unit_mxn: l.product.price_mxn })),
            pieces: priced.pieces, subtotal: priced.subtotal, discount: priced.discount, embroidery: priced.embroidery, shipping: priced.shipping, total: priced.total,
        };
        store.write('za-pedidos', [order, ...store.read('za-pedidos', [])]);
        postLead({ type: 'pedido', ...order });
        return order;
    },
    ordersInThisBrowser: () => store.read('za-pedidos', []),

    // Company programme request (/pages/empresas/).
    submitCompanyRequest: async (request) => {
        const saved = { ...request, id: `EMP-${Date.now().toString(36).toUpperCase()}`, created_at: new Date().toISOString() };
        store.write('za-solicitudes', [saved, ...store.read('za-solicitudes', [])]);
        await postLead({ type: 'empresa', ...saved });
        return saved;
    },
};

const useCatalog = () => {
    const [state, setState] = useState({ status: 'loading', lines: [], types: [], products: [], fabrics: [], rules: null });
    useEffect(() => {
        let alive = true;
        db.catalog()
            .then(d => alive && setState({ status: 'ready', ...d }))
            .catch(err => { console.error('[tienda] No se pudo cargar el catálogo:', err); alive && setState(s => ({ ...s, status: 'error' })); });
        return () => { alive = false; };
    }, []);
    return useMemo(() => {
        const colors = {};
        state.fabrics.forEach(f => f.colors.forEach(c => { colors[c.id] = c; }));
        return {
            ...state,
            colors,
            byId: Object.fromEntries(state.products.map(p => [p.id, p])),
            bySlug: Object.fromEntries(state.products.map(p => [p.slug, p])),
            line: Object.fromEntries(state.lines.map(l => [l.id, l])),
            type: Object.fromEntries(state.types.map(t => [t.id, t])),
            fabric: Object.fromEntries(state.fabrics.map(f => [f.id, f])),
        };
    }, [state]);
};

// --- PRICING ---
// Same rules the server will apply in Etapa 2 (tienda.json). Prices include IVA.
//   discount: by total pieces in the bag (volume tiers), on garments only, not on embroidery or shipping
//   embroidery: per piece + one set-up fee per order (digitising the logo)
//   shipping: free above the method's threshold, measured after discount
const tierFor = (rules, pieces) => [...rules.volume_tiers].sort((a, b) => b.min_qty - a.min_qty).find(t => pieces >= t.min_qty) || { min_qty: 1, pct: 0 };
const nextTier = (rules, pieces) => [...rules.volume_tiers].sort((a, b) => a.min_qty - b.min_qty).find(t => t.min_qty > pieces) || null;

const priceBag = (lines, rules, shippingId = 'cdmx') => {
    const pieces = lines.reduce((a, l) => a + l.qty, 0);
    const tier = tierFor(rules, pieces);
    const subtotal = lines.reduce((a, l) => a + l.qty * l.product.price_mxn, 0);
    const discount = Math.round(subtotal * tier.pct / 100);
    const embPieces = lines.filter(l => l.embroidery).reduce((a, l) => a + l.qty, 0);
    const embroidery = embPieces ? embPieces * rules.embroidery_mxn + rules.embroidery_setup_mxn : 0;
    const method = rules.shipping.find(s => s.id === shippingId) || rules.shipping[0];
    const goods = subtotal - discount;
    const shipping = pieces === 0 || (method.free_from_mxn && goods >= method.free_from_mxn) ? 0 : method.cost_mxn;
    return { lines, pieces, tier, next: nextTier(rules, pieces), subtotal, discount, embroidery, embPieces, method, shipping, total: goods + embroidery + shipping };
};

// Bag lines resolved against the catalogue (unknown or inactive products are dropped).
const useBagLines = (catalog) => useBag()
    .map(l => ({ ...l, product: catalog.byId[l.productId], color: catalog.colors[l.colorId] }))
    .filter(l => l.product);

const FIT_LABEL = { dama: 'Dama', caballero: 'Caballero', unisex: 'Unisex' };
const availabilityLabel = (p) => (p.availability === 'existencia' ? 'En existencia · sale en 2 días hábiles' : `Sobre pedido · ${p.lead_days} días hábiles`);

// --- GARMENT ILLUSTRATION ---
// Flat SVG drawn in the chosen colour, so the shop works without photos. When photos exist, add
// `images: { <colorId>: "/img/prendas/<id>-<color>.webp" }` to the product and render <img> here.
const GARMENT_SHAPES = {
    sacos: (c, s) => <g>
        <path d="M70 30 L100 62 L130 30 L162 44 L182 120 L174 200 L156 200 L152 124 L150 214 L50 214 L48 124 L44 200 L26 200 L18 120 L38 44 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M80 32 L100 112 L120 32 Z" fill="#f6f9fd" stroke={s} />
        <path d="M70 30 L94 128 M130 30 L106 128" stroke={s} strokeWidth="2" fill="none" />
        <circle cx="100" cy="146" r="3.5" fill={s} /><circle cx="100" cy="170" r="3.5" fill={s} />
        <path d="M60 160 h22 M118 160 h22 M128 96 h14" stroke={s} strokeWidth="2" />
    </g>,
    pantalones: (c, s) => <g>
        <path d="M62 24 H138 L152 222 H110 L100 92 L90 222 H48 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M62 38 H138" stroke={s} strokeWidth="2" /><path d="M100 38 V92 M78 40 L74 222 M122 40 L126 222" stroke={s} strokeWidth="1" opacity=".5" />
    </g>,
    faldas: (c, s) => <g>
        <rect x="64" y="34" width="72" height="14" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M64 48 H136 L150 206 H50 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M100 176 V206" stroke={s} strokeWidth="2" /><path d="M82 50 L80 120 M118 50 L120 120" stroke={s} opacity=".45" />
    </g>,
    blusas: (c, s) => <g>
        <path d="M74 30 L100 50 L126 30 L160 46 L180 146 L160 152 L146 90 L150 204 H50 L54 90 L40 152 L20 146 L40 46 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M74 30 L100 50 L88 66 Z M126 30 L100 50 L112 66 Z" fill={c} stroke={s} strokeWidth="1.2" />
        <path d="M100 50 V204" stroke={s} opacity=".5" /><path d="M20 146 L40 152 M180 146 L160 152" stroke={s} strokeWidth="5" />
    </g>,
    camisas: (c, s) => <g>
        <path d="M76 30 L100 48 L124 30 L160 44 L180 160 L162 164 L148 92 L150 212 H50 L52 92 L38 164 L20 160 L40 44 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M76 30 L100 48 L90 62 Z M124 30 L100 48 L110 62 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M100 48 V212" stroke={s} />
        {[76, 104, 132, 160, 188].map(y => <circle key={y} cx="104" cy={y} r="2.2" fill={s} />)}
        <rect x="118" y="86" width="20" height="18" fill="none" stroke={s} opacity=".6" />
    </g>,
    chalecos: (c, s) => <g>
        <path d="M72 28 L100 92 L128 28 L150 40 L146 102 L154 202 L100 216 L46 202 L54 102 L50 40 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M80 30 L100 92 L120 30 Z" fill="#f6f9fd" stroke={s} />
        <path d="M100 92 V214" stroke={s} />
        {[110, 130, 150, 170, 190].map(y => <circle key={y} cx="104" cy={y} r="2.6" fill={s} />)}
        <path d="M62 140 h22 M116 140 h22" stroke={s} strokeWidth="2" />
    </g>,
    filipinas: (c, s) => <g>
        <path d="M78 28 L100 34 L122 28 L160 44 L182 158 L162 164 L148 92 L150 212 H50 L52 92 L38 164 L18 158 L40 44 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M78 28 Q100 46 122 28 L122 20 Q100 30 78 20 Z" fill={c} stroke={s} strokeWidth="1.4" />
        <path d="M78 36 L132 74 L132 212" stroke={s} fill="none" strokeWidth="1.4" />
        {[86, 118, 150, 182].map(y => <g key={y}><circle cx="120" cy={y} r="3" fill="none" stroke={s} strokeWidth="1.4" /><circle cx="80" cy={y} r="3" fill="none" stroke={s} strokeWidth="1.4" /></g>)}
        <path d="M150 70 h10 v18 h-10" fill="none" stroke={s} opacity=".6" />
    </g>,
    mandiles: (c, s) => <g>
        <path d="M74 40 H126 L128 96 Q150 98 152 112 L150 214 H50 L48 112 Q50 98 72 96 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M74 40 L52 8 M126 40 L148 8" stroke="#6b4f3a" strokeWidth="4" strokeLinecap="round" />
        <path d="M60 140 H140 V176 H60 Z M100 140 V176" fill="none" stroke={s} strokeWidth="1.4" />
        <path d="M58 132 H142" stroke={s} strokeDasharray="4 3" opacity=".7" />
    </g>,
    clinicos: (c, s) => <g>
        <path d="M74 26 L100 72 L126 26 L156 38 L178 92 L158 102 L148 78 L148 134 H52 L52 78 L42 102 L22 92 L44 38 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M74 26 L100 72 L126 26" fill="none" stroke={s} strokeWidth="2" />
        <path d="M60 104 h24 v20 h-24 Z M118 52 h16 v14 h-16 Z" fill="none" stroke={s} opacity=".6" />
        <path d="M58 140 H142 L146 226 H108 L100 168 L92 226 H54 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M58 148 H142" stroke={s} strokeDasharray="3 3" /><path d="M56 222 H92 M108 222 H144" stroke={s} strokeWidth="3" />
    </g>,
    bata: (c, s) => <g>
        <path d="M74 22 L100 58 L126 22 L160 36 L182 150 L162 156 L150 86 L156 228 H44 L50 86 L38 156 L18 150 L40 36 Z" fill={c} stroke={s} strokeWidth="1.5" />
        <path d="M74 22 L94 110 M126 22 L106 110" stroke={s} strokeWidth="2" fill="none" />
        <path d="M100 110 V228" stroke={s} />
        {[124, 150, 176].map(y => <circle key={y} cx="104" cy={y} r="2.6" fill={s} />)}
        <path d="M58 156 h26 v26 h-26 Z M118 156 h26 v26 h-26 Z M118 80 h20" fill="none" stroke={s} opacity=".6" />
    </g>,
};

const Garment = ({ product, color, className = '' }) => {
    const hex = color ? color.hex : '#1b2a4a';
    const shape = GARMENT_SHAPES[product.shape || product.type_id] || GARMENT_SHAPES.sacos;
    return (
        <svg viewBox="0 0 200 240" className={className} role="img" aria-label={`${product.name}${color ? `, ${color.name}` : ''}`}>
            <ellipse cx="100" cy="230" rx="64" ry="5" fill="#0b1b34" opacity=".07" />
            {shape(hex, 'rgba(7,18,38,.38)')}
        </svg>
    );
};

const Swatch = ({ color, active, onClick, size = 'w-6 h-6' }) => (
    <button type="button" onClick={onClick} title={color.name} aria-label={color.name} aria-pressed={active}
        className={`${size} rounded-full border transition-shadow ${active ? 'ring-2 ring-offset-2 ring-zafiro border-zafiro' : 'border-noche-line hover:ring-2 hover:ring-acero-300'}`}
        style={{ background: color.hex }} />
);

// --- CARD ---
const ProductCard = ({ product, catalog }) => {
    const [colorId, setColorId] = useState(product.color_ids[0]);
    const color = catalog.colors[colorId];
    const href = `/pages/tienda/${product.slug}/?color=${colorId}`;
    return (
        <article className="reveal group flex flex-col">
            <a href={href} className="block rounded-2xl ice-wash aspect-[5/6] relative overflow-hidden">
                <Garment product={product} color={color} className="absolute inset-0 w-full h-full p-8 transition-transform duration-700 group-hover:scale-[1.04]" />
                <span className="absolute top-4 left-4 kicker text-acero-600">{FIT_LABEL[product.fit]}</span>
                {product.availability !== 'existencia' && <span className="absolute top-3.5 right-4 kicker bg-white/90 px-2.5 py-1 rounded-full">Sobre pedido</span>}
            </a>
            <div className="pt-4 flex-1 flex flex-col">
                <p className="kicker text-acero-400">{catalog.type[product.type_id]?.label} · {catalog.line[product.line_id]?.label}</p>
                <h3 className="text-2xl mt-1.5"><a href={href} className="hover:text-zafiro">{product.name}</a></h3>
                <p className="text-sm text-acero-600 mt-1 flex-1">{product.short}</p>
                <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-1.5" role="group" aria-label="Colores">
                        {product.color_ids.map(id => catalog.colors[id] && <Swatch key={id} color={catalog.colors[id]} active={id === colorId} onClick={() => setColorId(id)} size="w-5 h-5" />)}
                    </div>
                    <p className="font-display text-xl">{formatMXN(product.price_mxn)}</p>
                </div>
            </div>
        </article>
    );
};

const GridSkeleton = ({ n = 4 }) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
        {Array.from({ length: n }, (_, i) => <div key={i} className="animate-pulse"><div className="rounded-2xl bg-hielo-100 aspect-[5/6]" /><div className="h-4 bg-hielo-100 rounded mt-4 w-1/2" /><div className="h-6 bg-hielo-100 rounded mt-2" /></div>)}
    </div>
);

const LoadError = () => <p className="text-center text-acero-600 py-16">No pudimos cargar el catálogo. Recarga la página en un momento.</p>;

// Per-piece price at each volume tier: shown on product pages and the company page.
const VolumeTable = ({ price, rules, pieces = 0 }) => {
    const current = tierFor(rules, pieces);
    return (
        <table className="w-full text-sm">
            <thead><tr className="text-left kicker text-acero-400"><th className="pb-2 font-semibold">Piezas en tu bolsa</th><th className="pb-2 font-semibold">Descuento</th><th className="pb-2 font-semibold text-right">Por pieza</th></tr></thead>
            <tbody>
                {rules.volume_tiers.map((t, i) => {
                    const next = rules.volume_tiers[i + 1];
                    const active = t.min_qty === current.min_qty;
                    return (
                        <tr key={t.min_qty} className={`border-t border-noche-line ${active ? 'text-zafiro font-semibold' : ''}`}>
                            <td className="py-2">{next ? `${t.min_qty} – ${next.min_qty - 1}` : `${t.min_qty}+`}{active && pieces > 0 && ' · tú'}</td>
                            <td className="py-2">{t.pct ? `${t.pct} %` : '—'}</td>
                            {price != null && <td className="py-2 text-right">{formatMXN(Math.round(price * (100 - t.pct) / 100))}</td>}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

// --- PRODUCT PAGE ---
// Each /pages/tienda/<slug>/index.html calls renderProduct(); the slug comes from the URL, the colour from ?color=.
const ProductPage = () => {
    const catalog = useCatalog();
    const inBag = useBagLines(catalog);
    const slug = window.location.pathname.split('/').filter(Boolean).pop();
    const product = catalog.bySlug[slug];
    const [colorId, setColorId] = useState(new URLSearchParams(window.location.search).get('color'));
    const [size, setSize] = useState(null);
    const [qty, setQty] = useState(1);
    const [embroidery, setEmbroidery] = useState(false);
    const [needSize, setNeedSize] = useState(false);
    const [tab, setTab] = useState('detalles');

    useEffect(() => {
        if (!product) return;
        if (!product.color_ids.includes(colorId)) setColorId(product.color_ids[0]);
        if (product.sizes.length === 1) setSize(product.sizes[0]);
    }, [product]);

    if (catalog.status === 'loading') return <div className="max-w-6xl mx-auto px-4 py-20"><GridSkeleton n={2} /></div>;
    if (catalog.status === 'error') return <LoadError />;
    if (!product) return (
        <PageHero kicker="Tienda" title="Prenda" accent="no encontrada" intro="Puede que ya no esté en catálogo.">
            <a href="/pages/tienda/" className="btn btn-dark mt-8">Ver la tienda</a>
        </PageHero>
    );

    const { rules } = catalog;
    const color = catalog.colors[colorId] || catalog.colors[product.color_ids[0]];
    const fabrics = product.fabric_ids.map(id => catalog.fabric[id]).filter(Boolean);
    const related = catalog.products.filter(p => p.id !== product.id && p.line_id === product.line_id).slice(0, 4);
    const pieces = inBag.reduce((a, l) => a + l.qty, 0);
    const pickColor = (id) => {
        setColorId(id);
        const url = new URL(window.location); url.searchParams.set('color', id); history.replaceState(null, '', url);
    };
    const add = () => {
        if (!size) { setNeedSize(true); return; }
        bag.add({ productId: product.id, colorId: color.id, size, embroidery, qty });
        setQty(1);
    };

    const tabs = [
        { id: 'detalles', label: 'Detalles', body: <ul className="space-y-2">{product.features.map(f => <li key={f} className="flex gap-3"><IconCheck className="w-5 h-5 text-acero shrink-0" />{f}</li>)}</ul> },
        { id: 'tela', label: 'Tela y cuidados', body: (
            <div className="space-y-3">{fabrics.map(f => (
                <div key={f.id} className="rounded-xl border border-noche-line p-4">
                    <p className="font-medium text-noche">{f.name} <span className="text-sm text-acero-400 font-normal">· {f.weight} · {f.origin}</span></p>
                    <p className="text-sm">{f.composition}. {f.feel}</p>
                    <p className="text-xs text-acero-400 mt-1">{f.care}</p>
                </div>
            ))}<p className="text-xs text-acero-400">Elige la tela al confirmar tu pedido; el precio es el mismo.</p></div>) },
        { id: 'envios', label: 'Envíos y ajustes', body: (
            <ul className="space-y-2 text-sm">
                {rules.shipping.map(s => <li key={s.id}><strong className="text-noche">{s.label}</strong> · {s.detail} · {s.cost_mxn ? `${formatMXN(s.cost_mxn)}${s.free_from_mxn ? `, gratis desde ${formatMXN(s.free_from_mxn)}` : ''}` : 'sin costo'}</li>)}
                <li>Primer ajuste de largo de manga o dobladillo <strong className="text-noche">sin costo</strong> en el taller. <a href="/pages/terminos/#cambios" className="underline">Cambios y ajustes</a></li>
            </ul>) },
    ];

    return (
        <>
            <section className="max-w-7xl mx-auto px-4 md:px-8 pt-8 md:pt-12 pb-16 grid md:grid-cols-2 gap-10 md:gap-16 items-start">
                <div className="md:sticky md:top-28 rounded-3xl ice-wash aspect-square relative animate-fade-in">
                    <Garment product={product} color={color} className="absolute inset-0 w-full h-full p-10 md:p-16" />
                    <p className="absolute bottom-5 left-5 text-sm bg-white/90 rounded-full px-3.5 py-1.5">{color.name}</p>
                    <p className="absolute bottom-5 right-5 text-xs text-acero-400">Ilustración de referencia</p>
                </div>
                <div className="animate-rise-in">
                    <nav className="text-sm text-acero-400 mb-6" aria-label="Ruta">
                        <a href="/pages/tienda/" className="hover:text-noche">Tienda</a> / <a href={`/pages/tienda/?linea=${product.line_id}`} className="hover:text-noche">{catalog.line[product.line_id].label}</a> / {catalog.type[product.type_id].label}
                    </nav>
                    <p className="kicker text-acero">{FIT_LABEL[product.fit]} · {product.sku}</p>
                    <h1 className="text-5xl md:text-6xl mt-2">{product.name}</h1>
                    <p className="font-display text-3xl mt-4">{formatMXN(product.price_mxn)} <span className="font-sans text-xs text-acero-400 align-middle">IVA incluido</span></p>
                    <p className="text-lg text-acero-600 mt-5 leading-relaxed">{product.description}</p>

                    <div className="mt-8">
                        <p className="kicker text-acero-600 mb-3">Color · <span className="normal-case tracking-normal font-normal">{color.name}</span></p>
                        <div className="flex flex-wrap gap-3">{product.color_ids.map(id => catalog.colors[id] && <Swatch key={id} color={catalog.colors[id]} active={id === color.id} onClick={() => pickColor(id)} size="w-9 h-9" />)}</div>
                    </div>

                    <div className="mt-7">
                        <div className="flex justify-between items-baseline mb-3">
                            <p className={`kicker ${needSize && !size ? 'text-red-700' : 'text-acero-600'}`}>Talla{needSize && !size ? ' · elige una' : ''}</p>
                            <a href="/pages/confeccion/#tallas" className="text-xs underline text-acero-600">Guía de tallas</a>
                        </div>
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Talla">
                            {product.sizes.map(s => (
                                <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => { setSize(s); setNeedSize(false); }}
                                    className={`min-w-[3rem] h-11 px-3 rounded-lg border text-sm transition-colors ${size === s ? 'bg-noche text-white border-noche' : 'border-noche-line hover:border-noche'}`}>{s}</button>
                            ))}
                        </div>
                    </div>

                    {product.embroidery && (
                        <label className="mt-6 flex gap-3 items-start rounded-xl border border-noche-line p-4 cursor-pointer hover:border-acero-300">
                            <input type="checkbox" checked={embroidery} onChange={e => setEmbroidery(e.target.checked)} className="mt-1 accent-[#1e3a6e]" />
                            <span className="text-sm"><strong>Bordar logotipo o nombre</strong> · +{formatMXN(rules.embroidery_mxn)} por pieza
                                <span className="block text-acero-400 text-xs mt-0.5">Más {formatMXN(rules.embroidery_setup_mxn)} por pedido para digitalizar tu logotipo. Te pedimos el archivo al confirmar. Agrega 3 días hábiles.</span></span>
                        </label>
                    )}

                    <div className="flex gap-3 mt-6">
                        <div className="flex items-center border border-noche-line rounded-full">
                            <button className="w-11 h-12 text-lg" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Menos">−</button>
                            <input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-12 text-center bg-transparent focus:outline-none" aria-label="Piezas" />
                            <button className="w-11 h-12 text-lg" onClick={() => setQty(q => q + 1)} aria-label="Más">+</button>
                        </div>
                        <button className="btn btn-blue flex-1" onClick={add}><IconBag className="w-4 h-4" /> Agregar a la bolsa</button>
                    </div>
                    <p className="text-sm text-acero-600 mt-4 flex gap-2 items-center"><IconTruck className="w-4 h-4" /> {availabilityLabel(product)}</p>

                    <div className="mt-8 rounded-2xl bg-hielo-50 border border-noche-line p-5">
                        <p className="kicker text-acero-600 mb-3">Precio por volumen · combina prendas, tallas y colores</p>
                        <VolumeTable price={product.price_mxn} rules={rules} pieces={pieces} />
                        <p className="text-xs text-acero-400 mt-3">Más de {rules.company_from_qty} piezas o diseño propio: <a href="/pages/empresas/" className="underline">programa para empresas</a>.</p>
                    </div>

                    <div className="mt-10">
                        <div className="flex gap-6 border-b border-noche-line overflow-x-auto no-scrollbar" role="tablist">
                            {tabs.map(t => (
                                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                                    className={`kicker pb-3 -mb-px border-b-2 shrink-0 ${tab === t.id ? 'border-zafiro text-noche' : 'border-transparent text-acero-400'}`}>{t.label}</button>
                            ))}
                        </div>
                        <div className="pt-6 text-acero-600 leading-relaxed" role="tabpanel">{tabs.find(t => t.id === tab).body}</div>
                    </div>
                </div>
            </section>

            {related.length > 0 && (
                <section className="max-w-7xl mx-auto px-4 md:px-8 py-14">
                    <SectionTitle kicker={`Línea ${catalog.line[product.line_id].label}`} accent="el conjunto">Completa</SectionTitle>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">{related.map(p => <ProductCard key={p.id} product={p} catalog={catalog} />)}</div>
                </section>
            )}
        </>
    );
};

const renderProduct = () => renderPage(ProductPage);

// --- BAG DRAWER ---
// Opens when something is added to the bag (event 'za-bolsa-abrir' from bag.add in layout.jsx).
const BagDrawer = () => {
    const catalog = useCatalog();
    const lines = useBagLines(catalog);
    const [openKey, setOpenKey] = useState(null);
    useEffect(() => {
        const onOpen = (e) => setOpenKey(e.detail);
        const onKey = (e) => { if (e.key === 'Escape') setOpenKey(null); };
        window.addEventListener('za-bolsa-abrir', onOpen);
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('za-bolsa-abrir', onOpen); window.removeEventListener('keydown', onKey); };
    }, []);
    if (!openKey || !catalog.rules) return null;
    const added = lines.find(l => l.key === openKey);
    const priced = priceBag(lines, catalog.rules);
    return (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Agregado a tu bolsa">
            <div className="absolute inset-0 bg-noche/40 animate-fade-in" onClick={() => setOpenKey(null)} />
            <aside className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl animate-slide-in flex flex-col">
                <div className="flex justify-between items-center px-6 h-20 border-b border-noche-line">
                    <p className="font-display text-2xl flex items-center gap-2"><IconCheck className="w-5 h-5 text-zafiro" /> En tu bolsa</p>
                    <button onClick={() => setOpenKey(null)} aria-label="Cerrar"><IconClose className="w-6 h-6" /></button>
                </div>
                {added && (
                    <div className="p-6 flex gap-4 border-b border-noche-line">
                        <div className="w-24 h-28 rounded-xl ice-wash shrink-0"><Garment product={added.product} color={added.color} className="w-full h-full p-2" /></div>
                        <div>
                            <p className="font-display text-xl">{added.product.name}</p>
                            <p className="text-sm text-acero-600">{added.color?.name} · Talla {added.size}{added.embroidery ? ' · Bordado' : ''}</p>
                            <p className="text-sm mt-1">{added.qty} {added.qty === 1 ? 'pieza' : 'piezas'} · {formatMXN(added.qty * added.product.price_mxn)}</p>
                        </div>
                    </div>
                )}
                <div className="p-6 space-y-2 text-sm flex-1">
                    <div className="flex justify-between"><span>{priced.pieces} piezas en tu bolsa</span><span>{formatMXN(priced.subtotal)}</span></div>
                    {priced.discount > 0 && <div className="flex justify-between text-zafiro"><span>Descuento por volumen ({priced.tier.pct} %)</span><span>−{formatMXN(priced.discount)}</span></div>}
                    {priced.next && <p className="text-xs text-acero-600 bg-hielo-50 rounded-lg p-3 mt-3">Agrega {priced.next.min_qty - priced.pieces} {priced.next.min_qty - priced.pieces === 1 ? 'pieza' : 'piezas'} más (cualquier prenda) y obtén {priced.next.pct} % de descuento.</p>}
                </div>
                <div className="p-6 border-t border-noche-line grid gap-3">
                    <a href="/pages/bolsa/" className="btn btn-blue">Ver bolsa y pagar</a>
                    <button className="btn btn-line" onClick={() => setOpenKey(null)}>Seguir comprando</button>
                </div>
            </aside>
        </div>
    );
};
