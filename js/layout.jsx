// Shared by EVERY page: brand config, header, footer, bag (cart) storage, WhatsApp button, cookie notice,
// PageHero, SectionTitle, LegalPage, renderPage().
// Load order on each page: tailwind.config.js → layout.jsx → (tienda.jsx) → page script.

const { useState, useEffect, useMemo } = React;

// --- BRAND ---
// Values marked [verificar] are placeholders until the client confirms them.
const BRAND = {
    name: 'Zarem',
    tagline: 'Uniformes de confección fina, hechos en la Ciudad de México',
    email: 'hola@zarem.mx',                                    // [verificar]
    sales: 'empresas@zarem.mx',                                // [verificar]
    phone: '+52 55 0000 0000',                                 // [verificar]
    whatsapp: '5200000000000',                                 // [verificar] solo dígitos, formato internacional
    address: '[Calle y número], Col. Roma Norte, Cuauhtémoc, 06700 Ciudad de México',   // [verificar]
    hours: 'Lunes a viernes 10:00 – 19:00 · Sábado 10:00 – 14:00',                     // [verificar]
    instagram: 'https://instagram.com/zarem.mx',               // [verificar]
};

const NAV_LINKS = [
    { href: '/pages/tienda/', label: 'Tienda', match: '' },
    { href: '/pages/tienda/?linea=corporativo', label: 'Corporativo', match: 'linea=corporativo' },
    { href: '/pages/tienda/?linea=hospitalidad', label: 'Hospitalidad', match: 'linea=hospitalidad' },
    { href: '/pages/tienda/?linea=salud', label: 'Salud', match: 'linea=salud' },
    { href: '/pages/confeccion/', label: 'Confección' },
    { href: '/pages/empresas/', label: 'Empresas' },
];

const isActive = (link) => {
    const path = window.location.pathname;
    if (link.match !== undefined) {
        if (!path.startsWith('/pages/tienda')) return false;
        return link.match ? window.location.search.includes(link.match) : !window.location.search.includes('linea=') && path === '/pages/tienda/';
    }
    return path.startsWith(link.href.replace(/\/$/, ''));
};

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

// --- BAG (cart) ---
// A uniform is bought by variant: product + colour + size (+ optional logo embroidery). Lines live in 'za-bolsa' as
// [{ key, productId, colorId, size, embroidery, qty }], synced between tabs. Prices are NOT stored here: they are
// always recomputed from the catalogue (js/tienda.jsx → priceBag), as the server will do in Etapa 2.
const bag = {
    read: () => store.read('za-bolsa', []),
    save: (lines) => { store.write('za-bolsa', lines); window.dispatchEvent(new Event('za-bolsa')); },
    keyOf: ({ productId, colorId, size, embroidery }) => `${productId}|${colorId}|${size}|${embroidery ? 'b' : ''}`,
    add: (line) => {
        const key = bag.keyOf(line);
        const lines = bag.read();
        const found = lines.find(l => l.key === key);
        if (found) found.qty += line.qty; else lines.push({ ...line, key });
        bag.save(lines);
        window.dispatchEvent(new CustomEvent('za-bolsa-abrir', { detail: key }));
    },
    set: (key, qty) => bag.save(qty > 0 ? bag.read().map(l => (l.key === key ? { ...l, qty } : l)) : bag.read().filter(l => l.key !== key)),
    clear: () => bag.save([]),
};

const useBag = () => useStoreEvent('za-bolsa', ['za-bolsa'], bag.read);
const bagCount = (lines) => lines.reduce((a, l) => a + l.qty, 0);

// --- ICONS ---
const Icon = ({ d, className = 'w-5 h-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IconBag = (p) => <Icon {...p} d={<><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>} />;
const IconMenu = (p) => <Icon {...p} d={<path d="M4 7h16M4 12h16M4 17h10" />} />;
const IconClose = (p) => <Icon {...p} d={<path d="M6 6l12 12M18 6L6 18" />} />;
const IconArrow = (p) => <Icon {...p} d={<path d="M5 12h14M13 6l6 6-6 6" />} />;
const IconCheck = (p) => <Icon {...p} d={<path d="M5 12.5l4.5 4.5L19 7" />} />;
const IconNeedle = (p) => <Icon {...p} d={<><path d="M4 20L18 6" /><ellipse cx="19" cy="5" rx="1.6" ry="1" transform="rotate(-45 19 5)" /><path d="M6 13c-3 1-3 5 1 5" strokeDasharray="2 2" /></>} />;
const IconRuler = (p) => <Icon {...p} d={<><rect x="2.5" y="8" width="19" height="8" rx="1" /><path d="M6 8v3M9.5 8v4M13 8v3M16.5 8v4" /></>} />;
const IconTruck = (p) => <Icon {...p} d={<><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17" cy="17.5" r="1.5" /></>} />;
const IconShield = (p) => <Icon {...p} d={<><path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></>} />;
const IconPin = (p) => <Icon {...p} d={<><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>} />;
const IconWhatsApp = ({ className = 'w-6 h-6' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z" /></svg>
);

// --- LOGO: a Z drawn as a seam inside a basting-stitch circle + wordmark ---
const ZaremMark = ({ className = 'w-9 h-9', light = false }) => (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill={light ? 'transparent' : '#0b1b34'} stroke={light ? '#8fb0dc' : 'none'} strokeWidth="1.2" />
        <circle cx="32" cy="32" r="22" fill="none" stroke="#8fb0dc" strokeWidth="1.4" strokeDasharray="3 3" />
        <path d="M22 22h20L22 42h20" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="square" />
    </svg>
);

const Logo = ({ light = false }) => (
    <a href="/" className={`flex items-center gap-3 ${light ? 'text-white' : 'text-noche'}`} aria-label={`${BRAND.name}, inicio`}>
        <ZaremMark light={light} />
        <span className="leading-none">
            <span className="font-display text-[1.65rem] tracking-[0.28em] block">ZAREM</span>
            <span className={`text-[0.56rem] tracking-[0.3em] uppercase ${light ? 'text-white/55' : 'text-acero-600'}`}>Confección · CDMX</span>
        </span>
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
        <div className="fixed bottom-4 left-4 right-4 md:right-auto md:max-w-sm z-[90] bg-white border border-noche-line rounded-2xl shadow-xl p-5 animate-rise-in" role="dialog" aria-label="Cookies">
            <p className="font-display text-xl">Cookies</p>
            <p className="text-sm text-acero-600 mt-1 mb-4">Usamos almacenamiento necesario para tu bolsa. Con tu permiso, también para medir y mejorar el sitio. <a href="/pages/privacidad/" className="underline">Aviso de privacidad</a></p>
            <div className="flex gap-2">
                <button className="btn btn-dark flex-1 !py-2.5" onClick={() => choose('all')}>Aceptar</button>
                <button className="btn btn-line flex-1 !py-2.5" onClick={() => choose('necessary')}>Solo necesarias</button>
            </div>
        </div>
    );
};

// --- WHATSAPP ---
const waLink = (text) => `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(text)}`;

const WhatsAppButton = () => (
    <a href={waLink('Hola Zarem, tengo una pregunta sobre sus uniformes.')} target="_blank" rel="noopener noreferrer"
       className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full bg-[#25d366] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
       aria-label="Escríbenos por WhatsApp">
        <IconWhatsApp className="w-7 h-7" />
    </a>
);

// --- REVEAL ON SCROLL ---
const useReveal = () => {
    useEffect(() => {
        const io = new IntersectionObserver((entries) => entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
        }), { threshold: 0.1 });
        const scan = () => document.querySelectorAll('.reveal:not(.is-in)').forEach(el => io.observe(el));
        scan();
        const mo = new MutationObserver(scan);
        mo.observe(document.getElementById('root'), { childList: true, subtree: true });
        return () => { io.disconnect(); mo.disconnect(); };
    }, []);
};

// --- LAYOUT ---
// BagDrawer is defined in tienda.jsx; pages that do not load it (legal, contact) simply have no drawer.
const Layout = ({ children }) => {
    const count = bagCount(useBag());
    const [menuOpen, setMenuOpen] = useState(false);
    useReveal();
    useEffect(() => { document.body.style.overflow = menuOpen ? 'hidden' : ''; }, [menuOpen]);

    const BagButton = ({ className = '' }) => (
        <a href="/pages/bolsa/" className={`relative p-2 ${className}`} aria-label={`Bolsa, ${count} piezas`}>
            <IconBag className="w-6 h-6" />
            {count > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-zafiro text-white text-[0.68rem] font-semibold flex items-center justify-center">{count}</span>}
        </a>
    );

    return (
        <div className="min-h-screen flex flex-col">
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] bg-white px-4 py-2 rounded">Saltar al contenido</a>

            <div className="bg-noche text-white/80 text-[0.72rem] tracking-wide">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-2 flex justify-between gap-4">
                    <p>Confeccionado en nuestro taller de la Ciudad de México</p>
                    <p className="hidden md:block">Envío gratis en CDMX desde {formatMXN(2500)} · Descuento por volumen desde 10 piezas</p>
                </div>
            </div>

            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-noche-line">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-6">
                    <Logo />
                    <nav className="hidden lg:flex items-center gap-7 text-sm" aria-label="Principal">
                        {NAV_LINKS.map(l => (
                            <a key={l.href} href={l.href} aria-current={isActive(l) ? 'page' : undefined}
                               className={`py-1 transition-colors ${isActive(l) ? 'text-noche stitch-under' : 'text-acero-600 hover:text-noche'}`}>{l.label}</a>
                        ))}
                    </nav>
                    <div className="flex items-center gap-2">
                        <a href="/pages/empresas/" className="hidden xl:inline-flex btn btn-ice !py-2.5 !px-4 !text-xs">Cotizar para empresa</a>
                        <BagButton />
                        <button className="lg:hidden p-2" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><IconMenu className="w-6 h-6" /></button>
                    </div>
                </div>
            </header>

            {menuOpen && (
                <div className="fixed inset-0 z-[70] bg-white animate-fade-in flex flex-col" role="dialog" aria-modal="true" aria-label="Menú">
                    <div className="h-20 px-4 flex items-center justify-between border-b border-noche-line">
                        <Logo />
                        <button onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><IconClose className="w-6 h-6" /></button>
                    </div>
                    <nav className="flex-1 flex flex-col px-6 py-8 gap-5 overflow-y-auto">
                        {NAV_LINKS.map(l => <a key={l.href} href={l.href} className="font-display text-3xl">{l.label}</a>)}
                        <a href="/pages/contacto/" className="font-display text-3xl">Contacto</a>
                        <div className="flex gap-3 mt-6">
                            <a href="/pages/bolsa/" className="btn btn-dark"><IconBag className="w-4 h-4" /> Bolsa ({count})</a>
                            <a href="/pages/empresas/" className="btn btn-line">Empresas</a>
                        </div>
                    </nav>
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
        { href: '/pages/tienda/?linea=corporativo', label: 'Corporativo' },
        { href: '/pages/tienda/?linea=hospitalidad', label: 'Hospitalidad' },
        { href: '/pages/tienda/?linea=salud', label: 'Salud' },
        { href: '/pages/tienda/', label: 'Todas las prendas' },
    ] },
    { title: 'Zarem', links: [
        { href: '/pages/confeccion/', label: 'Nuestro taller' },
        { href: '/pages/confeccion/#telas', label: 'Telas' },
        { href: '/pages/confeccion/#tallas', label: 'Guía de tallas' },
        { href: '/pages/empresas/', label: 'Programa para empresas' },
    ] },
    { title: 'Ayuda', links: [
        { href: '/pages/contacto/', label: 'Contacto y showroom' },
        { href: '/pages/terminos/#envios', label: 'Envíos' },
        { href: '/pages/terminos/#cambios', label: 'Cambios y ajustes' },
        { href: '/pages/terminos/', label: 'Términos de venta' },
        { href: '/pages/privacidad/', label: 'Aviso de privacidad' },
    ] },
];

const Footer = () => (
    <footer className="twill text-white/75 mt-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 grid gap-10 md:grid-cols-5">
            <div className="md:col-span-2">
                <Logo light />
                <p className="mt-6 text-sm max-w-xs leading-relaxed">{BRAND.tagline}. Patronaje, corte y confección en un solo taller.</p>
                <p className="mt-5 text-sm flex gap-2"><IconPin className="w-4 h-4 mt-0.5 shrink-0 text-acero-300" /><span>{BRAND.address}</span></p>
                <p className="mt-3 text-sm">{BRAND.phone} · <a href={`mailto:${BRAND.email}`} className="hover:text-white">{BRAND.email}</a></p>
            </div>
            {FOOTER_COLUMNS.map(col => (
                <div key={col.title}>
                    <p className="kicker text-acero-300 mb-4">{col.title}</p>
                    <ul className="space-y-2.5 text-sm">{col.links.map(l => <li key={l.href}><a href={l.href} className="hover:text-white">{l.label}</a></li>)}</ul>
                </div>
            ))}
        </div>
        <div className="border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 text-xs text-white/50 flex flex-col md:flex-row justify-between gap-2">
                <p>© {new Date().getFullYear()} {BRAND.name} · Hecho en la Ciudad de México</p>
                <p>{BRAND.hours}</p>
            </div>
        </div>
    </footer>
);

// --- SHARED SECTIONS ---
const PageHero = ({ kicker, title, accent, intro, children }) => (
    <section className="bg-hielo-50 border-b border-noche-line">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-20 animate-rise-in">
            {kicker && <p className="kicker text-acero mb-4">{kicker}</p>}
            <h1 className="text-5xl md:text-6xl leading-[1.05]">{title} {accent && <span className="accent">{accent}</span>}</h1>
            {intro && <p className="mt-6 text-lg text-acero-600 max-w-2xl leading-relaxed">{intro}</p>}
            {children}
        </div>
    </section>
);

const SectionTitle = ({ kicker, children, accent, center = false, light = false }) => (
    <div className={`mb-12 reveal ${center ? 'text-center' : ''}`}>
        {kicker && <p className={`kicker mb-3 ${light ? 'text-acero-300' : 'text-acero'}`}>{kicker}</p>}
        <h2 className="text-4xl md:text-5xl leading-tight">{children} {accent && <span className={light ? 'italic text-acero-300' : 'accent'}>{accent}</span>}</h2>
    </div>
);

// Legal pages: values in [corchetes] are placeholders, highlighted until filled in.
const Placeholders = ({ children }) => String(children).split(/(\[[^\]]+\])/g)
    .map((p, i) => (p.startsWith('[') ? <mark key={i} className="bg-hielo-200 text-noche px-1 rounded">{p}</mark> : p));

const LegalPage = ({ kicker, title, accent, updated, sections }) => (
    <>
        <PageHero kicker={kicker} title={title} accent={accent} intro={`Última actualización: ${updated}`} />
        <section className="max-w-6xl mx-auto px-4 md:px-8 py-14 grid md:grid-cols-4 gap-12">
            <nav className="hidden md:block md:sticky md:top-28 self-start text-sm space-y-3" aria-label="Índice">
                {sections.map(s => <a key={s.id} href={`#${s.id}`} className="block text-acero-600 hover:text-noche">{s.title}</a>)}
            </nav>
            <div className="md:col-span-3 space-y-12">
                {sections.map(s => (
                    <article key={s.id} id={s.id} className="scroll-mt-28">
                        <h2 className="text-3xl mb-3">{s.title}</h2>
                        <div className="space-y-3 text-acero-600 leading-relaxed">{s.body.map((p, i) => <p key={i}><Placeholders>{p}</Placeholders></p>)}</div>
                    </article>
                ))}
            </div>
        </section>
    </>
);

const renderPage = (Page) => {
    ReactDOM.createRoot(document.getElementById('root')).render(<Layout><Page /></Layout>);
};
