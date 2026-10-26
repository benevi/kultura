#!/usr/bin/env node
// ============================================================
// F-29 · Comprobación EN PRODUCCIÓN de "También existe como…" y las tarjetas
// (no es un test de vitest: se ejecuta a mano tras desplegar).
//
//   node tests/unit/adaptations/check-production.mjs [--base https://kulturaapp.vercel.app] [--user benevi]
//
// 1. Para los 50 títulos de `fixtures/titles.json` abre su ficha pública y
//    busca, dentro de la sección `#adaptations-title`, un enlace a la ficha
//    del formato esperado cuyo texto case con el nombre esperado. La primera
//    visita de un título consulta Wikidata (puede no llegar a tiempo): si la
//    sección no sale, se reintenta una vez a los 5 s. Aceptación: ≥ 70 %.
// 2. Tarjetas OG: la del perfil (`--user`) y la genérica de una nota son PNG
//    con caché corta (no la de un año), y un id de tarjeta inventado da 404.
//
// Sin sesión, sin formularios y ≤ 1 petición por segundo.
// ============================================================

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = opt("base", "https://kulturaapp.vercel.app").replace(/\/+$/, "");
const USER = opt("user", "benevi");
const DIR = path.dirname(fileURLToPath(import.meta.url));
const titles = JSON.parse(readFileSync(path.join(DIR, "fixtures", "titles.json"), "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function get(url) {
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  last = Date.now();
  return fetch(url, { headers: { "User-Agent": "KULTURA-check/1.0 (+https://kulturaapp.vercel.app)" }, redirect: "follow" });
}

function kulturaPath(t) {
  if (t.type === "game") return t.kulturaId ? `/es/media/game/${t.kulturaId}` : null;
  return `/es/media/${t.type}/${encodeURIComponent(t.externalId)}`;
}

/** Enlaces (href + texto) de la sección de adaptaciones del HTML. */
function sectionLinks(html) {
  const start = html.indexOf('id="adaptations-title"');
  if (start < 0) return null;
  const end = html.indexOf("</section>", start);
  const chunk = html.slice(start, end < 0 ? undefined : end);
  const links = [];
  for (const m of chunk.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
    links.push({ href: m[1], text });
  }
  return links;
}

let ok = 0;
let checked = 0;
for (const t of titles) {
  const p = kulturaPath(t);
  if (!p) {
    console.log("??", t.slug, "sin id de KULTURA");
    continue;
  }
  checked++;
  let links = null;
  for (let attempt = 0; attempt < 2 && !links; attempt++) {
    if (attempt) await sleep(5000);
    const res = await get(`${BASE}${p}`);
    links = res.ok ? sectionLinks(await res.text()) : null;
    if (!res.ok) console.log("  HTTP", res.status, p);
  }
  const re = new RegExp(t.expect.label, "i");
  const hit = (links ?? []).find((l) => l.href.startsWith(`/es/media/${t.expect.type}/`) && re.test(l.text));
  if (hit) ok++;
  console.log(hit ? "OK" : "--", t.slug.padEnd(24), hit ? `${hit.href}  ${hit.text.slice(0, 50)}` : links ? `${links.length} vínculos, ninguno esperado` : "sin sección");
}
const ratio = checked ? ok / checked : 0;
console.log(`\nAdaptaciones: ${ok}/${checked} (${Math.round(ratio * 100)} %, aceptación ≥ 70 %)`);

// ── Tarjetas OG ──────────────────────────────────────────────────────────────
let ogFail = 0;
async function card(url, expectStatus) {
  const res = await get(url);
  const cc = res.headers.get("cache-control") ?? "";
  const type = res.headers.get("content-type") ?? "";
  const good = res.status === expectStatus && (expectStatus !== 200 || (type.startsWith("image/png") && !cc.includes("31536000")));
  if (!good) ogFail++;
  console.log(good ? "OK" : "--", res.status, type, cc, url.replace(BASE, ""));
}
console.log("\nTarjetas:");
await card(`${BASE}/es/u/${USER}/opengraph-image`, 200);
await card(`${BASE}/es/u/${USER}/r/movie/438631/opengraph-image/card`, 200);
await card(`${BASE}/en/u/${USER}/r/movie/438631/opengraph-image/card`, 200);
await card(`${BASE}/es/u/${USER}/r/movie/438631/opengraph-image/AAAAAAAAAAAAAAAAAAAAAA`, 404);

process.exit(ratio >= 0.7 && ogFail === 0 ? 0 : 1);
