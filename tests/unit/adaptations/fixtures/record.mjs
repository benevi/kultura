// Graba las respuestas de Wikidata de los 50 títulos de prueba (F-29).
// Uso (desde la raíz del repo, con red):
//   node --experimental-strip-types tests/unit/adaptations/fixtures/record.mjs
// Escribe wikidata-responses.json junto a este archivo. Los tests NUNCA salen
// a la red: leen lo grabado.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildAdaptationsQuery,
  wikidataKeyFor,
  WIKIDATA_SPARQL_URL,
  WIKIDATA_USER_AGENT,
} from "../../../../src/lib/api/wikidata.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(path.join(dir, "cases.json"), "utf8"));
const out = {};
for (const c of cases) {
  const key = wikidataKeyFor(c.mediaId, { rawgSlug: c.rawgSlug });
  if (!key) {
    out[c.mediaId] = null;
    continue;
  }
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(buildAdaptationsQuery(key))}&format=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": WIKIDATA_USER_AGENT },
  });
  if (!res.ok) throw new Error(`${c.mediaId}: ${res.status}`);
  const json = await res.json();
  // Solo `value` de cada campo (lo que lee el parser): el archivo pesa la mitad.
  const bindings = json.results.bindings.map((b) =>
    Object.fromEntries(Object.entries(b).map(([k, v]) => [k, { value: v.value }])),
  );
  out[c.mediaId] = { results: { bindings } };
  process.stdout.write(`${c.mediaId}: ${json.results.bindings.length} filas\n`);
  await new Promise((r) => setTimeout(r, 300));
}
writeFileSync(path.join(dir, "wikidata-responses.json"), JSON.stringify(out) + "\n");
