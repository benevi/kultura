import type { Rgb } from "@/lib/design/color";
import { SALA_TITLE_WIDE_FROM_REM } from "@/lib/design/sala-title";
import { resolveSalaFuse, type SalaFuseData, type SalaFuseResolved } from "@/lib/design/sala-title-fuse";
import { measureLetterCoverage, measureVisibleContrast, type TitleRaster } from "@/lib/design/title-fuse";

/**
 * Medidas del rótulo sobre la imagen para las historias: lo que el navegador
 * ha pintado de verdad, píxel a píxel. Vive aquí y no en `src` porque medir es
 * trabajo de la sala (fase 8.5, con la máscara de la figura calculada de
 * antemano); `SalaStage` solo recibe lo ya medido. Las historias lo usan para
 * dos cosas: darle a `SalaStage` unas coberturas de ejemplo que son las de
 * verdad, y comprobar en el `play` que lo pintado cumple los topes.
 *
 * Cómo mide: pinta cada letra del título en un lienzo, con la misma fuente,
 * anchura y tamaño, en el sitio donde el navegador la ha puesto
 * (`Range.getClientRects`), y la cruza con la figura y con la imagen ya
 * velada. Solo vale para títulos en alfabeto latino (los de Anybody).
 */

export interface LetraMedida {
  /** El carácter. */
  ch: string;
  /** Caja de la letra en la sala, en píxeles CSS. */
  x: number;
  y: number;
  width: number;
  height: number;
  line: number;
  /** Esquina del recorte de la letra, en píxeles de la sala. */
  x0: number;
  y0: number;
  /** La letra sola, en su recorte: para volver a medirla con otra figura. */
  raster: TitleRaster;
  /** Lo que tiene detrás en ese recorte, RGBA: sin fundido y con la figura por delante del velo. */
  detras: Uint8ClampedArray;
  detrasConFigura: Uint8ClampedArray;
}

export interface MedidaSala {
  /** Qué composición está pintada. */
  layout: "narrow" | "wide";
  /** Ancho y alto de la sala, en píxeles CSS. */
  width: number;
  height: number;
  letras: LetraMedida[];
  /** Tinta del título (sRGB 0–1). */
  ink: Rgb;
  /** Lo que se le pasa a `SalaStage`. */
  data: SalaFuseData;
  /** Contraste mínimo del título sin fundido, contra la imagen con su velo. */
  contrasteSinFundido: number;
}

const caras = new Map<string, Promise<string>>();

/**
 * Espera a que acaben las animaciones de entrada. Si en 2 s no han acabado,
 * las termina: lo que se mide es el estado final. En las pruebas se ha visto
 * que, tras cambiar el tamaño de la ventana, alguna no llega a acabar nunca.
 */
async function animacionesTerminadas(raiz: Element): Promise<void> {
  const animaciones = raiz.getAnimations({ subtree: true });
  const todas = Promise.all(animaciones.map((a) => a.finished.catch(() => undefined)));
  await Promise.race([todas, new Promise((seguir) => setTimeout(seguir, 2000))]);
  for (const a of animaciones) if (a.playState !== "finished" && a.playState !== "idle") a.finish();
}
const sinComillas = (v: string) => v.trim().replace(/^["']|["']$/g, "");

/**
 * El lienzo no admite `font-stretch` en porcentaje: se registra Anybody otra
 * vez con la anchura puesta en la propia cara, leyendo sus archivos de las
 * reglas `@font-face` de la página.
 */
function caraConAnchura(stretch: number): Promise<string> {
  const nombre = `SalaMedida${String(stretch).replace(".", "_")}`;
  let lista = caras.get(nombre);
  if (!lista) {
    lista = (async () => {
      const cargas: Promise<unknown>[] = [];
      for (const hoja of Array.from(document.styleSheets)) {
        let reglas: CSSRuleList;
        try {
          reglas = hoja.cssRules;
        } catch {
          continue;
        }
        for (const regla of Array.from(reglas)) {
          if (!(regla instanceof CSSFontFaceRule) || sinComillas(regla.style.getPropertyValue("font-family")) !== "Anybody") continue;
          const base = hoja.href || location.href;
          const src = regla.style.getPropertyValue("src").replace(/url\((["']?)([^"')]+)\1\)/g, (_m, _q, u: string) => `url("${new URL(u, base).href}")`);
          const cara = new FontFace(nombre, src, {
            weight: "100 900",
            unicodeRange: regla.style.getPropertyValue("unicode-range") || "U+0-10FFFF",
            variationSettings: `"wdth" ${stretch}`,
          } as FontFaceDescriptors);
          document.fonts.add(cara);
          cargas.push(cara.load().catch(() => undefined));
        }
      }
      if (cargas.length === 0) throw new Error("No encuentro las reglas @font-face de Anybody");
      await Promise.all(cargas);
      return nombre;
    })();
    caras.set(nombre, lista);
  }
  return lista;
}

function lienzo(ancho: number, alto: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(ancho));
  canvas.height = Math.max(1, Math.round(alto));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Sin lienzo 2D");
  return { canvas, ctx };
}

/** Pinta una imagen como `object-fit: cover` con su `object-position`, en una caja de `ancho` × `alto`. */
function pintarCubriendo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, ancho: number, alto: number) {
  const proporcion = img.naturalWidth / img.naturalHeight;
  const dw = Math.max(ancho, alto * proporcion);
  const dh = dw / proporcion;
  const [fx, fy] = getComputedStyle(img)
    .objectPosition.split(" ")
    .map((v) => parseFloat(v) / 100);
  ctx.drawImage(img, (ancho - dw) * (Number.isFinite(fx) ? fx : 0.5), (alto - dh) * (Number.isFinite(fy) ? fy : 0.5), dw, dh);
}

async function cargada(img: HTMLImageElement): Promise<HTMLImageElement> {
  if (!img.complete || img.naturalWidth === 0) await img.decode();
  return img;
}

function leerRgb(valor: string): [number, number, number, number] {
  const n = (valor.match(/-?\d*\.?\d+(e-?\d+)?/g) ?? []).map(Number);
  if (n.length < 3) throw new Error(`No es un color: «${valor}»`);
  const escala = valor.trim().startsWith("color(") ? 255 : 1;
  return [n[0] * escala, n[1] * escala, n[2] * escala, n[3] ?? 1];
}

/** El velo, leído de lo que el navegador ha calculado: su color y su opacidad en cada fila (de arriba abajo). */
function velo(elemento: Element | null, alto: number): { rgb: [number, number, number]; alfa: Float32Array } {
  const alfa = new Float32Array(Math.max(1, Math.round(alto)));
  if (!elemento) return { rgb: [0, 0, 0], alfa };
  const fondo = getComputedStyle(elemento).backgroundImage;
  const dentro = /^linear-gradient\((.*)\)$/.exec(fondo)?.[1];
  if (!dentro) throw new Error(`El velo no es un degradado: «${fondo}»`);
  // Paradas: «color posición», separadas por comas que no están dentro de un paréntesis.
  const partes = dentro.split(/,(?![^(]*\))/).map((p) => p.trim());
  if (partes[0] !== "to top") throw new Error(`El velo no sube: «${fondo}»`);
  const paradas = partes.slice(1).map((p) => {
    const m = /^(.*\))\s+(-?[\d.]+)px$/.exec(p) ?? /^(.*\))\s+(-?[\d.]+)%$/.exec(p);
    if (!m) throw new Error(`Parada ilegible en el velo: «${p}»`);
    const [r, g, b, a] = leerRgb(m[1]);
    return { rgb: [r, g, b] as [number, number, number], a, en: p.endsWith("%") ? (parseFloat(m[2]) / 100) * alto : parseFloat(m[2]) };
  });
  const color = paradas.find((p) => p.a > 0)?.rgb ?? [0, 0, 0];
  for (let fila = 0; fila < alfa.length; fila++) {
    const desdeAbajo = alto - (fila + 0.5);
    let a = paradas[paradas.length - 1].a;
    if (desdeAbajo <= paradas[0].en) a = paradas[0].a;
    else {
      for (let i = 1; i < paradas.length; i++) {
        if (desdeAbajo <= paradas[i].en) {
          const t = (desdeAbajo - paradas[i - 1].en) / Math.max(1e-6, paradas[i].en - paradas[i - 1].en);
          a = paradas[i - 1].a + (paradas[i].a - paradas[i - 1].a) * t;
          break;
        }
      }
    }
    alfa[fila] = a;
  }
  return { rgb: color, alfa };
}

/**
 * Mide una sala ya pintada (`SalaStage`): sus letras, lo que la figura les
 * taparía y el contraste de la tinta contra lo que hay detrás. `figura` es el
 * recorte que pasaría por delante; sin él, las coberturas son cero.
 */
export async function medirSala(sala: HTMLElement, figura?: string): Promise<MedidaSala> {
  await document.fonts.ready;
  // Con el título ya en su sitio: la entrada lo mueve.
  await animacionesTerminadas(sala);
  const texto = sala.querySelector<HTMLElement>("[data-sala-title-text]");
  if (!texto) throw new Error("La sala no tiene rótulo");
  const estilo = getComputedStyle(texto);
  const cuerpo = parseFloat(estilo.fontSize);
  const anchura = parseFloat(estilo.fontStretch);
  await document.fonts.load(`${estilo.fontWeight} ${cuerpo}px "Anybody"`, texto.textContent ?? "");
  const familia = await caraConAnchura(anchura);
  const fuente = `${estilo.fontWeight} ${cuerpo}px "${familia}"`;
  await document.fonts.load(fuente, texto.textContent ?? "");

  const caja = sala.getBoundingClientRect();
  const W = Math.round(caja.width);
  const H = Math.round(caja.height);

  // Lo que hay detrás: la imagen, el velo y, con fundido, la figura por delante del velo.
  const fondo = lienzo(W, H);
  const imagen = sala.querySelector<HTMLImageElement>(".sala-stage-image img");
  if (imagen) pintarCubriendo(fondo.ctx, await cargada(imagen), W, H);
  else {
    fondo.ctx.fillStyle = getComputedStyle(sala).backgroundColor;
    fondo.ctx.fillRect(0, 0, W, H);
  }
  const base = fondo.ctx.getImageData(0, 0, W, H).data;
  const v = velo(sala.querySelector(".sala-stage-veil"), H);
  for (let y = 0; y < H; y++) {
    const a = v.alfa[y];
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) base[i + c] = base[i + c] * (1 - a) + v.rgb[c] * a;
      base[i + 3] = 255;
    }
  }
  const conFigura = new Uint8ClampedArray(base);
  const mascara = new Uint8Array(W * H);
  if (figura && imagen) {
    const recorte = new Image();
    recorte.src = figura;
    await recorte.decode();
    // El recorte se pinta con el mismo encuadre que la imagen.
    const capa = lienzo(W, H);
    const proporcion = recorte.naturalWidth / recorte.naturalHeight;
    const dw = Math.max(W, H * proporcion);
    const dh = dw / proporcion;
    const [fx, fy] = getComputedStyle(imagen)
      .objectPosition.split(" ")
      .map((p) => parseFloat(p) / 100);
    capa.ctx.drawImage(recorte, (W - dw) * (Number.isFinite(fx) ? fx : 0.5), (H - dh) * (Number.isFinite(fy) ? fy : 0.5), dw, dh);
    const px = capa.ctx.getImageData(0, 0, W, H).data;
    for (let p = 0; p < W * H; p++) {
      const a = px[p * 4 + 3] / 255;
      mascara[p] = px[p * 4 + 3];
      for (let c = 0; c < 3; c++) conFigura[p * 4 + c] = conFigura[p * 4 + c] * (1 - a) + px[p * 4 + c] * a;
    }
  }

  // La tinta: el color que tendría un texto dentro de la sala (el del título puede ser transparente, con el fundido).
  const sonda = document.createElement("span");
  sonda.style.color = "var(--sala-ink)";
  sala.appendChild(sonda);
  const [r, g, b] = leerRgb(getComputedStyle(sonda).color);
  sonda.remove();
  const ink: Rgb = [r / 255, g / 255, b / 255];

  // Las letras, donde el navegador las ha puesto.
  const medidor = lienzo(1, 1).ctx;
  medidor.font = fuente;
  const metrica = medidor.measureText("Hg");
  const sube = metrica.fontBoundingBoxAscent;
  const margen = Math.ceil(cuerpo * 0.3);
  const rango = document.createRange();
  const nodos = document.createTreeWalker(texto, NodeFilter.SHOW_TEXT);
  const letras: LetraMedida[] = [];
  const tops: number[] = [];
  for (let nodo = nodos.nextNode() as Text | null; nodo; nodo = nodos.nextNode() as Text | null) {
    for (let i = 0; i < nodo.data.length; ) {
      const ch = String.fromCodePoint(nodo.data.codePointAt(i) ?? 32);
      if (ch.trim() !== "") {
        rango.setStart(nodo, i);
        rango.setEnd(nodo, i + ch.length);
        const rect = rango.getClientRects()[0];
        if (!rect || rect.width === 0) throw new Error(`La letra «${ch}» no está pintada`);
        const x = rect.left - caja.left;
        const y = rect.top - caja.top;
        if (!tops.some((t) => Math.abs(t - y) < cuerpo * 0.2)) tops.push(y);
        // La letra sola, en un recorte con margen: los remates que se salen de su caja también cuentan.
        const x0 = Math.max(0, Math.floor(x - margen));
        const y0 = Math.max(0, Math.floor(y - margen));
        const x1 = Math.min(W, Math.ceil(x + rect.width + margen));
        const y1 = Math.min(H, Math.ceil(y + rect.height + margen));
        const w = x1 - x0;
        const h = y1 - y0;
        const dibujo = lienzo(w, h);
        dibujo.ctx.font = fuente;
        dibujo.ctx.textBaseline = "alphabetic";
        dibujo.ctx.fillStyle = "#000";
        dibujo.ctx.fillText(ch, x - x0, y - y0 + sube);
        const alfa = dibujo.ctx.getImageData(0, 0, w, h).data;
        const letter = new Uint8Array(w * h);
        const figure = new Uint8Array(w * h);
        const detras = new Uint8ClampedArray(w * h * 4);
        const detrasConFigura = new Uint8ClampedArray(w * h * 4);
        for (let yy = 0; yy < h; yy++) {
          for (let xx = 0; xx < w; xx++) {
            const local = yy * w + xx;
            const global = (y0 + yy) * W + (x0 + xx);
            letter[local] = alfa[local * 4 + 3];
            figure[local] = mascara[global];
            for (let c = 0; c < 4; c++) {
              detras[local * 4 + c] = base[global * 4 + c];
              detrasConFigura[local * 4 + c] = conFigura[global * 4 + c];
            }
          }
        }
        letras.push({
          ch,
          x,
          y,
          width: rect.width,
          height: rect.height,
          line: y,
          x0,
          y0,
          raster: { width: w, height: h, letter, figure, letters: [{ x: 0, y: 0, width: w, height: h, line: 0 }] },
          detras,
          detrasConFigura,
        });
      }
      i += ch.length;
    }
  }
  tops.sort((a, c) => a - c);
  for (const letra of letras) {
    letra.line = tops.findIndex((t) => Math.abs(t - letra.line) < cuerpo * 0.2);
    letra.raster.letters[0].line = letra.line;
  }

  let contrasteConFigura = Infinity;
  let contrasteSinFundido = Infinity;
  const data: SalaFuseData = {
    letters: letras.map((letra) => {
      const [cobertura] = measureLetterCoverage(letra.raster);
      // Todos los píxeles de la letra, también los que la figura taparía: el peor caso.
      contrasteConFigura = Math.min(contrasteConFigura, measureVisibleContrast(letra.raster, [true], letra.detrasConFigura, ink).minContrast);
      contrasteSinFundido = Math.min(contrasteSinFundido, measureVisibleContrast(letra.raster, [true], letra.detras, ink).minContrast);
      return {
        ...cobertura,
        line: letra.line,
        box: { x: letra.x / caja.width, y: letra.y / caja.height, width: letra.width / caja.width, height: letra.height / caja.height },
      };
    }),
    minContrast: contrasteConFigura,
  };
  const ancha = caja.width >= SALA_TITLE_WIDE_FROM_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);
  return { layout: ancha ? "wide" : "narrow", width: caja.width, height: caja.height, letras, ink, data, contrasteSinFundido };
}

export interface FundidoPintado {
  /** Parte de los píxeles de letra del título que la figura tapa de verdad (0–1). */
  titulo: number;
  /** Lo mismo por línea. */
  lineas: number[];
  /** La letra más tapada. */
  peorLetra: number;
  /** Píxeles tapados de las letras que van por delante: tiene que ser 0. */
  tapadoDelante: number;
  /** Contraste mínimo de la letra que se ve contra lo que tiene detrás. */
  contraste: number;
}

/**
 * Lo que queda pintado con el fundido: la figura tapa un píxel de letra salvo
 * dentro de la caja (con su margen) de una letra que va por delante, que es
 * como lo pinta `SalaStage`. Vuelve a medirlo todo con `title-fuse.ts`.
 */
export function fundidoPintado(medida: MedidaSala, resuelto: SalaFuseResolved): FundidoPintado {
  const porLinea: Array<[number, number]> = [];
  let total = 0;
  let tapado = 0;
  let peorLetra = 0;
  let tapadoDelante = 0;
  let contraste = Infinity;
  medida.letras.forEach((letra, i) => {
    const { raster } = letra;
    const { x0, y0 } = letra;
    const figure = Uint8Array.from(raster.figure as Uint8Array);
    for (const hueco of resuelto.holes) {
      const hx0 = Math.floor(hueco.x * medida.width) - x0;
      const hx1 = Math.ceil((hueco.x + hueco.width) * medida.width) - x0;
      const hy0 = Math.floor(hueco.y * medida.height) - y0;
      const hy1 = Math.ceil((hueco.y + hueco.height) * medida.height) - y0;
      for (let y = Math.max(0, hy0); y < Math.min(raster.height, hy1); y++) {
        for (let x = Math.max(0, hx0); x < Math.min(raster.width, hx1); x++) figure[y * raster.width + x] = 0;
      }
    }
    const pintada: TitleRaster = { ...raster, figure };
    const [cobertura] = measureLetterCoverage(pintada);
    total += cobertura.letterPixels;
    tapado += cobertura.coveredPixels;
    const linea = (porLinea[letra.line] ??= [0, 0]);
    linea[0] += cobertura.letterPixels;
    linea[1] += cobertura.coveredPixels;
    peorLetra = Math.max(peorLetra, cobertura.letterPixels > 0 ? cobertura.coveredPixels / cobertura.letterPixels : 0);
    if (resuelto.plan.inFront[i]) tapadoDelante += cobertura.coveredPixels;
    // Lo que se ve de la letra, contra lo que tiene detrás con la figura puesta.
    contraste = Math.min(contraste, measureVisibleContrast(pintada, [false], letra.detrasConFigura, medida.ink).minContrast);
  });
  return {
    titulo: total > 0 ? tapado / total : 0,
    lineas: porLinea.map(([t, c]) => (t > 0 ? c / t : 0)),
    peorLetra,
    tapadoDelante,
    contraste,
  };
}

/** Lo que `SalaStage` decide con una medida: el mismo `resolveSalaFuse`, con el título y la proporción de la sala. */
export function resolver(medida: MedidaSala, titulo: string): SalaFuseResolved | null {
  return resolveSalaFuse(medida.data, titulo, medida.width / medida.height);
}

// ------------------------------------------------------------
// El rótulo solo (SalaTitle): líneas, anchura y cuerpo pintados
// ------------------------------------------------------------

/**
 * Espera a que los rótulos de la página estén como se van a quedar: las
 * fuentes cargadas (Anybody con los caracteres de cada título) y la entrada
 * terminada.
 */
export async function rotulosListos(raiz: HTMLElement): Promise<void> {
  await document.fonts.ready;
  const textos = Array.from(raiz.querySelectorAll<HTMLElement>("[data-sala-title-text]"));
  await Promise.all(
    textos.map((t) => {
      const e = getComputedStyle(t);
      return document.fonts.load(`${e.fontWeight} ${parseFloat(e.fontSize)}px "Anybody"`, t.textContent ?? "").catch(() => undefined);
    })
  );
  await animacionesTerminadas(raiz);
  await document.fonts.ready;
  await new Promise((seguir) => requestAnimationFrame(() => requestAnimationFrame(() => seguir(undefined))));
}

export interface LineaMedida {
  /** El texto de la línea, sin espacios en los bordes. */
  texto: string;
  /** Bordes de la tinta de la línea respecto al borde izquierdo de la caja, en píxeles CSS. */
  izquierda: number;
  derecha: number;
  ancho: number;
}

export interface RotuloMedido {
  titulo: string;
  /** Ancho de la caja (el contenedor del que sale el tamaño), en píxeles CSS. */
  caja: number;
  /** Tamaño de `rem`, en píxeles. */
  rem: number;
  lineas: LineaMedida[];
  /** `font-stretch` pintado, en %. */
  anchura: number;
  /** `font-size` pintado, en píxeles. */
  cuerpo: number;
  /** Alto del bloque de texto, en píxeles. */
  alto: number;
  /** ¿Algo recorta alguna línea (un antepasado con `overflow` o scroll dentro del texto)? */
  recortado: boolean;
  /** `font-family` calculada del texto. */
  familia: string;
}

/**
 * Mide un rótulo pintado (`[data-sala-title]`, o cualquier caja con un
 * `[data-sala-title-text]` dentro): las líneas salen de dónde ha puesto el
 * navegador cada carácter, no de los `<br>`, así que también se ve si algo se
 * ha partido por su cuenta.
 */
export function medirRotulo(rotulo: HTMLElement): RotuloMedido {
  const texto = rotulo.matches("[data-sala-title-text]") ? rotulo : rotulo.querySelector<HTMLElement>("[data-sala-title-text]");
  if (!texto) throw new Error("No hay rótulo");
  const estilo = getComputedStyle(texto);
  const cuerpo = parseFloat(estilo.fontSize);
  const caja = rotulo.getBoundingClientRect();
  const izquierdaCaja = caja.left + parseFloat(getComputedStyle(rotulo).paddingLeft);
  const anchoCaja = rotulo.clientWidth - parseFloat(getComputedStyle(rotulo).paddingLeft) - parseFloat(getComputedStyle(rotulo).paddingRight);

  // Carácter a carácter (por puntos de código), con su caja.
  const rango = document.createRange();
  const lineas: { texto: string; top: number; izq: number; der: number }[] = [];
  const recorrido = document.createTreeWalker(texto, NodeFilter.SHOW_TEXT);
  for (let nodo = recorrido.nextNode() as Text | null; nodo; nodo = recorrido.nextNode() as Text | null) {
    const valor = nodo.data;
    for (let i = 0; i < valor.length; ) {
      const cp = valor.codePointAt(i)!;
      const n = cp > 0xffff ? 2 : 1;
      rango.setStart(nodo, i);
      rango.setEnd(nodo, i + n);
      const cajas = Array.from(rango.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
      const ch = valor.slice(i, i + n);
      i += n;
      if (cajas.length === 0) continue;
      const r = cajas[cajas.length - 1];
      let linea = lineas[lineas.length - 1];
      if (!linea || r.top > linea.top + cuerpo * 0.45) {
        linea = { texto: "", top: r.top, izq: Infinity, der: -Infinity };
        lineas.push(linea);
      }
      linea.texto += ch;
      if (ch.trim() !== "") {
        linea.izq = Math.min(linea.izq, r.left);
        linea.der = Math.max(linea.der, r.right);
      }
    }
  }
  const medidas = lineas
    .filter((l) => l.texto.trim() !== "")
    .map((l) => ({ texto: l.texto.trim(), izquierda: l.izq - izquierdaCaja, derecha: l.der - izquierdaCaja, ancho: l.der - l.izq }));

  // ¿Lo recorta algo? Un antepasado que no deja ver lo que se sale, o scroll dentro del propio texto.
  let recortado = texto.scrollWidth > texto.clientWidth + 1;
  for (let el = texto.parentElement; el && el !== document.body && !recortado; el = el.parentElement) {
    const e = getComputedStyle(el);
    if (e.overflowX === "visible" && e.overflowY === "visible") continue;
    const r = el.getBoundingClientRect();
    for (const l of lineas) if (l.izq < r.left - 0.5 || l.der > r.right + 0.5) recortado = true;
  }

  return {
    titulo: texto.textContent ?? "",
    caja: anchoCaja,
    rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
    lineas: medidas,
    anchura: parseFloat(estilo.fontStretch),
    cuerpo,
    alto: texto.getBoundingClientRect().height,
    recortado,
    familia: estilo.fontFamily,
  };
}
