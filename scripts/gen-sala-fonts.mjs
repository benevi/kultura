#!/usr/bin/env node
// Genera los @font-face de «Sala» (src/styles/sala/fonts*.css) a partir de los
// CSS de los paquetes @fontsource-variable de los que salieron los archivos de
// assets/fonts/ (versiones en assets/LICENSES.csv). De ahí se toma el
// `unicode-range` de cada archivo; solo se escriben reglas para los archivos
// que están en el repo (de Noto Sans KR no se guardan todos los trozos).
//
// Uso (no hace falta red si ya tienes los paquetes):
//   npm i --no-save --prefix <dir-vacío> @fontsource-variable/anybody@5.3.0 \
//     @fontsource-variable/instrument-sans@5.3.0 \
//     @fontsource-variable/noto-sans-jp@5.3.1 @fontsource-variable/noto-sans-kr@5.3.1
//   node scripts/gen-sala-fonts.mjs <dir-vacío>
//
// Las versiones van fijadas (`version` en FAMILIES): con otra, los
// `unicode-range` podrían no ser los de los archivos guardados, así que el
// script se para. También se para si un archivo del repo no es, byte a byte,
// el del paquete.
//
// `tests/unit/design/sala-fonts.test.ts` comprueba que lo generado y los
// archivos del repo casan uno a uno.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src/styles/sala");
const FONTS_DIR = join(ROOT, "assets/fonts");
/** De src/styles/sala/ a assets/fonts/. El empaquetador resuelve y copia cada archivo. */
const URL_PREFIX = "../../../assets/fonts";

const FAMILIES = [
  // out · paquete y versión (la de assets/LICENSES.csv) · CSS del paquete · carpeta · familia · nombre de archivo en el repo
  {
    out: "fonts.css",
    pkg: "anybody",
    version: "5.3.0",
    css: "standard.css",
    dir: "anybody",
    family: "Anybody",
    local: (subset) => `Anybody-${subset}-wdth-wght.woff2`,
    pattern: /anybody-(latin|latin-ext)-standard-normal\.woff2/,
  },
  {
    out: "fonts.css",
    pkg: "instrument-sans",
    version: "5.3.0",
    css: "standard.css",
    dir: "instrument-sans",
    family: "Instrument Sans",
    local: (subset) => `InstrumentSans-${subset}-wdth-wght.woff2`,
    pattern: /instrument-sans-(latin|latin-ext)-standard-normal\.woff2/,
  },
  {
    out: "fonts-jp.css",
    pkg: "noto-sans-jp",
    version: "5.3.1",
    css: "wght.css",
    dir: "noto-sans-jp",
    family: "Noto Sans JP",
    local: (n) => `NotoSansJP-${n}-wght.woff2`,
    pattern: /noto-sans-jp-(\d+)-wght-normal\.woff2/,
  },
  {
    out: "fonts-kr.css",
    pkg: "noto-sans-kr",
    version: "5.3.1",
    css: "wght.css",
    dir: "noto-sans-kr",
    family: "Noto Sans KR",
    local: (n) => `NotoSansKR-${n}-wght.woff2`,
    pattern: /noto-sans-kr-(\d+)-wght-normal\.woff2/,
  },
];

/** Busca `<paquete>/…/<css>` bajo `dir` (vale `node_modules` o un `npm pack` descomprimido). */
function findCss(dir, pkg, css, depth = 0) {
  if (depth > 5) return null;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name === pkg || name.startsWith(`fontsource-variable-${pkg}-`)) {
      for (const candidate of [join(full, css), join(full, "package", css)]) {
        if (existsSync(candidate)) return candidate;
      }
    }
    const found = findCss(full, pkg, css, depth + 1);
    if (found) return found;
  }
  return null;
}

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error("Uso: node scripts/gen-sala-fonts.mjs <directorio con los paquetes @fontsource-variable>");
  process.exit(1);
}

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

const outputs = new Map();
for (const fam of FAMILIES) {
  const cssPath = findCss(resolve(source), fam.pkg, fam.css);
  if (!cssPath) {
    console.error(`No encuentro ${fam.css} de @fontsource-variable/${fam.pkg} en ${source}`);
    process.exit(1);
  }
  const pkgDir = dirname(cssPath);
  const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  if (version !== fam.version) {
    throw new Error(
      `@fontsource-variable/${fam.pkg}: hay ${version} en ${pkgDir} y los archivos del repo son de ${fam.version}. ` +
        "Para cambiar de versión hay que cambiar también los .woff2 y su fila en assets/LICENSES.csv."
    );
  }
  const rules = [];
  for (const block of readFileSync(cssPath, "utf8").split("@font-face").slice(1)) {
    const file = fam.pattern.exec(block);
    if (!file) continue;
    const local = fam.local(file[1]);
    if (!existsSync(join(FONTS_DIR, fam.dir, local))) continue; // trozo que no se guarda
    const packaged = join(pkgDir, "files", file[0]);
    if (!existsSync(packaged)) throw new Error(`${local}: el paquete no trae ${packaged}`);
    if (sha256(packaged) !== sha256(join(FONTS_DIR, fam.dir, local))) {
      throw new Error(`${local}: no es el mismo archivo que ${file[0]} de @fontsource-variable/${fam.pkg}@${version}`);
    }
    const prop = (name) => new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1].trim();
    const range = prop("unicode-range");
    if (!range) throw new Error(`${local}: sin unicode-range en ${cssPath}`);
    const weight = prop("font-weight");
    if (!weight) throw new Error(`${local}: sin font-weight en ${cssPath}`);
    const stretch = prop("font-stretch");
    rules.push(
      [
        "@font-face {",
        `  font-family: "${fam.family}";`,
        "  font-style: normal;",
        "  font-display: swap;",
        `  font-weight: ${weight};`,
        ...(stretch ? [`  font-stretch: ${stretch};`] : []),
        `  src: url("${URL_PREFIX}/${fam.dir}/${local}") format("woff2");`,
        `  unicode-range: ${range};`,
        "}",
      ].join("\n")
    );
  }
  const present = readdirSync(join(FONTS_DIR, fam.dir)).filter((f) => f.endsWith(".woff2")).length;
  if (rules.length !== present) {
    throw new Error(`${fam.family}: ${present} archivos en el repo y ${rules.length} reglas generadas`);
  }
  outputs.set(fam.out, [...(outputs.get(fam.out) ?? []), `/* ${fam.family} · ${rules.length} archivos */`, ...rules]);
}

for (const [name, parts] of outputs) {
  const header = "/* GENERADO por scripts/gen-sala-fonts.mjs. No editar. Licencias: assets/LICENSES.csv */\n\n";
  writeFileSync(join(OUT_DIR, name), header + parts.join("\n\n") + "\n");
  console.log(`${name}: ${parts.filter((p) => p.startsWith("@font-face")).length} reglas`);
}
