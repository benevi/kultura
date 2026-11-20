import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { contraste, conVentana, emularMedios, EN_PRUEBAS, escenaDeEjemplo, fijarVentana, Suelo } from "../../../.storybook/sala";
import { fundidoPintado, medirRotulo, medirSala, resolver } from "../../../.storybook/rotulo";
import { TITLE_FUSE_MAX_COVERED, TITLE_FUSE_MIN_CONTRAST, TITLE_LETTER_MAX_COVERED } from "@/lib/design/title-fuse";
import { SalaStage, type SalaStageFuse, type SalaStageProps } from "./SalaStage";

/**
 * La sala: la imagen de una obra a todo el ancho con el rótulo dentro. Las
 * escenas son inventadas (SVG), con su figura recortada: lo que en la app
 * llegará ya calculado (fase 8.5). Aquí la historia mide la sala pintada sin
 * fundido (`medirSala`), le pasa esas medidas a `SalaStage` y el `play`
 * vuelve a medir lo pintado contra los topes de la biblia: la figura tapa
 * como mucho el 22 % del título, ninguna letra que se ve por detrás pierde
 * más del 35 %, las que van por delante se ven enteras y lo que se ve de cada
 * letra está a 3:1 o más.
 */
const meta = {
  title: "Sala/Sala con rótulo",
  component: SalaStage,
  parameters: {
    layout: "fullscreen",
  },
  args: { title: "El viaje de Chihiro" },
} satisfies Meta<typeof SalaStage>;

export default meta;
type Story = StoryObj<typeof meta>;

const NOCHE = escenaDeEjemplo(250, { x: 0.62 });
const DIA = escenaDeEjemplo(80, { x: 0.3, claro: true });
const FIGURA_ILEGIBLE = escenaDeEjemplo(250, { x: 0.62, figuraClara: true });

/** Proporción de la sala: apaisada en escritorio, más alta en el móvil. Es un mínimo: si el título no cabe, crece. */
const PROPORCION = "aspect-[4/5] sm:aspect-[16/9] w-full";

type Escena = { imagen: string; figura: string };

/**
 * Una sala que se mide a sí misma: se pinta sin fundido, se mide (como hará
 * la fase 8.5 de antemano) y se vuelve a pintar con lo medido. Marca
 * `data-medida` cuando ha terminado.
 */
function SalaMedida({ escena, ...props }: Omit<SalaStageProps, "image" | "fuse"> & { escena: Escena }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [fuse, setFuse] = React.useState<SalaStageFuse | null>(null);
  const [medida, setMedida] = React.useState(false);
  const [fallo, setFallo] = React.useState<string | null>(null);
  React.useEffect(() => {
    let vivo = true;
    void (async () => {
      // Si la sala se vuelve a montar a media medida (cambio de tema), se mide la nueva.
      for (let intento = 0; vivo && intento < 5; intento++) {
        const sala = ref.current;
        try {
          if (!sala?.isConnected) throw new Error("La sala no está en la página");
          const m = await medirSala(sala, escena.figura);
          if (!vivo || sala !== ref.current) continue;
          setFuse({ figure: escena.figura, [m.layout]: m.data, ratio: { [m.layout]: m.width / m.height } });
          setMedida(true);
          return;
        } catch (error) {
          if (vivo && intento === 4) setFallo(String(error));
          await new Promise((seguir) => setTimeout(seguir, 100));
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [escena.figura]);
  return (
    <div data-medida={medida ? "" : undefined} data-medida-fallo={fallo ?? undefined}>
      <SalaStage
        ref={ref}
        className={PROPORCION}
        image={
          // Una imagen inventada en un data: URI; en la app, `next/image`.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={escena.imagen} alt="" />
        }
        fuse={fuse}
        {...props}
      />
    </div>
  );
}

/** Espera la sala medida y vuelve a medir lo pintado. */
async function salaPintada(canvasElement: HTMLElement, figura: string) {
  await waitFor(
    () => {
      const fallo = canvasElement.querySelector<HTMLElement>("[data-medida-fallo]")?.dataset.medidaFallo;
      if (fallo) throw new Error(`No se pudo medir la sala: ${fallo}`);
      expect(canvasElement.querySelector("[data-medida]")).not.toBeNull();
    },
    { timeout: 10_000 }
  );
  const sala = canvasElement.querySelector<HTMLElement>("[data-sala-stage]")!;
  return { sala, medida: await medirSala(sala, figura) };
}

/** Lo que tiene que cumplir una sala con fundido, medido sobre lo pintado. */
async function comprobarFundido(canvasElement: HTMLElement, titulo: string, figura: string) {
  const { sala, medida } = await salaPintada(canvasElement, figura);
  const resuelto = resolver(medida, titulo);
  await expect(resuelto, "con estas medidas el fundido cumple").not.toBeNull();
  await expect(sala.dataset.salaFuse).toContain(medida.layout === "wide" ? "w" : "n");
  // El encabezado se pinta con el fundido (el texto, con la imagen de fondo).
  const encabezado = sala.querySelector<HTMLElement>(".sala-stage-heading")!;
  await expect(getComputedStyle(encabezado).backgroundClip.split(", ").every((capa) => capa === "text")).toBe(true);
  const pintado = fundidoPintado(medida, resuelto!);
  await expect(pintado.titulo, "la figura tapa como mucho el 22 % del título").toBeLessThanOrEqual(TITLE_FUSE_MAX_COVERED + 1e-9);
  for (const [i, linea] of pintado.lineas.entries()) {
    await expect(linea, `y de cada línea (la ${i + 1}.ª)`).toBeLessThanOrEqual(TITLE_FUSE_MAX_COVERED + 1e-9);
  }
  await expect(pintado.titulo, "y algo tapa: hay fundido").toBeGreaterThan(0);
  await expect(pintado.peorLetra, "ninguna letra de detrás pierde más del 35 %").toBeLessThanOrEqual(TITLE_LETTER_MAX_COVERED + 1e-9);
  await expect(pintado.tapadoDelante, "las letras de delante se ven enteras").toBe(0);
  await expect(pintado.contraste, "lo que se ve de cada letra, a 3:1 o más").toBeGreaterThanOrEqual(TITLE_FUSE_MIN_CONTRAST);
  // El título se lee una vez: un encabezado con el texto entero.
  await expect(encabezado).toHaveTextContent(titulo);
  await expect(sala.querySelectorAll("[data-sala-title-text]")).toHaveLength(1);
}

/** Sin fundido: el título entero por delante, sobre el velo, a 3:1 o más (texto grande). */
async function comprobarSinFundido(canvasElement: HTMLElement, figura: string) {
  const { sala, medida } = await salaPintada(canvasElement, figura);
  const encabezado = sala.querySelector<HTMLElement>(".sala-stage-heading")!;
  await expect(getComputedStyle(encabezado).backgroundClip).not.toContain("text");
  await expect(getComputedStyle(encabezado).color).not.toBe("rgba(0, 0, 0, 0)");
  const figuraPintada = sala.querySelector(".sala-stage-figure");
  if (figuraPintada) await expect(getComputedStyle(figuraPintada).display).toBe("none");
  await expect(medida.contrasteSinFundido).toBeGreaterThanOrEqual(TITLE_FUSE_MIN_CONTRAST);
  // Con el velo por defecto, la tinta queda a 4,5:1 o más sobre cualquier imagen.
  await expect(contrasteEnElVelo(sala)).toBeGreaterThanOrEqual(4.5);
}

/** Un color de la sala (una variable), leído a través de un elemento de prueba dentro de ella. */
function colorDe(sala: HTMLElement, variable: string): string {
  const sonda = document.createElement("span");
  sonda.style.color = `var(${variable})`;
  sala.appendChild(sonda);
  const color = getComputedStyle(sonda).color;
  sonda.remove();
  return color;
}

/**
 * Contraste de la tinta en la parte llena del velo, en el peor caso: la
 * imagen blanca o negra del todo debajo. Es donde va el título original y lo
 * de debajo del título.
 */
function contrasteEnElVelo(sala: HTMLElement): number {
  const tinta = colorDe(sala, "--sala-ink");
  // El color del velo ya calculado, con su opacidad (la de `veil` o, con más contraste, 0,85).
  const fondo = getComputedStyle(sala.querySelector(".sala-stage-veil")!).backgroundColor;
  const lienzo = document.createElement("canvas").getContext("2d")!;
  return Math.min(
    ...["#fff", "#000"].map((imagen) => {
      lienzo.globalAlpha = 1;
      lienzo.fillStyle = imagen;
      lienzo.fillRect(0, 0, 1, 1);
      lienzo.fillStyle = fondo;
      lienzo.fillRect(0, 0, 1, 1);
      const [r, g, b] = lienzo.getImageData(0, 0, 1, 1).data;
      return contraste(tinta, `rgb(${r}, ${g}, ${b})`);
    })
  );
}

const SOBRE_LA_SALA =
  "El título está en una subrejilla que ocupa la sala entera, encima de la imagen y del velo, y axe no ve su fondo. El `play` lo mide a mano (`medirSala`): cada letra, pintada en un lienzo donde la ha puesto el navegador, contra la imagen velada píxel a píxel; 3:1 o más (texto grande) en el peor píxel.";
const EN_EL_VELO =
  "Texto sobre el velo: el color del fondo al 70 % (85 % con más contraste), macizo, sobre la imagen; axe ve la imagen debajo y no sabe mezclarlos. El `play` lo mide en el peor caso, con la imagen blanca o negra del todo debajo: 4,5:1 o más.";

const NOTA_FUNDIDO =
  "La figura pasa por delante de algunas letras. Las que perderían más del 35 % van por delante, enteras; en total la figura no tapa más del 22 % del título, y lo que se ve de cada letra está a 3:1 o más. El texto es el encabezado de verdad, una sola vez: el fundido es ese mismo texto pintado con la imagen.";

// ------------------------------------------------------------
// Con fundido
// ------------------------------------------------------------

export const ConFundido: Story = {
  name: "Con fundido, de noche",
  parameters: {
    contraste: {
      revisado: {
        bgOverlap: SOBRE_LA_SALA,
      },
    },
  },
  render: (args) => (
    <Suelo titulo="Sala con fundido" nota={NOTA_FUNDIDO}>
      <SalaMedida escena={NOCHE} title={args.title} headingLevel={3} />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: ({ canvasElement, args }) => comprobarFundido(canvasElement, args.title, NOCHE.figura),
};

export const ConFundidoEnMovil: Story = {
  name: "Con fundido, en el móvil",
  parameters: {
    contraste: {
      revisado: {
        bgOverlap: SOBRE_LA_SALA,
      },
    },
  },
  render: (args) => (
    <Suelo titulo="Sala con fundido, 375 px" nota={NOTA_FUNDIDO}>
      <SalaMedida escena={NOCHE} title={args.title} headingLevel={3} />
    </Suelo>
  ),
  beforeEach: conVentana(375, 812),
  play: ({ canvasElement, args }) => comprobarFundido(canvasElement, args.title, NOCHE.figura),
};

export const DeDia: Story = {
  name: "Con fundido, de día",
  parameters: {
    contraste: {
      revisado: {
        bgOverlap: SOBRE_LA_SALA,
      },
    },
  },
  args: { title: "Cien años de soledad" },
  render: (args) => (
    <Suelo titulo="Escena clara" nota="Con una imagen muy clara la sala va en tono claro: tinta oscura sobre velo claro.">
      <SalaMedida escena={DIA} title={args.title} tone="light" headingLevel={3} />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: ({ canvasElement, args }) => comprobarFundido(canvasElement, args.title, DIA.figura),
};

// ------------------------------------------------------------
// Sin fundido: sin datos, sin contraste o con movimiento reducido
// ------------------------------------------------------------

export const SinFundido: Story = {
  name: "Sin fundido",
  parameters: {
    contraste: {
      revisado: {
        bgOverlap: SOBRE_LA_SALA,
        imgNode: EN_EL_VELO,
      },
    },
  },
  render: (args) => (
    <Suelo titulo="Sala sin fundido" nota="Sin medidas de la figura, el título va entero por delante, sobre el velo.">
      <SalaStage
        className={PROPORCION}
        title={args.title}
        headingLevel={3}
        original={{ text: "千と千尋の神隠し", lang: "ja" }}
        // eslint-disable-next-line @next/next/no-img-element
        image={<img src={NOCHE.imagen} alt="" />}
      />
      <span data-medida="" hidden />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvasElement, canvas, args }) => {
    await comprobarSinFundido(canvasElement, NOCHE.figura);
    // El original va debajo, fuera del encabezado, con su idioma.
    await expect(canvas.getByRole("heading", { level: 3, name: args.title })).toBeVisible();
    await expect(canvas.getByText("千と千尋の神隠し")).toHaveAttribute("lang", "ja");
  },
};

export const SinContraste: Story = {
  name: "Figura que no se lee: sin fundido",
  parameters: {
    contraste: {
      revisado: {
        bgOverlap: SOBRE_LA_SALA,
      },
    },
  },
  render: (args) => (
    <Suelo
      titulo="La figura no deja 3:1"
      nota="La figura es tan clara como la tinta: una letra por delante no se leería sobre ella. El fundido no se pinta y el título va entero por delante, sobre el velo."
    >
      <SalaMedida escena={FIGURA_ILEGIBLE} title={args.title} headingLevel={3} />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvasElement, args }) => {
    const { sala, medida } = await salaPintada(canvasElement, FIGURA_ILEGIBLE.figura);
    await expect(medida.data.minContrast).toBeLessThan(TITLE_FUSE_MIN_CONTRAST);
    await expect(resolver(medida, args.title)).toBeNull();
    await expect(sala.dataset.salaFuse).toBeUndefined();
    await comprobarSinFundido(canvasElement, FIGURA_ILEGIBLE.figura);
  },
};

export const MovimientoReducido: Story = {
  name: "Con movimiento reducido",
  parameters: {
    contraste: {
      revisado: {
        imgNode: SOBRE_LA_SALA,
      },
    },
  },
  render: (args) => (
    <Suelo
      titulo="Movimiento reducido"
      nota="Con movimiento reducido (del sistema o de la app) no hay fundido ni entrada: el título, quieto y entero por delante. El HTML es el mismo; lo decide el CSS."
    >
      <div data-sala-motion="reduce">
        <SalaMedida escena={NOCHE} title={args.title} headingLevel={3} />
      </div>
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvasElement }) => {
    const { sala } = await salaPintada(canvasElement, NOCHE.figura);
    // Las medidas cumplen y la sala lleva el fundido en el HTML…
    await waitFor(() => expect(sala.dataset.salaFuse).toBeTruthy());
    // …pero no se pinta ni se anima.
    await comprobarSinFundido(canvasElement, NOCHE.figura);
    await expect(sala.getAnimations({ subtree: true })).toHaveLength(0);
  },
};

export const SinImagen: Story = {
  name: "Sin imagen",
  parameters: {
    contraste: {
      revisado: {
        bgOverlap: "Sin imagen, el título va sobre el campo de color de la sala. axe no ve ese fondo porque el encabezado ocupa la sala entera en una subrejilla; el `play` mide la tinta contra el campo: 4,5:1 o más.",
      },
    },
  },
  render: (args) => (
    <Suelo titulo="Sin imagen" nota="Sin imagen, o mientras llega: el campo de color de la obra con el título.">
      <SalaStage className={PROPORCION} title={args.title} headingLevel={3} />
    </Suelo>
  ),
  play: async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByRole("heading", { level: 3, name: args.title })).toBeVisible();
    const sala = canvasElement.querySelector<HTMLElement>("[data-sala-stage]")!;
    await expect(sala).toHaveAttribute("data-sala-stage", "empty");
    const texto = sala.querySelector<HTMLElement>("[data-sala-title-text]")!;
    await expect(contraste(getComputedStyle(texto).color, getComputedStyle(sala).backgroundColor)).toBeGreaterThanOrEqual(4.5);
  },
};

// ------------------------------------------------------------
// Imagen blanca, con el original y más cosas debajo: el velo sigue al contenido
// ------------------------------------------------------------

const BLANCA = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#fff"/></svg>')}`;

function SalaConDebajo({ className = PROPORCION, title }: { className?: string; title: string }) {
  return (
    <SalaStage
      className={className}
      title={title}
      headingLevel={3}
      original={{ text: "千と千尋の神隠し", lang: "ja" }}
      // eslint-disable-next-line @next/next/no-img-element
      image={<img src={BLANCA} alt="" />}
    >
      <p className="mt-2 sala-type-text">Película · 2001 · Hayao Miyazaki</p>
      <p className="mt-1 sala-type-small">Vista el 3 de marzo. Tu nota: 9</p>
    </SalaStage>
  );
}

/** La tinta, sobre el velo, en todo lo que hay del título hacia abajo. */
async function comprobarVelo(canvasElement: HTMLElement, donde: string) {
  const sala = canvasElement.querySelector<HTMLElement>("[data-sala-stage]")!;
  const medida = await medirSala(sala);
  // Cada letra del título, en su peor píxel (también el borde de arriba de la primera línea).
  await expect(medida.contrasteSinFundido, `${donde}: título`).toBeGreaterThanOrEqual(4.5);
  // El original y lo de debajo: en el peor caso de imagen.
  await expect(contrasteEnElVelo(sala), `${donde}: debajo`).toBeGreaterThanOrEqual(4.5);
  // El velo empieza por encima de la primera línea y llega al pie de la sala.
  const velo = sala.querySelector(".sala-stage-veil")!.getBoundingClientRect();
  const texto = sala.querySelector("[data-sala-title-text]")!.getBoundingClientRect();
  const caja = sala.getBoundingClientRect();
  await expect(velo.top, `${donde}: el velo empieza encima del título`).toBeLessThanOrEqual(texto.top);
  await expect(velo.bottom, `${donde}: y llega abajo`).toBeGreaterThanOrEqual(caja.bottom - 0.5);
}

export const ImagenBlanca: Story = {
  name: "Imagen blanca, con lo de debajo",
  parameters: { contraste: { revisado: { bgOverlap: SOBRE_LA_SALA, imgNode: EN_EL_VELO } } },
  render: (args) => (
    <Suelo
      titulo="Imagen blanca"
      nota="El peor caso del velo: una imagen blanca del todo. El velo va del título hacia abajo, con el original y lo que haya debajo, y la tinta queda a 4,5:1 o más."
    >
      <SalaConDebajo title={args.title} />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvasElement }) => {
    await comprobarVelo(canvasElement, "1440 px");
    if (!EN_PRUEBAS) return;
    const { innerWidth: ancho, innerHeight: alto } = window;
    try {
      for (const [w, h] of [
        [375, 812],
        [320, 640],
      ]) {
        await expect(await fijarVentana(w, h)).toBe(true);
        await comprobarVelo(canvasElement, `${w} px`);
      }
    } finally {
      await fijarVentana(ancho, alto);
    }
  },
};

// ------------------------------------------------------------
// Alto limitado, texto al 200 % y espaciado: la sala crece, el título no se corta
// ------------------------------------------------------------

/** El título y lo de debajo, enteros dentro de la sala; nada se sale a lo ancho. */
async function comprobarEntera(canvasElement: HTMLElement, donde: string) {
  const sala = canvasElement.querySelector<HTMLElement>("[data-sala-stage]")!;
  const caja = sala.getBoundingClientRect();
  const texto = sala.querySelector("[data-sala-title-text]")!.getBoundingClientRect();
  const debajo = sala.querySelector(".sala-stage-below")!.getBoundingClientRect();
  await expect(texto.top, `${donde}: el título empieza dentro`).toBeGreaterThanOrEqual(caja.top - 0.5);
  const velo = sala.querySelector(".sala-stage-veil")!.getBoundingClientRect();
  await expect(velo.top, `${donde}: el velo empieza encima del título`).toBeLessThanOrEqual(texto.top);
  await expect(velo.top, `${donde}: y dentro de la sala`).toBeGreaterThanOrEqual(caja.top - 0.5);
  await expect(debajo.bottom, `${donde}: lo de debajo acaba dentro`).toBeLessThanOrEqual(caja.bottom + 0.5);
  const m = medirRotulo(sala);
  await expect(m.recortado, `${donde}: nada recorta el título`).toBe(false);
  for (const linea of m.lineas) await expect(linea.derecha, `${donde}: «${linea.texto}»`).toBeLessThanOrEqual(caja.width + 0.5);
  await expect(document.documentElement.scrollWidth, `${donde}: sin scroll horizontal`).toBeLessThanOrEqual(document.documentElement.clientWidth);
}

export const AltoLimitado: Story = {
  name: "Ventana baja, texto al 200 % y espaciado",
  parameters: { contraste: { revisado: { bgOverlap: SOBRE_LA_SALA, imgNode: EN_EL_VELO } } },
  args: { title: "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb" },
  render: (args) => (
    <Suelo
      titulo="Alto limitado"
      nota="La sala lleva un alto mínimo, no fijo. En una ventana apaisada baja, con el texto al 200 % o con el espaciado de WCAG 1.4.12, el título y lo de debajo no caben en ese alto: la sala crece y no se corta nada."
    >
      <SalaConDebajo className="w-full min-h-[70vh]" title={args.title} />
    </Suelo>
  ),
  play: async ({ canvasElement }) => {
    if (!EN_PRUEBAS) return comprobarEntera(canvasElement, "aquí");
    const { innerWidth: ancho, innerHeight: alto } = window;
    const raiz = document.documentElement;
    const espaciado = document.createElement("style");
    try {
      for (const [w, h] of [
        [640, 360],
        [1280, 400],
      ]) {
        await expect(await fijarVentana(w, h)).toBe(true);
        await comprobarEntera(canvasElement, `${w}×${h}`);
      }
      await expect(await fijarVentana(1280, 720)).toBe(true);
      raiz.style.fontSize = "200%";
      await comprobarEntera(canvasElement, "1280×720 al 200 %");
      raiz.style.fontSize = "";
      await expect(await fijarVentana(320, 640)).toBe(true);
      espaciado.textContent =
        "* { letter-spacing: 0.12em !important; word-spacing: 0.16em !important; line-height: 1.5 !important; } p { margin-bottom: 2em !important; }";
      document.head.appendChild(espaciado);
      await comprobarEntera(canvasElement, "320 px con espaciado de texto");
    } finally {
      espaciado.remove();
      raiz.style.fontSize = "";
      await fijarVentana(ancho, alto);
    }
  },
};

// ------------------------------------------------------------
// Colores forzados y más contraste; un punto de interés que no vale
// ------------------------------------------------------------

/** Opacidad de un color calculado (`rgba(…)` o `color(srgb … / a)`). */
function opacidad(color: string): number {
  const n = color.match(/-?\d*\.?\d+(e-?\d+)?/g)?.map(Number) ?? [];
  return n.length >= 4 ? n[3] : 1;
}

export const ColoresForzadosYMasContraste: Story = {
  name: "Colores forzados y más contraste",
  parameters: { contraste: { revisado: { bgOverlap: SOBRE_LA_SALA } } },
  render: (args) => (
    <Suelo
      titulo="Colores forzados y más contraste"
      nota="Con colores forzados o con más contraste no hay fundido: el título entero, por delante. Con más contraste, además, el velo no baja de 0,85."
    >
      <SalaMedida escena={NOCHE} title={args.title} headingLevel={3} />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvasElement }) => {
    const { sala } = await salaPintada(canvasElement, NOCHE.figura);
    await waitFor(() => expect(sala.dataset.salaFuse).toBeTruthy());
    if (!EN_PRUEBAS) return;
    const encabezado = sala.querySelector<HTMLElement>(".sala-stage-heading")!;
    const sinFundido = async (que: string) => {
      await expect(getComputedStyle(encabezado).backgroundClip, que).not.toContain("text");
      await expect(getComputedStyle(encabezado).color, que).not.toBe("rgba(0, 0, 0, 0)");
      await expect(getComputedStyle(sala.querySelector(".sala-stage-figure")!).display, que).toBe("none");
    };
    try {
      await expect(await emularMedios([{ name: "forced-colors", value: "active" }])).toBe(true);
      await sinFundido("colores forzados");
      await expect(await emularMedios([{ name: "prefers-contrast", value: "more" }])).toBe(true);
      await sinFundido("más contraste");
      const velo = getComputedStyle(sala.querySelector(".sala-stage-veil")!).backgroundColor;
      await expect(opacidad(velo), "velo con más contraste").toBeGreaterThanOrEqual(0.85 - 1e-3);
      await expect(contrasteEnElVelo(sala)).toBeGreaterThanOrEqual(7);
    } finally {
      await emularMedios([]);
    }
  },
};

export const FocoNoValido: Story = {
  name: "Punto de interés que no vale",
  parameters: { contraste: { revisado: { bgOverlap: SOBRE_LA_SALA } } },
  render: (args) => (
    <Suelo
      titulo="Punto de interés que no vale"
      nota="Un punto de interés que no es una posición (aquí, una expresión con calc y var) se ignora y la sala va sin fundido: el título se ve entero."
    >
      <SalaMedida escena={NOCHE} title={args.title} headingLevel={3} focus="calc(50% + var(--x))" />
    </Suelo>
  ),
  beforeEach: conVentana(1440, 900),
  play: async ({ canvasElement }) => {
    const { sala } = await salaPintada(canvasElement, NOCHE.figura);
    await expect(sala.dataset.salaFuse).toBeUndefined();
    await expect(sala.style.getPropertyValue("--sala-stage-focus")).toBe("");
    await comprobarSinFundido(canvasElement, NOCHE.figura);
  },
};

// ------------------------------------------------------------
// Las mismas en claro (la sala no cambia con el tema; lo de alrededor, sí).
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const ConFundidoEnClaro: Story = { ...ConFundido, ...SOLO_PRUEBA };
export const ConFundidoEnMovilEnClaro: Story = { ...ConFundidoEnMovil, ...SOLO_PRUEBA };
export const SinFundidoEnClaro: Story = { ...SinFundido, ...SOLO_PRUEBA };
export const SinImagenEnClaro: Story = { ...SinImagen, ...SOLO_PRUEBA };
export const ImagenBlancaEnClaro: Story = { ...ImagenBlanca, ...SOLO_PRUEBA };
