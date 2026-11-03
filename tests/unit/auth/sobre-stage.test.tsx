/**
 * El sobre de la tapa de acceso: geometría compartida HTML/3D, salida del
 * abanico dentro de los tiempos del sistema y three.js solo en escritorio.
 */
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ sceneImported: vi.fn() }));

vi.mock("@/components/media/PosterImage", () => ({
  PosterImage: ({ src }: { src: string }) => <img alt="" src={src} />,
}));
vi.mock("@/app/[locale]/login/sobre-scene", () => {
  h.sceneImported();
  return { mountSobreScene: () => ({ dispose: () => undefined }) };
});

import { SobreStage } from "@/app/[locale]/login/SobreStage";
import {
  BURST_MAX_MS,
  BURST_MS,
  STAGE_MAX_CROMOS,
  baseHidden,
  burstDelays,
  fanPoses,
  cromoAt,
  insideStage,
} from "@/app/[locale]/login/sobre-layout";

const COVERS = ["movie", "tv", "anime", "manga", "game", "book", "comic"].map((type, i) => ({
  id: `${type}_${i}`,
  title: `Título ${i}`,
  type: type as never,
  poster: `https://image.tmdb.org/t/p/w342/${i}.jpg`,
}));

describe("geometría del abanico", () => {
  it.each([1, 3, 5, 7])("con %i cromos cabe entero y la base queda dentro del sobre", (n) => {
    const poses = fanPoses(n);
    expect(poses).toHaveLength(n);
    for (const pose of poses) {
      expect(insideStage(pose)).toBe(true);
      expect(baseHidden(pose)).toBe(true);
    }
  });

  it("nunca más de un cromo por formato (7)", () => {
    expect(fanPoses(20)).toHaveLength(STAGE_MAX_CROMOS);
  });

  it("la salida dura 360 ms por cromo y nunca pasa de 600 ms en total", () => {
    for (const n of [1, 2, 7]) {
      const delays = burstDelays(n);
      expect(delays).toHaveLength(n);
      expect(Math.max(...delays) + BURST_MS).toBeLessThanOrEqual(BURST_MAX_MS);
    }
    expect(burstDelays(7)[1]).toBe(40);
  });

  it("el puntero sobre el sobre no levanta ningún cromo; donde se solapan, gana el de encima", () => {
    const poses = fanPoses(7);
    expect(cromoAt(0.5, 0.75, poses)).toBe(-1);
    // En (0,44; 0,2) están el 2 y el 3: se ve (y se levanta) el 3.
    expect(cromoAt(0.44, 0.2, poses)).toBe(3);
    // Un poco más a la derecha, el 4 tapa al 3.
    expect(cromoAt(0.5, 0.2, poses)).toBe(4);
  });
});

describe("SobreStage", () => {
  beforeEach(() => {
    h.sceneImported.mockReset();
  });

  it("pinta las portadas reales como cromos, oculto al lector", () => {
    const { container } = render(<SobreStage covers={COVERS} />);
    const stage = container.querySelector("[data-sobre]")!;
    expect(stage).toHaveAttribute("aria-hidden", "true");
    expect(stage.querySelectorAll("[data-cromo]")).toHaveLength(7);
    expect(stage.querySelectorAll("img")).toHaveLength(7);
    expect(stage.querySelectorAll("[data-sobre-cromo]")).toHaveLength(7);
  });

  it("sin portadas: los huecos vacíos del abanico, sin inventar nada", () => {
    const { container } = render(<SobreStage covers={[]} />);
    expect(container.querySelectorAll("[data-cromo]")).toHaveLength(0);
    expect(container.querySelectorAll(".border-dashed")).toHaveLength(STAGE_MAX_CROMOS);
  });

  it("la salida se apaga con movimiento reducido (CSS)", () => {
    const { container } = render(<SobreStage covers={COVERS} />);
    const css = [...container.ownerDocument.querySelectorAll("style")].map((s) => s.textContent).join("");
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\{\[data-sobre-cromo\]\{animation:none\}/);
    // Cada cromo sale en 360 ms con la curva de pegar.
    expect(css).toContain("kultura-sobre-out-6 360ms cubic-bezier(.3,1.3,.5,1) 240ms both");
  });

  it("fuera de escritorio (o sin matchMedia) no carga three", async () => {
    vi.useFakeTimers();
    render(<SobreStage covers={COVERS} />);
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();
    expect(h.sceneImported).not.toHaveBeenCalled();
  });
});
