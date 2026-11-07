// node supabase/functions/_compartido/precios.test.mjs   (desde zarem.mx/; usa el catálogo real del colegio)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { priceOrder, PricingError } from './precios.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../../../colegio_la_florida/db/${f}`, import.meta.url)));
const productos = read('productos.json');
const rules = read('tienda.json');
const polo = productos.products.find((p) => p.id === 'cl-102');
const v = polo.variants[0];
const order = (lines, shippingId = 'tienda', paymentId = 'tarjeta') => priceOrder({ lines, shippingId, paymentId }, productos, rules);
const fails = (fn, code) => assert.throws(fn, (e) => e instanceof PricingError && e.code === code);

test('precio del catálogo, en centavos', () => {
    const r = order([{ productId: polo.id, size: v.size, qty: 2 }]);
    assert.equal(r.subtotal_cents, 2 * Math.round(v.price_mxn * 100));
    assert.equal(r.lines[0].sku, v.sku);
    assert.equal(r.total_cents, r.subtotal_cents);
});

test('ignora precios enviados por el navegador', () => {
    const r = order([{ productId: polo.id, size: v.size, qty: 1, price_mxn: 1, unit_cents: 1 }]);
    assert.equal(r.lines[0].unit_cents, Math.round(v.price_mxn * 100));
});

test('bordado por pieza con nombre', () => {
    const r = order([{ productId: polo.id, size: v.size, qty: 3, name: 'Ana López' }]);
    assert.equal(r.embroidery_cents, 3 * rules.embroidery_mxn * 100);
});

test('envío a domicilio: cobra debajo del umbral, gratis desde el umbral', () => {
    const dom = rules.shipping.find((s) => s.id === 'domicilio');
    const r1 = order([{ productId: polo.id, size: v.size, qty: 1 }], 'domicilio', 'oxxo');
    assert.equal(r1.shipping_cents, dom.cost_mxn * 100);
    const n = Math.ceil(dom.free_from_mxn / v.price_mxn);
    const r2 = order([{ productId: polo.id, size: v.size, qty: n }], 'domicilio', 'tarjeta');
    assert.equal(r2.shipping_cents, 0);
});

test('une líneas iguales', () => {
    const r = order([{ productId: polo.id, size: v.size, qty: 1 }, { productId: polo.id, size: v.size, qty: 2 }]);
    assert.equal(r.lines.length, 1);
    assert.equal(r.lines[0].qty, 3);
});

test('rechaza entradas inválidas', () => {
    fails(() => order([]), 'bolsa-vacia');
    fails(() => order([{ productId: 'x', size: '4', qty: 1 }]), 'producto-no-disponible');
    fails(() => order([{ productId: polo.id, size: 'XXL-falsa', qty: 1 }]), 'talla-no-disponible');
    for (const qty of [0, -1, 1.5, 21, '1e9']) fails(() => order([{ productId: polo.id, size: v.size, qty }]), 'cantidad-invalida');
    fails(() => order([{ productId: polo.id, size: v.size, qty: 1, name: '<script>' }]), 'nombre-bordado-invalido');
    fails(() => order([{ productId: polo.id, size: v.size, qty: 1, name: 'x'.repeat(25) }]), 'nombre-bordado-invalido');
    fails(() => order([{ productId: polo.id, size: v.size, qty: 1 }], 'tienda', 'oxxo'), 'pago-no-permitido');
    fails(() => order([{ productId: polo.id, size: v.size, qty: 1 }], 'domicilio', 'efectivo'), 'pago-no-permitido');
    fails(() => order([{ productId: polo.id, size: v.size, qty: 1 }], 'luna', 'tarjeta'), 'entrega-invalida');
    fails(() => order(Array.from({ length: 31 }, () => ({ productId: polo.id, size: v.size, qty: 1 }))), 'demasiadas-lineas');
});

test('mismo total que priceBag() del navegador', () => {
    // priceBag en js/tienda.jsx: subtotal + bordado + envío (gratis desde free_from_mxn)
    const lines = [{ productId: polo.id, size: v.size, qty: 2, name: 'Luis' }, { productId: polo.id, size: polo.variants.at(-1).size, qty: 1 }];
    const r = order(lines, 'domicilio', 'tarjeta');
    const sub = 2 * v.price_mxn + polo.variants.at(-1).price_mxn;
    const dom = rules.shipping.find((s) => s.id === 'domicilio');
    const expected = sub + 2 * rules.embroidery_mxn + (sub >= dom.free_from_mxn ? 0 : dom.cost_mxn);
    assert.equal(r.total_cents, Math.round(expected * 100));
});
