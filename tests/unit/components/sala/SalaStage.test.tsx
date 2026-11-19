import { describe, expect, it } from "vitest";
import { salaStageFocusOk } from "@/components/sala/SalaStage";

describe("salaStageFocusOk", () => {
  it("acepta una o dos posiciones de CSS", () => {
    for (const f of ["center", "left top", "30% 70%", "12px -4rem", " right  bottom ", "0 50.5%"]) {
      expect(salaStageFocusOk(f), f).toBe(true);
    }
  });

  it("rechaza lo que no es una posición: nada de fuera llega al CSS", () => {
    for (const f of [
      "",
      "calc(50% + var(--x))",
      "var(--x)",
      "50%; background: red",
      "url(x)",
      "left top center",
      "50vw",
      "}",
    ]) {
      expect(salaStageFocusOk(f), f).toBe(false);
    }
  });
});
