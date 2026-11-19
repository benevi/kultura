import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, waitFor } from "storybook/test";
import {
  contraste,
  deColor,
  fondoDe,
  IconoCerrar,
  IconoMas,
  IMAGEN_ROTA,
  imagenDeEjemplo,
  Muestra,
  Muestras,
  NOTA_PALETA,
  OBRAS,
  Suelo,
} from "../../../.storybook/sala";
import type { ImagePalette } from "@/lib/design/image-palette";
import type { MediaType } from "@/types/media";
import { SalaButton } from "./SalaButton";
import { SalaWorkCard, SalaWorkCardSkeleton, type SalaWorkCardVariant } from "./SalaWorkCard";
import { SalaWorkList } from "./SalaWorkList";

/**
 * Tarjeta de obra de «Sala». Los títulos son de obras reales; las imágenes,
 * inventadas (un SVG de colores planos en un `data:` URI): no se baja nada de
 * la red ni se enseñan portadas con derechos. Las historias «en claro» son las
 * mismas, para que axe las pase en los dos temas.
 */
const meta = {
  title: "Sala/Tarjeta de obra",
  component: SalaWorkCard,
  parameters: { layout: "fullscreen" },
  args: {
    href: "/media/movie/496243",
    title: "Parásitos",
    originalTitle: { text: "기생충", lang: "ko" },
    format: "movie",
    formatLabel: "Película",
    year: 2019,
    poster: imagenDeEjemplo(480, 720, 165),
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["grid", "row", "compact"] },
  },
} satisfies Meta<typeof SalaWorkCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const SUELO_OBRA = OBRAS[1];

interface Obra {
  href: string;
  title: string;
  titleLang?: string;
  originalTitle?: { text: string; lang: string };
  format: MediaType;
  formatLabel: string;
  year: number;
  /** Matiz de la imagen inventada y de su paleta. */
  tono: number;
  /** `null`: la obra no trae portada. `"rota"`: la trae y no carga. */
  poster?: null | "rota";
  detail?: string;
}

const FORMATO: Record<MediaType, string> = {
  movie: "Película",
  tv: "Serie",
  anime: "Anime",
  book: "Libro",
  comic: "Cómic",
  manga: "Manga",
  game: "Videojuego",
};

const obra = (format: MediaType, id: string, title: string, year: number, tono: number, resto: Partial<Obra> = {}): Obra => ({
  href: `/media/${format}/${id}`,
  title,
  format,
  formatLabel: FORMATO[format],
  year,
  tono,
  ...resto,
});

const BIBLIOTECA: Obra[] = [
  obra("movie", "496243", "Parásitos", 2019, 165, { originalTitle: { text: "기생충", lang: "ko" }, detail: "Vista el 3 de marzo. Tu nota: 9" }),
  obra("anime", "129", "El viaje de Chihiro", 2001, 28, { originalTitle: { text: "千と千尋の神隠し", lang: "ja" }, detail: "Vista dos veces" }),
  obra("manga", "30002", "Berserk", 1989, 258, { originalTitle: { text: "ベルセルク", lang: "ja" }, poster: null, detail: "Leyendo: tomo 14 de 42" }),
  obra("tv", "1396", "Breaking Bad", 2008, 120, { detail: "Viendo: temporada 3, episodio 7" }),
  obra("book", "OL27448W", "Cien años de soledad", 1967, 70, { detail: "Pendiente" }),
  obra("tv", "93405", "El juego del calamar", 2021, 350, { originalTitle: { text: "오징어 게임", lang: "ko" }, poster: "rota", detail: "Pendiente" }),
  obra("comic", "4000-18520", "Watchmen", 1986, 95, { detail: "Leído. Tu nota: 8" }),
  obra("game", "326243", "Elden Ring", 2022, 50, { detail: "Jugando: 61 horas" }),
  obra("movie", "194662", "Birdman o (la inesperada virtud de la ignorancia)", 2014, 300, { detail: "Vista" }),
  obra("manga", "108556", "転生したらスライムだった件", 2015, 200, { titleLang: "ja", poster: null, detail: "Pendiente" }),
  obra("anime", "21", "One Piece", 1999, 230, { originalTitle: { text: "ワンピース", lang: "ja" }, detail: "Viendo: episodio 1071" }),
  obra("book", "OL5735363W", "La casa de los espíritus", 1982, 10, { detail: "Leído" }),
];

const JUEGOS: Obra[] = [
  obra("game", "326243", "Elden Ring", 2022, 50),
  obra("game", "22511", "The Legend of Zelda: Breath of the Wild", 2017, 150),
  obra("game", "9767", "Hollow Knight", 2017, 250, { poster: null }),
];

const paleta = (tono: number): ImagePalette => deColor(0.55, 0.16, tono);

function imagen({ format, tono, poster }: Obra, apaisada = format === "game"): string | null {
  if (poster === null) return null;
  if (poster === "rota") return IMAGEN_ROTA;
  return apaisada ? imagenDeEjemplo(1280, 720, tono) : imagenDeEjemplo(480, 720, tono);
}

/** Las props de una tarjeta a partir de una obra de ejemplo. */
function de(o: Obra, apaisada?: boolean) {
  return {
    href: o.href,
    title: o.title,
    titleLang: o.titleLang,
    originalTitle: o.originalTitle,
    format: o.format,
    formatLabel: o.formatLabel,
    year: o.year,
    poster: imagen(o, apaisada),
    palette: paleta(o.tono),
  };
}

// Dos columnas a 320 px: con tres, la tarjeta se queda en 85 px y casi todo título se corta.
const REJILLA = "grid grid-cols-2 gap-x-4 gap-y-8 min-[360px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6";
const SIZES_REJILLA = "(min-width: 1024px) 15vw, (min-width: 640px) 22vw, (min-width: 360px) 30vw, 45vw";

function EnLosDosSuelos({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suelo titulo="Sin imagen">{children}</Suelo>
      <Suelo titulo={SUELO_OBRA.titulo} nota={NOTA_PALETA} palette={SUELO_OBRA.palette}>
        {children}
      </Suelo>
    </>
  );
}

const cargadas = (canvasElement: HTMLElement) =>
  waitFor(() => expect(canvasElement.querySelector('[data-sala-poster-image="loading"]')).toBeNull());

// ------------------------------------------------------------
// Una sola pieza, con controles
// ------------------------------------------------------------

export const Una: Story = {
  name: "Tarjeta",
  render: (args) => (
    <Suelo titulo="Tarjeta de obra">
      <div className={args.variant && args.variant !== "grid" ? "max-w-md" : "w-40"}>
        <SalaWorkCard {...args} />
      </div>
    </Suelo>
  ),
  // axe mide con la imagen ya puesta: mientras llega, tapa a medias el rótulo de debajo.
  play: ({ canvasElement }) => cargadas(canvasElement),
};

// ------------------------------------------------------------
// Rejilla
// ------------------------------------------------------------

function Rejilla() {
  return (
    <SalaWorkList aria-label="Tu biblioteca" loadingLabel="Cargando tu biblioteca" className={REJILLA}>
      {BIBLIOTECA.map((o, i) => (
        // Una rejilla que mezcla formatos fija la proporción: las filas cuadran.
        <SalaWorkCard key={o.href} {...de(o, false)} ratio="2/3" sizes={SIZES_REJILLA} priority={i < 6} />
      ))}
    </SalaWorkList>
  );
}

export const EnRejilla: Story = {
  name: "Rejilla",
  render: () => (
    <Suelo
      titulo="Tu biblioteca"
      nota="Doce obras de siete formatos, todas a 2:3. Dos no traen portada y una no carga: queda el campo de color con el título."
    >
      <Rejilla />
    </Suelo>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await cargadas(canvasElement);

    // Una lista de verdad, con un elemento por obra.
    const lista = canvas.getByRole("list", { name: "Tu biblioteca" });
    await expect(lista.querySelectorAll(":scope > li")).toHaveLength(BIBLIOTECA.length);

    // Un enlace por tarjeta, y su nombre es el título y nada más.
    const enlaces = canvas.getAllByRole("link");
    await expect(enlaces).toHaveLength(BIBLIOTECA.length);
    for (const [i, enlace] of enlaces.entries()) {
      await expect(enlace).toHaveAccessibleName(BIBLIOTECA[i].title);
    }
    // Los títulos son encabezados: se puede saltar de obra en obra.
    await expect(canvas.getAllByRole("heading", { level: 3 })).toHaveLength(BIBLIOTECA.length);

    // El póster es adorno: ninguna imagen con nombre.
    await expect(canvas.queryAllByRole("img")).toHaveLength(0);

    // Toda la tarjeta se pulsa: un clic en el centro del póster cae en el enlace.
    const tarjeta = enlaces[0].closest<HTMLElement>("[data-sala-card]")!;
    const caja = tarjeta.getBoundingClientRect();
    await expect(caja.width).toBeGreaterThanOrEqual(48);
    await expect(caja.height).toBeGreaterThanOrEqual(48);
    const poster = tarjeta.querySelector("[data-sala-poster]")!.getBoundingClientRect();
    await expect(document.elementFromPoint(poster.left + poster.width / 2, poster.top + poster.height / 2)).toBe(enlaces[0]);

    // La portada real llena su caja (sin tope de ampliación), y el enlace no lleva `title`:
    // como cubre la tarjeta, saldría un cartelito en cualquier punto de ella.
    for (const marco of Array.from(canvasElement.querySelectorAll('[data-sala-poster-frame]'))) {
      await expect(marco).toHaveAttribute("data-sala-poster-frame", "fill");
      await expect(Math.round(marco.getBoundingClientRect().width)).toBe(Math.round(marco.parentElement!.getBoundingClientRect().width));
    }
    for (const enlace of enlaces) await expect(enlace).not.toHaveAttribute("title");
    // La lista llegó hecha: la región viva está, y callada.
    await expect(canvas.getByRole("status")).toBeEmptyDOMElement();

    // Sin salto de maquetación: con imagen, sin ella y con la imagen rota, el póster mide lo mismo.
    const altos = new Set(
      Array.from(canvasElement.querySelectorAll("[data-sala-poster]")).map((p) => Math.round(p.getBoundingClientRect().height))
    );
    await expect(altos.size).toBe(1);

    // El formato va escrito en cada tarjeta.
    await expect(canvas.getAllByText("Manga")).toHaveLength(2);

    // Cada escritura con su idioma.
    await expect(canvas.getByText("기생충")).toHaveAttribute("lang", "ko");
    await expect(canvas.getByRole("link", { name: "転生したらスライムだった件" }).firstElementChild).toHaveAttribute("lang", "ja");

    // Foco de teclado: el anillo rodea la tarjeta entera, no solo el título.
    await userEvent.tab();
    await expect(enlaces[0]).toHaveFocus();
    const anillo = getComputedStyle(enlaces[0], "::after");
    await expect(anillo.outlineStyle).toBe("solid");
    await expect(anillo.outlineWidth).toBe("3px");

    // Ni a 320 px hay scroll horizontal (WCAG 1.4.10).
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  },
};

// ------------------------------------------------------------
// Lista
// ------------------------------------------------------------

function Lista({ variant }: { variant: SalaWorkCardVariant }) {
  return (
    <SalaWorkList
      aria-label={variant === "row" ? "Diario" : "Sugerencias"}
      loadingLabel={variant === "row" ? "Cargando el diario" : "Buscando"}
      variant={variant}
      className={variant === "row" ? "grid max-w-2xl gap-6" : "grid max-w-md gap-2"}
    >
      {BIBLIOTECA.slice(0, 8).map((o) => (
        <SalaWorkCard
          key={o.href}
          {...de(o)}
          variant={variant}
          detail={variant === "row" ? o.detail : undefined}
          headingLevel={variant === "row" ? 3 : "none"}
        />
      ))}
    </SalaWorkList>
  );
}

export const EnLista: Story = {
  name: "Lista (fila)",
  render: () => (
    <Suelo titulo="Diario" nota="Fila: póster a la izquierda y, al lado, título, título original, formato, año y una línea de datos. El videojuego va apaisado.">
      <Lista variant="row" />
    </Suelo>
  ),
  play: async ({ canvas, canvasElement }) => {
    await cargadas(canvasElement);
    const enlaces = canvas.getAllByRole("link");
    await expect(enlaces).toHaveLength(8);
    await expect(enlaces[0]).toHaveAccessibleName("Parásitos");
    // Los datos están a la vista y fuera del nombre del enlace.
    await expect(canvas.getByText("Viendo: temporada 3, episodio 7")).toBeVisible();
    for (const tarjeta of Array.from(canvasElement.querySelectorAll("[data-sala-card]"))) {
      await expect(tarjeta.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    }
    // El póster mide en rem, que es en lo que va su `sizes`: 4 y 5 rem el vertical, 7 y 9 el apaisado.
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const ancha = window.matchMedia("(min-width: 640px)").matches;
    for (const poster of Array.from(canvasElement.querySelectorAll("[data-sala-poster]"))) {
      const { width, height } = poster.getBoundingClientRect();
      const esperado = width < height ? (ancha ? 5 : 4) : ancha ? 9 : 7;
      await expect(width).toBeCloseTo(esperado * rem, 0);
    }
  },
};

export const Compacta: Story = {
  render: () => (
    <Suelo titulo="Sugerencias" nota="Compacta: una miniatura y dos líneas. El título no es un encabezado: una lista de sugerencias no es un índice.">
      <Lista variant="compact" />
    </Suelo>
  ),
  play: async ({ canvas, canvasElement }) => {
    await cargadas(canvasElement);
    await expect(canvas.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    for (const tarjeta of Array.from(canvasElement.querySelectorAll("[data-sala-card]"))) {
      await expect(tarjeta.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    }
    // La miniatura mide en rem, como su `sizes`: 2,5 rem la vertical.
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const miniatura = canvasElement.querySelector("[data-sala-poster]")!;
    await expect(miniatura.getBoundingClientRect().width).toBeCloseTo(2.5 * rem, 0);
    // Un título de dos líneas como mucho: lo que sobra no se ve.
    for (const titulo of Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-sala-card] p:has(> a)"))) {
      const estilo = getComputedStyle(titulo);
      await expect(titulo.getBoundingClientRect().height).toBeLessThanOrEqual(2 * parseFloat(estilo.lineHeight) + 1);
    }
  },
};

const alQuitar = fn();

export const CompactaConAccion: Story = {
  name: "Compacta, con acción",
  render: () => (
    <Suelo
      titulo="Tu lista"
      nota="Compacta con acción secundaria: el botón va a la derecha, fuera del enlace, con su objetivo de 48 px. La fila crece hasta él."
    >
      <SalaWorkList aria-label="Tu lista" loadingLabel="Cargando tu lista" variant="compact" className="grid max-w-md gap-2">
        {BIBLIOTECA.slice(0, 4).map((o) => (
          <SalaWorkCard
            key={o.href}
            {...de(o)}
            variant="compact"
            headingLevel="none"
            action={<SalaButton variant="quiet" icon={<IconoCerrar />} label={`Quitar ${o.title} de la lista`} onClick={alQuitar} />}
          />
        ))}
      </SalaWorkList>
    </Suelo>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await cargadas(canvasElement);
    alQuitar.mockClear();
    const botones = canvas.getAllByRole("button");
    await expect(botones).toHaveLength(4);
    for (const [i, boton] of botones.entries()) {
      await expect(boton).toHaveAccessibleName(`Quitar ${BIBLIOTECA[i].title} de la lista`);
      await expect(boton.closest("a")).toBeNull();
      // El objetivo: 48 × 48 px, entero dentro de la tarjeta, y suyo (no del enlace que la cubre).
      const objetivo = boton.getBoundingClientRect();
      await expect(objetivo.width).toBeGreaterThanOrEqual(48);
      await expect(objetivo.height).toBeGreaterThanOrEqual(48);
      const tarjeta = boton.closest("[data-sala-card]")!.getBoundingClientRect();
      await expect(objetivo.top).toBeGreaterThanOrEqual(tarjeta.top - 0.5);
      await expect(objetivo.bottom).toBeLessThanOrEqual(tarjeta.bottom + 0.5);
      await expect(objetivo.right).toBeLessThanOrEqual(tarjeta.right + 0.5);
      for (const [x, y] of [
        [objetivo.left + 2, objetivo.top + 2],
        [objetivo.left + objetivo.width / 2, objetivo.top + objetivo.height / 2],
        [objetivo.right - 2, objetivo.bottom - 2],
      ]) {
        await expect(boton.contains(document.elementFromPoint(x, y))).toBe(true);
      }
      // Y entre un botón y el siguiente no se pisan.
      if (i > 0) await expect(objetivo.top).toBeGreaterThanOrEqual(botones[i - 1].getBoundingClientRect().bottom - 0.5);
    }
    // Fuera del botón, la fila sigue siendo el enlace.
    const [enlace] = canvas.getAllByRole("link");
    const fila = enlace.closest("[data-sala-card]")!.getBoundingClientRect();
    await expect(document.elementFromPoint(fila.left + 4, fila.top + fila.height / 2)).toBe(enlace);
    await userEvent.click(botones[0]);
    await expect(alQuitar).toHaveBeenCalledTimes(1);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  },
};

// ------------------------------------------------------------
// Estados
// ------------------------------------------------------------

const ESTADOS: Array<{ pie: string; force?: string }> = [
  { pie: "Reposo" },
  { pie: "Con el puntero encima", force: "hover" },
  { pie: "Con el foco del teclado", force: "focus" },
  { pie: "Pulsada", force: "pressed" },
];

function Estados() {
  const o = BIBLIOTECA[1];
  return (
    <>
      <Muestras titulo="Rejilla">
        {ESTADOS.map(({ pie, force }) => (
          <Muestra key={pie} pie={pie}>
            <div className="w-40">
              <SalaWorkCard {...de(o)} sizes="160px" data-sala-force={force} />
            </div>
          </Muestra>
        ))}
      </Muestras>
      <Muestras titulo="Fila">
        {ESTADOS.map(({ pie, force }) => (
          <Muestra key={pie} pie={pie}>
            <div className="w-72">
              <SalaWorkCard {...de(o)} variant="row" detail="Vista dos veces" data-sala-force={force} />
            </div>
          </Muestra>
        ))}
      </Muestras>
      <Muestras titulo="Compacta">
        {ESTADOS.map(({ pie, force }) => (
          <Muestra key={pie} pie={pie}>
            <div className="w-64">
              <SalaWorkCard {...de(o)} variant="compact" headingLevel="none" data-sala-force={force} />
            </div>
          </Muestra>
        ))}
      </Muestras>
    </>
  );
}

export const LosEstados: Story = {
  name: "Estados",
  render: () => (
    <EnLosDosSuelos>
      <Estados />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas, canvasElement }) => {
    await cargadas(canvasElement);
    const enlaces = canvas.getAllByRole("link", { name: "El viaje de Chihiro" });
    const con = (force: string) => enlaces.filter((a) => a.dataset.salaForce === force);
    const reposo = enlaces.filter((a) => !a.dataset.salaForce);

    // Ningún estado cambia la medida de la tarjeta.
    const medida = (a: HTMLElement) => {
      const { width, height } = a.closest("[data-sala-card]")!.getBoundingClientRect();
      return `${Math.round(width)}x${Math.round(height)}`;
    };
    for (const force of ["hover", "focus", "pressed"]) {
      for (const [i, enlace] of con(force).entries()) {
        await expect(medida(enlace)).toBe(medida(reposo[i]));
      }
    }
    // El anillo va alrededor de la tarjeta (en `::after`), no del título.
    for (const enlace of con("focus")) {
      await expect(getComputedStyle(enlace, "::after").outlineWidth).toBe("3px");
      await expect(getComputedStyle(enlace).outlineStyle).toBe("none");
    }
    // Con el puntero, el título se marca en tinta: cambia el fondo, no solo el color.
    for (const [i, enlace] of con("hover").entries()) {
      const marca = enlace.firstElementChild!;
      await expect(getComputedStyle(marca).backgroundColor).toBe(getComputedStyle(reposo[i]).color);
    }
  },
};

// ------------------------------------------------------------
// Acción secundaria
// ------------------------------------------------------------

const alGuardar = fn();

function ConAccion() {
  const [a, b] = BIBLIOTECA;
  const boton = (titulo: string) => (
    <SalaButton icon={<IconoMas />} label={`Guardar ${titulo} en la biblioteca`} onClick={alGuardar} />
  );
  return (
    <div className="grid gap-10">
      <SalaWorkList aria-label="Novedades" loadingLabel="Cargando novedades" className="grid max-w-md grid-cols-2 gap-4">
        {[a, b].map((o) => (
          <SalaWorkCard key={o.href} {...de(o)} sizes="220px" action={boton(o.title)} />
        ))}
      </SalaWorkList>
      <SalaWorkList aria-label="Recomendadas" loadingLabel="Cargando recomendadas" variant="row" className="grid max-w-2xl gap-6">
        {[a, b].map((o) => (
          <SalaWorkCard key={o.href} {...de(o)} variant="row" detail={o.detail} action={boton(o.title)} />
        ))}
      </SalaWorkList>
    </div>
  );
}

export const ConAccionSecundaria: Story = {
  name: "Con acción secundaria",
  render: () => (
    <Suelo
      titulo="Descubrir"
      nota="El botón va fuera del enlace y encima de él: no hay un control dentro de otro. En el teclado, primero la obra y después su acción."
    >
      <ConAccion />
    </Suelo>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await cargadas(canvasElement);
    alGuardar.mockClear();
    const botones = canvas.getAllByRole("button", { name: "Guardar Parásitos en la biblioteca" });
    await expect(botones).toHaveLength(2);
    for (const boton of botones) {
      // HTML válido: el botón no está dentro del enlace.
      await expect(boton.closest("a")).toBeNull();
      const caja = boton.getBoundingClientRect();
      await expect(caja.width).toBeGreaterThanOrEqual(48);
      await expect(caja.height).toBeGreaterThanOrEqual(48);
      // Y queda por encima: un clic en su centro es suyo, no del enlace.
      await expect(boton.contains(document.elementFromPoint(caja.left + caja.width / 2, caja.top + caja.height / 2))).toBe(true);
    }
    await userEvent.click(botones[0]);
    await expect(alGuardar).toHaveBeenCalledTimes(1);

    // Orden del teclado: la obra y, después, su acción.
    const [enlace] = canvas.getAllByRole("link", { name: "Parásitos" });
    enlace.focus();
    await userEvent.tab();
    await expect(botones[0]).toHaveFocus();
  },
};

// ------------------------------------------------------------
// Títulos largos y otras escrituras
// ------------------------------------------------------------

const LARGOS: Obra[] = [
  obra("movie", "194662", "Birdman o (la inesperada virtud de la ignorancia)", 2014, 300),
  obra("manga", "108556", "転生したらスライムだった件", 2015, 200, { titleLang: "ja" }),
  obra("tv", "93405", "오징어 게임", 2021, 350, { titleLang: "ko" }),
  obra("book", "OL1W", "Dondeviveelmonstruoquenadiehavistonuncaporquenotienenombre", 1999, 40),
];

export const TitulosLargos: Story = {
  name: "Títulos largos y otras escrituras",
  parameters: {
    contraste: {
      revisado: {
        elmPartiallyObscuring:
          "Un título cortado sigue ocupando, recortado e invisible, el sitio de las líneas que no se ven, y axe cree que tapa los datos de debajo. No tapa nada: es texto sobre el fondo liso de la página. El `play` mide cada texto de las tarjetas contra ese fondo: 4,5:1 o más.",
      },
    },
  },
  render: () => (
    <Suelo
      titulo="Títulos"
      nota="El título se corta a tres líneas en la rejilla y a dos en las filas. El corte es solo a la vista: el nombre del enlace lleva el título entero (sin title: el enlace cubre la tarjeta y el cartelito saldría en cualquier punto de ella). Con clamp=&quot;none&quot; no se corta. Una palabra más larga que la tarjeta se parte."
    >
      <Muestras titulo="Cortado (por defecto)">
        {LARGOS.map((o) => (
          <Muestra key={o.href} pie={o.formatLabel}>
            <div data-testid="estrecha" className="w-28">
              <SalaWorkCard {...de(o)} sizes="112px" />
            </div>
          </Muestra>
        ))}
      </Muestras>
      <Muestras titulo="Entero">
        {LARGOS.map((o) => (
          <Muestra key={o.href} pie={o.formatLabel}>
            <div data-testid="estrecha" className="w-28">
              <SalaWorkCard {...de(o)} sizes="112px" clamp="none" />
            </div>
          </Muestra>
        ))}
      </Muestras>
    </Suelo>
  ),
  play: async ({ canvas, canvasElement }) => {
    await cargadas(canvasElement);
    // Cortado o entero, el nombre es el título completo.
    await expect(canvas.getAllByRole("link", { name: LARGOS[0].title })).toHaveLength(2);
    const [cortado, entero] = canvas.getAllByRole("link", { name: LARGOS[0].title });
    // Ninguno lleva `title`: el enlace cubre la tarjeta y saldría un cartelito en cualquier punto de ella.
    await expect(cortado).not.toHaveAttribute("title");
    await expect(entero).not.toHaveAttribute("title");
    // Cortado: tres líneas a la vista y texto de sobra debajo. Entero: todo a la vista.
    const lineas = (enlace: HTMLElement) => {
      const titulo = enlace.parentElement!;
      return { titulo, alto: titulo.getBoundingClientRect().height, linea: parseFloat(getComputedStyle(titulo).lineHeight) };
    };
    const corto = lineas(cortado);
    await expect(corto.alto).toBeLessThanOrEqual(3 * corto.linea + 1);
    await expect(corto.titulo.scrollHeight).toBeGreaterThan(corto.titulo.clientHeight + 1);
    const largo = lineas(entero);
    await expect(largo.alto).toBeGreaterThan(3 * largo.linea + 1);
    await expect(largo.titulo.scrollHeight).toBeLessThanOrEqual(largo.titulo.clientHeight + 1);
    // Nada se sale de su tarjeta.
    for (const caja of canvas.getAllByTestId("estrecha")) {
      await expect(caja.scrollWidth).toBeLessThanOrEqual(caja.clientWidth + 1);
    }
    // Lo que axe no puede medir aquí (ver `parameters.contraste`): cada texto contra el fondo liso que tiene detrás.
    for (const texto of Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-sala-card] a > span, [data-sala-card] p, [data-sala-card] p > span"))) {
      await expect(contraste(getComputedStyle(texto).color, fondoDe(texto))).toBeGreaterThanOrEqual(4.5);
    }
    // Japonés y coreano, cada uno con su fuente delante.
    const japones = canvas.getAllByRole("link", { name: LARGOS[1].title })[0].firstElementChild!;
    await expect(getComputedStyle(japones).fontFamily).toMatch(/Noto Sans JP.*Noto Sans KR/);
    const coreano = canvas.getAllByRole("link", { name: LARGOS[2].title })[0].firstElementChild!;
    await expect(getComputedStyle(coreano).fontFamily).toMatch(/Noto Sans KR.*Noto Sans JP/);
  },
};

// ------------------------------------------------------------
// Apaisado
// ------------------------------------------------------------

export const Apaisadas: Story = {
  name: "Videojuegos, en apaisado",
  render: () => (
    <Suelo titulo="Videojuegos" nota="Una estantería de un solo formato usa su proporción: el arte de un videojuego llega a 16:9.">
      <SalaWorkList aria-label="Videojuegos" loadingLabel="Cargando videojuegos" ratio="16/9" className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {JUEGOS.map((o) => (
          <SalaWorkCard key={o.href} {...de(o)} />
        ))}
      </SalaWorkList>
    </Suelo>
  ),
  play: async ({ canvasElement }) => {
    await cargadas(canvasElement);
    for (const poster of Array.from(canvasElement.querySelectorAll("[data-sala-poster]"))) {
      const { width, height } = poster.getBoundingClientRect();
      await expect(width / height).toBeCloseTo(16 / 9, 1);
    }
  },
};

// ------------------------------------------------------------
// Esqueleto
// ------------------------------------------------------------

/** Una biblioteca que se carga: primero nada, luego las obras. El botón repite la carga. */
function BibliotecaQueCarga() {
  const [cargando, setCargando] = useState(true);
  const obras = cargando ? BIBLIOTECA.slice(3, 4) : BIBLIOTECA.slice(3, 9);
  return (
    <div className="grid gap-6">
      <div>
        <SalaButton variant="secondary" onClick={() => setCargando((c) => !c)}>
          {cargando ? "Terminar la carga" : "Cargar otra vez"}
        </SalaButton>
      </div>
      <SalaWorkList
        aria-label="Tu biblioteca"
        loading={cargando}
        loadingLabel="Cargando tu biblioteca"
        loadedLabel={`${obras.length} obras`}
        skeletons={5}
        className={REJILLA}
      >
        {obras.map((o) => (
          <SalaWorkCard key={o.href} {...de(o, false)} ratio="2/3" sizes={SIZES_REJILLA} />
        ))}
      </SalaWorkList>
    </div>
  );
}

export const Esqueleto: Story = {
  render: () => (
    <EnLosDosSuelos>
      <div className="grid gap-10">
        <BibliotecaQueCarga />
        <div className="grid max-w-2xl gap-6">
          <SalaWorkCardSkeleton variant="row" />
          <SalaWorkCardSkeleton variant="row" ratio="16/9" />
          <SalaWorkCardSkeleton variant="compact" />
        </div>
      </div>
    </EnLosDosSuelos>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await cargadas(canvasElement);
    const [lista] = canvas.getAllByRole("list", { name: "Tu biblioteca" });
    const [estado] = canvas.getAllByRole("status");

    // Cargando: la lista lo dice, y la región viva lo anuncia una vez (no una por tarjeta).
    await expect(lista).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(estado).toHaveTextContent("Cargando tu biblioteca"));
    // Los esqueletos no cuentan como elementos de la lista: solo la obra que ya está.
    await expect(lista.querySelectorAll(":scope > li")).toHaveLength(6);
    await expect(lista.querySelectorAll(':scope > li:not([aria-hidden="true"])')).toHaveLength(1);

    const esqueletos = Array.from(lista.querySelectorAll<HTMLElement>('[data-sala-card-skeleton="grid"]'));
    await expect(esqueletos).toHaveLength(5);
    const poster = lista.querySelector("[data-sala-poster]")!.getBoundingClientRect();
    for (const esqueleto of esqueletos) {
      await expect(esqueleto.closest("li")).toHaveAttribute("aria-hidden", "true");
      // Reserva el mismo sitio que el póster de la tarjeta de verdad.
      const hueco = esqueleto.firstElementChild!.getBoundingClientRect();
      await expect(Math.round(hueco.height)).toBe(Math.round(poster.height));
      // Se para solo: tres vueltas de 1,2 s (biblia §6: nada se mueve solo más de 5 s).
      const estilo = getComputedStyle(esqueleto);
      if (estilo.animationName !== "none") {
        await expect(parseFloat(estilo.animationDuration) * Number(estilo.animationIterationCount)).toBeLessThanOrEqual(5);
      }
    }

    // Al acabar: fuera esqueletos y `aria-busy`, y la misma región dice el resultado.
    const [terminar] = canvas.getAllByRole("button", { name: "Terminar la carga" });
    await userEvent.click(terminar);
    await waitFor(() => expect(estado).toHaveTextContent("6 obras"));
    await expect(estado).toBeInTheDocument();
    await expect(lista).not.toHaveAttribute("aria-busy");
    await expect(lista.querySelectorAll("[data-sala-list-skeleton]")).toHaveLength(0);
    await expect(lista.querySelectorAll(":scope > li")).toHaveLength(6);
    await cargadas(canvasElement);
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const RejillaEnClaro: Story = { ...EnRejilla, ...SOLO_PRUEBA };
export const ListaEnClaro: Story = { ...EnLista, ...SOLO_PRUEBA };
export const CompactaEnClaro: Story = { ...Compacta, ...SOLO_PRUEBA };
export const CompactaConAccionEnClaro: Story = { ...CompactaConAccion, ...SOLO_PRUEBA };
export const EstadosEnClaro: Story = { ...LosEstados, ...SOLO_PRUEBA };
export const ConAccionSecundariaEnClaro: Story = { ...ConAccionSecundaria, ...SOLO_PRUEBA };
export const TitulosLargosEnClaro: Story = { ...TitulosLargos, ...SOLO_PRUEBA };
export const ApaisadasEnClaro: Story = { ...Apaisadas, ...SOLO_PRUEBA };
export const EsqueletoEnClaro: Story = { ...Esqueleto, ...SOLO_PRUEBA };
