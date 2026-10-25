/**
 * MOV-3 — cuándo se ofrece "Instalar la app": 2.ª visita o 1.ª entrada en la
 * biblioteca, nunca instalada, y no vuelve en 30 días tras descartarlo.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DISMISS_MS,
  EMPTY_STATE,
  INSTALL_STORAGE_KEY,
  VISIT_GAP_MS,
  detectPlatform,
  dismiss,
  isLibraryPath,
  markInstalled,
  readInstallState,
  registerVisit,
  shouldOfferInstall,
  writeInstallState,
  type InstallState,
  type OfferInput,
} from "@/components/pwa/install-policy";

const NOW = Date.UTC(2026, 10, 1, 12);
const DAY = 24 * 60 * 60 * 1000;

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(INSTALL_STORAGE_KEY, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const offer = (over: Partial<OfferInput> & { state: InstallState }) =>
  shouldOfferInstall({ now: NOW, pathname: "/es/home", standalone: false, canPrompt: true, platform: "android", ...over });

describe("visitas", () => {
  it("la primera carga es la visita 1; recargar al rato no suma", () => {
    let s = registerVisit(EMPTY_STATE, NOW);
    expect(s.visits).toBe(1);
    s = registerVisit(s, NOW + 5 * 60 * 1000);
    expect(s.visits).toBe(1);
  });

  it("volver tras más de 30 min sin actividad es otra visita", () => {
    const first = registerVisit(EMPTY_STATE, NOW);
    expect(registerVisit(first, NOW + VISIT_GAP_MS + 1).visits).toBe(2);
    expect(registerVisit(first, NOW + VISIT_GAP_MS).visits).toBe(1);
  });

  it("un reloj que va hacia atrás cuenta como visita nueva (no se queda bloqueado)", () => {
    const first = registerVisit(EMPTY_STATE, NOW);
    expect(registerVisit(first, NOW - DAY).visits).toBe(2);
  });
});

describe("shouldOfferInstall", () => {
  const second: InstallState = { visits: 2, lastSeenAt: NOW };
  const first: InstallState = { visits: 1, lastSeenAt: NOW };

  it("no en la 1.ª visita; sí en la 2.ª", () => {
    expect(offer({ state: first })).toBe(false);
    expect(offer({ state: second })).toBe(true);
  });

  it("sí en la 1.ª entrada en la biblioteca (es y en, con subrutas)", () => {
    expect(offer({ state: first, pathname: "/es/library" })).toBe(true);
    expect(offer({ state: first, pathname: "/en/library/" })).toBe(true);
    expect(offer({ state: first, pathname: "/es/library?status=watching" })).toBe(true);
    expect(isLibraryPath("/es/librarything")).toBe(false);
    expect(isLibraryPath(null)).toBe(false);
  });

  it("tras descartarlo no vuelve en 30 días; a los 30 días, sí", () => {
    const dismissed = dismiss(second, NOW);
    expect(offer({ state: dismissed, now: NOW + DAY })).toBe(false);
    expect(offer({ state: dismissed, now: NOW + DISMISS_MS - 1 })).toBe(false);
    expect(offer({ state: dismissed, now: NOW + DISMISS_MS })).toBe(true);
    // También en la biblioteca.
    expect(offer({ state: dismissed, now: NOW + DAY, pathname: "/es/library" })).toBe(false);
  });

  it("nunca si ya está instalada o se ejecuta en modo app", () => {
    expect(offer({ state: markInstalled(second) })).toBe(false);
    expect(offer({ state: second, standalone: true })).toBe(false);
  });

  it("sin beforeinstallprompt solo en iOS (instrucciones); en el resto, nada", () => {
    expect(offer({ state: second, canPrompt: false, platform: "desktop" })).toBe(false);
    expect(offer({ state: second, canPrompt: false, platform: "android" })).toBe(false);
    expect(offer({ state: second, canPrompt: false, platform: "ios" })).toBe(true);
  });
});

describe("almacenamiento", () => {
  it("ida y vuelta", () => {
    const store = memory();
    const state = dismiss(registerVisit(EMPTY_STATE, NOW), NOW);
    writeInstallState(store, state);
    expect(readInstallState(store)).toEqual(state);
  });

  it("JSON roto, valores raros o storage que lanza: se empieza de cero sin romper", () => {
    expect(readInstallState(memory("{no json"))).toEqual(EMPTY_STATE);
    expect(readInstallState(memory("null"))).toEqual(EMPTY_STATE);
    expect(readInstallState(memory('{"visits":"9","lastSeenAt":-1,"dismissedAt":"x","installed":"yes"}'))).toEqual({
      visits: 0,
      lastSeenAt: -1,
    });
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    expect(readInstallState(throwing)).toEqual(EMPTY_STATE);
    expect(() => writeInstallState(throwing, EMPTY_STATE)).not.toThrow();
    expect(readInstallState(null)).toEqual(EMPTY_STATE);
  });
});

describe("detectPlatform", () => {
  it("iPhone, iPad (también el que se presenta como Mac táctil), Android y escritorio", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 0)).toBe("desktop");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0")).toBe("desktop");
  });
});
