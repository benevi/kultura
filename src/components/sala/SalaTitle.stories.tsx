import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { conVentana, EN_PRUEBAS, fijarVentana, NOTA_PALETA, OBRAS, Suelo } from "../../../.storybook/sala";
import { medirRotulo, rotulosListos } from "../../../.storybook/rotulo";
import {
  planSalaTitle,
  SALA_TITLE_MIN_PX,
  SALA_TITLE_STRETCH_MAX,
  SALA_TITLE_STRETCH_MIN,
  salaTitleLayoutFor,
  salaTitleLines,
} from "@/lib/design/sala-title";
import { SalaTitle } from "./SalaTitle";

/**
 * El rótulo de «Sala»: el título de una obra en Anybody, a la anchura que le
 * toca por su longitud y al mayor cuerpo que cabe en su caja. Todo sale del
 * servidor (`planSalaTitle`): estas historias miden en el navegador que lo
 * pintado es lo calculado. Las historias «en claro» son las mismas, para que
 * axe las pase en los dos temas.
 */
const meta = {
  title: "Sala/Rótulo",
  component: SalaTitle,
  parameters: { layout: "fullscreen" },
  args: { title: "El viaje de Chihiro", headingLevel: 2 },
} satisfies Meta<typeof SalaTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Anchos de caja: la ventana menos los márgenes de la página. */
const CAJAS = [
  { ancho: 280, pie: "Móvil de 320 px" },
  { ancho: 335, pie: "Móvil de 375 px" },
  { ancho: 728, pie: "Tableta de 768 px" },
  { ancho: 1200, pie: "Escritorio" },
] as const;

const CORTOS = ["Up", "Her", "Hades", "Roma"];
const MEDIOS = ["Parásitos", "Breaking Bad", "Elden Ring", "Watchmen"];
const LARGOS = [
  "El viaje de Chihiro",
  "Cien años de soledad",
  "The Legend of Zelda: Breath of the Wild",
  "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb",
];

/** Una caja del ancho que se diga, con su borde a la vista: el rótulo llena el ancho que le dan. */
function Caja({ ancho, pie, children }: { ancho: number; pie?: string; children: React.ReactNode }) {
  return (
    <figure className="m-0 mb-10">
      <div data-caja="" style={{ width: ancho }} className="border-l-2 border-r-2 border-sala-border">
        {children}
      </div>
      {pie ? <figcaption className="mt-2 text-sala-ink-secondary sala-type-small">{pie}</figcaption> : null}
    </figure>
  );
}

function Lista({ titulos, ancho }: { titulos: readonly string[]; ancho: number }) {
  return (
    <div className="flex flex-col gap-8">
      {titulos.map((titulo) => (
        <SalaTitle key={titulo} title={titulo} headingLevel={3} />
      ))}
      <p className="sr-only">{ancho}</p>
    </div>
  );
}

/**
 * Lo que tiene que cumplir cada rótulo de la página, medido sobre lo pintado:
 * cabe en su caja, no se corta, tiene las líneas que se calcularon, la
 * anchura está en el eje y el cuerpo no baja del mínimo.
 */
async function comprobarRotulos(canvasElement: HTMLElement, { minimo = SALA_TITLE_MIN_PX } = {}) {
  await rotulosListos(canvasElement);
  const rotulos = Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-sala-title]"));
  await expect(rotulos.length).toBeGreaterThan(0);
  for (const rotulo of rotulos) {
    const m = medirRotulo(rotulo);
    const donde = `«${m.titulo}» en ${Math.round(m.caja)} px`;
    const plan = planSalaTitle(m.titulo);
    const layout = salaTitleLayoutFor(plan, m.caja, m.rem);
    // La composición que se pinta es la que el servidor calculó para esta caja.
    await expect(m.lineas.map((l) => l.texto), donde).toEqual(salaTitleLines(plan, layout));
    await expect(m.anchura, donde).toBe(layout.stretch);
    await expect(m.anchura, donde).toBeGreaterThanOrEqual(SALA_TITLE_STRETCH_MIN);
    await expect(m.anchura, donde).toBeLessThanOrEqual(SALA_TITLE_STRETCH_MAX);
    await expect(m.cuerpo, donde).toBeCloseTo((layout.size * m.caja) / 100, 0);
    await expect(m.cuerpo, donde).toBeGreaterThanOrEqual(minimo);
    for (const [i, linea] of m.lineas.entries()) {
      // Cabe: ninguna línea se sale de la caja ni se parte.
      await expect(linea.derecha, `${donde}: «${linea.texto}»`).toBeLessThanOrEqual(m.caja + 0.5);
      await expect(linea.izquierda, `${donde}: «${linea.texto}»`).toBeGreaterThanOrEqual(-0.5);
      // Lo pintado nunca mide más que lo calculado (el interletraje solo estrecha), y se le parece.
      const calculado = layout.widths[i] * m.cuerpo;
      await expect(linea.ancho, `${donde}: «${linea.texto}»`).toBeLessThanOrEqual(calculado + 1);
      if (plan.exact) await expect(linea.ancho, `${donde}: «${linea.texto}»`).toBeGreaterThan(calculado * 0.88);
    }
    // El bloque mide sus líneas, ni una más: nada se ha partido por su cuenta.
    await expect(m.alto, donde).toBeCloseTo(m.lineas.length * plan.lineHeight * m.cuerpo, 0);
    // Ninguna letra se corta: nada recorta al rótulo y no hay scroll horizontal dentro de él.
    await expect(m.recortado, donde).toBe(false);
  }
}

// ------------------------------------------------------------
// Uno, con controles
// ------------------------------------------------------------

export const Uno: Story = {
  name: "Rótulo",
  render: (args) => (
    <Suelo titulo="Rótulo">
      <SalaTitle {...args} />
    </Suelo>
  ),
  play: ({ canvasElement }) => comprobarRotulos(canvasElement),
};

// ------------------------------------------------------------
// Títulos reales en varias anchuras de caja
// ------------------------------------------------------------

function PorAnchuras({ titulos }: { titulos: readonly string[] }) {
  return (
    <>
      {CAJAS.map(({ ancho, pie }) => (
        <Caja key={ancho} ancho={ancho} pie={`${pie}: caja de ${ancho} px`}>
          <Lista titulos={titulos} ancho={ancho} />
        </Caja>
      ))}
    </>
  );
}

const NOTA_ANCHURAS =
  "Cada título llena el ancho de su caja con el mayor cuerpo que cabe: uno corto va ancho y uno largo, estrecho. En las cajas estrechas, hasta tres líneas; en las anchas, hasta dos. Las rayas marcan los bordes de la caja.";

export const Cortos: Story = {
  name: "Títulos cortos",
  render: () => (
    <Suelo titulo="Cortos" nota={NOTA_ANCHURAS}>
      <PorAnchuras titulos={CORTOS} />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: ({ canvasElement }) => comprobarRotulos(canvasElement),
};

export const Medios: Story = {
  name: "Títulos medios",
  render: () => (
    <Suelo titulo="Medios" nota={NOTA_ANCHURAS}>
      <PorAnchuras titulos={MEDIOS} />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: ({ canvasElement }) => comprobarRotulos(canvasElement),
};

export const Largos: Story = {
  name: "Títulos largos",
  render: () => (
    <Suelo titulo="Largos" nota={NOTA_ANCHURAS}>
      <PorAnchuras titulos={LARGOS} />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: ({ canvasElement }) => comprobarRotulos(canvasElement),
};

// ------------------------------------------------------------
// Título original en otra escritura
// ------------------------------------------------------------

const ORIGINALES = [
  { titulo: "Parásitos", original: { text: "기생충", lang: "ko" } },
  { titulo: "El viaje de Chihiro", original: { text: "千と千尋の神隠し", lang: "ja" } },
  { titulo: "Berserk", original: { text: "ベルセルク", lang: "ja" } },
  { titulo: "Memorias de un asesino", original: { text: "살인의 추억", lang: "ko" } },
];

function ConOriginal() {
  return (
    <>
      {[CAJAS[1], CAJAS[3]].map(({ ancho, pie }) => (
        <Caja key={ancho} ancho={ancho} pie={`${pie}: caja de ${ancho} px`}>
          <div className="flex flex-col gap-10">
            {ORIGINALES.map(({ titulo, original }) => (
              <SalaTitle key={titulo} title={titulo} original={original} headingLevel={3} />
            ))}
          </div>
        </Caja>
      ))}
    </>
  );
}

export const TituloOriginal: Story = {
  name: "Con el título original",
  render: () => (
    <Suelo
      titulo="Título original"
      nota="El título va en el idioma de la persona. Debajo, el original en su escritura, marcado con su idioma: con eso sale con su fuente (Noto Sans JP o KR), que se carga solo cuando hay un texto en esa escritura."
    >
      <ConOriginal />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvas, canvasElement }) => {
    await comprobarRotulos(canvasElement);
    // El original va fuera del encabezado: el nombre del título es solo el título.
    await expect(canvas.getAllByRole("heading", { name: "Parásitos" })).toHaveLength(2);
    await expect(canvas.queryByRole("heading", { name: /기생충/ })).toBeNull();
    const [coreano] = canvas.getAllByText("기생충");
    await expect(coreano).toHaveAttribute("lang", "ko");
    await expect(coreano.tagName).toBe("P");
    // Orden de la biblia (§5): en coreano, la coreana primero; en japonés, la japonesa.
    await expect(getComputedStyle(coreano).fontFamily).toMatch(/Noto Sans KR.*Noto Sans JP/);
    const [japones] = canvas.getAllByText("千と千尋の神隠し");
    await expect(japones).toHaveAttribute("lang", "ja");
    await expect(getComputedStyle(japones).fontFamily).toMatch(/Noto Sans JP.*Noto Sans KR/);
    // Las fuentes de esas escrituras han llegado (las pide `SalaScriptFonts`).
    await waitFor(() => expect(document.fonts.check('700 20px "Noto Sans JP"', "千尋")).toBe(true), { timeout: 10_000 });
    await waitFor(() => expect(document.fonts.check('700 20px "Noto Sans KR"', "기생충")).toBe(true), { timeout: 10_000 });
    // No se sale de la caja.
    for (const original of Array.from(canvasElement.querySelectorAll<HTMLElement>(".sala-title-original"))) {
      const caja = original.closest("[data-caja]")!.getBoundingClientRect();
      await expect(original.getBoundingClientRect().right).toBeLessThanOrEqual(caja.right + 0.5);
      await expect(parseFloat(getComputedStyle(original).fontSize)).toBeGreaterThanOrEqual(18);
    }
  },
};

/** El rótulo entero en japonés o en coreano: una persona que usa la app en ese idioma. */
export const EnJaponesYCoreano: Story = {
  name: "Rótulo en japonés y en coreano",
  render: () => (
    <Suelo
      titulo="Japonés y coreano"
      nota="Sin eje de anchura: cada carácter mide un em. En japonés se parte donde empieza una palabra (tras una partícula); una palabra en katakana o en hangul no se parte."
    >
      {[CAJAS[1], CAJAS[3]].map(({ ancho, pie }) => (
        <Caja key={ancho} ancho={ancho} pie={`${pie}: caja de ${ancho} px`}>
          <div className="flex flex-col gap-10">
            <SalaTitle title="千と千尋の神隠し" titleLang="ja" original={{ text: "El viaje de Chihiro", lang: "es" }} headingLevel={3} />
            <SalaTitle title="ベルセルク" titleLang="ja" headingLevel={3} />
            <SalaTitle title="기생충" titleLang="ko" original={{ text: "Parásitos", lang: "es" }} headingLevel={3} />
            <SalaTitle title="살인의 추억" titleLang="ko" headingLevel={3} />
          </div>
        </Caja>
      ))}
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => expect(document.fonts.check('800 40px "Noto Sans JP"', "千尋の神隠しベルセルク")).toBe(true), { timeout: 10_000 });
    await waitFor(() => expect(document.fonts.check('800 40px "Noto Sans KR"', "기생충살인의추억")).toBe(true), { timeout: 10_000 });
    await comprobarRotulos(canvasElement);
    const [chihiro] = canvas.getAllByRole("heading", { name: "千と千尋の神隠し" });
    await expect(chihiro).toHaveAttribute("lang", "ja");
  },
};

// ------------------------------------------------------------
// Sobre el color de una obra
// ------------------------------------------------------------

export const SobreUnaObra: Story = {
  name: "Sobre el color de una obra",
  render: () => (
    <>
      {OBRAS.map((obra) => (
        <Suelo key={obra.titulo} titulo={obra.formato} nota={NOTA_PALETA} palette={obra.palette}>
          <div className="bg-sala-band p-6 text-sala-band-ink">
            <SalaTitle title={obra.titulo} original={obra.original ? { text: obra.original.texto, lang: obra.original.lang } : null} headingLevel={3} />
          </div>
        </Suelo>
      ))}
    </>
  ),
  play: ({ canvasElement }) => comprobarRotulos(canvasElement),
};

// ------------------------------------------------------------
// Casos límite
// ------------------------------------------------------------

const LIMITES = [
  { titulo: "X", pie: "Un carácter" },
  { titulo: "LAWRENCE DE ARABIA", pie: "Mayúsculas" },
  { titulo: "2001: Una odisea del espacio", pie: "Números" },
  { titulo: "¿Quién engañó a Roger Rabbit?", pie: "Signos" },
  { titulo: "WALL·E", pie: "Punto medio" },
  { titulo: "Spider-Man: Un nuevo universo", pie: "Guion: se puede partir detrás" },
  { titulo: "Supercalifragilisticoespialidoso", pie: "Una palabra larga: no se parte" },
  {
    titulo: "El extraño caso del doctor Jekyll y el señor Hyde, contado por su abogado y por él mismo en una larga confesión final",
    pie: "120 caracteres",
  },
  { titulo: "Up 🎈", pie: "Emoji: el ancho se estima por arriba" },
  { titulo: "Сталкер", pie: "Cirílico: Anybody no lo tiene; sale con la fuente del sistema y el ancho se estima" },
];

function Limites() {
  return (
    <>
      {[CAJAS[0], CAJAS[3]].map(({ ancho, pie }) => (
        <Caja key={ancho} ancho={ancho} pie={`${pie}: caja de ${ancho} px`}>
          <ul className="flex flex-col gap-8">
            {LIMITES.map(({ titulo, pie: nota }) => (
              <li key={titulo}>
                <SalaTitle title={titulo} headingLevel={3} lang={titulo === "Сталкер" ? "ru" : undefined} />
                <p className="mt-2 text-sala-ink-secondary sala-type-small">{nota}</p>
              </li>
            ))}
          </ul>
        </Caja>
      ))}
    </>
  );
}

export const CasosLimite: Story = {
  name: "Casos límite",
  render: () => (
    <Suelo titulo="Casos límite" nota="De un carácter a 120. De derecha a izquierda (árabe, hebreo) no está cubierto.">
      <Limites />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvasElement }) => {
    await rotulosListos(canvasElement);
    for (const rotulo of Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-sala-title]"))) {
      const m = medirRotulo(rotulo);
      const donde = `«${m.titulo}» en ${Math.round(m.caja)} px`;
      const plan = planSalaTitle(m.titulo);
      // Cabe siempre, también con el ancho estimado (emoji, cirílico).
      for (const linea of m.lineas) await expect(linea.derecha, donde).toBeLessThanOrEqual(m.caja + 0.5);
      await expect(m.recortado, donde).toBe(false);
      await expect(m.anchura, donde).toBeGreaterThanOrEqual(SALA_TITLE_STRETCH_MIN);
      await expect(m.anchura, donde).toBeLessThanOrEqual(SALA_TITLE_STRETCH_MAX);
      await expect(m.cuerpo, donde).toBeGreaterThanOrEqual(SALA_TITLE_MIN_PX);
      // Con todos los caracteres medidos, las líneas son las calculadas.
      if (plan.exact) {
        await expect(m.lineas.map((l) => l.texto), donde).toEqual(salaTitleLines(plan, salaTitleLayoutFor(plan, m.caja, m.rem)));
      }
    }
  },
};

// ------------------------------------------------------------
// Sin salto al llegar la fuente
// ------------------------------------------------------------

const PARA_EL_RESPALDO = [...CORTOS, ...MEDIOS, ...LARGOS, "LAWRENCE DE ARABIA", "¿Quién engañó a Roger Rabbit?"];

/** La pila del rótulo sin Anybody: lo que se ve mientras llega la fuente. */
const SOLO_RESPALDO = { "--sala-font-display": '"Anybody Fallback", system-ui, sans-serif' } as React.CSSProperties;

export const SinSaltoAlCargar: Story = {
  name: "Mientras llega la fuente",
  render: () => (
    <Suelo
      titulo="Mientras llega Anybody"
      nota="Arriba, el rótulo con Anybody; debajo, el mismo con la fuente de respaldo (Arial Bold ajustada por tramo de anchura), que es lo que se ve hasta que llega. Ocupan las mismas líneas y el mismo alto: al cambiar una por otra la caja no cambia; las palabras se recolocan dentro de su línea, porque el respaldo es más estrecho."
    >
      {[CAJAS[1], CAJAS[3]].map(({ ancho, pie }) => (
        <Caja key={ancho} ancho={ancho} pie={`${pie}: caja de ${ancho} px`}>
          <div className="flex flex-col gap-8">
            {PARA_EL_RESPALDO.map((titulo) => (
              <div key={titulo} data-pareja="">
                <SalaTitle title={titulo} headingLevel={3} />
                <SalaTitle title={titulo} headingLevel={3} style={SOLO_RESPALDO} className="mt-3 text-sala-ink-secondary" />
              </div>
            ))}
          </div>
        </Caja>
      ))}
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvasElement }) => {
    await rotulosListos(canvasElement);
    for (const pareja of Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-pareja]"))) {
      const [anybody, respaldo] = Array.from(pareja.querySelectorAll<HTMLElement>("[data-sala-title]")).map(medirRotulo);
      const donde = `«${anybody.titulo}» en ${Math.round(anybody.caja)} px`;
      // El respaldo es de verdad otra fuente.
      await expect(respaldo.familia, donde).not.toMatch(/^"?Anybody"?,/);
      // Las mismas líneas y el mismo alto: al cambiar de fuente la caja no cambia.
      await expect(respaldo.lineas.map((l) => l.texto), donde).toEqual(anybody.lineas.map((l) => l.texto));
      await expect(respaldo.alto, donde).toBe(anybody.alto);
      await expect(respaldo.cuerpo, donde).toBe(anybody.cuerpo);
      // Y el respaldo nunca es más ancho que la caja.
      for (const linea of respaldo.lineas) await expect(linea.derecha, `${donde}: «${linea.texto}»`).toBeLessThanOrEqual(respaldo.caja + 0.5);
    }
  },
};

// ------------------------------------------------------------
// Reflow a 320 px, texto al 200 % y espaciado de texto
// ------------------------------------------------------------

export const ReflowYZoom: Story = {
  name: "320 px, texto al 200 % y espaciado",
  render: () => (
    <Suelo
      titulo="Reflow y zoom"
      nota="El rótulo llena su caja a cualquier ancho. Con el texto del navegador al 200 % la composición estrecha (letra más alta, más líneas) dura hasta el doble de ancho. Con el espaciado de texto de WCAG 1.4.12 las líneas se parten donde haga falta: no se corta nada."
    >
      <div className="flex flex-col gap-8">
        {[...MEDIOS, ...LARGOS].map((titulo) => (
          <SalaTitle key={titulo} title={titulo} headingLevel={3} />
        ))}
      </div>
    </Suelo>
  ),
  play: async ({ canvasElement }) => {
    await rotulosListos(canvasElement);
    if (!EN_PRUEBAS) return;
    const { innerWidth: ancho, innerHeight: alto } = window;
    const raiz = document.documentElement;
    const sinDesbordar = async (que: string) => {
      await expect(raiz.scrollWidth, que).toBeLessThanOrEqual(raiz.clientWidth);
      for (const rotulo of Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-sala-title]"))) {
        const m = medirRotulo(rotulo);
        for (const linea of m.lineas) await expect(linea.derecha, `${que}: «${linea.texto}»`).toBeLessThanOrEqual(m.caja + 0.5);
        await expect(m.recortado, `${que}: «${m.titulo}»`).toBe(false);
      }
    };
    const espaciado = document.createElement("style");
    try {
      // Reflow a 320 px (WCAG 1.4.10): la caja es de 280 y todo cabe, con sus líneas.
      await expect(await fijarVentana(320, 640)).toBe(true);
      await comprobarRotulos(canvasElement);
      await sinDesbordar("320 px");
      // Texto al 200 % (WCAG 1.4.4), a 320 px y a 1280 px: sigue cabiendo.
      raiz.style.fontSize = "200%";
      await sinDesbordar("320 px al 200 %");
      await expect(await fijarVentana(1280, 800)).toBe(true);
      await sinDesbordar("1280 px al 200 %");
      // A 1280 px con el texto al 200 % (caja de 1200 px < 45 rem de 32 px) sigue la composición estrecha.
      const [primero] = Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-sala-title]")).map(medirRotulo);
      const plan = planSalaTitle(primero.titulo);
      await expect(primero.anchura).toBe(plan.narrow.stretch);
      raiz.style.fontSize = "";
      await waitFor(() => expect(medirRotulo(canvasElement.querySelector<HTMLElement>("[data-sala-title]")!).anchura).toBe(plan.wide.stretch));
      // Espaciado de texto (WCAG 1.4.12), a 320 px: las líneas se parten, nada se corta ni se sale.
      await expect(await fijarVentana(320, 640)).toBe(true);
      espaciado.textContent = "* { letter-spacing: 0.12em !important; word-spacing: 0.16em !important; line-height: 1.5 !important; }";
      document.head.appendChild(espaciado);
      await sinDesbordar("320 px con espaciado de texto");
    } finally {
      espaciado.remove();
      raiz.style.fontSize = "";
      await fijarVentana(ancho, alto);
    }
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const CortosEnClaro: Story = { ...Cortos, ...SOLO_PRUEBA };
export const MediosEnClaro: Story = { ...Medios, ...SOLO_PRUEBA };
export const LargosEnClaro: Story = { ...Largos, ...SOLO_PRUEBA };
export const TituloOriginalEnClaro: Story = { ...TituloOriginal, ...SOLO_PRUEBA };
export const EnJaponesYCoreanoEnClaro: Story = { ...EnJaponesYCoreano, ...SOLO_PRUEBA };
export const SobreUnaObraEnClaro: Story = { ...SobreUnaObra, ...SOLO_PRUEBA };
export const CasosLimiteEnClaro: Story = { ...CasosLimite, ...SOLO_PRUEBA };
export const SinSaltoAlCargarEnClaro: Story = { ...SinSaltoAlCargar, ...SOLO_PRUEBA };
