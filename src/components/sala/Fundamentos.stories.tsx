import type { CSSProperties, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { contrastRatio, parseHex, type Rgb } from "@/lib/design/color";
import { NEUTRAL_PALETTE, paletteFromSwatches, type ImagePalette } from "@/lib/design/image-palette";
import {
  SALA_MODES,
  SALA_ROLES,
  SALA_WORK_CLASS,
  salaVar,
  workPaletteVars,
  type SalaMode,
} from "@/lib/design/sala-palette";
import {
  SALA_COLOR,
  SALA_COLOR_ALIAS,
  SALA_FAMILY,
  SALA_MOTION,
  SALA_SIZE,
  SALA_SPACE_STEPS,
  SALA_STATES,
  SALA_TYPE,
  type SalaState,
  type SalaTypeName,
} from "@/lib/design/sala-tokens";

/**
 * Fundamentos de «Sala»: lo que fija la biblia (`docs/design/BIBLIA.md`) hecho
 * tokens. Todo lo que se ve aquí sale de `src/lib/design/sala-tokens.ts`; las
 * cifras de contraste se calculan al pintar, no están escritas.
 */
const meta = {
  title: "Sala/Fundamentos",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ------------------------------------------------------------
// Piezas comunes
// ------------------------------------------------------------

const TEMA: Record<SalaMode, string> = { light: "Claro", dark: "Oscuro" };
const ESTADO: Record<SalaState, { nombre: string; frase: string }> = {
  danger: { nombre: "Error", frase: "No se pudo guardar. Inténtalo otra vez." },
  success: { nombre: "Hecho", frase: "Guardada en tu biblioteca." },
  warning: { nombre: "Aviso", frase: "Esta obra aún no tiene fecha de estreno." },
};

const ratio = (fg: string, bg: string) =>
  contrastRatio(parseHex(fg) as Rgb, parseHex(bg) as Rgb).toLocaleString("es", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

/** La página: fondo, tinta y fuente de «Sala», en el tema de la barra de Storybook. */
function Pagina({ titulo, entrada, children }: { titulo: string; entrada: string; children: ReactNode }) {
  return (
    <div lang="es" className="min-h-screen bg-sala-background px-sala-margin pb-24 pt-12 text-sala-ink sala-type-text">
      <header className="mb-16 max-w-3xl">
        <h1 className="sala-type-title" style={{ fontSize: "clamp(2.5rem, 11vw, 6rem)" }}>
          {titulo}
        </h1>
        <p className="mt-6 sala-type-lead text-sala-ink-secondary">{entrada}</p>
      </header>
      {children}
    </div>
  );
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="mb-20">
      <h2 className="sala-type-heading">{titulo}</h2>
      {nota ? <p className="mb-8 mt-3 max-w-2xl text-sala-ink-secondary">{nota}</p> : <div className="mb-8" />}
      {children}
    </section>
  );
}

/** Nombre del token y su valor, con el contraste contra lo que tiene debajo. */
function Ficha({ token, hex, sobre }: { token: string; hex: string; sobre?: string }) {
  return (
    <span className="block sala-type-small">
      <code className="font-sala-text">{salaVar(token)}</code> {hex}
      {sobre ? `, ${ratio(hex, sobre)}:1` : ""}
    </span>
  );
}

// ------------------------------------------------------------
// Color
// ------------------------------------------------------------

/**
 * Los papeles de la biblia puestos en su sitio, en un tema. Con `palette`, el
 * tablero es el contenedor de una obra (`sala-work`) y todo sale de su paleta.
 */
function Tablero({ mode, palette, nombre }: { mode: SalaMode; palette?: ImagePalette; nombre: string }) {
  const p = (palette ?? NEUTRAL_PALETTE)[mode];
  const estados = SALA_COLOR[mode];
  return (
    <div
      data-theme={mode}
      className={`${palette ? SALA_WORK_CLASS : ""} bg-sala-background text-sala-ink`}
      style={palette ? (workPaletteVars(palette) as CSSProperties) : undefined}
    >
      <div className="bg-sala-band px-6 py-5 text-sala-band-ink">
        <p className="sala-type-heading">{nombre}</p>
        <p className="mt-1 sala-type-small">{TEMA[mode]}</p>
        <div className="mt-4">
          <Ficha token="band" hex={p.band} />
          <Ficha token="bandInk" hex={p.bandInk} sobre={p.band} />
        </div>
      </div>

      <div className="grid gap-6 p-6">
        <div>
          <p className="sala-type-data">Tinta sobre el fondo</p>
          <Ficha token="background" hex={p.background} />
          <Ficha token="ink" hex={p.ink} sobre={p.background} />
          <p className="mt-3 text-sala-ink-secondary">Tinta secundaria, para lo que acompaña.</p>
          <div className="text-sala-ink-secondary">
            <Ficha token="inkSecondary" hex={p.inkSecondary} sobre={p.background} />
          </div>
        </div>

        <div className="bg-sala-panel p-5">
          <p className="sala-type-data">Panel</p>
          <Ficha token="panel" hex={p.panel} />
          <p className="mt-3">
            Un paso de tono sobre el fondo, sin líneas ni sombras.{" "}
            <a href="#acento" className="font-semibold text-sala-accent underline underline-offset-4 focus-visible:sala-focus">
              Un enlace lleva el acento
            </a>
            .
          </p>
          <div className="text-sala-ink-secondary">
            <Ficha token="accent" hex={p.accent} sobre={p.panel} />
          </div>
          <input
            type="text"
            disabled
            aria-label="Campo deshabilitado, de muestra"
            defaultValue="Borde de un campo y texto deshabilitado"
            className="mt-4 min-h-sala-target w-full border-2 border-sala-border bg-transparent px-4 text-sala-ink-disabled"
          />
          <div className="mt-2 text-sala-ink-secondary">
            <Ficha token="border" hex={p.border} sobre={p.panel} />
          </div>
        </div>

        <div className="flex min-h-sala-target items-center justify-between gap-4 bg-sala-accent px-5 py-3 text-sala-accent-ink">
          <span className="sala-type-label">Acción principal</span>
          <Ficha token="accentInk" hex={p.accentInk} sobre={p.accent} />
        </div>

        <ul className="grid gap-2">
          {SALA_STATES.map((estado) => (
            <li key={estado} className="grid gap-2 sm:grid-cols-2">
              <div
                className="flex min-h-sala-target flex-col justify-center px-4 py-2"
                style={{ background: `var(${salaVar(estado)})`, color: `var(${salaVar(`${estado}Ink`)})` }}
              >
                <span className="sala-type-label">{ESTADO[estado].nombre}</span>
                <Ficha token={`${estado}Ink`} hex={estados[`${estado}Ink`]} sobre={estados[estado]} />
              </div>
              <div className="flex flex-col justify-center" style={{ color: `var(${salaVar(estado)})` }}>
                <span className="font-semibold">{ESTADO[estado].frase}</span>
                <Ficha token={estado} hex={estados[estado]} sobre={p.background} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ParDeTemas({ palette, nombre }: { palette?: ImagePalette; nombre: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Tablero mode="light" palette={palette} nombre={nombre} />
      <Tablero mode="dark" palette={palette} nombre={nombre} />
    </div>
  );
}

/** Una imagen de un solo color: basta para ver cómo se deriva una paleta. */
const deColor = (l: number, c: number, h: number) =>
  paletteFromSwatches([{ rgb: [0, 0, 0], oklch: { l, c, h }, share: 1 }]);

const EJEMPLOS: Array<{ nombre: string; palette: ImagePalette }> = [
  { nombre: "Imagen azul", palette: deColor(0.45, 0.16, 258) },
  { nombre: "Imagen roja", palette: deColor(0.58, 0.21, 28) },
  { nombre: "Imagen verde", palette: deColor(0.72, 0.13, 165) },
];

function TablaDeColor() {
  const filas = [...Object.keys(SALA_COLOR.light), ...Object.keys(SALA_COLOR_ALIAS)];
  const valor = (mode: SalaMode, token: string) =>
    SALA_COLOR[mode][token] ?? `igual que ${salaVar(SALA_COLOR_ALIAS[token])}`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <caption className="sr-only">Tokens de color neutros, en claro y en oscuro</caption>
        <thead>
          <tr className="border-b-2 border-sala-border">
            <th scope="col" className="py-3 pr-6 sala-type-label">Token</th>
            <th scope="col" className="py-3 pr-6 sala-type-label">Clase</th>
            <th scope="col" className="py-3 pr-6 sala-type-label">Claro</th>
            <th scope="col" className="py-3 sala-type-label">Oscuro</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((token) => (
            <tr key={token} className="border-b border-sala-border">
              <th scope="row" className="py-3 pr-6 font-normal">
                <code className="font-sala-text">{salaVar(token)}</code>
              </th>
              <td className="py-3 pr-6 text-sala-ink-secondary">
                <code className="font-sala-text">{`bg-${salaVar(token).slice(2)}`}</code>
              </td>
              <td className="py-3 pr-6 tabular-nums">{valor("light", token)}</td>
              <td className="py-3 tabular-nums">{valor("dark", token)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Color: Story = {
  render: () => (
    <Pagina
      titulo="Color"
      entrada="El color de una ficha sale de la imagen de su obra y se ajusta hasta que se lee. Cuando no hay imagen, o mientras llega, valen estos neutros. Claro y oscuro, siempre los dos."
    >
      <Seccion
        titulo="Neutros"
        nota="Cada cifra es el contraste de ese color contra lo que tiene debajo: 4,5:1 o más para texto y 3:1 o más para bordes."
      >
        <ParDeTemas nombre="Sin imagen" />
      </Seccion>

      <Seccion
        titulo="Con el color de una obra"
        nota="Los mismos papeles, sacados de una imagen. Los colores de error, hecho y aviso no cambian con la obra. Son imágenes de un solo color, de ejemplo: las portadas reales llegan con la ficha."
      >
        <div className="grid gap-10">
          {EJEMPLOS.map((ejemplo) => (
            <ParDeTemas key={ejemplo.nombre} {...ejemplo} />
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Todos los tokens">
        <TablaDeColor />
      </Seccion>
    </Pagina>
  ),
};

// ------------------------------------------------------------
// Tipografía
// ------------------------------------------------------------

/** El rótulo llena el ancho: cuanto más largo el título, más estrecha la letra. */
const ROTULOS: Array<{ titulo: string; original?: string; lang?: string; anchura: number }> = [
  { titulo: "Hades", anchura: 150 },
  { titulo: "Parásitos", original: "기생충", lang: "ko", anchura: 112 },
  { titulo: "El viaje de Chihiro", original: "千と千尋の神隠し", lang: "ja", anchura: 62 },
  { titulo: "Berserk", original: "ベルセルク", lang: "ja", anchura: 130 },
];

const MUESTRA: Record<SalaTypeName, string> = {
  title: "Parásitos",
  heading: "Dónde verla",
  data: "132 min",
  lead: "Una familia sin trabajo se va colando, uno a uno, en la casa de otra que lo tiene todo.",
  text: "Añádela a tu biblioteca para puntuarla y seguir por dónde vas.",
  label: "Guardar en la biblioteca",
  small: "Estreno en España",
};

/** Escritas enteras: Tailwind solo genera las clases que encuentra tal cual en el código. */
const CLASE_DE_PAPEL: Record<SalaTypeName, string> = {
  title: "sala-type-title",
  heading: "sala-type-heading",
  data: "sala-type-data",
  lead: "sala-type-lead",
  text: "sala-type-text",
  label: "sala-type-label",
  small: "sala-type-small",
};

function Tipos() {
  return (
    <>
      <Seccion
        titulo="Rótulo"
        nota="Anybody, con su eje de anchura. Debajo va el título original en su escritura, marcado con su idioma. La anchura de cada rótulo la calculará el componente; aquí está puesta a mano."
      >
        <div className="grid gap-10">
          {ROTULOS.map((r) => (
            <div key={r.titulo}>
              <p
                className="sala-type-title"
                style={{ fontSize: "clamp(2.75rem, 11vw, 6rem)", fontStretch: `${r.anchura}%` }}
              >
                {r.titulo}
              </p>
              {r.original ? (
                <p lang={r.lang} className="mt-3 font-sala-display text-3xl font-bold">
                  {r.original}
                </p>
              ) : null}
              <p className="mt-2 sala-type-small text-sala-ink-secondary">
                Anchura {r.anchura} %{r.lang ? `, original en ${r.lang === "ko" ? "coreano" : "japonés"}` : ""}
              </p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="La anchura, de 50 a 150">
        <div className="grid gap-1">
          {[50, 75, 100, 125, 150].map((anchura) => (
            <p key={anchura} className="flex items-baseline gap-6">
              <span className="w-16 shrink-0 sala-type-small tabular-nums text-sala-ink-secondary">{anchura} %</span>
              <span className="font-sala-display text-5xl font-extrabold" style={{ fontStretch: `${anchura}%` }}>
                Sala
              </span>
            </p>
          ))}
        </div>
      </Seccion>

      <Seccion
        titulo="Papeles"
        nota="Texto e interfaz van en Instrument Sans. Cada papel es una clase; el más pequeño mide 14 px."
      >
        <dl className="grid gap-8">
          {(Object.keys(SALA_TYPE) as SalaTypeName[]).map((nombre) => {
            const papel = SALA_TYPE[nombre];
            return (
              <div key={nombre} className="grid gap-2 border-t-2 border-sala-border pt-4 md:grid-cols-[16rem_1fr] md:gap-8">
                <dt>
                  <code className="font-sala-text font-semibold">{CLASE_DE_PAPEL[nombre]}</code>
                  <span className="mt-1 block sala-type-small text-sala-ink-secondary">{papel.use}</span>
                  <span className="mt-1 block sala-type-small tabular-nums text-sala-ink-secondary">
                    {[papel.size ?? "tamaño libre", `interlineado ${papel.lineHeight}`, `peso ${papel.weight}`].join(", ")}
                  </span>
                </dt>
                <dd
                  className={`${CLASE_DE_PAPEL[nombre]} max-w-[62ch]`}
                  style={nombre === "title" ? { fontSize: "clamp(2.75rem, 8vw, 5rem)" } : undefined}
                >
                  {MUESTRA[nombre]}
                </dd>
              </div>
            );
          })}
        </dl>
      </Seccion>

      <Seccion
        titulo="Coreano y japonés"
        nota="Noto Sans. En texto japonés va primero la fuente japonesa y en coreano la coreana: el mismo carácter chino se dibuja distinto en cada una."
      >
        <div className="grid gap-8 md:grid-cols-2">
          <div lang="ja">
            <p className="font-sala-display text-4xl font-extrabold md:text-5xl">千と千尋の神隠し</p>
            <p className="mt-3 sala-type-lead">今日観た映画を記録しましょう。直 骨 令</p>
            <p lang="es" className="mt-2 sala-type-small text-sala-ink-secondary">Japonés</p>
          </div>
          <div lang="ko">
            <p className="font-sala-display text-4xl font-extrabold md:text-5xl">기생충</p>
            <p className="mt-3 sala-type-lead">오늘 본 영화를 기록해 보세요. 直 骨 令</p>
            <p lang="es" className="mt-2 sala-type-small text-sala-ink-secondary">Coreano</p>
          </div>
        </div>
      </Seccion>
    </>
  );
}

const ENTRADA_TIPOS =
  "Anybody para el rótulo, Instrument Sans para todo lo demás y Noto Sans para el coreano y el japonés.";

export const Tipografia: Story = {
  name: "Tipografía",
  render: () => (
    <Pagina titulo="Tipografía" entrada={ENTRADA_TIPOS}>
      <Tipos />
    </Pagina>
  ),
};

// ------------------------------------------------------------
// Espacio, medidas y movimiento
// ------------------------------------------------------------

function Medidas() {
  return (
    <>
      <Seccion
        titulo="Espacio"
        nota="Múltiplos de 4 px, con la escala de Tailwind: no hay tokens propios. Estos son los pasos que se usan."
      >
        <ul className="grid gap-3">
          {SALA_SPACE_STEPS.map((px) => (
            <li key={px} className="flex items-center gap-6">
              <span className="w-28 shrink-0 sala-type-small tabular-nums text-sala-ink-secondary">
                {px} px, <code className="font-sala-text">p-{px / 4}</code>
              </span>
              <span className="block h-6 bg-sala-ink" style={{ width: px }} />
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion
        titulo="Acción y foco"
        nota="Esquinas rectas, color plano y ninguna sombra. Una acción mide 48 px o más. El foco es un anillo de 3 px con la tinta, separado otros 3: pulsa Tab para verlo."
      >
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="min-h-sala-target bg-sala-accent px-6 text-sala-accent-ink transition-colors duration-sala-fast ease-sala sala-type-label hover:bg-sala-ink hover:text-sala-background focus-visible:sala-focus"
          >
            Guardar en la biblioteca
          </button>
          <button
            type="button"
            className="min-h-sala-target border-2 border-sala-ink px-6 transition-colors duration-sala-fast ease-sala sala-type-label hover:bg-sala-ink hover:text-sala-background focus-visible:sala-focus"
          >
            Ver el tráiler
          </button>
          <span className="flex min-h-sala-target items-center px-2 sala-type-label sala-focus">Así se ve el foco</span>
        </div>
        <dl className="mt-10 grid gap-4 sm:grid-cols-2">
          {Object.entries({ ...SALA_SIZE, ...SALA_MOTION }).map(([nombre, valor]) => (
            <div key={nombre} className="border-t-2 border-sala-border pt-3">
              <dt>
                <code className="font-sala-text font-semibold">{salaVar(nombre)}</code>
              </dt>
              <dd className="mt-1 tabular-nums text-sala-ink-secondary">{valor}</dd>
            </div>
          ))}
        </dl>
      </Seccion>
    </>
  );
}

const ENTRADA_MEDIDAS =
  "Lo poco que hace falta además del color y la letra. Los tiempos y el margen vienen del prototipo que se firmó y son propuesta.";

export const Espacio: Story = {
  name: "Espacio y medidas",
  render: () => (
    <Pagina titulo="Medidas" entrada={ENTRADA_MEDIDAS}>
      <Medidas />
    </Pagina>
  ),
};

// ------------------------------------------------------------
// Anidados: un tema dentro de una obra y un idioma dentro de otro. La prueba
// lee lo que calcula el navegador, no un simulador de `var()`.
// ------------------------------------------------------------

const OBRA = EJEMPLOS[0].palette;

/** Como lo devuelve `getComputedStyle`: `rgb(205, 225, 255)`. */
const rgbCss = (hex: string) =>
  `rgb(${(parseHex(hex) as Rgb).map((canal) => Math.round(canal * 255)).join(", ")})`;

function Anidados() {
  return (
    <>
      <Seccion
        titulo="Tema dentro de una obra"
        nota="Un contenedor con data-theme dentro de una obra cambia de tema y sigue pintando con la paleta de la obra."
      >
        <div className={`${SALA_WORK_CLASS} grid gap-4 sm:grid-cols-2`} style={workPaletteVars(OBRA) as CSSProperties}>
          {SALA_MODES.map((mode) => (
            <div
              key={mode}
              data-theme={mode}
              data-testid={`obra-${mode}`}
              className="p-5"
              style={{ background: `var(${salaVar("background")})`, color: `var(${salaVar("ink")})` }}
            >
              <p className="sala-type-data">{TEMA[mode]}</p>
              <Ficha token="background" hex={OBRA[mode].background} />
              <Ficha token="ink" hex={OBRA[mode].ink} sobre={OBRA[mode].background} />
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion
        titulo="Idioma dentro de otro"
        nota="Un título japonés dentro de un texto coreano sale con la fuente japonesa primero."
      >
        <div lang="ko">
          <p data-testid="ko" className="font-sala-display text-4xl font-extrabold">
            기생충 直 骨 令
          </p>
          <p lang="ja" data-testid="ja-en-ko" className="mt-3 font-sala-display text-4xl font-extrabold">
            千と千尋の神隠し 直 骨 令
          </p>
        </div>
      </Seccion>
    </>
  );
}

export const AnidadosDePrueba: Story = {
  name: "Anidados",
  tags: ["!dev"],
  render: () => (
    <Pagina titulo="Anidados" entrada="Casos que comprueba la prueba de esta historia, con los valores que calcula el navegador.">
      <Anidados />
    </Pagina>
  ),
  play: async ({ canvasElement }) => {
    const nodo = (id: string) => canvasElement.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const token = (el: HTMLElement, name: string) => getComputedStyle(el).getPropertyValue(salaVar(name)).trim();

    for (const mode of SALA_MODES) {
      const el = nodo(`obra-${mode}`);
      // La obra no es gris: si saliera el neutro, se notaría.
      await expect(OBRA[mode].background).not.toBe(NEUTRAL_PALETTE[mode].background);
      for (const role of SALA_ROLES) await expect(token(el, role), `${mode} ${role}`).toBe(OBRA[mode][role]);
      // Los alias siguen a la obra, y lo que se pinta es eso.
      await expect(token(el, "focus")).toBe(OBRA[mode].ink);
      await expect(token(el, "inkDisabled")).toBe(OBRA[mode].border);
      await expect(getComputedStyle(el).backgroundColor).toBe(rgbCss(OBRA[mode].background));
      await expect(getComputedStyle(el).color).toBe(rgbCss(OBRA[mode].ink));
      // Los estados son los del tema del contenedor anidado.
      await expect(token(el, "danger")).toBe(SALA_COLOR[mode].danger);
    }

    const orden = (el: HTMLElement) => {
      const pila = getComputedStyle(el).fontFamily;
      return { jp: pila.indexOf(SALA_FAMILY.jp), kr: pila.indexOf(SALA_FAMILY.kr) };
    };
    const coreano = orden(nodo("ko"));
    await expect(coreano.kr).toBeGreaterThan(0);
    await expect(coreano.kr).toBeLessThan(coreano.jp);
    const japones = orden(nodo("ja-en-ko"));
    await expect(japones.jp).toBeGreaterThan(0);
    await expect(japones.jp).toBeLessThan(japones.kr);
  },
};

// ------------------------------------------------------------
// Las mismas páginas en claro, para que axe las pase en los dos temas. No
// salen en la barra lateral: en Storybook se cambia con el botón «Tema».
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const ColorEnClaro: Story = { ...Color, ...SOLO_PRUEBA };
export const TipografiaEnClaro: Story = { ...Tipografia, ...SOLO_PRUEBA };
export const EspacioEnClaro: Story = { ...Espacio, ...SOLO_PRUEBA };
