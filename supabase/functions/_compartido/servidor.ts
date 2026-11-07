// Shared server helpers for the 1.1.1 Edge Functions: env, CORS, Stripe/Supabase clients, catalogue, JSON replies.
// Secrets are read ONLY here, from Supabase function secrets (supabase secrets set …). Never from the request.
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const need = (k: string): string => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`falta el secreto ${k}`);
  return v;
};

// https://zarem.mx (live) or the test domain. Used for CORS, success/cancel URLs and to read the catalogue.
export const SITE_URL = need("SITE_URL").replace(/\/$/, "");
// Schools with online payments. A school not listed here cannot be charged even if its folder exists.
export const SCHOOLS = new Set(["colegio_la_florida"]);

export const stripe = new Stripe(need("STRIPE_SECRET_KEY"), {   // restricted key rk_… (see SECURITY.md)
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase in every Edge Function.
export const admin = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

export const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") === SITE_URL ? SITE_URL : "null",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Vary": "Origin",
});

export const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Catalogue = the published JSON of the school (single source of truth in 1.1.1). Short in-memory cache.
const cache = new Map<string, { at: number; data: [unknown, unknown] }>();
export async function catalogue(school: string) {
  if (!SCHOOLS.has(school)) throw new Error("colegio sin pagos en línea");
  const hit = cache.get(school);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  const get = async (f: string) => {
    const r = await fetch(`${SITE_URL}/${school}/db/${f}.json`, { headers: { "cache-control": "no-cache" } });
    if (!r.ok) throw new Error(`catálogo ${f}: ${r.status}`);
    return r.json();
  };
  const data = await Promise.all([get("productos"), get("tienda")]) as [unknown, unknown];
  cache.set(school, { at: Date.now(), data });
  return data;
}

export const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

export const randomToken = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
