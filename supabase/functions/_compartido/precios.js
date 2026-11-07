// Server-side pricing for 1.1.1 (Etapa 2). Same rules as priceBag() in js/tienda.jsx, but:
//   · input comes from the browser and is NOT trusted: only ids, sizes, names and quantities are read from it;
//   · every amount comes from the catalogue (productos.json + tienda.json) and is computed in integer cents.
// Plain ESM (no TypeScript) so it runs in Deno (Edge Functions) and in Node (precios.test.mjs).

export const LIMITS = { maxLines: 30, maxQtyPerLine: 20, maxNameLength: 24 };

export class PricingError extends Error {
    constructor(code, detail) { super(code); this.code = code; this.detail = detail; }
}

const cents = (mxn) => {
    const c = Math.round(Number(mxn) * 100);
    if (!Number.isSafeInteger(c) || c < 0) throw new PricingError('catalogo-invalido', mxn);
    return c;
};

// Student name to embroider: letters (with accents), spaces, apostrophe, dot and hyphen only.
const cleanName = (raw) => {
    const name = String(raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!name) return '';
    if (name.length > LIMITS.maxNameLength || !/^[\p{L}][\p{L} .'\-]*$/u.test(name)) throw new PricingError('nombre-bordado-invalido');
    return name;
};

/**
 * @param {{ lines: {productId: string, size: string, name?: string, qty: number}[], shippingId: string, paymentId: string }} input
 * @param {{ products: object[] }} productos  productos.json
 * @param {{ embroidery_mxn: number, shipping: object[], payments: object[] }} rules  tienda.json
 */
export function priceOrder(input, productos, rules) {
    const raw = Array.isArray(input?.lines) ? input.lines : null;
    if (!raw || raw.length === 0) throw new PricingError('bolsa-vacia');
    if (raw.length > LIMITS.maxLines) throw new PricingError('demasiadas-lineas');

    const method = rules.shipping.find((s) => s.id === input.shippingId);
    if (!method) throw new PricingError('entrega-invalida');
    if (!method.payments.includes(input.paymentId) || !rules.payments.some((p) => p.id === input.paymentId)) {
        throw new PricingError('pago-no-permitido');
    }

    const byId = new Map(productos.products.filter((p) => p.active !== false).map((p) => [p.id, p]));
    const merged = new Map();   // same product + size + name → one line (as bag.add does)
    for (const l of raw) {
        const product = byId.get(String(l?.productId));
        if (!product) throw new PricingError('producto-no-disponible', l?.productId);
        const variant = (product.variants || []).find((v) => v.size === String(l.size));
        if (!variant) throw new PricingError('talla-no-disponible', `${product.id}/${l.size}`);
        const qty = Number(l.qty);
        if (!Number.isInteger(qty) || qty < 1 || qty > LIMITS.maxQtyPerLine) throw new PricingError('cantidad-invalida');
        const name = cleanName(l.name);
        if (name && !product.embroidery) throw new PricingError('bordado-no-disponible', product.id);

        const key = `${product.id}|${variant.size}|${name}`;
        const prev = merged.get(key);
        if (prev && prev.qty + qty > LIMITS.maxQtyPerLine) throw new PricingError('cantidad-invalida');
        merged.set(key, prev ? { ...prev, qty: prev.qty + qty } : {
            product_id: product.id, sku: variant.sku, name: product.name, size: variant.size,
            embroidery_name: name, qty, unit_cents: cents(variant.price_mxn),
        });
    }

    const lines = [...merged.values()];
    const pieces = lines.reduce((a, l) => a + l.qty, 0);
    const subtotal_cents = lines.reduce((a, l) => a + l.qty * l.unit_cents, 0);
    const embPieces = lines.filter((l) => l.embroidery_name).reduce((a, l) => a + l.qty, 0);
    const embroidery_unit_cents = cents(rules.embroidery_mxn);
    const embroidery_cents = embPieces * embroidery_unit_cents;
    const free = method.free_from_mxn && subtotal_cents >= cents(method.free_from_mxn);
    const shipping_cents = free ? 0 : cents(method.cost_mxn);

    return {
        lines, pieces, embPieces, embroidery_unit_cents,
        shipping: { id: method.id, label: method.label },
        payment: input.paymentId,
        subtotal_cents, embroidery_cents, shipping_cents,
        total_cents: subtotal_cents + embroidery_cents + shipping_cents,
    };
}
