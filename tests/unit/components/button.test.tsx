import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renderiza con variante primary por defecto", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/bg-accent/);
  });

  it("aplica clase correcta según variante ghost", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button", { name: "Ghost" });
    expect(btn.className).toMatch(/hover:bg-surface2/);
  });

  it("aplica clase correcta según variante outline", () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole("button", { name: "Outline" });
    expect(btn.className).toMatch(/border/);
  });

  it("muestra spinner cuando loading=true", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("está disabled cuando disabled=true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("está disabled cuando loading=true", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("llama onClick cuando se hace click", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Click" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("no llama onClick cuando está disabled", () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Click" }));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
