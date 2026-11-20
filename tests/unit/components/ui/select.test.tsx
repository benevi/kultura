import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { KInput } from "@/components/ui/KInput";
import { Select } from "@/components/ui/Select";

const options = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
  { value: "anime", label: "Anime" },
];

describe("Select", () => {
  it("renderiza todas las opciones", () => {
    render(<Select value="movie" onChange={vi.fn()} options={options} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Movies")).toBeInTheDocument();
    expect(screen.getByText("TV Shows")).toBeInTheDocument();
    expect(screen.getByText("Anime")).toBeInTheDocument();
  });

  it("el value seleccionado coincide con la prop value", () => {
    render(<Select value="tv" onChange={vi.fn()} options={options} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("tv");
  });

  it("llama onChange con el nuevo valor al cambiar la selección", () => {
    const handleChange = vi.fn();
    render(<Select value="movie" onChange={handleChange} options={options} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "anime" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("anime");
  });

  it("renderiza un label cuando se provee la prop label", () => {
    render(
      <Select value="movie" onChange={vi.fn()} options={options} label="Tipo de contenido" />
    );
    expect(screen.getByText("Tipo de contenido")).toBeInTheDocument();
  });

  it("no renderiza label cuando no se provee", () => {
    render(<Select value="movie" onChange={vi.fn()} options={options} />);
    expect(screen.queryByText("Tipo de contenido")).not.toBeInTheDocument();
  });
});

describe("Select — etiqueta asociada, borde visible y 16 px en móvil", () => {
  it("la etiqueta nombra al select (htmlFor/id)", () => {
    render(<Select value="movie" onChange={vi.fn()} options={options} label="Estado" />);
    expect(screen.getByLabelText("Estado").tagName).toBe("SELECT");
  });

  it("16 px en móvil y 15 px desde md, como KInput", () => {
    render(<Select value="movie" onChange={vi.fn()} options={options} />);
    const cls = screen.getByRole("combobox").className;
    expect(cls).toMatch(/\btext-base\b/);
    expect(cls).toMatch(/\bmd:text-body\b/);
  });

  it("borde con contraste de campo y foco visible", () => {
    render(<Select value="movie" onChange={vi.fn()} options={options} />);
    const cls = screen.getByRole("combobox").className;
    expect(cls).toMatch(/\bborder-field-border\b/);
    expect(cls).toMatch(/focus-visible:outline-focus-ring/);
  });
});

describe("Select — la caja y la etiqueta de KInput (C14)", () => {
  it("la misma caja que KInput, más el alto mínimo del select nativo", () => {
    render(
      <>
        <KInput label="Nombre" />
        <Select value="movie" onChange={vi.fn()} options={options} label="Tipo" />
      </>
    );
    const input = screen.getByLabelText("Nombre").className.split(" ");
    const select = screen.getByLabelText("Tipo").className.split(" ");
    for (const c of input) expect(select).toContain(c);
    expect(select).toEqual(expect.arrayContaining(["min-h-14", "md:min-h-[54px]"]));
  });

  it("la misma etiqueta que KInput (13 px en negrita, text-tertiary)", () => {
    render(
      <>
        <KInput label="Nombre" />
        <Select value="movie" onChange={vi.fn()} options={options} label="Tipo" />
      </>
    );
    expect(screen.getByText("Tipo").className).toBe(screen.getByText("Nombre").className);
  });

  it("con error: aria-invalid, descripción, role=alert y borde de error", () => {
    render(<Select value="movie" onChange={vi.fn()} options={options} label="Tipo" error="Elige un tipo" />);
    const select = screen.getByLabelText("Tipo");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Elige un tipo");
    expect(screen.getByRole("alert")).toHaveTextContent("Elige un tipo");
    expect(select.className).toMatch(/\bborder-accent-danger\b/);
  });

  it("sin error no lleva aria-invalid; la ayuda lo describe y conserva un aria-describedby propio", () => {
    render(
      <>
        <p id="extra">Extra</p>
        <Select value="movie" onChange={vi.fn()} options={options} label="Tipo" hint="Puedes cambiarlo" aria-describedby="extra" />
      </>
    );
    const select = screen.getByLabelText("Tipo");
    expect(select).not.toHaveAttribute("aria-invalid");
    expect(select).toHaveAccessibleDescription("Extra Puedes cambiarlo");
  });

  it("respeta el id que llega por props", () => {
    render(<Select id="tipo" value="movie" onChange={vi.fn()} options={options} label="Tipo" />);
    expect(screen.getByLabelText("Tipo")).toHaveAttribute("id", "tipo");
  });
});
