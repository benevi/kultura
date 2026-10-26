/**
 * MOV-3 — el aviso de instalación en el navegador: sale cuando toca, el
 * diálogo nativo se abre desde "Instalar", "Ahora no" lo calla 30 días, iOS
 * ve las instrucciones y `appinstalled` se registra (beacon a
 * /api/pwa/installed, que llama a `track()`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { INSTALLED_ENDPOINT, InstallPrompt, type InstallLabels } from "@/components/pwa/InstallPrompt";
import { resetInstallEventsForTest } from "@/components/pwa/install-events";
import { DISMISS_MS, INSTALL_STORAGE_KEY, VISIT_GAP_MS } from "@/components/pwa/install-policy";

let pathname = "/es/home";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const labels: InstallLabels = {
  title: "Instala KULTURA",
  body: "Ábrela desde la pantalla de inicio",
  action: "Instalar",
  later: "Ahora no",
  iosTitle: "Añade KULTURA a tu pantalla de inicio",
  iosStepShare: "Toca Compartir",
  iosStepAdd: "Añadir a pantalla de inicio",
  iosDone: "Entendido",
};

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function fireBeforeInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

/** Simula que ya hubo una visita hace más de 30 min. */
function previousVisit(extra: Record<string, unknown> = {}) {
  window.localStorage.setItem(
    INSTALL_STORAGE_KEY,
    JSON.stringify({ visits: 1, lastSeenAt: Date.now() - VISIT_GAP_MS - 1000, ...extra }),
  );
}

const beacon = vi.fn((_url: string, _body?: BodyInit | null) => true);

beforeEach(() => {
  window.localStorage.clear();
  resetInstallEventsForTest();
  pathname = "/es/home";
  setUserAgent(ANDROID);
  Object.defineProperty(window.navigator, "sendBeacon", { value: beacon, configurable: true });
  beacon.mockClear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("InstallPrompt", () => {
  it("1.ª visita en Inicio: nada, aunque el navegador pueda instalar", () => {
    render(<InstallPrompt labels={labels} />);
    fireBeforeInstallPrompt();
    expect(screen.queryByTestId("install-prompt")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(INSTALL_STORAGE_KEY)!).visits).toBe(1);
  });

  it("captura beforeinstallprompt (quita la mini-barra) y sale en la 2.ª visita", () => {
    previousVisit();
    render(<InstallPrompt labels={labels} />);
    expect(screen.queryByTestId("install-prompt")).toBeNull(); // aún sin evento
    const event = fireBeforeInstallPrompt();
    expect(event.defaultPrevented).toBe(true);
    const card = screen.getByRole("complementary", { name: labels.title });
    expect(card).toHaveTextContent(labels.body);
    // No es un diálogo: no roba el foco.
    expect(document.activeElement).toBe(document.body);
  });

  it("sale en la 1.ª entrada en la biblioteca", () => {
    pathname = "/es/library";
    render(<InstallPrompt labels={labels} />);
    fireBeforeInstallPrompt();
    expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
  });

  it("Instalar abre el diálogo nativo; aceptado, ya no vuelve", async () => {
    previousVisit();
    render(<InstallPrompt labels={labels} />);
    const event = fireBeforeInstallPrompt("accepted");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.action }));
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("install-prompt")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(INSTALL_STORAGE_KEY)!).installed).toBe(true);
  });

  it("cancelar el diálogo nativo cuenta como descartar (30 días)", async () => {
    previousVisit();
    render(<InstallPrompt labels={labels} />);
    fireBeforeInstallPrompt("dismissed");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.action }));
    });
    expect(JSON.parse(window.localStorage.getItem(INSTALL_STORAGE_KEY)!).dismissedAt).toEqual(expect.any(Number));
  });

  it("«Ahora no» lo cierra y no reaparece en 30 días; después, sí", () => {
    previousVisit();
    const first = render(<InstallPrompt labels={labels} />);
    fireBeforeInstallPrompt();
    fireEvent.click(screen.getByRole("button", { name: labels.later }));
    expect(screen.queryByTestId("install-prompt")).toBeNull();
    first.unmount();

    // Otra visita al día siguiente: no sale.
    vi.useFakeTimers({ now: Date.now() + 24 * 60 * 60 * 1000, toFake: ["Date"] });
    const second = render(<InstallPrompt labels={labels} />);
    fireBeforeInstallPrompt();
    expect(screen.queryByTestId("install-prompt")).toBeNull();
    second.unmount();

    // A los 30 días: vuelve.
    vi.setSystemTime(Date.now() + DISMISS_MS);
    render(<InstallPrompt labels={labels} />);
    fireBeforeInstallPrompt();
    expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
  });

  it("Escape la cierra como «Ahora no» y devuelve el foco adonde estaba", () => {
    previousVisit();
    render(
      <>
        <main id="main" tabIndex={-1}>
          <button type="button">antes</button>
        </main>
        <InstallPrompt labels={labels} />
      </>,
    );
    fireBeforeInstallPrompt();
    const before = screen.getByRole("button", { name: "antes" });
    before.focus();
    const later = screen.getByRole("button", { name: labels.later });
    fireEvent.focus(later, { relatedTarget: before });
    later.focus();
    fireEvent.keyDown(later, { key: "Escape" });
    expect(screen.queryByTestId("install-prompt")).toBeNull();
    expect(document.activeElement).toBe(before);
    expect(JSON.parse(window.localStorage.getItem(INSTALL_STORAGE_KEY)!).dismissedAt).toEqual(expect.any(Number));
  });

  it("si el elemento de antes ya no existe, el foco va al contenido principal; otras teclas no cierran", () => {
    previousVisit();
    render(
      <>
        <main id="main" tabIndex={-1} />
        <InstallPrompt labels={labels} />
      </>,
    );
    fireBeforeInstallPrompt();
    const action = screen.getByRole("button", { name: labels.action });
    action.focus();
    fireEvent.keyDown(action, { key: "Enter" });
    expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
    fireEvent.keyDown(action, { key: "Escape" });
    expect(document.activeElement).toBe(document.getElementById("main"));
  });

  it("iOS: instrucciones de Compartir → Añadir a pantalla de inicio, sin botón Instalar", () => {
    setUserAgent(IPHONE);
    previousVisit();
    render(<InstallPrompt labels={labels} />);
    const card = screen.getByRole("complementary", { name: labels.iosTitle });
    expect(card).toHaveTextContent(labels.iosStepShare);
    expect(card).toHaveTextContent(labels.iosStepAdd);
    expect(screen.queryByRole("button", { name: labels.action })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: labels.iosDone }));
    expect(screen.queryByTestId("install-prompt")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(INSTALL_STORAGE_KEY)!).dismissedAt).toEqual(expect.any(Number));
  });

  it("ya instalada (modo standalone): nunca", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    previousVisit();
    render(<InstallPrompt labels={labels} />);
    fireBeforeInstallPrompt();
    expect(screen.queryByTestId("install-prompt")).toBeNull();
  });

  it("appinstalled: se registra con beacon (no pasa por window.fetch) y se recuerda", async () => {
    const fetchSpy = vi.spyOn(window, "fetch");
    previousVisit();
    render(<InstallPrompt labels={labels} />);
    const event = fireBeforeInstallPrompt("accepted");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.action }));
    });
    expect(event.prompt).toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, body] = beacon.mock.calls[0];
    expect(url).toBe(INSTALLED_ENDPOINT);
    expect(JSON.parse(await (body as Blob).text())).toEqual({ platform: "android", source: "banner" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(INSTALL_STORAGE_KEY)!).installed).toBe(true);
    fetchSpy.mockRestore();
  });

  it("instalada desde el menú del navegador: source=browser", async () => {
    render(<InstallPrompt labels={labels} />);
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    const body = beacon.mock.calls[0][1] as Blob;
    expect(JSON.parse(await body.text())).toEqual({ platform: "android", source: "browser" });
  });

  it("con localStorage bloqueado no rompe (y se comporta como 1.ª visita)", () => {
    const spy = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => render(<InstallPrompt labels={labels} />)).not.toThrow();
    fireBeforeInstallPrompt();
    expect(screen.queryByTestId("install-prompt")).toBeNull();
    spy.mockRestore();
  });
});
