// Shared by EVERY page: brand config, header (transparent over photos on the home page), side menu, footer,
// bag storage, parallax + reveal hooks, WhatsApp button, cookie notice, PageHero, LegalPage, renderPage().
// Load order on each page: tailwind.config.js → layout.jsx → (tienda.jsx) → page script.

const { useState, useEffect, useMemo, useRef } = React;

// --- BRAND ---
// Values marked [verificar] are placeholders until the client confirms them.
const BRAND = {
    name: 'Zarem',
    school: 'Colegio La Florida',
    tagline: 'Uniformes oficiales del Colegio La Florida',
    email: 'hola@zarem.mx',                                    // [verificar]
    phone: '+52 55 0000 0000',                                 // [verificar]
    whatsapp: '5200000000000',                                 // [verificar] solo dígitos, formato internacional
    store: '[Dirección de la tienda de uniformes], Ciudad de México',   // [verificar]
    hours: 'Lunes a viernes 9:00 – 18:00 · Sábado 9:00 – 14:00',        // [verificar]
};

// Side menu (Zara-style): big list on the left. Header shows only the short links.
const MENU = [
    { href: '/pages/tienda/?corte=nina', label: 'Niña' },
    { href: '/pages/tienda/?corte=nino', label: 'Niño' },
    { href: '/pages/tienda/?linea=diario', label: 'Diario' },
    { href: '/pages/tienda/?linea=deportes', label: 'Deportes' },
    { href: '/pages/tienda/?linea=paquetes', label: 'Paquetes' },
];
const MENU_SECONDARY = [
    { href: '/pages/como-comprar/', label: 'Cómo comprar' },
    { href: '/pages/como-comprar/#tallas', label: 'Guía de tallas' },
    { href: '/pages/contacto/', label: 'Tienda y contacto' },
];

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
// Lines in 'za-bolsa': [{ key, productId, size, name, qty }]. `name` = student name to embroider ('' = none).
// Prices are NOT stored: they are recomputed from the catalogue (js/tienda.jsx → priceBag), as the server will in Etapa 2.
const bag = {
    read: () => store.read('za-bolsa', []),
    save: (lines) => { store.write('za-bolsa', lines); window.dispatchEvent(new Event('za-bolsa')); },
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

const useBag = () => useStoreEvent('za-bolsa', ['za-bolsa'], bag.read);
const bagCount = (lines) => lines.reduce((a, l) => a + l.qty, 0);

// --- ICONS (thin strokes) ---
const Icon = ({ d, className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" aria-hidden="true">{d}</svg>
);
const IconMenu = (p) => <Icon {...p} d={<path d="M3 8h18M3 16h18" />} />;
const IconClose = (p) => <Icon {...p} d={<path d="M5 5l14 14M19 5L5 19" />} />;
const IconArrow = (p) => <Icon {...p} d={<path d="M4 12h16M14 6l6 6-6 6" />} />;
const IconWhatsApp = ({ className = 'w-6 h-6' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z" /></svg>
);

// --- LOGO: Didone wordmark + school line ---
const Logo = ({ light = false, big = false }) => (
    <a href="/" className={`block leading-none ${light ? 'text-white' : 'text-ink'}`} aria-label={`${BRAND.name}, inicio`}>
        <span className={`font-logo block tracking-[0.12em] ${big ? 'text-6xl md:text-8xl' : 'text-[1.9rem] md:text-[2.3rem]'}`}>ZAREM</span>
        <span className={`label block mt-1 ${light ? 'text-white/80' : 'text-ink-500'}`}>{BRAND.school}</span>
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
                <p className="text-xs max-w-2xl">Usamos almacenamiento necesario para tu bolsa y, con tu permiso, para medir y mejorar el sitio. <a href="/pages/privacidad/" className="underline">Aviso de privacidad</a></p>
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
    <a href={waLink(`Hola, tengo una pregunta sobre los uniformes del ${BRAND.school}.`)} target="_blank" rel="noopener noreferrer"
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
const Layout = ({ children, overlay = false }) => {
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
                    <nav className="flex items-center gap-5 md:gap-8 mt-2" aria-label="Principal">
                        <a href="/pages/tienda/" className="label link hidden sm:inline" aria-current={here.startsWith('/pages/tienda/') ? 'page' : undefined}>Tienda</a>
                        <a href="/pages/como-comprar/" className="label link hidden md:inline" aria-current={here.startsWith('/pages/como-comprar') ? 'page' : undefined}>Cómo comprar</a>
                        <a href="/pages/bolsa/" className="label link" aria-label={`Bolsa, ${count} piezas`}>Bolsa ({count})</a>
                    </nav>
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
                        <nav className="mt-14 flex flex-col gap-4">
                            {MENU.map(l => <a key={l.href} href={l.href} className="text-3xl font-light tracking-tight hover:pl-2 transition-all">{l.label}</a>)}
                        </nav>
                        <nav className="mt-12 flex flex-col gap-3">
                            {MENU_SECONDARY.map(l => <a key={l.href} href={l.href} className="label link self-start">{l.label}</a>)}
                        </nav>
                        <p className="mt-auto pt-12 text-xs text-ink-500">{BRAND.store}<br />{BRAND.hours}</p>
                    </aside>
                </div>
            )}

            <main id="main" className="flex-1">{children}</main>

            <Footer />
            <WhatsAppButton />
            {typeof BagDrawer !== 'undefined' && <BagDrawer />}
            <CookieConsent />
        </div>
    );
};

const FOOTER_COLUMNS = [
    { title: 'Tienda', links: [
        { href: '/pages/tienda/?corte=nina', label: 'Niña' },
        { href: '/pages/tienda/?corte=nino', label: 'Niño' },
        { href: '/pages/tienda/?linea=deportes', label: 'Deportes' },
        { href: '/pages/tienda/?linea=paquetes', label: 'Paquetes' },
    ] },
    { title: 'Ayuda', links: [
        { href: '/pages/como-comprar/', label: 'Cómo comprar' },
        { href: '/pages/como-comprar/#tallas', label: 'Guía de tallas' },
        { href: '/pages/como-comprar/#pagos', label: 'Formas de pago' },
        { href: '/pages/terminos/#cambios', label: 'Cambios' },
    ] },
    { title: 'Zarem', links: [
        { href: '/pages/contacto/', label: 'Tienda y contacto' },
        { href: '/pages/terminos/', label: 'Términos de venta' },
        { href: '/pages/privacidad/', label: 'Aviso de privacidad' },
    ] },
];

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
    ReactDOM.createRoot(document.getElementById('root')).render(<Layout overlay={options.overlay}><Page /></Layout>);
};
