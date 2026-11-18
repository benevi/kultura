// GENERADO por `scripts/proto-depth/build.py` — no editar a mano.
// Prototipo fase 8.3 — mapas de las obras fijas en modo Sala (`?3d=fondo`).
// Archivos estáticos de la rama, calculados EN LOCAL: no hay servicio, ni
// subida, ni copia de la imagen; solo los mapas derivados.
//   d: profundidad para el parallax (Depth Anything V2 Small, Apache-2.0).
//   m: máscara de primer plano, sin pérdida (BiRefNet, MIT): lo que pasa por
//      delante del título.
// Clave: `tipo/id externo`. Una Sala sin mapa no admite `fondo`.

export const DEPTH: Record<string, { d: string; m: string }> = {
  "movie/496243": { d: "/proto/depth/parasitos.d.jpg", m: "/proto/depth/parasitos.m.png" },
  "game/274755": { d: "/proto/depth/hades.d.jpg", m: "/proto/depth/hades.m.png" },
  "anime/al-199": { d: "/proto/depth/chihiro.d.jpg", m: "/proto/depth/chihiro.m.png" },
};
