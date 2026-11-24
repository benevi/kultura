/**
 * MOV-3 — cuándo se ofrece "Instalar la app": al entrar en la biblioteca,
 * nunca instalada, y no vuelve en 30 días tras descartarlo. Sin contador de
 * visitas: solo se guarda la respuesta (24-11-2026).
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DISMISS_MS,
  EMPTY_STATE,
  INSTALL_STORAGE_KEY,
  detectPlatform,
  dismiss,
  isLibraryPath,
  markInstalled,
  pruneInstallState,
  readInstallState,
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
    removeItem: (k: string) => void data.delete(k),
  };
}

const LIBRARY = "/es/library";
const offer = (over: Partial<OfferInput> & { state: InstallState }) =>
  shouldOfferInstall({ now: NOW, pathname: LIBRARY, standalone: false, canPrompt: true, platform: "android", ...over });

describe("shouldOfferInstall", () => {
  it("solo en la biblioteca (es y en, con subrutas); en el resto, nunca", () => {
    expect(offer({ state: EMPTY_STATE })).toBe(true);
    expect(offer({ state: EMPTY_STATE, pathname: "/en/library/" })).toBe(true);
    expect(offer({ state: EMPTY_STATE, pathname: "/es/library?status=watching" })).toBe(true);
    expect(offer({ state: EMPTY_STATE, pathname: "/es/home" })).toBe(false);
    expect(isLibraryPath("/es/librarything")).toBe(false);
    expect(isLibraryPath(null)).toBe(false);
  });

  it("tras descartarlo no vuelve en 30 días; a los 30 días, sí", () => {
    const dismissed = dismiss(EMPTY_STATE, NOW);
    expect(offer({ state: dismissed, now: NOW + DAY })).toBe(false);
    expect(offer({ state: dismissed, now: NOW + DISMISS_MS - 1 })).toBe(false);
    expect(offer({ state: dismissed, now: NOW + DISMISS_MS })).toBe(true);
  });

  it("nunca si ya está instalada o se ejecuta en modo app", () => {
    expect(offer({ state: markInstalled(EMPTY_STATE) })).toBe(false);
    expect(offer({ state: EMPTY_STATE, standalone: true })).toBe(false);
  });

  it("sin beforeinstallprompt solo en iOS (instrucciones); en el resto, nada", () => {
    expect(offer({ state: EMPTY_STATE, canPrompt: false, platform: "desktop" })).toBe(false);
    expect(offer({ state: EMPTY_STATE, canPrompt: false, platform: "android" })).toBe(false);
    expect(offer({ state: EMPTY_STATE, canPrompt: false, platform: "ios" })).toBe(true);
  });
});

describe("almacenamiento", () => {
  it("ida y vuelta: solo la respuesta", () => {
    const store = memory();
    const state = dismiss(EMPTY_STATE, NOW);
    writeInstallState(store, state);
    expect(readInstallState(store)).toEqual(state);
    expect(store.data.get(INSTALL_STORAGE_KEY)).toBe(JSON.stringify({ dismissedAt: NOW }));
  });

  it("sin respuesta no se guarda nada (y se borra lo que hubiera)", () => {
    const store = memory('{"installed":true}');
    writeInstallState(store, EMPTY_STATE);
    expect(store.data.has(INSTALL_STORAGE_KEY)).toBe(false);
  });

  it("nunca escribe campos de más, aunque se los pasen", () => {
    const store = memory();
    writeInstallState(store, { installed: true, visits: 3 } as InstallState);
    expect(store.data.get(INSTALL_STORAGE_KEY)).toBe('{"installed":true}');
  });

  it("pruneInstallState: quita el contador de versiones anteriores", () => {
    const withAnswer = memory(JSON.stringify({ visits: 4, lastSeenAt: NOW, dismissedAt: NOW }));
    pruneInstallState(withAnswer);
    expect(withAnswer.data.get(INSTALL_STORAGE_KEY)).toBe(JSON.stringify({ dismissedAt: NOW }));

    const onlyCounter = memory(JSON.stringify({ visits: 4, lastSeenAt: NOW }));
    pruneInstallState(onlyCounter);
    expect(onlyCounter.data.has(INSTALL_STORAGE_KEY)).toBe(false);

    const broken = memory("{no json");
    pruneInstallState(broken);
    expect(broken.data.has(INSTALL_STORAGE_KEY)).toBe(false);

    const clean = memory('{"installed":true}');
    pruneInstallState(clean);
    expect(clean.data.get(INSTALL_STORAGE_KEY)).toBe('{"installed":true}');
  });

  it("JSON roto, valores raros o storage que lanza: se empieza de cero sin romper", () => {
    expect(readInstallState(memory("{no json"))).toEqual(EMPTY_STATE);
    expect(readInstallState(memory("null"))).toEqual(EMPTY_STATE);
    expect(readInstallState(memory('{"dismissedAt":"x","installed":"yes"}'))).toEqual(EMPTY_STATE);
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readInstallState(throwing)).toEqual(EMPTY_STATE);
    expect(() => writeInstallState(throwing, EMPTY_STATE)).not.toThrow();
    expect(() => writeInstallState(throwing, { installed: true })).not.toThrow();
    expect(() => pruneInstallState(throwing)).not.toThrow();
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
