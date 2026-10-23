// F-15 · El error de la ficha pública no manda al login a quien no tiene sesión.
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "es" }) }));

import MediaDetailError from "@/app/[locale]/media/[type]/[id]/error";

describe("error de la ficha", () => {
  it("«Ir al inicio» lleva a la portada del idioma, no a /home", () => {
    render(<MediaDetailError error={new Error("x")} reset={vi.fn()} />);
    expect(screen.getByRole("link", { name: "goHome" })).toHaveAttribute("href", "/es");
  });
});
