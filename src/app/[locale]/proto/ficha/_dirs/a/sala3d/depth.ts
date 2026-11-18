// Prototipo fase 8.3 — mapas de profundidad de las obras fijas (`?3d=fondo`).
// Archivos estáticos de la rama, generados EN LOCAL con
// `scripts/proto-depth/build.py` (Depth Anything V2 Small, Apache-2.0). No hay
// servicio, ni subida, ni copia de la imagen: solo los dos mapas derivados.
//   d: profundidad para el parallax (dilatada y suavizada, como la landing).
//   m: máscara del corte (pegada a los contornos y sin el suelo).
// Clave: `tipo/id externo` de la obra. Solo las obras en modo Sala (imagen
// apaisada): la Pieza no usa mapa. Una Sala sin mapa no admite `fondo`.

const at = (slug: string) => ({ d: `/proto/depth/${slug}.d.jpg`, m: `/proto/depth/${slug}.m.jpg` });

export const DEPTH: Record<string, { d: string; m: string }> = {
  "movie/496243": at("parasitos"),
  "game/274755": at("hades"),
};
