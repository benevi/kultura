"use client";

import { TextureLoader } from "three";
import type { GLTFLoader } from "three-stdlib";

/**
 * Ajuste común de los cargadores glTF (lo usan los modelos generados con
 * gltfjsx). Las texturas van embebidas en el .glb y three las sirve como
 * URLs `blob:`; su `ImageBitmapLoader` las pide con `fetch`, que la CSP de
 * Kultura no permite para `blob:` (`connect-src`), mientras que `img-src` sí
 * lo admite. Con `TextureLoader` (un `<img>`) cargan sin tocar la CSP y sin
 * Draco, meshopt ni KTX2 (no hay WASM ni workers).
 */
export function extendGltfLoader(loader: GLTFLoader): void {
  // El cargador de texturas se elige en cada `GLTFParser`, no en el loader, y
  // `register` es el único punto en el que se recibe el parser antes de parsear.
  if ((loader as unknown as { kulturaTextures?: boolean }).kulturaTextures) return;
  (loader as unknown as { kulturaTextures?: boolean }).kulturaTextures = true;
  loader.register((parser) => {
    (parser as unknown as { textureLoader: TextureLoader }).textureLoader = new TextureLoader(loader.manager);
    return { name: "KULTURA_texture_loader" } as unknown as import("three-stdlib").GLTFLoaderPlugin;
  });
}
