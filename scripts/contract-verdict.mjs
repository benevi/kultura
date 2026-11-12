// Veredicto del contrato de proveedores (lo usa .github/workflows/contract.yml).
// Lee contract-result.json (tests/contract/outage-reporter.ts):
//   - Sin archivo o con fallos en `broken` → sale con 1 (el workflow abre issue).
//   - Solo caídas (`outage`) → aviso en el resumen y sale con 0.
// Uso: node scripts/contract-verdict.mjs <outcome del paso de tests>
import { existsSync, readFileSync } from "node:fs";

const outcome = process.argv[2] ?? "failure";
const file = "contract-result.json";

if (!existsSync(file)) {
  console.error(`::error::No hay ${file}: los tests de contrato no llegaron a terminar.`);
  process.exit(1);
}

const { outage = [], broken = [] } = JSON.parse(readFileSync(file, "utf8"));

for (const line of broken) console.error(`::error::Contrato roto · ${line}`);
for (const line of outage) console.log(`::warning::Proveedor caído · ${line}`);

if (broken.length > 0) process.exit(1);
if (outcome !== "success" && outage.length === 0) {
  console.error("::error::Los tests fallaron sin ningún fallo clasificado.");
  process.exit(1);
}
if (outage.length > 0) {
  console.log(`Solo proveedores caídos (${outage.length}); el contrato no se da por roto.`);
}
