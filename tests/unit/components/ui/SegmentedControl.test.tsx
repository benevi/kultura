// E59 · F5b — primitivo SegmentedControl (controlado, genérico).
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const OPTIONS = [
  { value: "movie", label: "Películas" },
  { value: "tv", label: "Series" },
  { value: "anime", label: "Anime" },
];

describe("SegmentedControl", () => {
  it("renderiza una opción por entrada", () => {
    render(
      <SegmentedControl options={OPTIONS} value="movie" onChange={() => {}} />
    );
    expect(screen.getAllByRole("radio")).toHaveLength(OPTIONS.length);
    for (const o of OPTIONS) {
      expect(screen.getByText(o.label)).toBeInTheDocument();
    }
  });

  it("marca la opción activa con aria-checked", () => {
    render(
      <SegmentedControl options={OPTIONS} value="tv" onChange={() => {}} />
    );
    expect(screen.getByText("Series")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Películas")).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByText("Anime")).toHaveAttribute("aria-checked", "false");
  });

  it("click en una opción llama onChange con su value", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl options={OPTIONS} value="movie" onChange={onChange} />
    );
    fireEvent.click(screen.getByText("Anime"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("anime");
  });

  it("usa patrón a11y radiogroup con aria-label", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="movie"
        onChange={() => {}}
        ariaLabel="Tipo de contenido"
      />
    );
    const group = screen.getByRole("radiogroup", { name: "Tipo de contenido" });
    expect(group).toBeInTheDocument();
  });

  it("controlado: re-render con nuevo value mueve el activo", () => {
    const { rerender } = render(
      <SegmentedControl options={OPTIONS} value="movie" onChange={() => {}} />
    );
    expect(screen.getByText("Películas")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    rerender(
      <SegmentedControl options={OPTIONS} value="anime" onChange={() => {}} />
    );
    expect(screen.getByText("Películas")).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByText("Anime")).toHaveAttribute("aria-checked", "true");
  });
});
