import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { StatusSelector } from "@/components/ui/StatusSelector";

describe("StatusSelector", () => {
  it("renderiza las 4 opciones de estado", () => {
    render(<StatusSelector value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "completed" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "in_progress" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "pending" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "abandoned" })).toBeInTheDocument();
  });

  it("muestra opción vacía cuando value es undefined", () => {
    render(<StatusSelector value={undefined} onChange={vi.fn()} />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("");
  });

  it("selecciona el valor correcto cuando value está definido", () => {
    render(<StatusSelector value="completed" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("completed");
  });

  it("llama onChange con el valor correcto al cambiar", () => {
    const handleChange = vi.fn();
    render(<StatusSelector value={undefined} onChange={handleChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "in_progress" } });
    expect(handleChange).toHaveBeenCalledWith("in_progress");
  });

  it("llama onChange con abandoned al seleccionar abandonado", () => {
    const handleChange = vi.fn();
    render(<StatusSelector value="pending" onChange={handleChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "abandoned" } });
    expect(handleChange).toHaveBeenCalledWith("abandoned");
  });
});
