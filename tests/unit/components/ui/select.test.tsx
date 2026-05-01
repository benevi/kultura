import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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
