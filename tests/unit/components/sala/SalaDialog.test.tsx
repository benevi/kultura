import { useRef, useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SalaConfirmDialog } from "@/components/sala/SalaConfirmDialog";
import { SalaDialog, type SalaDialogProps } from "@/components/sala/SalaDialog";
import { paletteFromSwatches } from "@/lib/design/image-palette";

/** Una paleta de un solo color: basta para ver que llega al diálogo. */
const deColorParaTests = paletteFromSwatches([{ rgb: [0, 0, 0], oklch: { l: 0.58, c: 0.21, h: 28 }, share: 1 }]);

type Extra = Partial<Omit<SalaDialogProps, "showClose" | "closeLabel">> & { sinCerrar?: boolean };

/** Un diálogo abierto por su botón, como en la app. */
function Caso({ onClose, sinCerrar, ...props }: Extra & { onClose?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => {
    onClose?.();
    setAbierto(false);
  };
  const cierre = sinCerrar ? ({ showClose: false } as const) : ({ closeLabel: "Cerrar" } as const);
  return (
    <>
      <button onClick={() => setAbierto(true)}>Abrir</button>
      <a href="#fuera">Enlace de fuera</a>
      <SalaDialog open={abierto} onClose={cerrar} title="Crear una lista" {...cierre} {...props} />
    </>
  );
}

const abrir = async () => {
  await userEvent.click(screen.getByText("Abrir"));
  return screen.getByRole("dialog", { name: "Crear una lista" });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SalaDialog", () => {
  it("cerrado no pinta nada", () => {
    render(<Caso />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("es un diálogo modal con nombre (el título) y, si la hay, descripción", async () => {
    const { unmount } = render(<Caso description="Puedes cambiarla después." />);
    const caja = await abrir();
    expect(caja).toHaveAttribute("aria-modal", "true");
    expect(caja).toHaveAccessibleName("Crear una lista");
    expect(caja).toHaveAccessibleDescription("Puedes cambiarla después.");
    expect(screen.getByRole("heading", { level: 2, name: "Crear una lista" })).toBeInTheDocument();
    unmount();
    render(<Caso />);
    expect(await abrir()).not.toHaveAttribute("aria-describedby");
  });

  it("hideTitle esconde el título a la vista, pero sigue nombrando al diálogo", async () => {
    render(<Caso hideTitle />);
    const caja = await abrir();
    expect(caja).toHaveAccessibleName("Crear una lista");
    expect(screen.getByRole("heading", { name: "Crear una lista" })).toHaveClass("sr-only");
  });

  it("biblia §1: esquinas rectas, sin sombras ni desenfoque, y borde que se ve con colores forzados", async () => {
    render(<Caso />);
    const caja = await abrir();
    const velo = caja.parentElement!;
    for (const pieza of [caja, velo]) expect(pieza.className).not.toMatch(/rounded|shadow|blur/);
    expect(caja.className).toContain("border-2");
    expect(caja.className).toContain("border-sala-ink");
    // El velo es color plano del sistema, no un negro fijo.
    expect(velo.className).toContain("bg-sala-background/90");
  });

  it("deja fuera del árbol de accesibilidad el resto de la página", async () => {
    render(<Caso />);
    await abrir();
    expect(screen.queryByRole("link", { name: "Enlace de fuera" })).toBeNull();
    expect(screen.getByText("Enlace de fuera").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  describe("foco inicial", () => {
    it("va al primer control del cuerpo, no al botón de cerrar", async () => {
      render(
        <Caso footer={<button>Guardar</button>}>
          <input aria-label="Nombre" />
        </Caso>
      );
      await abrir();
      expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus();
    });

    it("sin controles en el cuerpo, al primero del pie", async () => {
      render(
        <Caso
          footer={
            <>
              <button>Cancelar</button>
              <button>Guardar</button>
            </>
          }
        >
          <p>Texto</p>
        </Caso>
      );
      await abrir();
      expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    });

    it("sin ninguno, al botón de cerrar, que lleva su nombre", async () => {
      render(
        <Caso>
          <p>Texto</p>
        </Caso>
      );
      await abrir();
      expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    });

    it("data-autofocus manda sobre el orden", async () => {
      render(
        <Caso footer={<button data-autofocus="">Guardar</button>}>
          <input aria-label="Nombre" />
        </Caso>
      );
      await abrir();
      expect(screen.getByRole("button", { name: "Guardar" })).toHaveFocus();
    });

    it("initialFocusRef manda sobre todo", async () => {
      function ConRef() {
        const ref = useRef<HTMLInputElement>(null);
        return (
          <Caso initialFocusRef={ref}>
            <input aria-label="Nombre" data-autofocus="" />
            <input aria-label="Descripción" ref={ref} />
          </Caso>
        );
      }
      render(<ConRef />);
      await abrir();
      expect(screen.getByRole("textbox", { name: "Descripción" })).toHaveFocus();
    });
  });

  it("Tab y Mayús+Tab no salen del diálogo", async () => {
    render(
      <Caso footer={<button>Guardar</button>}>
        <input aria-label="Nombre" />
      </Caso>
    );
    const caja = await abrir();
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(caja).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 4; i++) {
      await userEvent.tab({ shift: true });
      expect(caja).toContainElement(document.activeElement as HTMLElement);
    }
  });

  describe("cierre", () => {
    it("Escape cierra y devuelve el foco a quien lo abrió", async () => {
      const onClose = vi.fn();
      render(<Caso onClose={onClose} />);
      await abrir();
      await userEvent.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByText("Abrir")).toHaveFocus();
    });

    it("el botón de cerrar cierra", async () => {
      const onClose = vi.fn();
      render(<Caso onClose={onClose} />);
      await abrir();
      await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Abrir")).toHaveFocus();
    });

    it("pulsar el velo cierra; pulsar dentro, no", async () => {
      const onClose = vi.fn();
      render(
        <Caso onClose={onClose}>
          <p>Texto del cuerpo</p>
        </Caso>
      );
      const caja = await abrir();
      await userEvent.click(screen.getByText("Texto del cuerpo"));
      expect(onClose).not.toHaveBeenCalled();
      await userEvent.click(caja.parentElement!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("un arrastre que empieza dentro y acaba en el velo (seleccionar texto) no cierra", async () => {
      const onClose = vi.fn();
      render(
        <Caso onClose={onClose}>
          <p>Texto del cuerpo</p>
        </Caso>
      );
      const caja = await abrir();
      const velo = caja.parentElement!;
      fireEvent.pointerDown(screen.getByText("Texto del cuerpo"));
      fireEvent.click(velo);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closeOnOutside={false}: el velo no cierra, Escape sí", async () => {
      const onClose = vi.fn();
      render(<Caso onClose={onClose} closeOnOutside={false} />);
      const caja = await abrir();
      await userEvent.click(caja.parentElement!);
      expect(onClose).not.toHaveBeenCalled();
      await userEvent.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("dismissible={false}: ni Escape ni el velo ni el botón cierran", async () => {
      const onClose = vi.fn();
      render(<Caso onClose={onClose} dismissible={false} />);
      const caja = await abrir();
      await userEvent.keyboard("{Escape}");
      await userEvent.click(caja.parentElement!);
      expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
      expect(caja).toBeInTheDocument();
    });

    it("si quien lo abrió ya no está, el foco va a finalFocusRef", async () => {
      function Desaparece() {
        const [abierto, setAbierto] = useState(false);
        const [hecho, setHecho] = useState(false);
        const destino = useRef<HTMLHeadingElement>(null);
        return (
          <>
            <h1 ref={destino} tabIndex={-1}>
              Biblioteca
            </h1>
            {hecho ? null : <button onClick={() => setAbierto(true)}>Abrir</button>}
            <SalaDialog
              open={abierto}
              onClose={() => setAbierto(false)}
              title="Crear una lista"
              closeLabel="Cerrar"
              finalFocusRef={destino}
              footer={
                <button
                  onClick={() => {
                    setHecho(true);
                    setAbierto(false);
                  }}
                >
                  Hecho
                </button>
              }
            />
          </>
        );
      }
      render(<Desaparece />);
      await abrir();
      await userEvent.click(screen.getByRole("button", { name: "Hecho" }));
      expect(screen.getByRole("heading", { name: "Biblioteca" })).toHaveFocus();
    });
  });

  it("el error de la acción se anuncia dentro, en una región que ya existía, una sola vez", async () => {
    function ConError() {
      const [error, setError] = useState<string | null>(null);
      return <Caso error={error} footer={<button onClick={() => setError("No se ha podido guardar.")}>Guardar</button>} />;
    }
    render(<ConError />);
    const caja = await abrir();
    const region = within(caja).getByRole("alert");
    expect(region).toBeEmptyDOMElement();
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(region).toHaveTextContent("No se ha podido guardar.");
    // El aviso de dentro va callado: una sola región lo dice.
    expect(within(caja).getAllByRole("alert")).toHaveLength(1);
    expect(region.querySelector("[aria-live]")).toBeNull();
    // Con su dibujo: no solo color.
    expect(region.querySelector("svg")).not.toBeNull();
  });

  it("variant=sheet: hoja pegada abajo en móvil, con zona segura, y diálogo centrado desde md", async () => {
    render(<Caso variant="sheet" />);
    const caja = await abrir();
    expect(caja).toHaveAttribute("data-sala-dialog", "sheet");
    expect(caja.className).toContain("max-w-none");
    expect(caja.className).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(caja.className).toContain("md:max-w-md");
    expect(caja.parentElement!.className).toContain("items-end");
    expect(caja.parentElement!.className).toContain("md:items-center");
    // Nunca pasa del 85 % del alto ni queda bajo el teclado.
    expect(caja.className).toContain("max-h-[min(85dvh,calc(100dvh-var(--sala-kb,0px)))]");
  });

  it("con el teclado en pantalla, el velo sabe cuánto tapa (visualViewport)", async () => {
    const oyentes: Record<string, () => void> = {};
    const ventana = { height: 500, offsetTop: 0, scale: 1, addEventListener: (tipo: string, fn: () => void) => (oyentes[tipo] = fn), removeEventListener: vi.fn() };
    vi.stubGlobal("visualViewport", ventana);
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
      fn(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    render(<Caso />);
    const caja = await abrir();
    const velo = caja.parentElement!;
    oyentes.resize();
    expect(velo.style.getPropertyValue("--sala-kb")).toBe("300px");
    ventana.height = 800;
    oyentes.resize();
    expect(velo.style.getPropertyValue("--sala-kb")).toBe("0px");
    // Zoom de pellizco a escala 2: la ventana visual mide la mitad y no hay teclado. No se toca.
    ventana.height = 400;
    ventana.scale = 2;
    oyentes.resize();
    expect(velo.style.getPropertyValue("--sala-kb")).toBe("0px");
  });

  it("pulsar el velo no se lleva el foco a <body>", async () => {
    render(<Caso closeOnOutside={false} footer={<button>Guardar</button>} />);
    const caja = await abrir();
    const velo = caja.parentElement!;
    // El foco se mueve en `mousedown`: sobre el velo se anula; dentro, no.
    expect(fireEvent.mouseDown(velo)).toBe(false);
    expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Guardar" }))).toBe(true);
    await userEvent.click(velo);
    expect(caja).toContainElement(document.activeElement as HTMLElement);
  });

  it("abierto sin que nadie tuviera el foco, al cerrar va a finalFocusRef; si falta, avisa en desarrollo", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    function SinDisparador({ conDestino }: { conDestino: boolean }) {
      const [abierto, setAbierto] = useState(true);
      const destino = useRef<HTMLHeadingElement>(null);
      return (
        <>
          <h1 ref={destino} tabIndex={-1}>
            Biblioteca
          </h1>
          <SalaDialog open={abierto} onClose={() => setAbierto(false)} title="Crear una lista" closeLabel="Cerrar" finalFocusRef={conDestino ? destino : undefined} />
        </>
      );
    }
    const { unmount } = render(<SinDisparador conDestino />);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("heading", { name: "Biblioteca" })).toHaveFocus();
    expect(aviso).not.toHaveBeenCalledWith(expect.stringContaining("finalFocusRef"));
    unmount();
    render(<SinDisparador conDestino={false} />);
    await userEvent.keyboard("{Escape}");
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("finalFocusRef"));
    aviso.mockRestore();
  });

  it("lo que se desplaza cuelga de sí mismo (relative): lo absoluto de dentro no escapa de su recorte", async () => {
    render(
      <Caso>
        <p>Texto</p>
      </Caso>
    );
    const caja = await abrir();
    expect(caja.querySelector("[data-sala-dialog-scroll]")).toHaveClass("relative");
    expect(caja.querySelector("[data-sala-dialog-body]")).toHaveClass("relative");
  });

  it("un cuerpo de solo texto que no cabe recibe el foco, arriba del todo, y dice qué es", async () => {
    // jsdom no maqueta: se le dice que el cuerpo no cabe.
    const alto = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-sala-dialog-body") ? 900 : 0;
    });
    render(
      <Caso footer={<button>Entendido</button>}>
        <p>Texto largo</p>
      </Caso>
    );
    const caja = await abrir();
    const cuerpo = caja.querySelector<HTMLElement>("[data-sala-dialog-body]")!;
    expect(cuerpo).toHaveFocus();
    expect(cuerpo).toHaveAttribute("tabindex", "0");
    expect(cuerpo.scrollTop).toBe(0);
    // Un grupo con el nombre del diálogo: el lector no dice un foco sin nombre.
    expect(cuerpo).toHaveAttribute("role", "group");
    expect(cuerpo).toHaveAccessibleName("Crear una lista");
    alto.mockRestore();
  });

  it("con palette, el diálogo (que cuelga de body) lleva la paleta de la obra", async () => {
    render(<Caso palette={deColorParaTests} />);
    const velo = (await abrir()).parentElement!;
    expect(velo).toHaveClass("sala-work");
    expect(velo.style.getPropertyValue("--sala-work-light-background")).not.toBe("");
    expect(velo.style.getPropertyValue("--sala-work-dark-ink")).not.toBe("");
  });

  it("sin botón de cerrar no hay aspa", async () => {
    render(<Caso sinCerrar footer={<button>Vale</button>} />);
    const caja = await abrir();
    expect(within(caja).getAllByRole("button")).toHaveLength(1);
  });
});

describe("SalaConfirmDialog", () => {
  const base = {
    title: "¿Borrar la lista?",
    message: "No se puede deshacer.",
    confirmLabel: "Borrar la lista",
    cancelLabel: "No, dejarla",
  };

  function Confirmar({ onConfirm = vi.fn(), onCancel = vi.fn(), ...props }: Partial<React.ComponentProps<typeof SalaConfirmDialog>>) {
    const [abierto, setAbierto] = useState(false);
    return (
      <>
        <button onClick={() => setAbierto(true)}>Abrir</button>
        <SalaConfirmDialog
          {...base}
          open={abierto}
          onConfirm={onConfirm}
          onCancel={() => {
            onCancel();
            setAbierto(false);
          }}
          {...props}
        />
      </>
    );
  }

  const abrirlo = async () => {
    await userEvent.click(screen.getByText("Abrir"));
    return screen.getByRole("alertdialog", { name: "¿Borrar la lista?" });
  };

  it("es un alertdialog con el mensaje como descripción y el foco en lo seguro", async () => {
    render(<Confirmar danger />);
    const caja = await abrirlo();
    expect(caja).toHaveAttribute("aria-modal", "true");
    expect(caja).toHaveAccessibleDescription("No se puede deshacer.");
    expect(screen.getByRole("button", { name: "No, dejarla" })).toHaveFocus();
    // Sin aspa: repetiría «cancelar».
    expect(within(caja).getAllByRole("button")).toHaveLength(2);
  });

  it("sin cierre accidental: pulsar fuera no cancela; Escape sí", async () => {
    const onCancel = vi.fn();
    render(<Confirmar onCancel={onCancel} />);
    const caja = await abrirlo();
    await userEvent.click(caja.parentElement!);
    expect(onCancel).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Abrir")).toHaveFocus();
  });

  it("danger pinta la confirmación de peligro; sin él, es la principal", async () => {
    const { unmount } = render(<Confirmar danger />);
    await abrirlo();
    expect(screen.getByRole("button", { name: "Borrar la lista" }).className).toContain("bg-sala-danger");
    unmount();
    render(<Confirmar />);
    await abrirlo();
    expect(screen.getByRole("button", { name: "Borrar la lista" }).className).toContain("bg-sala-accent");
  });

  it("confirmar y cancelar llaman a lo suyo", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<Confirmar onConfirm={onConfirm} onCancel={onCancel} />);
    await abrirlo();
    await userEvent.click(screen.getByRole("button", { name: "Borrar la lista" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "No, dejarla" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("confirmando: el botón espera, se anuncia y no se puede cerrar ni repetir", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<SalaConfirmDialog {...base} open loading loadingLabel="Borrando la lista…" onConfirm={onConfirm} onCancel={onCancel} />);
    const borrar = screen.getByRole("button", { name: "Borrar la lista" });
    expect(borrar).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Borrando la lista…")).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", { name: "No, dejarla" })).toBeDisabled();
    await userEvent.click(borrar);
    await userEvent.keyboard("{Escape}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("pinta los campos extra y el error dentro", () => {
    render(
      <SalaConfirmDialog {...base} open error="Contraseña incorrecta." onConfirm={vi.fn()} onCancel={vi.fn()}>
        <input aria-label="Contraseña" type="password" />
      </SalaConfirmDialog>
    );
    const caja = screen.getByRole("alertdialog");
    expect(within(caja).getByLabelText("Contraseña")).toBeInTheDocument();
    expect(within(caja).getByRole("alert")).toHaveTextContent("Contraseña incorrecta.");
  });
});
