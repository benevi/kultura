import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, waitFor, within } from "storybook/test";
import { NOTA_PALETA, OBRAS, Suelo, contraste, fondoDe } from "../../../.storybook/sala";
import { SalaButton } from "./SalaButton";
import { SalaLink } from "./SalaLink";
import { SalaNotice, type SalaNoticeTone } from "./SalaNotice";

/**
 * Aviso en línea de «Sala»: un mensaje en su sitio, dentro de la página. Cada
 * historia se ve sobre los neutros y sobre el color de una obra.
 */
const meta = {
  title: "Sala/Aviso",
  component: SalaNotice,
  parameters: { layout: "fullscreen" },
  args: { tone: "info", children: "Tu biblioteca se está importando. Puedes seguir usando la app." },
  argTypes: {
    tone: { control: "inline-radio", options: ["info", "success", "warning", "error"] },
    live: { control: "inline-radio", options: ["auto", "assertive", "polite", "off"] },
  },
} satisfies Meta<typeof SalaNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

const OBRA = OBRAS[0];

function EnLosDosSuelos({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suelo titulo="Sin imagen">{children}</Suelo>
      <Suelo titulo={OBRA.titulo} nota={NOTA_PALETA} palette={OBRA.palette}>
        {children}
      </Suelo>
    </>
  );
}

const TONOS: Array<{ tone: SalaNoticeTone; titulo: string; texto: string }> = [
  { tone: "info", titulo: "Importación en marcha", texto: "Estamos pasando tus 214 películas de Letterboxd. Tarda unos minutos; puedes seguir usando la app." },
  { tone: "success", titulo: "Importación terminada", texto: "Ya tienes en tu biblioteca 214 películas, con sus notas y sus fechas." },
  { tone: "warning", titulo: "Sin conexión", texto: "Lo que guardes ahora se queda en este dispositivo y se envía cuando vuelva la conexión." },
  { tone: "error", titulo: "No se ha podido guardar", texto: "El catálogo no responde. Tu nota sigue aquí: inténtalo otra vez dentro de un momento." },
];

export const Uno: Story = {
  name: "Aviso",
  render: (args) => (
    <Suelo titulo="Aviso">
      <div className="max-w-xl">
        <SalaNotice {...args} />
      </div>
    </Suelo>
  ),
};

// ------------------------------------------------------------
// Tonos
// ------------------------------------------------------------

/**
 * Los cuatro tonos. El tono va en el borde y en el dibujo, que tiene una
 * forma distinta en cada uno; el texto es siempre tinta sobre panel.
 */
export const LosTonos: Story = {
  name: "Tonos",
  render: () => (
    <EnLosDosSuelos>
      <div className="grid max-w-xl gap-4">
        {TONOS.map(({ tone, titulo, texto }) => (
          <SalaNotice key={tone} tone={tone} title={titulo} live="off">
            {texto}
          </SalaNotice>
        ))}
        {TONOS.map(({ tone, texto }) => (
          <SalaNotice key={tone} tone={tone} live="off">
            {texto}
          </SalaNotice>
        ))}
      </div>
    </EnLosDosSuelos>
  ),
  play: async ({ canvasElement }) => {
    const avisos = Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-sala-notice]"));
    await expect(avisos).toHaveLength(16);
    const dibujos = new Set<string>();
    for (const aviso of avisos) {
      const estilo = getComputedStyle(aviso);
      const panel = estilo.backgroundColor;
      // Texto 4,5:1; borde y dibujo 3:1 (WCAG 1.4.3 y 1.4.11), contra el panel y contra el suelo.
      await expect(contraste(estilo.color, panel)).toBeGreaterThanOrEqual(4.5);
      await expect(contraste(estilo.borderTopColor, panel)).toBeGreaterThanOrEqual(3);
      await expect(contraste(estilo.borderTopColor, fondoDe(aviso))).toBeGreaterThanOrEqual(3);
      const dibujo = aviso.querySelector("svg")!;
      await expect(contraste(getComputedStyle(dibujo).color, panel)).toBeGreaterThanOrEqual(3);
      await expect(dibujo).toHaveAttribute("aria-hidden", "true");
      dibujos.add(`${aviso.dataset.salaNotice}:${dibujo.querySelector("path")!.getAttribute("d")}`);
      // Biblia §1: esquinas rectas, sin sombras.
      await expect(estilo.borderRadius).toBe("0px");
      await expect(estilo.boxShadow).toBe("none");
    }
    // Cada tono, su forma: cuatro dibujos distintos.
    await expect(new Set(Array.from(dibujos, (d) => d.split(":")[1])).size).toBe(4);
  },
};

// ------------------------------------------------------------
// Quién lo anuncia
// ------------------------------------------------------------

/**
 * `error` interrumpe (`alert`); los demás esperan su turno (`status`); con
 * `live="off"`, nada. El papel lo lleva solo el texto: los botones quedan
 * fuera. Nunca hay `aria-live` además del papel (se oiría dos veces).
 */
export const QuienLoAnuncia: Story = {
  name: "Quién lo anuncia",
  render: () => (
    <Suelo titulo="Quién lo anuncia">
      <div className="grid max-w-xl gap-4">
        <SalaNotice tone="error" data-testid="error" action={<SalaButton variant="secondary">Reintentar</SalaButton>} onClose={fn()} closeLabel="Cerrar el aviso">
          No se ha podido guardar tu nota.
        </SalaNotice>
        <SalaNotice tone="warning" data-testid="aviso">
          Estás sin conexión.
        </SalaNotice>
        <SalaNotice tone="success" data-testid="hecho" toneLabel="Hecho:">
          Nota guardada.
        </SalaNotice>
        <SalaNotice tone="info" data-testid="info">
          La importación sigue en marcha.
        </SalaNotice>
        <SalaNotice tone="warning" live="assertive" data-testid="urgente">
          La sesión se cierra dentro de 2 minutos.
        </SalaNotice>
        <SalaNotice tone="error" live="off" data-testid="callado">
          Este error ya estaba en la página al llegar.
        </SalaNotice>
      </div>
    </Suelo>
  ),
  play: async ({ canvas, canvasElement }) => {
    const papel = (id: string) => canvas.getByTestId(id).querySelector("[role]")?.getAttribute("role") ?? null;
    await expect(papel("error")).toBe("alert");
    await expect(papel("aviso")).toBe("status");
    await expect(papel("hecho")).toBe("status");
    await expect(papel("info")).toBe("status");
    await expect(papel("urgente")).toBe("alert");
    await expect(papel("callado")).toBeNull();
    // Ni `aria-live` repetido ni una región dentro de otra.
    await expect(canvasElement.querySelector("[data-sala-notice] [aria-live]")).toBeNull();
    await expect(canvasElement.querySelector("[role=alert] [role=alert], [role=alert] [role=status], [role=status] [role=status]")).toBeNull();
    // Los botones quedan fuera de lo que se anuncia.
    const alerta = within(canvas.getByTestId("error")).getByRole("alert");
    await expect(alerta).toHaveTextContent(/^No se ha podido guardar tu nota\.$/);
    await expect(alerta.querySelector("button")).toBeNull();
    // La palabra del tono solo la oye el lector.
    await expect(within(canvas.getByTestId("hecho")).getByRole("status")).toHaveTextContent("Hecho: Nota guardada.");
  },
};

// ------------------------------------------------------------
// Con acción y con cierre
// ------------------------------------------------------------

function Cerrable() {
  const [visto, setVisto] = React.useState(true);
  const [veces, setVeces] = React.useState(0);
  const titulo = React.useRef<HTMLHeadingElement>(null);
  return (
    <div className="max-w-xl">
      <h3 ref={titulo} tabIndex={-1} className="mb-4 outline-none sala-type-data sala-focused:sala-focus">
        Tus listas
      </h3>
      {visto ? (
        <SalaNotice
          tone="warning"
          live="off"
          title="Tu lista «Pendientes» ya no es pública"
          action={
            <>
              <SalaButton variant="secondary" onClick={() => setVeces((n) => n + 1)}>
                Volver a publicarla
              </SalaButton>
              <SalaLink variant="standalone" href="/lists">
                Ver mis listas
              </SalaLink>
            </>
          }
          closeLabel="Cerrar el aviso"
          onClose={() => {
            setVisto(false);
            // Quien cierra decide a dónde va el foco: aquí, al encabezado de la sección.
            titulo.current?.focus();
          }}
        >
          La pasaste a privada el 3 de noviembre. Quien la tenía guardada ha dejado de verla.
        </SalaNotice>
      ) : null}
      <p role="status" className="mt-4 text-sala-ink-secondary sala-type-small">
        {veces ? `Publicada otra vez (${veces}).` : ""}
      </p>
    </div>
  );
}

/** La acción va debajo del texto; el aspa, arriba a la derecha, con 48 px. Al cerrar, el foco no se pierde. */
export const ConAccionYCierre: Story = {
  name: "Con acción y cierre",
  render: () => (
    <EnLosDosSuelos>
      <Cerrable />
    </EnLosDosSuelos>
  ),
  play: async ({ canvas, userEvent }) => {
    const [cerrar] = canvas.getAllByRole("button", { name: "Cerrar el aviso" });
    const marco = cerrar.getBoundingClientRect();
    await expect(marco.width).toBeGreaterThanOrEqual(48);
    await expect(marco.height).toBeGreaterThanOrEqual(48);
    await userEvent.click(canvas.getAllByRole("button", { name: "Volver a publicarla" })[0]);
    await expect(canvas.getAllByRole("status")[0]).toHaveTextContent("Publicada otra vez (1).");
    // Cerrar con el teclado: el aviso se va y el foco queda en el encabezado.
    cerrar.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getAllByRole("button", { name: "Cerrar el aviso" })).toHaveLength(1);
    await waitFor(() => expect(canvas.getAllByRole("heading", { name: "Tus listas" })[0]).toHaveFocus());
  },
};

// ------------------------------------------------------------
// Un aviso que aparece después
// ------------------------------------------------------------

function Guardar() {
  const [estado, setEstado] = React.useState<"nada" | "mal" | "bien">("nada");
  return (
    <div className="grid max-w-xl gap-4">
      <div className="flex flex-wrap gap-3">
        <SalaButton variant="secondary" onClick={() => setEstado("mal")}>
          Guardar (falla)
        </SalaButton>
        <SalaButton variant="secondary" onClick={() => setEstado("bien")}>
          Guardar (va bien)
        </SalaButton>
      </div>
      {/* Las regiones existen desde el principio y nacen vacías; el aviso entra después, callado. */}
      <div role="alert" data-testid="region-error">
        {estado === "mal" ? (
          <SalaNotice tone="error" live="off">
            No se ha podido guardar. Tu nota sigue aquí: inténtalo otra vez.
          </SalaNotice>
        ) : null}
      </div>
      <div role="status" data-testid="region-hecho">
        {estado === "bien" ? (
          <SalaNotice tone="success" live="off">
            Nota guardada.
          </SalaNotice>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Un lector avisa de lo que cambia, no de lo que nace con texto: la región
 * está montada desde el principio y el aviso entra dentro, con `live="off"`
 * para no ser una región dentro de otra.
 */
export const ApareceDespues: Story = {
  name: "Aparece después",
  render: () => (
    <Suelo titulo="Aparece después">
      <Guardar />
    </Suelo>
  ),
  play: async ({ canvas, userEvent }) => {
    const error = canvas.getByTestId("region-error");
    const hecho = canvas.getByTestId("region-hecho");
    await expect(error).toBeEmptyDOMElement();
    await expect(hecho).toBeEmptyDOMElement();
    await userEvent.click(canvas.getByRole("button", { name: "Guardar (va bien)" }));
    await expect(hecho).toHaveTextContent("Nota guardada.");
    await userEvent.click(canvas.getByRole("button", { name: "Guardar (falla)" }));
    await expect(error).toHaveTextContent("No se ha podido guardar.");
    await expect(hecho).toBeEmptyDOMElement();
    // Una sola región lo dice: el aviso de dentro va callado.
    await expect(canvas.getAllByRole("alert")).toHaveLength(1);
    // El foco no se ha movido del botón.
    await expect(canvas.getByRole("button", { name: "Guardar (falla)" })).toHaveFocus();
  },
};

// ------------------------------------------------------------
// Textos largos, otras escrituras y 320 px
// ------------------------------------------------------------

/** Nada da scroll horizontal: el texto se parte y el aspa sigue en su esquina. */
export const TextoLargo: Story = {
  name: "Texto largo, otras escrituras y 320 px",
  render: () => (
    <EnLosDosSuelos>
      {/* 288 px: lo que queda a 320 px con el margen de página. */}
      <div data-testid="columna" className="grid w-[288px] max-w-full gap-4">
        <SalaNotice
          tone="error"
          live="off"
          title="No se ha podido quitar «El increíble castillo vagabundo» de la lista «Pendientes de este invierno y del que viene»"
          action={<SalaButton variant="secondary">Reintentar dentro de un momento</SalaButton>}
          onClose={fn()}
          closeLabel="Cerrar el aviso"
        >
          El servidor ha tardado demasiado en contestar (https://kultura.example/listas/pendientes-de-este-invierno-y-del-que-viene).
        </SalaNotice>
        <div lang="ja">
          <SalaNotice tone="success" live="off" title="リストに追加しました" onClose={fn()} closeLabel="閉じる">
            「千と千尋の神隠し」を「この冬に観たい作品」に追加しました。
          </SalaNotice>
        </div>
        <div lang="ko">
          <SalaNotice tone="warning" live="off" title="오프라인 상태입니다">
            지금 저장한 내용은 이 기기에 보관되며 연결이 돌아오면 전송됩니다.
          </SalaNotice>
        </div>
      </div>
    </EnLosDosSuelos>
  ),
  play: async ({ canvas }) => {
    for (const columna of canvas.getAllByTestId("columna")) {
      const limite = columna.getBoundingClientRect().right;
      await expect(columna.scrollWidth).toBeLessThanOrEqual(columna.clientWidth);
      for (const el of Array.from(columna.querySelectorAll<HTMLElement>("p, div, button, svg"))) {
        await expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(limite + 1);
      }
    }
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const TonosEnClaro: Story = { ...LosTonos, ...SOLO_PRUEBA };
export const QuienLoAnunciaEnClaro: Story = { ...QuienLoAnuncia, ...SOLO_PRUEBA };
export const ConAccionYCierreEnClaro: Story = { ...ConAccionYCierre, ...SOLO_PRUEBA };
export const ApareceDespuesEnClaro: Story = { ...ApareceDespues, ...SOLO_PRUEBA };
export const TextoLargoEnClaro: Story = { ...TextoLargo, ...SOLO_PRUEBA };
