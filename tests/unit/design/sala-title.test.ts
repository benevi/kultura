/**
 * @vitest-environment node
 *
 * Fase 8.4 — el rótulo de «Sala»: anchura y tamaño de un título
 * (`src/lib/design/sala-title.ts`). Biblia §5: «la anchura se elige por la
 * longitud del título, que llena el ancho en 1–2 líneas (3 en móvil)».
 *
 * La regla que se prueba aquí, como propiedad: para cualquier título de 1 a
 * 120 caracteres y cualquier caja de 280 a 1600 px, la anchura queda entre 50
 * y 150, el título cabe en su caja y el tamaño no baja del mínimo legible.
 * Que lo que se pinta mide lo que aquí se calcula lo miden las historias
 * (**Sala/Rótulo**), en el navegador.
 */
import { describe, expect, it } from "vitest";
import {
  planSalaTitle,
  SALA_TITLE_MAX_LENGTH,
  SALA_TITLE_MIN_BOX,
  SALA_TITLE_MIN_PX,
  SALA_TITLE_PRESET,
  SALA_TITLE_STRETCH_MAX,
  SALA_TITLE_STRETCH_MIN,
  SALA_TITLE_WIDE_FROM_REM,
  salaScripts,
  salaTitleLayoutFor,
  salaTitleLines,
  salaTitleLineWidth,
  salaTitleSizePx,
  salaTitleStretch,
  type SalaTitleLayout,
  type SalaTitlePlan,
} from "@/lib/design/sala-title";

/** Azar con semilla: la prueba es la misma en cada pasada. */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const ALFABETOS = {
  minusculas: "abcdefghijklmnopqrstuvwxyzáéíóúñü",
  mayusculas: "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ",
  anchas: "MWmw@%",
  estrechas: "iIl.,:;'!1",
  cifras: "0123456789",
  signos: "¿?¡!:;,.-–()«»&'·/",
  japones: "千と尋の神隠しベルセクアイウエオかきくけこ東京物語、。ー",
  coreano: "기생충올드보이부산행살인의추억",
  cirilico: "СталкерИдиисмотри",
  emoji: "🎬👻🔥⭐",
};

type Alfabeto = keyof typeof ALFABETOS;

/** Un título inventado de `largo` caracteres: palabras de un alfabeto (o de varios), o una sola palabra. */
function titulo(rnd: () => number, largo: number): string {
  const nombres = Object.keys(ALFABETOS) as Alfabeto[];
  const modo = rnd();
  const base: Alfabeto[] =
    modo < 0.45 ? ["minusculas", "minusculas", "mayusculas", "cifras", "signos"] : [nombres[Math.floor(rnd() * nombres.length)]];
  const sinEspacios = rnd() < 0.12;
  let out = "";
  let palabra = 0;
  const proxima = () => 1 + Math.floor(rnd() * (rnd() < 0.15 ? 24 : 9));
  let hasta = proxima();
  while (Array.from(out).length < largo) {
    if (!sinEspacios && palabra >= hasta && Array.from(out).length < largo - 1) {
      out += " ";
      palabra = 0;
      hasta = proxima();
      continue;
    }
    const letras = Array.from(ALFABETOS[base[Math.floor(rnd() * base.length)]]);
    out += letras[Math.floor(rnd() * letras.length)];
    palabra++;
  }
  return Array.from(out).slice(0, largo).join("").trim() || "a";
}

/** Lo que tiene que cumplir cualquier composición en una caja de `caja` píxeles. */
function comprobar(texto: string, plan: SalaTitlePlan, layout: SalaTitleLayout, caja: number, minimo = SALA_TITLE_MIN_PX) {
  const donde = `«${texto}» en ${caja} px`;
  // Anchura: entera, dentro del eje.
  expect(Number.isInteger(layout.stretch), donde).toBe(true);
  expect(layout.stretch, donde).toBeGreaterThanOrEqual(SALA_TITLE_STRETCH_MIN);
  expect(layout.stretch, donde).toBeLessThanOrEqual(SALA_TITLE_STRETCH_MAX);
  // Tamaño: no baja del mínimo legible.
  const px = salaTitleSizePx(layout, caja);
  expect(px, donde).toBeGreaterThanOrEqual(minimo);
  // Cabe: ninguna línea mide más que la caja.
  const lineas = salaTitleLines(plan, layout);
  expect(lineas).toHaveLength(layout.starts.length);
  lineas.forEach((linea, i) => {
    const ancho = salaTitleLineWidth(linea, layout.stretch);
    expect(ancho, `${donde}, línea «${linea}»`).toBeCloseTo(layout.widths[i], 6);
    expect(ancho * px, `${donde}, línea «${linea}»`).toBeLessThanOrEqual(caja);
    expect(linea, donde).toBe(linea.trim());
    expect(linea.length, donde).toBeGreaterThan(0);
  });
  expect(layout.fill, donde).toBeLessThanOrEqual(1);
  // Las líneas empiezan en orden y la primera, en el principio.
  expect(layout.starts[0]).toBe(0);
  layout.starts.slice(1).forEach((s, i) => expect(s, donde).toBeGreaterThan(layout.starts[i]));
}

/** El título entero, tal como sale al juntar los trozos. */
const entero = (plan: SalaTitlePlan) => plan.chunks.map((c, i) => plan.joins[i] + c).join("");

describe("propiedad: cualquier título de 1 a 120 caracteres en cualquier caja de 280 a 1600 px", () => {
  it("anchura en 50–150, cabe en su caja y no baja de 18 px", () => {
    const rnd = azar(20261119);
    for (let caso = 0; caso < 4000; caso++) {
      const largo = 1 + Math.floor(rnd() * SALA_TITLE_MAX_LENGTH);
      const texto = titulo(rnd, largo);
      const plan = planSalaTitle(texto);
      // No se pierde ni se repite nada del título.
      expect(entero(plan)).toBe(texto.replace(/\s+/g, " "));
      const caja = SALA_TITLE_MIN_BOX + Math.floor(rnd() * (1600 - SALA_TITLE_MIN_BOX + 1));
      comprobar(texto, plan, salaTitleLayoutFor(plan, caja), caja);
    }
  });

  it("también en los bordes: 280 px, justo antes y justo en el cambio de composición, y 1600 px", () => {
    const rnd = azar(7);
    const cambio = SALA_TITLE_WIDE_FROM_REM * 16;
    for (let caso = 0; caso < 600; caso++) {
      const texto = titulo(rnd, 1 + Math.floor(rnd() * SALA_TITLE_MAX_LENGTH));
      const plan = planSalaTitle(texto);
      for (const caja of [SALA_TITLE_MIN_BOX, cambio - 1, cambio, 1600]) comprobar(texto, plan, salaTitleLayoutFor(plan, caja), caja);
    }
  });

  it("los peores casos: 120 letras anchas, una sola palabra de 120, 120 ideogramas, 120 emojis", () => {
    for (const texto of ["W".repeat(120), "M".repeat(60) + " " + "W".repeat(59), "a".repeat(120), "千".repeat(120), "🎬".repeat(120), "Ж".repeat(120)]) {
      const plan = planSalaTitle(texto);
      for (const caja of [280, 375, 719, 720, 1024, 1600]) comprobar(texto, plan, salaTitleLayoutFor(plan, caja), caja);
    }
  });

  it("con el texto del navegador más grande, el cambio de composición llega más tarde y sigue cabiendo", () => {
    const plan = planSalaTitle("El viaje de Chihiro");
    // A 32 px de texto base, una caja de 1000 px sigue siendo «estrecha».
    expect(salaTitleLayoutFor(plan, 1000, 32)).toBe(plan.narrow);
    expect(salaTitleLayoutFor(plan, 1000, 16)).toBe(plan.wide);
    comprobar("El viaje de Chihiro", plan, plan.narrow, 1000);
  });

  it("el póster: cabe y la anchura está en rango (su tamaño mínimo lo pone el CSS, en rem)", () => {
    const rnd = azar(99);
    for (let caso = 0; caso < 800; caso++) {
      const texto = titulo(rnd, 1 + Math.floor(rnd() * SALA_TITLE_MAX_LENGTH));
      const plan = planSalaTitle(texto, SALA_TITLE_PRESET.poster);
      comprobar(texto, plan, plan.narrow, 134, 0);
    }
  });
});

const REALES = [
  "Up",
  "Her",
  "Hades",
  "Berserk",
  "Parásitos",
  "Breaking Bad",
  "Elden Ring",
  "El viaje de Chihiro",
  "Cien años de soledad",
  "La princesa Mononoke",
  "Don Quijote de la Mancha",
  "El señor de los anillos: La comunidad del anillo",
  "The Legend of Zelda: Breath of the Wild",
  "Fullmetal Alchemist: Brotherhood",
  "Birdman o (La inesperada virtud de la ignorancia)",
  "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb",
  "¿Quién engañó a Roger Rabbit?",
  "LAWRENCE DE ARABIA",
  "2001: Una odisea del espacio",
  "Spider-Man: Un nuevo universo",
];

describe("títulos reales", () => {
  it("una, dos o tres líneas en estrecho y una o dos en ancho (biblia §5)", () => {
    for (const texto of REALES) {
      const plan = planSalaTitle(texto);
      expect(plan.narrow.starts.length, texto).toBeLessThanOrEqual(3);
      expect(plan.wide.starts.length, texto).toBeLessThanOrEqual(2);
      expect(plan.exact, texto).toBe(true);
    }
  });

  it("llenan el ancho; solo los muy cortos se quedan en el cuerpo máximo", () => {
    for (const texto of REALES) {
      const plan = planSalaTitle(texto);
      for (const [layout, reglas] of [
        [plan.narrow, SALA_TITLE_PRESET.sala.narrow],
        [plan.wide, SALA_TITLE_PRESET.sala.wide],
      ] as const) {
        if (layout.fill < 0.95) {
          // No llena: va al cuerpo máximo (o al alto máximo del bloque) y tan ancho como se le deja.
          const tope = Math.min(reglas.maxSize, reglas.maxBlock / (layout.starts.length * plan.lineHeight));
          expect(layout.size, texto).toBeCloseTo(tope, 1);
          expect(layout.stretch, texto).toBeGreaterThan(salaTitleStretch(texto, reglas.stretchScale));
        }
        expect(layout.size, texto).toBeLessThanOrEqual(reglas.maxSize);
        expect(layout.block, texto).toBeLessThanOrEqual(reglas.maxBlock + 0.01);
      }
    }
  });

  it("no parte palabras: cada trozo es una palabra (o media, si lleva guion)", () => {
    for (const texto of REALES) {
      const plan = planSalaTitle(texto);
      const palabras = texto.split(" ").flatMap((p) => p.split(/(?<=\p{L}-)(?=\p{L})/u));
      expect(plan.chunks, texto).toEqual(palabras);
    }
    expect(planSalaTitle("Spider-Man: Un nuevo universo").chunks.slice(0, 2)).toEqual(["Spider-", "Man:"]);
  });

  it("no deja una palabra de una o dos letras sola en una línea", () => {
    for (const texto of REALES) {
      const plan = planSalaTitle(texto);
      for (const layout of [plan.narrow, plan.wide]) {
        const lineas = salaTitleLines(plan, layout);
        if (lineas.length > 1) for (const linea of lineas) expect(linea.length, `${texto}: «${linea}»`).toBeGreaterThan(2);
      }
    }
  });

  it("más líneas solo si el cuerpo crece", () => {
    // «Parásitos» es una palabra: una línea. «Breaking Bad» gana cuerpo en dos.
    expect(planSalaTitle("Parásitos").narrow.starts).toEqual([0]);
    const bb = planSalaTitle("Breaking Bad");
    expect(salaTitleLines(bb, bb.narrow)).toEqual(["Breaking", "Bad"]);
  });

  it("un título largo va más estrecho que uno corto, en las dos composiciones", () => {
    const corto = planSalaTitle("Hades");
    const largo = planSalaTitle("The Legend of Zelda: Breath of the Wild");
    expect(largo.narrow.stretch).toBeLessThan(corto.narrow.stretch);
    expect(largo.wide.stretch).toBeLessThan(corto.wide.stretch);
    // Y en la caja estrecha, más estrecho que en la ancha: la misma palabra sale más alta.
    expect(largo.narrow.stretch).toBeLessThanOrEqual(largo.wide.stretch);
  });
});

describe("japonés y coreano", () => {
  it("con japonés o coreano, más interlineado: sus caracteres llenan el em", () => {
    expect(planSalaTitle("살인의 추억").lineHeight).toBe(1.1);
    expect(planSalaTitle("千と千尋の神隠し").lineHeight).toBe(1.1);
    expect(planSalaTitle("El viaje de Chihiro").lineHeight).toBe(0.9);
    const plan = planSalaTitle("살인의 추억");
    expect(plan.narrow.block).toBeCloseTo(plan.narrow.starts.length * 1.1 * plan.narrow.size, 6);
  });

  it("un em por carácter, y se parte donde empieza una palabra", () => {
    const chihiro = planSalaTitle("千と千尋の神隠し");
    expect(chihiro.chunks).toEqual(["千と", "千尋の", "神隠し"]);
    expect(chihiro.joins).toEqual(["", "", ""]);
    expect(chihiro.exact).toBe(true);
    expect(salaTitleLineWidth("千と千尋の神隠し", 100)).toBeCloseTo(8 * (1 - 0.025), 6);
    // Sin eje de anchura: mide lo mismo a 50 que a 150.
    expect(salaTitleLineWidth("千と千尋の神隠し", 50)).toBe(salaTitleLineWidth("千と千尋の神隠し", 150));
  });

  it("una palabra en katakana o en hangul no se parte", () => {
    expect(planSalaTitle("ベルセルク").chunks).toEqual(["ベルセルク"]);
    expect(planSalaTitle("기생충").chunks).toEqual(["기생충"]);
    expect(planSalaTitle("살인의 추억").chunks).toEqual(["살인의", "추억"]);
  });

  it("no empieza una línea con un cierre ni la acaba con una apertura", () => {
    expect(planSalaTitle("東京物語、その後").chunks.every((c) => !/^[、。」]/.test(c))).toBe(true);
    expect(planSalaTitle("「千と千尋」").chunks.every((c) => !/[「]$/.test(c))).toBe(true);
  });

  it("qué hojas de fuentes hacen falta", () => {
    expect(salaScripts("Parásitos")).toEqual([]);
    expect(salaScripts("Parásitos", { text: "기생충", lang: "ko" })).toEqual(["kr"]);
    expect(salaScripts({ text: "千と千尋の神隠し", lang: "ja" })).toEqual(["jp"]);
    expect(salaScripts("ベルセルク", "기생충")).toEqual(["jp", "kr"]);
    // Ideogramas sin kana: japonesa, salvo que el texto vaya marcado como coreano.
    expect(salaScripts("東京")).toEqual(["jp"]);
    expect(salaScripts({ text: "東京", lang: "ko-KR" })).toEqual(["kr"]);
    expect(salaScripts(null, undefined, "")).toEqual([]);
  });
});

describe("anchura por longitud", () => {
  it("baja con la longitud, sin salir de 50–150", () => {
    let anterior = Infinity;
    for (let largo = 1; largo <= 140; largo++) {
      const w = salaTitleStretch("a".repeat(largo));
      expect(w).toBeLessThanOrEqual(anterior);
      expect(w).toBeGreaterThanOrEqual(SALA_TITLE_STRETCH_MIN);
      expect(w).toBeLessThanOrEqual(SALA_TITLE_STRETCH_MAX);
      anterior = w;
    }
    expect(salaTitleStretch("Her")).toBe(135);
    expect(salaTitleStretch("a".repeat(120))).toBe(50);
  });

  it("en una caja estrecha, más estrecha", () => {
    for (const texto of REALES) expect(salaTitleStretch(texto, 0.72)).toBeLessThanOrEqual(salaTitleStretch(texto));
  });

  it("cuenta caracteres, no bytes, y no cuenta los espacios de sobra", () => {
    expect(salaTitleStretch("  Her  ")).toBe(salaTitleStretch("Her"));
    expect(salaTitleStretch("🎬🎬🎬")).toBe(salaTitleStretch("Her"));
  });
});

describe("casos límite", () => {
  it("es una función pura: el mismo título da siempre lo mismo", () => {
    expect(planSalaTitle("El viaje de Chihiro")).toEqual(planSalaTitle("El viaje de Chihiro"));
    expect(planSalaTitle("  El   viaje de\nChihiro ")).toEqual(planSalaTitle("El viaje de Chihiro"));
  });

  it("un título vacío no rompe", () => {
    const plan = planSalaTitle("   ");
    expect(plan.chunks).toEqual([]);
    expect(plan.narrow.starts).toEqual([0]);
    expect(Number.isFinite(plan.narrow.size)).toBe(true);
  });

  it("un carácter", () => {
    const plan = planSalaTitle("X");
    comprobar("X", plan, plan.narrow, 280);
    comprobar("X", plan, plan.wide, 1600);
    // No se estira hasta llenar: se queda en el cuerpo máximo.
    expect(plan.wide.size).toBe(SALA_TITLE_PRESET.sala.wide.maxSize);
  });

  it("cirílico y emoji: el ancho es una estimación por arriba y se dice", () => {
    expect(planSalaTitle("Сталкер").exact).toBe(false);
    expect(planSalaTitle("Up 🎈").exact).toBe(false);
    // Un emoji compuesto (familia, bandera con tono) cuenta como un dibujo.
    expect(salaTitleLineWidth("👨‍👩‍👧", 100)).toBeLessThan(salaTitleLineWidth("👨👩👧", 100));
  });

  it("una palabra que no cabe ni al tamaño mínimo se trocea, y solo entonces", () => {
    const larga = planSalaTitle("W".repeat(90));
    expect(larga.chunks.length).toBeGreaterThan(1);
    expect(larga.joins.every((j) => j === "")).toBe(true);
    expect(planSalaTitle("Supercalifragilisticoespialidoso").chunks).toHaveLength(1);
  });

  it("más de 120 caracteres: se compone y cabe, aunque ya sin tamaño mínimo garantizado", () => {
    const texto = REALES.join(" ");
    const plan = planSalaTitle(texto);
    for (const caja of [280, 1600]) {
      const layout = salaTitleLayoutFor(plan, caja);
      const px = salaTitleSizePx(layout, caja);
      for (const linea of salaTitleLines(plan, layout)) expect(salaTitleLineWidth(linea, layout.stretch) * px).toBeLessThanOrEqual(caja);
    }
  });
});
