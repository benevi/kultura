import { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SalaButton } from "@/components/sala/SalaButton";

const Icono = () => <svg data-testid="icono" />;

describe("SalaButton", () => {
  it("es un <button> nativo (Enter y Espacio los da el navegador) y no envía formularios por defecto", () => {
    render(<SalaButton>Guardar</SalaButton>);
    const boton = screen.getByRole("button", { name: "Guardar" });
    expect(boton.tagName).toBe("BUTTON");
    expect(boton).toHaveAttribute("type", "button");
    expect(boton).not.toHaveAttribute("tabindex");
  });

  it("respeta type=submit y pasa la ref y el resto de atributos", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <SalaButton ref={ref} type="submit" name="accion" value="guardar">
        Guardar
      </SalaButton>
    );
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(ref.current).toHaveAttribute("type", "submit");
    expect(ref.current).toHaveAttribute("name", "accion");
  });

  it("dispara onClick al pulsar", () => {
    const onClick = vi.fn();
    render(<SalaButton onClick={onClick}>Guardar</SalaButton>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(["primary", "secondary", "quiet", "danger"] as const)("variante %s: mide 48 px o más y lleva el foco de «Sala»", (variant) => {
    render(<SalaButton variant={variant}>Guardar</SalaButton>);
    const { className } = screen.getByRole("button");
    expect(className).toContain("min-h-sala-target");
    expect(className).toContain("sala-focused:sala-focus");
    // Biblia §1: esquinas rectas y sin sombras.
    expect(className).not.toMatch(/rounded|shadow/);
  });

  it("al pulsar encoge el contenido, no la caja: un clic en el borde no se pierde", () => {
    render(<SalaButton>Guardar</SalaButton>);
    const boton = screen.getByRole("button");
    // Ninguna clase escala el propio botón (ni `sala-pressed:scale-…` ni `active:scale-…`).
    expect(boton.className).not.toMatch(/(^|\s)(sala-pressed:|active:)?scale-/);
    expect(boton.className).toContain("[&>span:first-child]:sala-pressed:scale-[0.96]");
    // El contenido es ese primer hijo.
    expect(boton.firstElementChild).toContainElement(screen.getByText("Guardar"));
  });

  it("una palabra más larga que el botón se parte (WCAG 1.4.10)", () => {
    render(<SalaButton>Supercalifragilisticoespialidoso</SalaButton>);
    expect(screen.getByText("Supercalifragilisticoespialidoso").className).toContain("[overflow-wrap:anywhere]");
  });

  describe("deshabilitado", () => {
    it("usa el atributo nativo y no dispara onClick", () => {
      const onClick = vi.fn();
      render(
        <SalaButton disabled onClick={onClick}>
          Guardar
        </SalaButton>
      );
      const boton = screen.getByRole("button", { name: "Guardar" });
      expect(boton).toBeDisabled();
      fireEvent.click(boton);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("no conserva los estilos de hover ni de pulsado", () => {
      render(<SalaButton disabled>Guardar</SalaButton>);
      expect(screen.getByRole("button").className).not.toMatch(/sala-hover:|sala-pressed:/);
    });
  });

  describe("cargando", () => {
    it("marca aria-busy y aria-disabled, sigue en el orden de tabulación y conserva su nombre", () => {
      render(
        <SalaButton loading loadingLabel="Cargando…">
          Guardar
        </SalaButton>
      );
      const boton = screen.getByRole("button", { name: "Guardar" });
      expect(boton).toHaveAttribute("aria-busy", "true");
      expect(boton).toHaveAttribute("aria-disabled", "true");
      // Sin `disabled`: el foco no se pierde al empezar la carga.
      expect(boton).not.toBeDisabled();
    });

    it("no dispara onClick ni envía el formulario (sin doble envío)", () => {
      const onClick = vi.fn();
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <SalaButton type="submit" loading loadingLabel="Cargando…" onClick={onClick}>
            Guardar
          </SalaButton>
        </form>
      );
      fireEvent.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("lo anuncia en una región viva que ya existía antes de cargar", () => {
      const boton = (loading: boolean) => (
        <SalaButton loading={loading} loadingLabel="Guardando en tu biblioteca">
          Guardar
        </SalaButton>
      );
      const { rerender } = render(boton(false));
      const aviso = screen.getByRole("status");
      expect(aviso).toBeEmptyDOMElement();
      rerender(boton(true));
      expect(screen.getByRole("status")).toBe(aviso);
      expect(aviso).toHaveTextContent("Guardando en tu biblioteca");
    });

    it("al acabar la carga la región se vacía: el resultado lo anuncia quien usa el botón", () => {
      const boton = (loading: boolean) => (
        <SalaButton loading={loading} loadingLabel="Guardando en tu biblioteca">
          Guardar
        </SalaButton>
      );
      const { rerender } = render(boton(true));
      const aviso = screen.getByRole("status");
      expect(aviso).toHaveTextContent("Guardando en tu biblioteca");
      rerender(boton(false));
      expect(screen.getByRole("status")).toBe(aviso);
      expect(aviso).toBeEmptyDOMElement();
      expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
      expect(screen.getByRole("button")).not.toHaveAttribute("aria-disabled");
    });

    it("los tipos exigen el texto del aviso cuando el botón puede cargar", () => {
      // @ts-expect-error -- `loading` sin `loadingLabel` no compila.
      render(<SalaButton loading>Guardar</SalaButton>);
      expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    });

    it("el texto sigue a la vista (biblia §6: nada oculto) y el indicador es adorno", () => {
      render(
        <SalaButton loading loadingLabel="Cargando…">
          Guardar
        </SalaButton>
      );
      const boton = screen.getByRole("button");
      const texto = screen.getByText("Guardar");
      // Ni el texto ni lo que lo envuelve se ocultan o se atenúan.
      for (let el: HTMLElement | null = texto; el && el !== boton; el = el.parentElement) {
        expect(el.className).not.toMatch(/opacity-|invisible|hidden|sr-only/);
      }
      const espera = boton.querySelector("[data-sala-loader]")!;
      expect(espera).toHaveAttribute("aria-hidden", "true");
      // Fuera del flujo: no cambia el ancho ni el alto del botón.
      expect(espera.className).toContain("absolute");
    });

    it("los cuadrados de la espera se ven con colores forzados y se quedan quietos con movimiento reducido", () => {
      render(
        <SalaButton loading loadingLabel="Cargando…">
          Guardar
        </SalaButton>
      );
      const cuadrados = Array.from(screen.getByRole("button").querySelectorAll("[data-sala-loader] > span"));
      expect(cuadrados).toHaveLength(3);
      for (const cuadrado of cuadrados) {
        expect(cuadrado.className).toContain("forced-colors:bg-[ButtonText]");
        expect(cuadrado.className).toContain("motion-reduce:animate-none");
      }
    });

    it("un botón que nunca carga no monta la región viva", () => {
      render(<SalaButton>Guardar</SalaButton>);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("icono", () => {
    it("con texto: el icono es adorno y el nombre es el texto", () => {
      render(<SalaButton icon={<Icono />}>Añadir</SalaButton>);
      const boton = screen.getByRole("button", { name: "Añadir" });
      expect(screen.getByTestId("icono").parentElement).toHaveAttribute("aria-hidden", "true");
      expect(boton.firstElementChild).toContainElement(screen.getByTestId("icono"));
    });

    it("con colores forzados el icono hereda el color del botón: no se le fuerza el de texto", () => {
      // Con `ButtonText` fijo, el icono de un botón deshabilitado parecía activo
      // (no salía en `GrayText`) y el de un enlace no salía en `LinkText`.
      render(
        <SalaButton icon={<Icono />} disabled>
          Añadir
        </SalaButton>
      );
      expect(screen.getByTestId("icono").parentElement!.className).not.toContain("forced-colors:");
    });

    it("el icono puede ir al final", () => {
      render(
        <SalaButton icon={<Icono />} iconPosition="end">
          Siguiente
        </SalaButton>
      );
      const contenido = screen.getByText("Siguiente").parentElement!;
      expect(contenido.lastElementChild).toContainElement(screen.getByTestId("icono"));
    });

    it("solo icono: el nombre accesible sale de `label` y el botón es cuadrado", () => {
      render(<SalaButton icon={<Icono />} label="Cerrar" />);
      const boton = screen.getByRole("button", { name: "Cerrar" });
      // Sin `title`: repetiría el nombre y no llega al teclado ni al táctil.
      expect(boton).not.toHaveAttribute("title");
      expect(boton.className).toContain("w-sala-target");
    });

    it("los tipos exigen `label` cuando no hay texto", () => {
      // @ts-expect-error -- solo icono sin nombre accesible no compila.
      render(<SalaButton icon={<Icono />} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("asChild", () => {
    it("pinta el hijo con el aspecto del botón, sin anidar un <button>", () => {
      render(
        <SalaButton asChild variant="secondary">
          <a href="/library">Ir a la biblioteca</a>
        </SalaButton>
      );
      const enlace = screen.getByRole("link", { name: "Ir a la biblioteca" });
      expect(enlace).toHaveAttribute("href", "/library");
      expect(enlace.className).toContain("min-h-sala-target");
      expect(enlace).not.toHaveAttribute("type");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("mete el icono dentro del hijo", () => {
      render(
        <SalaButton asChild icon={<Icono />}>
          <a href="/library">Ir a la biblioteca</a>
        </SalaButton>
      );
      expect(screen.getByRole("link", { name: "Ir a la biblioteca" })).toContainElement(screen.getByTestId("icono"));
    });

    it("solo icono: el nombre va al hijo", () => {
      render(
        <SalaButton asChild icon={<Icono />} label="Volver a la biblioteca">
          <a href="/library" />
        </SalaButton>
      );
      const enlace = screen.getByRole("link", { name: "Volver a la biblioteca" });
      expect(enlace).not.toHaveAttribute("title");
    });

    it("el contenido del hijo va en el mismo envoltorio que el del botón (pulsa y parte igual)", () => {
      render(
        <SalaButton asChild>
          <a href="/library">Ir a la biblioteca</a>
        </SalaButton>
      );
      const enlace = screen.getByRole("link");
      expect(enlace.children).toHaveLength(1);
      expect(screen.getByText("Ir a la biblioteca").className).toContain("[overflow-wrap:anywhere]");
      expect(enlace.className).toContain("[&>span:first-child]:sala-pressed:scale-[0.96]");
    });

    it("deshabilitado: aria-disabled y el clic no navega ni llega a onClick", () => {
      const onClick = vi.fn();
      render(
        <SalaButton asChild disabled onClick={onClick}>
          <a href="/library">Ir a la biblioteca</a>
        </SalaButton>
      );
      const enlace = screen.getByRole("link");
      expect(enlace).toHaveAttribute("aria-disabled", "true");
      expect(enlace).not.toHaveAttribute("disabled");
      // `fireEvent` devuelve false si alguien llamó a preventDefault.
      expect(fireEvent.click(enlace)).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});
