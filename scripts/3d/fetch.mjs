#!/usr/bin/env node
// Baja los modelos del manifest (scripts/3d/sources.json) a scratch/3d/raw.
// Solo Node estándar; sin claves. Poly Haven publica todo con CC0 y una API
// pública: https://api.polyhaven.com/files/<id> devuelve el glTF por resolución
// con sus texturas (`include`). Es idempotente: no vuelve a bajar lo que ya está.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const manifest = JSON.parse(await readFile(join(here, "sources.json"), "utf8"));
const rawDir = resolve(root, manifest.rawDir);

const API = "https://api.polyhaven.com";

async function exists(p) {
  try {
    const s = await stat(p);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  if (await exists(dest)) return false;
  await mkdir(dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function fetchModel(m) {
  const info = await (await fetch(`${API}/files/${m.id}`)).json();
  const gltf = info.gltf?.[m.resolution]?.gltf;
  if (!gltf) throw new Error(`${m.id}: Poly Haven no ofrece glTF a ${m.resolution}`);
  const dir = join(rawDir, m.id);
  let fresh = await download(gltf.url, join(dir, `${m.id}_${m.resolution}.gltf`));
  for (const [rel, file] of Object.entries(gltf.include ?? {})) {
    fresh = (await download(file.url, join(dir, rel))) || fresh;
  }
  console.log(`${fresh ? "↓" : "="} ${m.id} (${Object.keys(gltf.include ?? {}).length + 1} archivos)`);
}

async function fetchEnvironment(e) {
  const info = await (await fetch(`${API}/files/${e.id}`)).json();
  const file = info.hdri?.[e.resolution]?.[e.format];
  if (!file) throw new Error(`${e.id}: sin HDRI ${e.format} a ${e.resolution}`);
  const dest = join(rawDir, "hdri", `${e.id}_${e.resolution}.${e.format}`);
  const fresh = await download(file.url, dest);
  console.log(`${fresh ? "↓" : "="} ${e.id} (${(file.size / 1e6).toFixed(2)} MB)`);
}

const only = process.argv.slice(2);
const models = manifest.models.filter((m) => only.length === 0 || only.includes(m.id));
for (const m of models) await fetchModel(m);
if (manifest.environment && (only.length === 0 || only.includes(manifest.environment.id))) {
  await fetchEnvironment(manifest.environment);
}
