import { createRef } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SalaBlockState } from "@/components/sala/SalaBlockState";
import { SalaNotice } from "@/components/sala/SalaNotice";

const TONOS = ["info", "success", "warning", "error"] as const;

describe("SalaNotice", () => {
  it("pinta el texto, el título y pasa la ref, la clase y los atributos a la caja", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SalaNotice ref={ref} title="Sin conexión" className="mt-4" data-testid="aviso">
        Se enviará cuando vuelva.
      </SalaNotice>
    );
    const caja = screen.getByTestId("aviso");
    expect(ref.current).toBe(caja);
    expect(caja).toHaveClass("mt-4");
    expect(caja).toHaveTextContent("Sin conexión");
    expect(caja).toHaveTextContent("Se enviará cuando vuelva.");
  });

  it.each(TONOS)("tono %s: borde y dibujo propios, texto en tinta; esquinas rectas y sin sombras", (tone) => {
    render(
      <SalaNotice tone={tone} data-testid="aviso">
        Texto
      </SalaNotice>
    );
    const caja = screen.getByTestId("aviso");
    expect(caja).toHaveAttribute("data-sala-notice", tone);
    expect(caja.className).toContain("border-2");
    expect(caja.className).toContain("text-sala-ink");
    expect(caja.className).not.toMatch(/rounded|shadow|border-l-/);
    // Nunca solo color: cada tono lleva su dibujo, que es adorno.
    const dibujo = caja.querySelector("svg")!;
    expect(dibujo).toHaveAttribute("data-sala-tone-icon", tone);
    expect(dibujo).toHaveAttribute("aria-hidden", "true");
  });

  it("los cuatro dibujos tienen forma distinta", () => {
    const { container } = render(
      <>
        {TONOS.map((tone) => (
          <SalaNotice key={tone} tone={tone}>
            Texto
          </SalaNotice>
        ))}
      </>
    );
    const formas = Array.from(container.querySelectorAll("svg path"), (trazo) => trazo.getAttribute("d"));
    expect(new Set(formas).size).toBe(4);
  });

  it("por defecto, el error interrumpe (alert) y los demás esperan (status)", () => {
    const { rerender } = render(<SalaNotice tone="error">Falló</SalaNotice>);
    expect(screen.getByRole("alert")).toHaveTextContent("Falló");
    for (const tone of ["info", "success", "warning"] as const) {
      rerender(<SalaNotice tone={tone}>Texto</SalaNotice>);
      expect(screen.getByRole("status")).toHaveTextContent("Texto");
      expect(screen.queryByRole("alert")).toBeNull();
    }
  });

  it("live fuerza el papel o lo quita", () => {
    const { rerender, container } = render(
      <SalaNotice tone="warning" live="assertive">
        La sesión caduca
      </SalaNotice>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(
      <SalaNotice tone="error" live="polite">
        Falló
      </SalaNotice>
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(
      <SalaNotice tone="error" live="off">
        Falló
      </SalaNotice>
    );
    expect(container.querySelector("[role]")).toBeNull();
  });

  it("no se anuncia dos veces: un solo papel, sin aria-live añadido, y los botones quedan fuera de él", () => {
    const { container } = render(
      <SalaNotice tone="error" action={<button>Reintentar</button>} onClose={vi.fn()} closeLabel="Cerrar el aviso">
        No se ha podido guardar.
      </SalaNotice>
    );
    expect(container.querySelectorAll("[role=alert], [role=status]")).toHaveLength(1);
    expect(container.querySelector("[aria-live]")).toBeNull();
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent(/^No se ha podido guardar\.$/);
    expect(within(alerta).queryByRole("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("toneLabel solo lo oye el lector, delante del texto", () => {
    render(
      <SalaNotice tone="success" toneLabel="Hecho:">
        Nota guardada.
      </SalaNotice>
    );
    expect(screen.getByRole("status")).toHaveTextContent("Hecho: Nota guardada.");
    expect(screen.getByText("Hecho:")).toHaveClass("sr-only");
  });

  it("con onClose lleva un botón de cerrar con nombre, de 48 px; sin él, no", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <SalaNotice onClose={onClose} closeLabel="Cerrar el aviso">
        Texto
      </SalaNotice>
    );
    const cerrar = screen.getByRole("button", { name: "Cerrar el aviso" });
    expect(cerrar.className).toContain("min-h-sala-target");
    expect(cerrar.className).toContain("w-sala-target");
    fireEvent.click(cerrar);
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<SalaNotice>Texto</SalaNotice>);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("SalaBlockState", () => {
  it("pinta título, explicación, acción y salida", () => {
    render(
      <SalaBlockState
        title="Tu biblioteca está vacía"
        description="Aquí va todo lo que ves."
        action={<button>Buscar una obra</button>}
        secondary={<a href="/import">Importar</a>}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Tu biblioteca está vacía" })).toBeInTheDocument();
    expect(screen.getByText("Aquí va todo lo que ves.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar una obra" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Importar" })).toBeInTheDocument();
  });

  it.each([1, 2, 3] as const)("headingLevel=%i pone ese encabezado", (nivel) => {
    render(<SalaBlockState title="Título" headingLevel={nivel} />);
    expect(screen.getByRole("heading", { level: nivel, name: "Título" })).toBeInTheDocument();
  });

  it("el error lleva su dibujo (no solo color) y el estado vacío no", () => {
    const { container, rerender } = render(<SalaBlockState tone="error" title="No se ha podido cargar" />);
    const dibujo = container.querySelector("svg[data-sala-tone-icon=error]")!;
    expect(dibujo.closest("[aria-hidden=true]")).not.toBeNull();
    rerender(<SalaBlockState title="Vacío" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("media sustituye al dibujo y queda oculto a los lectores", () => {
    const { container } = render(<SalaBlockState tone="error" title="Error" media={<img alt="" src="data:," data-testid="adorno" />} />);
    expect(container.querySelector("[data-sala-tone-icon]")).toBeNull();
    expect(screen.getByTestId("adorno").closest("[aria-hidden=true]")).not.toBeNull();
  });

  it("focusTitle lleva el foco al título al aparecer, sin papel de alerta", () => {
    const { container } = render(<SalaBlockState tone="error" headingLevel={1} focusTitle title="Se nos ha escapado un error" />);
    const titulo = screen.getByRole("heading", { level: 1 });
    expect(titulo).toHaveFocus();
    expect(titulo).toHaveAttribute("tabindex", "-1");
    expect(container.querySelector("[role=alert], [aria-live]")).toBeNull();
  });

  it("sin focusTitle no toca el foco ni pone tabindex", () => {
    render(<SalaBlockState title="Vacío" />);
    const titulo = screen.getByRole("heading");
    expect(titulo).not.toHaveFocus();
    expect(titulo).not.toHaveAttribute("tabindex");
  });

  it("pasa la ref, la clase y los atributos; va alineado a la izquierda, sin esquinas ni sombras", () => {
    const ref = createRef<HTMLDivElement>();
    render(<SalaBlockState ref={ref} title="Vacío" className="min-h-[60vh]" data-testid="estado" />);
    const caja = screen.getByTestId("estado");
    expect(ref.current).toBe(caja);
    expect(caja).toHaveClass("min-h-[60vh]");
    expect(caja.className).toContain("items-start");
    expect(caja.className).not.toMatch(/rounded|shadow|text-center/);
  });
});
