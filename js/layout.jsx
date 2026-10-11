// Shared by EVERY page: brand config, header (transparent over photos on the home page), side menu, footer,
// bag storage, parallax + reveal hooks, WhatsApp button, cookie notice, PageHero, LegalPage, renderPage().
// Load order on each page: tailwind.config.js → layout.jsx → (tienda.jsx) → page script.

const { useState, useEffect, useMemo, useRef } = React;

// --- CLIENTS ---
// Every school is a store under its own folder (zarem.mx/<id>/). The client is picked from the URL; on zarem.mx/
// there is none, and the logo reads "Casa de confección". To add a school: one entry here + its folder + a card
// on the home page (index.html). `soon: true` = folder with a "próximamente" page, no store yet.
const CLIENTS = [
    {
        id: 'colegio_la_florida',
        name: 'Colegio La Florida',
        base: '/colegio_la_florida',
        cover: '/img/fotos/florida-edificio.webp',
        menu: [
            { href: '/colegio_la_florida/#catalogo', label: 'Catálogo completo' },
            { href: '/colegio_la_florida/tienda/?corte=nina', label: 'Niña' },
            { href: '/colegio_la_florida/tienda/?corte=nino', label: 'Niño' },
            { href: '/colegio_la_florida/tienda/?linea=diario', label: 'Diario' },
            { href: '/colegio_la_florida/tienda/?linea=deportes', label: 'Deportes' },
            { href: '/colegio_la_florida/tienda/?linea=paquetes', label: 'Paquetes' },
            { href: '/colegio_la_florida/como-comprar/', label: 'Cómo comprar' },
            { href: '/colegio_la_florida/como-comprar/#tallas', label: 'Guía de tallas' },
            { href: '/colegio_la_florida/contacto/', label: 'Tienda y contacto' },
        ],
    },
    {
        id: 'cum',
        name: 'CUM',                                           // [verificar] nombre completo
        base: '/cum',
        cover: '/img/instituto-universitario-mexico-cum-mejores-preparatorias-cdmx.jpeg',
        soon: true,
        menu: [],
    },
];
const CLIENT = CLIENTS.find(c => (window.location.pathname + '/').startsWith(c.base + '/')) || null;

// --- BRAND ---
// Values marked [verificar] are placeholders until the client confirms them.
const BRAND = {
    name: 'Zarem',
    slogan: 'Casa de confección',
    school: CLIENT ? CLIENT.name : '',
    tagline: CLIENT ? `Uniformes oficiales del ${CLIENT.name}` : 'Casa de confección de uniformes escolares',
    email: 'hola@zarem.mx',                                    // [verificar]
    phone: '+52 55 0000 0000',                                 // [verificar]
    whatsapp: '5200000000000',                                 // [verificar] solo dígitos, formato internacional
    store: '[Dirección de la tienda de uniformes], Ciudad de México',   // [verificar]
    hours: 'Lunes a viernes 9:00 – 18:00 · Sábado 9:00 – 14:00',        // [verificar]
};
const HOME = CLIENT ? `${CLIENT.base}/` : '/';

const formatMXN = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);

// --- LOCAL STORAGE (every key starts with "za-") ---
const store = {
    read: (key, fallback) => { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    write: (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
};

const useStoreEvent = (eventName, keys, read) => {
    const [value, setValue] = useState(read);
    useEffect(() => {
        const update = () => setValue(read());
        const onStorage = (e) => { if (keys.includes(e.key)) update(); };
        window.addEventListener(eventName, update);
        window.addEventListener('storage', onStorage);
        return () => { window.removeEventListener(eventName, update); window.removeEventListener('storage', onStorage); };
    }, []);
    return value;
};

// --- BAG ---
// One bag per school, 'za-bolsa-<client id>': [{ key, productId, size, name, qty }]. `name` = student name to embroider
// ('' = none). Prices are NOT stored: they are recomputed from the catalogue (js/tienda.jsx → priceBag), as the server
// will in Etapa 2.
const BAG_KEY = `za-bolsa-${CLIENT ? CLIENT.id : 'zarem'}`;
const bag = {
    read: () => store.read(BAG_KEY, []),
    save: (lines) => { store.write(BAG_KEY, lines); window.dispatchEvent(new Event('za-bolsa')); },
    keyOf: ({ productId, size, name }) => `${productId}|${size}|${(name || '').trim().toLowerCase()}`,
    add: (line) => {
        const clean = { ...line, name: (line.name || '').trim() };
        const key = bag.keyOf(clean);
        const lines = bag.read();
        const found = lines.find(l => l.key === key);
        if (found) found.qty += clean.qty; else lines.push({ ...clean, key });
        bag.save(lines);
        window.dispatchEvent(new CustomEvent('za-bolsa-abrir', { detail: key }));
    },
    set: (key, qty) => bag.save(qty > 0 ? bag.read().map(l => (l.key === key ? { ...l, qty } : l)) : bag.read().filter(l => l.key !== key)),
    clear: () => bag.save([]),
};

const useBag = () => useStoreEvent('za-bolsa', [BAG_KEY], bag.read);
const bagCount = (lines) => lines.reduce((a, l) => a + l.qty, 0);

// --- ICONS (thin strokes) ---
const Icon = ({ d, className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" aria-hidden="true">{d}</svg>
);
const IconMenu = (p) => <Icon {...p} d={<path d="M3 8h18M3 16h18" />} />;
const IconClose = (p) => <Icon {...p} d={<path d="M5 5l14 14M19 5L5 19" />} />;
const IconPlus = (p) => <Icon {...p} d={<path d="M12 5v14M5 12h14" />} />;
const IconMinus = (p) => <Icon {...p} d={<path d="M5 12h14" />} />;
const IconArrow = (p) => <Icon {...p} d={<path d="M4 12h16M14 6l6 6-6 6" />} />;
const IconWhatsApp = ({ className = 'w-6 h-6' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z" /></svg>
);

// --- LOGO: Didone wordmark + line under it: the open school, or the Zarem slogan when no school is open ---
const Logo = ({ light = false, big = false }) => (
    <a href={HOME} className={`block leading-none ${light ? 'text-white' : 'text-ink'}`} aria-label={`${BRAND.name}${CLIENT ? ` · ${CLIENT.name}` : ''}, inicio`}>
        <span className={`font-logo block tracking-[0.12em] ${big ? 'text-6xl md:text-8xl' : 'text-[1.9rem] md:text-[2.3rem]'}`}>ZAREM</span>
        <span className={`label block mt-1 ${light ? 'text-white/80' : 'text-ink-500'}`}>{CLIENT ? CLIENT.name : BRAND.slogan}</span>
    </a>
);

// --- COOKIE NOTICE ---
const COOKIE_KEY = 'za-cookies';
window.ZA_COOKIES = (store.read(COOKIE_KEY, null) || {}).choice || null;
const hasCookieConsent = () => window.ZA_COOKIES === 'all';

const CookieConsent = () => {
    const [open, setOpen] = useState(!window.ZA_COOKIES);
    if (!open) return null;
    const choose = (choice) => { window.ZA_COOKIES = choice; store.write(COOKIE_KEY, { choice, at: new Date().toISOString() }); setOpen(false); };
    return (
        <div className="fixed bottom-0 inset-x-0 z-[90] bg-white border-t border-ink animate-fade-in" role="dialog" aria-label="Cookies">
            <div className="max-w-[1600px] mx-auto px-4 md:px-10 py-4 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <p className="text-xs max-w-2xl">Usamos almacenamiento necesario para tu bolsa y, con tu permiso, para medir y mejorar el sitio. <a href="/colegio_la_florida/privacidad/" className="underline">Aviso de privacidad</a></p>
                <div className="flex gap-2 shrink-0">
                    <button className="btn btn-ink" onClick={() => choose('all')}>Aceptar</button>
                    <button className="btn btn-line" onClick={() => choose('necessary')}>Solo necesarias</button>
                </div>
            </div>
        </div>
    );
};

// --- WHATSAPP ---
const waLink = (text) => `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(text)}`;

const WhatsAppButton = () => (
    <a href={waLink(CLIENT ? `Hola, tengo una pregunta sobre los uniformes del ${CLIENT.name}.` : 'Hola, tengo una pregunta sobre los uniformes de Zarem.')} target="_blank" rel="noopener noreferrer"
       className="fixed bottom-5 right-5 z-[60] w-12 h-12 bg-white border border-ink text-ink flex items-center justify-center hover:bg-ink hover:text-white transition-colors"
       aria-label="Escríbenos por WhatsApp">
        <IconWhatsApp className="w-5 h-5" />
    </a>
);

// --- MOTION ---
// Reveal: slow fade-in of .reveal elements as they enter the viewport (also for content rendered later).
const useReveal = () => {
    useEffect(() => {
        const io = new IntersectionObserver((entries) => entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        }), { threshold: 0.08 });
        const scan = () => document.querySelectorAll('.reveal:not(.is-in)').forEach(el => io.observe(el));
        scan();
        const mo = new MutationObserver(scan);
        mo.observe(document.getElementById('root'), { childList: true, subtree: true });
        return () => { io.disconnect(); mo.disconnect(); };
    }, []);
};

// Parallax: every .parallax frame moves its image at `data-speed` (default .18) of the scroll, relative to the
// frame's distance from the viewport centre. One rAF per frame; skipped entirely with prefers-reduced-motion.
const useParallax = () => {
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let ticking = false;
        const update = () => {
            ticking = false;
            const vh = window.innerHeight;
            document.querySelectorAll('.parallax').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.bottom < -100 || r.top > vh + 100) return;
                const speed = parseFloat(el.dataset.speed || '0.18');
                const offset = (r.top + r.height / 2 - vh / 2) * -speed;
                el.style.setProperty('--py', `${Math.max(-r.height * 0.14, Math.min(r.height * 0.14, offset)).toFixed(1)}px`);
            });
        };
        const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        const mo = new MutationObserver(onScroll);
        mo.observe(document.getElementById('root'), { childList: true, subtree: true });
        return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); mo.disconnect(); };
    }, []);
};

const useScrolled = (px = 40) => {
    const [scrolled, setScrolled] = useState(window.scrollY > px);
    useEffect(() => {
        const on = () => setScrolled(window.scrollY > px);
        window.addEventListener('scroll', on, { passive: true });
        return () => window.removeEventListener('scroll', on);
    }, []);
    return scrolled;
};

// --- LAYOUT ---
// overlay: the header floats transparent (white text) over a full-screen photo until the page scrolls.
// BagDrawer is defined in tienda.jsx; pages that do not load it simply have no drawer.
// Side menu, "Colegios": every school opens like a folder with its pages; the open school starts unfolded.
const SchoolsMenu = () => {
    const [open, setOpen] = useState(CLIENT ? CLIENT.id : null);
    return (
        <nav className="mt-14" aria-label="Colegios">
            <p className="label text-ink-500 mb-5">Colegios</p>
            <ul className="flex flex-col gap-4">
                {CLIENTS.map(c => {
                    const isOpen = open === c.id;
                    return (
                        <li key={c.id}>
                            <div className="flex items-center justify-between gap-4">
                                <a href={`${c.base}/`} className="text-3xl font-light tracking-tight hover:pl-2 transition-all" aria-current={CLIENT === c ? 'page' : undefined}>{c.name}</a>
                                {c.menu.length > 0 && (
                                    <button onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Cerrar' : 'Abrir'} ${c.name}`}>
                                        {isOpen ? <IconMinus /> : <IconPlus />}
                                    </button>
                                )}
                                {c.soon && <span className="label text-ink-400">Próximamente</span>}
                            </div>
                            {isOpen && (
                                <ul className="mt-4 ml-1 pl-5 border-l border-line flex flex-col gap-2.5 animate-fade-in">
                                    {c.menu.map(l => <li key={l.href}><a href={l.href} className="label link">{l.label}</a></li>)}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};

// landing: zarem.mx/ — no footer, no shop links (the page is the two school cards).
const Layout = ({ children, overlay = false, landing = false }) => {
    const count = bagCount(useBag());
    const [menuOpen, setMenuOpen] = useState(false);
    const scrolled = useScrolled();
    const clear = overlay && !scrolled && !menuOpen;
    useReveal();
    useParallax();
    useEffect(() => { document.body.style.overflow = menuOpen ? 'hidden' : ''; }, [menuOpen]);
    const here = window.location.pathname + window.location.search;

    return (
        <div className="min-h-screen flex flex-col">
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] bg-white px-4 py-2">Saltar al contenido</a>

            <header className={`${overlay ? 'fixed' : 'sticky'} top-0 inset-x-0 z-50 transition-colors duration-300 ${clear ? 'bg-transparent text-white' : 'bg-white/95 backdrop-blur-sm text-ink'}`}>
                <div className="max-w-[1600px] mx-auto px-4 md:px-10 h-20 md:h-24 flex items-start justify-between gap-6 pt-4 md:pt-5">
                    <div className="flex items-start gap-5 md:gap-8">
                        <button className="mt-1.5" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><IconMenu className="w-6 h-6" /></button>
                        <Logo light={clear} />
                    </div>
                    {CLIENT && !CLIENT.soon && (
                        <nav className="flex items-center gap-5 md:gap-8 mt-2" aria-label="Principal">
                            <a href={`${CLIENT.base}/tienda/`} className="label link hidden sm:inline" aria-current={here.startsWith(`${CLIENT.base}/tienda/`) ? 'page' : undefined}>Tienda</a>
                            <a href={`${CLIENT.base}/como-comprar/`} className="label link hidden md:inline" aria-current={here.startsWith(`${CLIENT.base}/como-comprar`) ? 'page' : undefined}>Cómo comprar</a>
                            <a href={`${CLIENT.base}/bolsa/`} className="label link" aria-label={`Bolsa, ${count} piezas`}>Bolsa ({count})</a>
                        </nav>
                    )}
                </div>
            </header>

            {menuOpen && (
                <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Menú">
                    <div className="absolute inset-0 bg-black/20 animate-fade-in" onClick={() => setMenuOpen(false)} />
                    <aside className="absolute left-0 inset-y-0 w-full max-w-md bg-white animate-slide-left flex flex-col px-6 md:px-10 pt-6 pb-10 overflow-y-auto">
                        <div className="flex items-start gap-5">
                            <button className="mt-1.5" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><IconClose className="w-6 h-6" /></button>
                            <Logo />
                        </div>
                        <SchoolsMenu />
                        <nav className="mt-12 flex flex-col gap-3">
                            <a href="/" className="label link self-start">Zarem · {BRAND.slogan}</a>
                        </nav>
                        <p className="mt-auto pt-12 text-xs text-ink-500">{BRAND.store}<br />{BRAND.hours}</p>
                    </aside>
                </div>
            )}

            <main id="main" className="flex-1">{children}</main>

            {!landing && <Footer />}
            <WhatsAppButton />
            {typeof BagDrawer !== 'undefined' && <BagDrawer />}
            <CookieConsent />
        </div>
    );
};

// Footer links of the open school's store (none on the home page or a "próximamente" school).
const footerColumns = (b) => [
    { title: 'Tienda', links: [
        { href: `${b}/tienda/?corte=nina`, label: 'Niña' },
        { href: `${b}/tienda/?corte=nino`, label: 'Niño' },
        { href: `${b}/tienda/?linea=deportes`, label: 'Deportes' },
        { href: `${b}/tienda/?linea=paquetes`, label: 'Paquetes' },
    ] },
    { title: 'Ayuda', links: [
        { href: `${b}/como-comprar/`, label: 'Cómo comprar' },
        { href: `${b}/como-comprar/#tallas`, label: 'Guía de tallas' },
        { href: `${b}/como-comprar/#pagos`, label: 'Formas de pago' },
        { href: `${b}/terminos/#cambios`, label: 'Cambios' },
    ] },
    { title: 'Zarem', links: [
        { href: `${b}/contacto/`, label: 'Tienda y contacto' },
        { href: `${b}/terminos/`, label: 'Términos de venta' },
        { href: `${b}/privacidad/`, label: 'Aviso de privacidad' },
    ] },
];
const FOOTER_COLUMNS = CLIENT && !CLIENT.soon ? footerColumns(CLIENT.base) : [];

const Footer = () => (
    <footer className="border-t border-line mt-24">
        <div className="max-w-[1600px] mx-auto px-4 md:px-10 py-16 grid gap-12 md:grid-cols-5">
            <div className="md:col-span-2">
                <Logo />
                <p className="mt-6 text-xs text-ink-500 max-w-xs leading-relaxed">{BRAND.tagline}. Confeccionados en la Ciudad de México.</p>
            </div>
            {FOOTER_COLUMNS.map(col => (
                <div key={col.title}>
                    <p className="label-strong mb-4">{col.title}</p>
                    <ul className="space-y-2.5">{col.links.map(l => <li key={l.href}><a href={l.href} className="label link text-ink-500 hover:text-ink">{l.label}</a></li>)}</ul>
                </div>
            ))}
        </div>
        <div className="max-w-[1600px] mx-auto px-4 md:px-10 pb-10 flex flex-col md:flex-row justify-between gap-2 label text-ink-400">
            <p>© {new Date().getFullYear()} {BRAND.name} · zarem.mx</p>
            <p>{BRAND.email} · {BRAND.phone}</p>
        </div>
    </footer>
);

// --- SHARED SECTIONS ---
// Plain-text page header: the minimal look keeps text pages without photos.
const PageHero = ({ kicker, title, intro, children }) => (
    <section className="max-w-[1600px] mx-auto px-4 md:px-10 pt-16 md:pt-24 pb-10 animate-fade-in">
        {kicker && <p className="label text-ink-500 mb-6">{kicker}</p>}
        <h1 className="text-5xl md:text-7xl max-w-4xl">{title}</h1>
        {intro && <p className="mt-6 text-ink-700 max-w-xl leading-relaxed">{intro}</p>}
        {children}
    </section>
);

// Legal pages: values in [corchetes] are placeholders, highlighted until filled in.
const Placeholders = ({ children }) => String(children).split(/(\[[^\]]+\])/g)
    .map((p, i) => (p.startsWith('[') ? <mark key={i} className="bg-paper-100 text-ink px-1">{p}</mark> : p));

const LegalPage = ({ kicker, title, updated, sections }) => (
    <>
        <PageHero kicker={kicker} title={title} intro={`Última actualización: ${updated}`} />
        <section className="max-w-[1600px] mx-auto px-4 md:px-10 py-10 grid md:grid-cols-4 gap-12">
            <nav className="hidden md:flex flex-col gap-3 md:sticky md:top-28 self-start" aria-label="Índice">
                {sections.map(s => <a key={s.id} href={`#${s.id}`} className="label link self-start text-ink-500 hover:text-ink">{s.title}</a>)}
            </nav>
            <div className="md:col-span-3 max-w-3xl space-y-12">
                {sections.map(s => (
                    <article key={s.id} id={s.id} className="scroll-mt-28 border-t border-line pt-6">
                        <h2 className="label-strong mb-4">{s.title}</h2>
                        <div className="space-y-3 text-ink-700 leading-relaxed">{s.body.map((p, i) => <p key={i}><Placeholders>{p}</Placeholders></p>)}</div>
                    </article>
                ))}
            </div>
        </section>
    </>
);

const renderPage = (Page, options = {}) => {
    ReactDOM.createRoot(document.getElementById('root')).render(<Layout overlay={options.overlay} landing={options.landing}><Page /></Layout>);
};
