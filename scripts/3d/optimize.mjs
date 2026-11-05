#!/usr/bin/env node
// Optimiza los modelos crudos (scratch/3d/raw) y deja un .glb por modelo en
// public/3d, dentro de su presupuesto. Sigue la guía de gltf-transform
// (https://gltf-transform.dev/cli) con una restricción propia de Kultura: la CSP
// de producción no permite workers `blob:` ni WASM, así que no se usa Draco,
// meshopt ni KTX2. Lo que sí: dedup, prune, flatten, texturas WebP
// (KHR_texture_webp, lo decodifica el navegador) y cuantización
// (KHR_mesh_quantization, sin decodificador). También escribe
// public/3d/CREDITS.md con la fuente y la licencia de cada pieza.
import { mkdir, readFile, writeFile, copyFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, normals, prune, quantize, resample, simplify, textureCompress, weld, join as joinMeshes } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const manifest = JSON.parse(await readFile(join(here, "sources.json"), "utf8"));
const rawDir = resolve(root, manifest.rawDir);
const outDir = resolve(root, manifest.outputDir);
await mkdir(outDir, { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const only = process.argv.slice(2);
const models = manifest.models.filter((m) => only.length === 0 || only.includes(m.id));
const report = [];
let failed = false;

for (const m of models) {
  const src = join(rawDir, m.id, `${m.id}_${m.resolution}.gltf`);
  const dest = join(outDir, `${m.id}.glb`);
  const doc = await io.read(src);
  if (m.simplify) {
    // Los escaneos traen normales y tangentes por cara que impiden simplificar
    // (cada arista es una costura). Se quitan, se simplifica y se recalculan.
    for (const prim of doc.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives())) {
      prim.setAttribute("NORMAL", null);
      prim.setAttribute("TANGENT", null);
    }
  }
  if (m.keepBooks) {
    // Del juego de libros bastan los primeros N; el resto se instancia en escena.
    for (const node of doc.getRoot().listNodes()) {
      const idx = Number(/book(\d+)$/.exec(node.getName() ?? "")?.[1]);
      if (idx && idx > m.keepBooks) node.dispose();
    }
  }
  await doc.transform(
    dedup(),
    prune(),
    resample(),
    flatten(),
    // Los juegos (libros sueltos, tapa de la consola) se dejan como nodos
    // independientes para poder moverlos; el resto se une en una malla.
    ...(m.keepNodes ? [] : [joinMeshes({ keepNamed: true })]),
    // La geometría de los escaneos pesa más que las texturas: se suelda y se
    // simplifica en build (meshoptimizer solo corre aquí, en Node; el .glb
    // resultante es glTF normal, sin decodificador en el cliente).
    weld(),
    ...(m.simplify ? [simplify({ simplifier: MeshoptSimplifier, ratio: m.simplify, error: m.simplifyError ?? 0.05 }), normals({ overwrite: true })] : []),
    textureCompress({ encoder: sharp, targetFormat: "webp", quality: m.webpQuality ?? 80, resize: [m.textureSize, m.textureSize] }),
    quantize(),
  );
  await io.write(dest, doc);
  const kb = Math.round((await stat(dest)).size / 1024);
  const ok = kb <= m.budgetKB;
  if (!ok) failed = true;
  report.push({ ...m, kb, ok });
  console.log(`${ok ? "✓" : "✗"} ${m.id}.glb ${kb} KB (presupuesto ${m.budgetKB} KB)`);
}

const env = manifest.environment;
if (env && (only.length === 0 || only.includes(env.id))) {
  const src = join(rawDir, "hdri", `${env.id}_${env.resolution}.${env.format}`);
  const dest = join(outDir, `${env.id}_${env.resolution}.${env.format}`);
  await copyFile(src, dest);
  const kb = Math.round((await stat(dest)).size / 1024);
  const ok = kb <= env.budgetKB;
  if (!ok) failed = true;
  report.push({ ...env, kb, ok });
  console.log(`${ok ? "✓" : "✗"} ${env.id} ${kb} KB (presupuesto ${env.budgetKB} KB)`);
}

if (only.length === 0) {
  const total = report.reduce((a, r) => a + r.kb, 0);
  const lines = [
    "# Modelos 3D de la landing",
    "",
    "Todos los modelos y el HDRI son **CC0** (dominio público) de [Poly Haven](https://polyhaven.com).",
    "Se descargan con `npm run 3d:fetch` y se optimizan con `npm run 3d:build` (`scripts/3d/`).",
    "",
    "| Archivo | Pieza | Autor | Licencia | Peso |",
    "|---|---|---|---|---|",
    ...report.map((r) => `| \`${r.id}${r.format ? `_${r.resolution}.${r.format}` : ".glb"}\` | [${r.name}](${r.url}) | ${r.author} | ${r.license} | ${r.kb} KB |`),
    "",
    `Total: ${Math.round(total / 1024 * 10) / 10} MB, cargados en diferido tras el LCP y solo cuando \`sceneAllowed\` lo permite.`,
    "",
  ];
  await writeFile(join(outDir, "CREDITS.md"), lines.join("\n"));
}

if (failed) {
  console.error("Algún modelo supera su presupuesto: baja textureSize o webpQuality en scripts/3d/sources.json.");
  process.exit(1);
}
