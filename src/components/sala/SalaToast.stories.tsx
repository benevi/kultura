import * as React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, waitFor, within } from "storybook/test";
import { Suelo, contraste } from "../../../.storybook/sala";
import { SalaButton } from "./SalaButton";
import { SalaDialog } from "./SalaDialog";
import { SalaToastProvider, useSalaToast } from "./SalaToast";

/**
 * Aviso efímero de «Sala». En la app el proveedor se monta una vez, alrededor
 * de todo; aquí, alrededor de cada historia. Los tiempos de las historias de
 * prueba son cortos a propósito (se pasan con `duration`): los de verdad son
 * 5 s, y 8 s para un error o un aviso con acción.
 */
const meta = {
  title: "Sala/Aviso efímero",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ETIQUETAS = { region: "Avisos (F8)", dismiss: "Cerrar el aviso" };

const zona = () => document.querySelector<HTMLElement>("[data-sala-toast-viewport]")!;
const avisos = () => Array.from(zona().querySelectorAll<HTMLElement>("[data-sala-toast]"));
const viva = (cual: "assertive" | "polite") => zona().querySelector<HTMLElement>(`[data-sala-toast-live="${cual}"]`)!;
const espera = (ms: number) => new Promise((seguir) => setTimeout(seguir, ms));

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <SalaToastProvider labels={ETIQUETAS}>
      <div className="min-h-screen bg-sala-background">
        <Suelo titulo="Aviso efímero">{children}</Suelo>
      </div>
    </SalaToastProvider>
  );
}

// ------------------------------------------------------------
// Los tres tipos, quietos: para mirar, para axe y para las capturas
// ------------------------------------------------------------

function Fijos() {
  const toast = useSalaToast();
  const hecho = React.useRef(false);
  React.useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    toast.showError("No se ha podido guardar tu nota. Inténtalo otra vez.", { persistent: true });
    toast.show({ message: "«Parásitos» está en tu biblioteca.", type: "success", duration: Infinity });
    toast.show({ message: "Quitada de «Pendientes».", duration: Infinity, action: { label: "Deshacer", onAction: () => {} } });
  }, [toast]);
  return <p className="max-w-prose">Un error, un «hecho» y un aviso con acción, sin reloj.</p>;
}

/**
 * Un bloque de tinta; el error, de `sala-danger`. Cada uno con su dibujo. Sin
 * sombra: se separa de la página por el color.
 */
export const LosTipos: Story = {
  name: "Tipos",
  render: () => (
    <Marco>
      <Fijos />
    </Marco>
  ),
  play: async () => {
    await waitFor(() => expect(avisos()).toHaveLength(3));
    const dibujos = new Set<string>();
    for (const aviso of avisos()) {
      const estilo = getComputedStyle(aviso);
      // Texto 4,5:1 sobre su bloque; el bloque, 3:1 contra la página.
      await expect(contraste(estilo.color, estilo.backgroundColor)).toBeGreaterThanOrEqual(4.5);
      await expect(contraste(estilo.backgroundColor, getComputedStyle(document.querySelector("section")!).backgroundColor)).toBeGreaterThanOrEqual(3);
      await expect(estilo.boxShadow).toBe("none");
      await expect(estilo.borderRadius).toBe("0px");
      dibujos.add(aviso.querySelector("svg path")!.getAttribute("d")!);
      for (const boton of within(aviso).getAllByRole("button")) {
        const marco = boton.getBoundingClientRect();
        await expect(marco.height).toBeGreaterThanOrEqual(48);
        await expect(marco.width).toBeGreaterThanOrEqual(48);
      }
    }
    await expect(dibujos.size).toBe(3);
    // El error va en la región que interrumpe; los demás, en la que espera.
    await expect(within(viva("assertive")).getAllByRole("button", { name: "Cerrar el aviso" })).toHaveLength(1);
    await expect(viva("polite").querySelectorAll("[data-sala-toast]")).toHaveLength(2);
    // Sin scroll horizontal.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  },
};

// ------------------------------------------------------------
// La cola
// ------------------------------------------------------------

function Lanzadores({ corto = false }: { corto?: boolean }) {
  const toast = useSalaToast();
  const cuenta = React.useRef(0);
  const duration = corto ? 700 : undefined;
  return (
    <div className="flex flex-wrap gap-3">
      <SalaButton variant="secondary" onClick={() => toast.show({ message: `Guardada (${++cuenta.current}).`, type: "success", duration })}>
        Guardar
      </SalaButton>
      <SalaButton variant="secondary" onClick={() => toast.show({ message: "Enlace copiado.", duration })}>
        Copiar el enlace
      </SalaButton>
      <SalaButton variant="secondary" onClick={() => toast.showError("No se ha podido guardar. Inténtalo otra vez.", { persistent: true })}>
        Fallar
      </SalaButton>
    </div>
  );
}

/**
 * Las regiones vivas están desde el principio, vacías. Un aviso entra en la
 * suya, el foco no se mueve, y con más de tres el más viejo sale.
 */
export const Cola: Story = {
  render: () => (
    <Marco>
      <Lanzadores />
    </Marco>
  ),
  play: async ({ canvas, userEvent }) => {
    // Montadas antes de que haya nada que decir.
    await waitFor(() => expect(zona()).not.toBeNull());
    await expect(zona()).toHaveAttribute("role", "region");
    await expect(zona()).toHaveAccessibleName("Avisos (F8)");
    await expect(viva("polite")).toHaveAttribute("role", "status");
    await expect(viva("polite")).toBeEmptyDOMElement();
    await expect(viva("assertive")).toHaveAttribute("aria-live", "assertive");
    await expect(viva("assertive")).toBeEmptyDOMElement();

    // La región viva cambia; el foco se queda en el botón.
    const guardar = canvas.getByRole("button", { name: "Guardar" });
    await userEvent.click(guardar);
    await expect(viva("polite")).toHaveTextContent("Guardada (1).");
    await expect(guardar).toHaveFocus();

    // Un error va a la otra región.
    await userEvent.click(canvas.getByRole("button", { name: "Fallar" }));
    await expect(viva("assertive")).toHaveTextContent("No se ha podido guardar.");
    await expect(viva("polite")).not.toHaveTextContent("No se ha podido guardar.");

    // Cola de tres: el cuarto desplaza al más viejo.
    await userEvent.click(guardar);
    await userEvent.click(guardar);
    await expect(avisos()).toHaveLength(3);
    await expect(zona()).not.toHaveTextContent("Guardada (1).");
    await expect(zona()).toHaveTextContent("Guardada (3).");
  },
};

// ------------------------------------------------------------
// El reloj se para
// ------------------------------------------------------------

/**
 * WCAG 2.2.1: el reloj se para con el puntero encima y con el foco dentro, y
 * sigue donde iba al salir. Aquí el aviso dura 0,7 s para verlo en la prueba.
 */
export const Pausa: Story = {
  name: "Se para con el puntero y con el foco",
  render: () => (
    <Marco>
      <Lanzadores corto />
    </Marco>
  ),
  play: async ({ canvas, userEvent }) => {
    const copiar = canvas.getByRole("button", { name: "Copiar el enlace" });

    // Sin tocarlo, se va solo.
    await userEvent.click(copiar);
    await waitFor(() => expect(avisos()).toHaveLength(1));
    await waitFor(() => expect(avisos()).toHaveLength(0), { timeout: 3000 });

    // Con el puntero encima, no se va: pasa el doble de su tiempo y sigue ahí.
    await userEvent.click(copiar);
    await waitFor(() => expect(avisos()).toHaveLength(1));
    await userEvent.hover(avisos()[0]);
    await espera(1400);
    await expect(avisos()).toHaveLength(1);
    // Al salir el puntero, sigue el reloj.
    await userEvent.unhover(avisos()[0]);
    await userEvent.hover(copiar);
    await waitFor(() => expect(avisos()).toHaveLength(0), { timeout: 3000 });

    // Con el foco dentro (F8 lo lleva), tampoco se va.
    await userEvent.click(copiar);
    await waitFor(() => expect(avisos()).toHaveLength(1));
    await userEvent.keyboard("{F8}");
    await expect(within(avisos()[0]).getByRole("button", { name: "Cerrar el aviso" })).toHaveFocus();
    await espera(1400);
    await expect(avisos()).toHaveLength(1);
    // Escape lo cierra y el foco vuelve a donde estaba.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(avisos()).toHaveLength(0), { timeout: 3000 });
    await waitFor(() => expect(copiar).toHaveFocus());
  },
};

// ------------------------------------------------------------
// Con acción
// ------------------------------------------------------------

const alDeshacer = fn();
const alCaducar = fn();

function Deshacer() {
  const toast = useSalaToast();
  return (
    <div className="flex flex-wrap gap-3">
      <SalaButton
        variant="secondary"
        onClick={() => toast.show({ message: "«Berserk» quitada de «Pendientes».", duration: 700, action: { label: "Deshacer", onAction: alDeshacer, onExpire: alCaducar } })}
      >
        Quitar de la lista
      </SalaButton>
    </div>
  );
}

/**
 * «Deshacer»: pulsar la acción la ejecuta y cierra el aviso; si el aviso se va
 * sin pulsarla (tiempo, aspa, deslizar), se llama a `onExpire`, una vez.
 */
export const ConAccion: Story = {
  name: "Con acción",
  render: () => (
    <Marco>
      <Deshacer />
    </Marco>
  ),
  play: async ({ canvas, userEvent }) => {
    alDeshacer.mockClear();
    alCaducar.mockClear();
    const quitar = canvas.getByRole("button", { name: "Quitar de la lista" });

    // Se pulsa la acción (con el puntero encima el reloj está parado).
    await userEvent.click(quitar);
    await waitFor(() => expect(avisos()).toHaveLength(1));
    await userEvent.click(within(avisos()[0]).getByRole("button", { name: "Deshacer" }));
    await expect(alDeshacer).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(avisos()).toHaveLength(0), { timeout: 3000 });
    await expect(alCaducar).not.toHaveBeenCalled();

    // Se deja pasar: caduca una vez.
    await userEvent.click(quitar);
    await waitFor(() => expect(avisos()).toHaveLength(1));
    await userEvent.hover(quitar);
    await waitFor(() => expect(avisos()).toHaveLength(0), { timeout: 3000 });
    await expect(alCaducar).toHaveBeenCalledTimes(1);
    await expect(alDeshacer).toHaveBeenCalledTimes(1);
  },
};

// ------------------------------------------------------------
// No tapa el foco
// ------------------------------------------------------------

function ConControlDebajo() {
  const toast = useSalaToast();
  return (
    <>
      <SalaButton variant="secondary" onClick={() => toast.show({ message: "Guardada en tu biblioteca.", type: "success", duration: Infinity })}>
        Guardar
      </SalaButton>
      {/* Un control justo donde sale la pila: la barra de acciones de una ficha, por ejemplo. */}
      <div className="fixed bottom-6 right-6">
        <SalaButton variant="primary">Siguiente capítulo</SalaButton>
      </div>
    </>
  );
}

/**
 * WCAG 2.4.11: si la pila queda encima del control que tiene el foco, se pasa
 * arriba. Los huecos de la zona no reciben clics.
 */
export const NoTapaElFoco: Story = {
  name: "No tapa el foco",
  render: () => (
    <Marco>
      <ConControlDebajo />
    </Marco>
  ),
  play: async ({ canvas, userEvent }) => {
    const debajo = canvas.getByRole("button", { name: "Siguiente capítulo" });
    await userEvent.click(canvas.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(avisos()).toHaveLength(1));
    await expect(zona()).toHaveAttribute("data-sala-toast-viewport", "bottom");
    await expect(getComputedStyle(zona()).pointerEvents).toBe("none");
    await expect(getComputedStyle(avisos()[0]).pointerEvents).toBe("auto");

    // El foco llega al control de debajo: la pila se aparta y ya no lo pisa.
    debajo.focus();
    await waitFor(() => expect(zona()).toHaveAttribute("data-sala-toast-viewport", "top"));
    const a = avisos()[0].getBoundingClientRect();
    const b = debajo.getBoundingClientRect();
    await expect(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right).toBe(true);
    await userEvent.click(within(avisos()[0]).getByRole("button", { name: "Cerrar el aviso" }));
    await waitFor(() => expect(avisos()).toHaveLength(0), { timeout: 3000 });
  },
};

// ------------------------------------------------------------
// Con un diálogo abierto
// ------------------------------------------------------------

function ConDialogo() {
  const toast = useSalaToast();
  const [abierto, setAbierto] = React.useState(false);
  return (
    <>
      <SalaButton variant="secondary" onClick={() => setAbierto(true)}>
        Compartir
      </SalaButton>
      <SalaDialog
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Compartir la lista"
        closeLabel="Cerrar"
        footer={<SalaButton onClick={() => toast.show({ message: "Enlace copiado.", type: "success", duration: Infinity })}>Copiar el enlace</SalaButton>}
      >
        <p>Cualquiera con el enlace puede ver la lista.</p>
      </SalaDialog>
    </>
  );
}

/**
 * El aviso sale por encima del diálogo, se oye (el diálogo no esconde las
 * regiones vivas) y se puede cerrar con el puntero sin que el diálogo se
 * cierre. El foco no sale del diálogo.
 */
export const SobreUnDialogo: Story = {
  name: "Con un diálogo abierto",
  render: () => (
    <Marco>
      <ConDialogo />
    </Marco>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Compartir" }));
    const caja = await screen.findByRole("dialog", { name: "Compartir la lista" });
    const copiar = within(caja).getByRole("button", { name: "Copiar el enlace" });
    await userEvent.click(copiar);
    await waitFor(() => expect(avisos()).toHaveLength(1));
    // Se oye: la región viva sigue en el árbol de accesibilidad con el diálogo abierto.
    await expect(viva("polite").closest('[aria-hidden="true"]')).toBeNull();
    await expect(screen.getByRole("status")).toHaveTextContent("Enlace copiado.");
    // Se ve: va por encima del velo.
    const aviso = avisos()[0];
    const centro = aviso.getBoundingClientRect();
    await expect(aviso.contains(document.elementFromPoint(centro.left + 24, centro.top + 24))).toBe(true);
    // El foco sigue en el diálogo.
    await expect(copiar).toHaveFocus();
    // Cerrar el aviso con el puntero no cierra el diálogo.
    await userEvent.click(within(aviso).getByRole("button", { name: "Cerrar el aviso" }));
    await waitFor(() => expect(avisos()).toHaveLength(0), { timeout: 3000 });
    await expect(caja).toBeVisible();
    await expect(caja).toContainElement(document.activeElement as HTMLElement);
  },
};

// ------------------------------------------------------------
// Textos largos y otras escrituras
// ------------------------------------------------------------

function Largos() {
  const toast = useSalaToast();
  const hecho = React.useRef(false);
  React.useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    toast.showError("No se ha podido quitar «El increíble castillo vagabundo» de la lista «Pendientes de este invierno y del que viene»: el servidor ha tardado demasiado.", { persistent: true });
    toast.show({ message: "「千と千尋の神隠し」を「この冬に観たい作品」に追加しました。", type: "success", duration: Infinity, action: { label: "元に戻す", onAction: () => {} } });
    toast.show({ message: "기생충을 목록에서 삭제했습니다.", duration: Infinity, action: { label: "실행 취소", onAction: () => {} } });
  }, [toast]);
  return null;
}

/** El texto se parte y la acción baja de línea si no cabe; la zona no pasa del ancho de la ventana. */
export const TextoLargo: Story = {
  name: "Texto largo, japonés y coreano",
  render: () => (
    <Marco>
      <Largos />
    </Marco>
  ),
  play: async () => {
    await waitFor(() => expect(avisos()).toHaveLength(3));
    const ancho = document.documentElement.clientWidth;
    for (const aviso of avisos()) {
      const marco = aviso.getBoundingClientRect();
      await expect(marco.left).toBeGreaterThanOrEqual(0);
      await expect(marco.right).toBeLessThanOrEqual(ancho);
      await expect(aviso.scrollWidth).toBeLessThanOrEqual(aviso.clientWidth);
      for (const boton of within(aviso).getAllByRole("button")) await expect(boton.getBoundingClientRect().right).toBeLessThanOrEqual(marco.right);
    }
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(ancho);
  },
};

// ------------------------------------------------------------
// Las mismas en claro, para que axe las pase en los dos temas.
// ------------------------------------------------------------

const SOLO_PRUEBA = { globals: { tema: "claro" }, tags: ["!dev"] };

export const TiposEnClaro: Story = { ...LosTipos, ...SOLO_PRUEBA };
export const ColaEnClaro: Story = { ...Cola, ...SOLO_PRUEBA };
export const SobreUnDialogoEnClaro: Story = { ...SobreUnDialogo, ...SOLO_PRUEBA };
export const TextoLargoEnClaro: Story = { ...TextoLargo, ...SOLO_PRUEBA };
