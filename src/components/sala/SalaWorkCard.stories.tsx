import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, waitFor } from "storybook/test";
import {
  contraste,
  deColor,
  fondoDe,
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

const REJILLA = "grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-6";
const SIZES_REJILLA = "(min-width: 1024px) 15vw, (min-width: 640px) 22vw, 30vw";

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
  waitFor(() => expect(canvasElement.querySelector('[data-sala-poster="loading"]')).toBeNull());

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
    <ul role="list" aria-label="Tu biblioteca" className={REJILLA}>
      {BIBLIOTECA.map((o, i) => (
        <li key={o.href} className="min-w-0">
          {/* Una rejilla que mezcla formatos fija la proporción: las filas cuadran. */}
          <SalaWorkCard {...de(o, false)} ratio="2/3" sizes={SIZES_REJILLA} priority={i < 6} />
        </li>
      ))}
    </ul>
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
    <ul role="list" aria-label={variant === "row" ? "Diario" : "Sugerencias"} className={variant === "row" ? "grid max-w-2xl gap-6" : "grid max-w-md gap-2"}>
      {BIBLIOTECA.slice(0, 8).map((o) => (
        <li key={o.href} className="min-w-0">
          <SalaWorkCard {...de(o)} variant={variant} detail={variant === "row" ? o.detail : undefined} headingLevel={variant === "row" ? 3 : "none"} />
        </li>
      ))}
    </ul>
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
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
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
      <ul role="list" className="grid max-w-md grid-cols-2 gap-4">
        {[a, b].map((o) => (
          <li key={o.href} className="min-w-0">
            <SalaWorkCard {...de(o)} sizes="220px" action={boton(o.title)} />
          </li>
        ))}
      </ul>
      <ul role="list" className="grid max-w-2xl gap-6">
        {[a, b].map((o) => (
          <li key={o.href} className="min-w-0">
            <SalaWorkCard {...de(o)} variant="row" detail={o.detail} action={boton(o.title)} />
          </li>
        ))}
      </ul>
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
      nota="El título se corta a tres líneas en la rejilla y a dos en las filas. El corte es solo a la vista: el nombre del enlace lleva el título entero. Con clamp=&quot;none&quot; no se corta. Una palabra más larga que la tarjeta se parte."
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
    await expect(cortado).toHaveAttribute("title", LARGOS[0].title);
    await expect(entero).not.toHaveAttribute("title");
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
      <ul role="list" className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {JUEGOS.map((o) => (
          <li key={o.href} className="min-w-0">
            <SalaWorkCard {...de(o)} />
          </li>
        ))}
      </ul>
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

export const Esqueleto: Story = {
  render: () => (
    <EnLosDosSuelos>
      <div className="grid gap-10">
        <ul role="list" aria-busy="true" aria-label="Tu biblioteca" className={REJILLA}>
          <li className="min-w-0">
            <SalaWorkCard {...de(BIBLIOTECA[3])} ratio="2/3" sizes={SIZES_REJILLA} />
          </li>
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="min-w-0">
              <SalaWorkCardSkeleton />
            </li>
          ))}
        </ul>
        <div className="grid max-w-2xl gap-6">
          <SalaWorkCardSkeleton variant="row" />
          <SalaWorkCardSkeleton variant="row" ratio="16/9" />
          <SalaWorkCardSkeleton variant="compact" />
        </div>
        <p role="status" className="sr-only">
          Cargando tu biblioteca
        </p>
      </div>
    </EnLosDosSuelos>
  ),
  play: async ({ canvasElement }) => {
    await cargadas(canvasElement);
    const esqueletos = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-sala-card-skeleton="grid"]'));
    await expect(esqueletos).toHaveLength(10);
    const poster = canvasElement.querySelector("[data-sala-poster]")!.getBoundingClientRect();
    for (const esqueleto of esqueletos) {
      // Es adorno: la carga se anuncia una vez, fuera.
      await expect(esqueleto).toHaveAttribute("aria-hidden", "true");
      // Reserva el mismo sitio que el póster de la tarjeta de verdad.
      const hueco = esqueleto.firstElementChild!.getBoundingClientRect();
      await expect(Math.round(hueco.height)).toBe(Math.round(poster.height));
      // Se para solo: tres vueltas de 1,2 s (biblia §6: nada se mueve solo más de 5 s).
      const estilo = getComputedStyle(esqueleto);
      if (estilo.animationName !== "none") {
        await expect(parseFloat(estilo.animationDuration) * Number(estilo.animationIterationCount)).toBeLessThanOrEqual(5);
      }
    }
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const RejillaEnClaro: Story = { ...EnRejilla, ...SOLO_PRUEBA };
export const ListaEnClaro: Story = { ...EnLista, ...SOLO_PRUEBA };
export const CompactaEnClaro: Story = { ...Compacta, ...SOLO_PRUEBA };
export const EstadosEnClaro: Story = { ...LosEstados, ...SOLO_PRUEBA };
export const ConAccionSecundariaEnClaro: Story = { ...ConAccionSecundaria, ...SOLO_PRUEBA };
export const TitulosLargosEnClaro: Story = { ...TitulosLargos, ...SOLO_PRUEBA };
export const ApaisadasEnClaro: Story = { ...Apaisadas, ...SOLO_PRUEBA };
export const EsqueletoEnClaro: Story = { ...Esqueleto, ...SOLO_PRUEBA };
