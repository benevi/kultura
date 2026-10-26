// ============================================================
// KULTURA — `beforeinstallprompt` capturado lo antes posible (MOV-3)
//
// Chrome lo lanza una vez y pronto (a veces antes de que React monte), así
// que se escucha al cargar el módulo y se guarda. `preventDefault()` quita la
// mini-barra del navegador: el aviso lo pone `InstallPrompt` cuando toca
// (2.ª visita o biblioteca). La opción "Instalar" del menú del navegador
// sigue ahí.
// ============================================================

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function captureInstallEvents(target: Window) {
  target.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  target.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

if (typeof window !== "undefined") captureInstallEvents(window);

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

/** El evento solo sirve una vez: quien lo usa se lo queda. */
export function takeDeferredPrompt(): BeforeInstallPromptEvent | null {
  const event = deferred;
  deferred = null;
  notify();
  return event;
}

export function subscribeInstallPrompt(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Solo para tests. */
export function resetInstallEventsForTest() {
  deferred = null;
}
