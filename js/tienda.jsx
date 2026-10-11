// Shop only, inside a school folder (<school>/, tienda/, product pages, bolsa/, como-comprar/). Paths use CLIENT.base.
// Data layer (db), catalogue hook, pricing, photo crop, product card, product page, bag drawer and orders.

// --- DATA LAYER ---
// The ONLY place that knows where data comes from. Today: static JSON in <school>/db (Etapa 1).
// Etapa 2: replace the bodies of db.* with Supabase queries / Edge Functions and keep the same return shapes;
// nothing else changes (supabase/README.md).
const DB_BASE = `${CLIENT.base}/db`;   // each school keeps its catalogue in <school>/db
const jsonCache = {};
const loadJson = (name) => jsonCache[name] || (jsonCache[name] =
    fetch(`${DB_BASE}/${name}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); }));

// Where a copy of each order is posted. null = WhatsApp only (Etapa 1). The endpoint is public: validate and rate-limit.
const ORDER_ENDPOINT = null;

const db = {
    catalog: () => Promise.all([loadJson('colecciones'), loadJson('productos'), loadJson('tienda')]).then(([c, p, rules]) => ({
        lines: c.lines,
        types: [...c.types].sort((a, b) => a.sort_order - b.sort_order),
        products: p.products.filter(x => x.active !== false),
        rules,
    })),

    // Etapa 1: the order is saved in this browser ('za-pedidos') and confirmed by WhatsApp; we send the payment link
    // (card) or OXXO slip by hand. Etapa 2: POST ids + qty to an Edge Function that re-prices from the database and
    // returns a Stripe / Mercado Pago checkout URL. Never trust browser prices.
    createOrder: async ({ customer, shippingId, paymentId, priced }) => {
        const order = {
            id: `ZA-${Date.now().toString(36).toUpperCase()}`,
            created_at: new Date().toISOString(),
            status: 'por-pagar',
            customer, shipping_id: shippingId, payment_id: paymentId,
            lines: priced.lines.map(l => ({ sku: skuOf(l.product, l.size), name: l.product.name, size: l.size, embroider: l.name || null, qty: l.qty, unit_mxn: unitPrice(l.product, l.size) })),
            pieces: priced.pieces, subtotal: priced.subtotal, embroidery: priced.embroidery, shipping: priced.shipping, total: priced.total,
        };
        store.write('za-pedidos', [order, ...store.read('za-pedidos', [])]);
        if (ORDER_ENDPOINT) fetch(ORDER_ENDPOINT, { method: 'POST', mode: 'no-cors', body: JSON.stringify(order) }).catch(() => {});
        return order;
    },
};

const useCatalog = () => {
    const [state, setState] = useState({ status: 'loading', lines: [], types: [], products: [], rules: null });
    useEffect(() => {
        let alive = true;
        db.catalog()
            .then(d => alive && setState({ status: 'ready', ...d }))
            .catch(err => { console.error('[tienda] No se pudo cargar el catálogo:', err); alive && setState(s => ({ ...s, status: 'error' })); });
        return () => { alive = false; };
    }, []);
    return useMemo(() => ({
        ...state,
        byId: Object.fromEntries(state.products.map(p => [p.id, p])),
        bySlug: Object.fromEntries(state.products.map(p => [p.slug, p])),
        line: Object.fromEntries(state.lines.map(l => [l.id, l])),
        type: Object.fromEntries(state.types.map(t => [t.id, t])),
    }), [state]);
};

// --- PRICING ---
// Price depends on the size: each product lists its `variants` (size, Odoo folio, price). `price_mxn` is the lowest.
const variantOf = (product, size) => (product.variants || []).find(v => v.size === size) || null;
const unitPrice = (product, size) => (variantOf(product, size) || product).price_mxn;
const skuOf = (product, size) => (variantOf(product, size) || product).sku;
// "$285" when every size costs the same, "Desde $285" otherwise.
const priceLabel = (product) => {
    const prices = (product.variants || []).map(v => v.price_mxn);
    return prices.length && Math.max(...prices) !== product.price_mxn ? `Desde ${formatMXN(product.price_mxn)}` : formatMXN(product.price_mxn);
};

// Same rules the server will apply in Etapa 2 (tienda.json). Prices include IVA.
//   embroidery: per piece that carries a student name
//   shipping: free above the method's threshold
const priceBag = (lines, rules, shippingId) => {
    const pieces = lines.reduce((a, l) => a + l.qty, 0);
    const subtotal = lines.reduce((a, l) => a + l.qty * unitPrice(l.product, l.size), 0);
    const embPieces = lines.filter(l => l.name).reduce((a, l) => a + l.qty, 0);
    const embroidery = embPieces * rules.embroidery_mxn;
    const method = rules.shipping.find(s => s.id === shippingId) || rules.shipping[0];
    const shipping = pieces === 0 || (method.free_from_mxn && subtotal >= method.free_from_mxn) ? 0 : method.cost_mxn;
    return { lines, pieces, subtotal, embroidery, embPieces, method, shipping, total: subtotal + embroidery + shipping };
};

// Bag lines resolved against the catalogue (unknown or inactive products are dropped).
const useBagLines = (catalog) => useBag()
    .map(l => ({ ...l, product: catalog.byId[l.productId] }))
    .filter(l => l.product);

const FIT_LABEL = { nina: 'Niña', nino: 'Niño', unisex: 'Niña y niño' };

// Short size range for cards: ['4'…'16','CH','M','G'] → "Tallas 4–16 · CH, M, G"; ['4-6'…'13-16'] → "Tallas 4–16".
const sizeRange = (sizes = []) => {
    const nums = sizes.filter(x => /^\d+(-\d+)?$/.test(x));
    const rest = sizes.filter(x => !nums.includes(x));
    const range = nums.length ? `${nums[0].split('-')[0]}–${nums[nums.length - 1].split('-').pop()}` : '';
    return 'Tallas ' + [range, rest.join(', ')].filter(Boolean).join(' · ');
};

// --- PHOTO ---
// Several garments share one photo: `focus` (object-position) and `zoom` in productos.json frame the right one.
// full = show the whole photo (used as the second image of a product page).
const Photo = ({ product, full = false, className = '', eager = false }) => (
    <div className={`crop ${className}`} style={full ? undefined : { '--focus': product.focus, '--zoom': product.zoom }}>
        <img src={product.image} alt={`${product.name}, uniforme ${BRAND.school}`} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    </div>
);

// --- CARD ---
const ProductCard = ({ product, catalog }) => {
    const href = `${CLIENT.base}/tienda/${product.slug}/`;
    return (
        <article className="reveal group">
            <a href={href} className="block">
                <Photo product={product} className="aspect-[3/4]" />
                <div className="pt-3 pb-6 flex justify-between gap-3">
                    <div>
                        <h3 className="label">{product.name}</h3>
                        <p className="label text-ink-400 mt-0.5">{FIT_LABEL[product.fit]}{product.includes ? ` · ${product.includes.length} prendas` : ''}</p>
                        {product.sizes && product.sizes.length > 0 && <p className="label text-ink-400 mt-0.5">{sizeRange(product.sizes)}</p>}
                    </div>
                    <p className="label whitespace-nowrap">{priceLabel(product)}</p>
                </div>
            </a>
        </article>
    );
};

const GridSkeleton = ({ n = 8 }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-1 gap-y-2">
        {Array.from({ length: n }, (_, i) => <div key={i} className="aspect-[3/4] bg-paper-50 animate-pulse" />)}
    </div>
);

const LoadError = () => <p className="text-center label text-ink-500 py-24">No pudimos cargar el catálogo. Recarga la página en un momento.</p>;

// Collapsible row, the way fashion sites show composition and care.
const Disclosure = ({ title, children, open = false }) => (
    <details className="border-t border-line group/d" open={open}>
        <summary className="label py-4 cursor-pointer list-none flex justify-between">{title}<span className="group-open/d:rotate-45 transition-transform">+</span></summary>
        <div className="pb-5 text-ink-700 text-[13px] leading-relaxed">{children}</div>
    </details>
);

// --- PRODUCT PAGE ---
// Each <school>/tienda/<slug>/index.html calls renderProduct(); the slug comes from the URL.
const ProductPage = () => {
    const catalog = useCatalog();
    const slug = window.location.pathname.split('/').filter(Boolean).pop();
    const product = catalog.bySlug[slug];
    const [size, setSize] = useState(null);
    const [qty, setQty] = useState(1);
    const [embroider, setEmbroider] = useState(false);
    const [name, setName] = useState('');
    const [needSize, setNeedSize] = useState(false);

    useEffect(() => { if (product && product.sizes.length === 1) setSize(product.sizes[0]); }, [product]);

    if (catalog.status === 'loading') return <div className="max-w-[1600px] mx-auto px-4 md:px-10 py-24"><GridSkeleton n={2} /></div>;
    if (catalog.status === 'error') return <LoadError />;
    if (!product) return (
        <PageHero kicker="Tienda" title="Esta prenda ya no está disponible.">
            <a href={`${CLIENT.base}/tienda/`} className="btn btn-ink mt-10">Ver la tienda</a>
        </PageHero>
    );

    const { rules } = catalog;
    const included = (product.includes || []).map(id => catalog.byId[id]).filter(Boolean);
    const related = catalog.products.filter(p => p.id !== product.id && p.line_id === product.line_id && (p.fit === product.fit || p.fit === 'unisex' || product.fit === 'unisex')).slice(0, 4);
    const add = () => {
        if (!size) { setNeedSize(true); return; }
        bag.add({ productId: product.id, size, name: embroider ? name : '', qty });
        setQty(1);
    };

    return (
        <>
            <section className="max-w-[1600px] mx-auto md:px-10 md:pt-6 grid md:grid-cols-12 gap-6 md:gap-10 items-start">
                <div className="md:col-span-7 grid gap-1">
                    <Photo product={product} className="aspect-[3/4] animate-fade-in" eager />
                    {!product.includes && (
                        <figure className="relative">
                            <Photo product={product} full className="aspect-[9/16] md:aspect-[3/5]" />
                            <figcaption className="absolute left-4 bottom-4 label">El uniforme completo</figcaption>
                        </figure>
                    )}
                </div>
                <div className="md:col-span-5 md:sticky md:top-28 px-4 md:px-0 pb-10 animate-fade-in">
                    <nav className="label text-ink-400 mb-8" aria-label="Ruta">
                        <a href={`${CLIENT.base}/tienda/`} className="link">Tienda</a> / <a href={`${CLIENT.base}/tienda/?linea=${product.line_id}`} className="link">{catalog.line[product.line_id].label}</a>
                    </nav>
                    <h1 className="text-3xl md:text-4xl uppercase tracking-tight">{product.name}</h1>
                    <p className="label text-ink-500 mt-2">{FIT_LABEL[product.fit]} · {size ? skuOf(product, size) : product.sku}</p>
                    <p className="text-lg mt-6">{size ? formatMXN(unitPrice(product, size)) : priceLabel(product)} <span className="label text-ink-400">IVA incluido</span></p>
                    <p className="text-ink-700 mt-6 leading-relaxed max-w-md">{product.description}</p>

                    {included.length > 0 && (
                        <ul className="mt-6 space-y-1">
                            {included.map(p => <li key={p.id} className="label flex justify-between max-w-md"><a href={`${CLIENT.base}/tienda/${p.slug}/`} className="link">{p.name}</a><span className="text-ink-400 line-through">{formatMXN(p.price_mxn)}</span></li>)}
                        </ul>
                    )}

                    <div className="mt-10">
                        <div className="flex justify-between items-baseline mb-3 max-w-md">
                            <p className={`label ${needSize && !size ? 'text-florida-naranja' : ''}`}>{needSize && !size ? 'Elige una talla' : 'Talla'}</p>
                            <a href={`${CLIENT.base}/como-comprar/#tallas`} className="label link text-ink-500">Guía de tallas</a>
                        </div>
                        <div className="flex flex-wrap gap-1 max-w-md" role="radiogroup" aria-label="Talla">
                            {product.sizes.map(s => <button key={s} type="button" role="radio" aria-checked={size === s} className="chip" onClick={() => { setSize(s); setNeedSize(false); }}>{s}</button>)}
                        </div>
                    </div>

                    {product.embroidery && (
                        <div className="mt-8 max-w-md">
                            <label className="flex gap-3 items-center cursor-pointer label">
                                <input type="checkbox" checked={embroider} onChange={e => setEmbroider(e.target.checked)} className="accent-black w-4 h-4" />
                                Bordar nombre del alumno · +{formatMXN(rules.embroidery_mxn)}{product.includes ? ' por prenda' : ''}
                            </label>
                            {embroider && <input className="field mt-3" placeholder="Nombre y apellido (máx. 24)" maxLength={24} value={name} onChange={e => setName(e.target.value)} required />}
                        </div>
                    )}

                    <div className="flex gap-1 mt-8 max-w-md">
                        <div className="flex items-center border border-ink">
                            <button className="w-11 h-11" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Menos">−</button>
                            <span className="w-6 text-center text-sm" aria-live="polite">{qty}</span>
                            <button className="w-11 h-11" onClick={() => setQty(q => q + 1)} aria-label="Más">+</button>
                        </div>
                        <button className="btn btn-ink flex-1" onClick={add} disabled={embroider && !name.trim()}>Añadir a la bolsa</button>
                    </div>
                    <p className="label text-ink-400 mt-4">En existencia · lista en 48 h hábiles</p>

                    <div className="mt-10 max-w-md border-b border-line">
                        {product.features.length > 0 && <Disclosure title="Detalles" open><ul className="space-y-1">{product.features.map(f => <li key={f}>— {f}</li>)}</ul></Disclosure>}
                        {product.fabric && <Disclosure title="Composición y cuidados"><p>{product.fabric}.</p><p className="mt-2">{product.care}</p></Disclosure>}
                        <Disclosure title="Entrega y pago">
                            {rules.shipping.map(s => <p key={s.id} className="mb-2"><strong className="font-medium text-ink">{s.label}.</strong> {s.detail}</p>)}
                            <p>Tarjeta, OXXO o efectivo en tienda. <a href={`${CLIENT.base}/como-comprar/`} className="underline">Cómo comprar</a></p>
                        </Disclosure>
                    </div>
                </div>
            </section>

            {related.length > 0 && (
                <section className="max-w-[1600px] mx-auto px-4 md:px-10 pt-20">
                    <p className="label mb-6">Completa el uniforme</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-1">{related.map(p => <ProductCard key={p.id} product={p} catalog={catalog} />)}</div>
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
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Añadido a tu bolsa">
            <div className="absolute inset-0 bg-black/20 animate-fade-in" onClick={() => setOpenKey(null)} />
            <aside className="absolute right-0 inset-y-0 w-full max-w-sm bg-white animate-slide-in flex flex-col">
                <div className="flex justify-between items-center px-6 h-20 border-b border-line">
                    <p className="label-strong">Añadido a tu bolsa</p>
                    <button onClick={() => setOpenKey(null)} aria-label="Cerrar"><IconClose className="w-5 h-5" /></button>
                </div>
                {added && (
                    <div className="p-6 flex gap-4">
                        <Photo product={added.product} className="w-28 aspect-[3/4] shrink-0" />
                        <div className="label space-y-1">
                            <p className="label-strong">{added.product.name}</p>
                            <p className="text-ink-500">Talla {added.size}</p>
                            {added.name && <p className="text-ink-500">Bordado: {added.name}</p>}
                            <p>{added.qty} × {formatMXN(unitPrice(added.product, added.size))}</p>
                        </div>
                    </div>
                )}
                <div className="mt-auto p-6 border-t border-line grid gap-2">
                    <p className="label flex justify-between mb-3"><span>{priced.pieces} {priced.pieces === 1 ? 'prenda' : 'prendas'}</span><span>{formatMXN(priced.subtotal + priced.embroidery)}</span></p>
                    <a href={`${CLIENT.base}/bolsa/`} className="btn btn-ink">Ver bolsa</a>
                    <button className="btn btn-line" onClick={() => setOpenKey(null)}>Seguir comprando</button>
                </div>
            </aside>
        </div>
    );
};
