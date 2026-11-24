// ============================================================
// KULTURA — Cuándo ofrecer "Instalar la app" (MOV-3). Lógica pura.
//
// - Se ofrece al entrar en la biblioteca. No se cuentan visitas (decisión de
//   Víctor, 24-11-2026: nada que no sea estrictamente necesario, art. 22.2
//   LSSI).
// - Descartado ("Ahora no", la X o cancelar el diálogo nativo): no reaparece
//   en 30 días.
// - Nunca si ya está instalada (modo standalone o `appinstalled`) ni si el
//   navegador no puede instalar (sin `beforeinstallprompt` y no es iOS, donde
//   se enseñan las instrucciones de "Añadir a pantalla de inicio").
//
// En `localStorage` solo se guarda lo que la persona respondió: cuándo dijo
// «Ahora no» o que ya la instaló. Sin respuesta no se guarda nada. Una
// lectura rota o bloqueada no rompe nada: se empieza de cero.
// ============================================================

export const INSTALL_STORAGE_KEY = "kultura.pwa.install";
export const DISMISS_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
export const DISMISS_MS = DISMISS_DAYS * DAY_MS;

export interface InstallState {
  /** Cuándo se descartó por última vez (ms). */
  dismissedAt?: number;
  /** Instalada desde este navegador (`appinstalled` o diálogo aceptado). */
  installed?: boolean;
}

export const EMPTY_STATE: InstallState = {};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseInstallState(raw: string | null | undefined): InstallState {
  if (!raw) return { ...EMPTY_STATE };
  const parsed = JSON.parse(raw) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") return { ...EMPTY_STATE };
  return {
    ...(finite(parsed.dismissedAt) ? { dismissedAt: parsed.dismissedAt } : {}),
    ...(parsed.installed === true ? { installed: true } : {}),
  };
}

/** Lee y valida el estado; cualquier cosa rara vale como "nada guardado". */
export function readInstallState(storage: StorageLike | null | undefined): InstallState {
  try {
    return parseInstallState(storage?.getItem(INSTALL_STORAGE_KEY));
  } catch {
    return { ...EMPTY_STATE };
  }
}

/** Guarda solo la respuesta; si no hay nada que recordar, borra la clave. */
export function writeInstallState(storage: StorageLike | null | undefined, state: InstallState): void {
  try {
    const clean = parseInstallState(JSON.stringify(state));
    if (Object.keys(clean).length === 0) storage?.removeItem(INSTALL_STORAGE_KEY);
    else storage?.setItem(INSTALL_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Modo privado o cuota llena: el aviso simplemente podrá volver a salir.
  }
}

/**
 * Limpia lo que guardaban versiones anteriores (`visits`, `lastSeenAt`):
 * reescribe la clave con solo la respuesta, o la borra si no hay ninguna.
 * No toca nada si ya está limpia.
 */
export function pruneInstallState(storage: StorageLike | null | undefined): void {
  try {
    const raw = storage?.getItem(INSTALL_STORAGE_KEY);
    if (!raw) return;
    let clean: InstallState;
    try {
      clean = parseInstallState(raw);
    } catch {
      clean = {};
    }
    if (raw !== JSON.stringify(clean)) writeInstallState(storage, clean);
  } catch {
    // Almacenamiento bloqueado: nada que limpiar.
  }
}

export function dismiss(state: InstallState, now: number): InstallState {
  return { ...state, dismissedAt: now };
}

export function markInstalled(state: InstallState): InstallState {
  return { ...state, installed: true };
}

/** `/es/library`, `/en/library/…` (con o sin barra final o consulta). */
export function isLibraryPath(pathname: string | null | undefined): boolean {
  return /^\/(?:es|en)\/library(?:[/?#]|$)/.test(pathname ?? "");
}

export type InstallPlatform = "ios" | "android" | "desktop";

/**
 * iOS e iPadOS (que se presenta como Mac con pantalla táctil). En iOS no hay
 * `beforeinstallprompt`: se instala desde la hoja de Compartir.
 */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

export interface OfferInput {
  state: InstallState;
  now: number;
  pathname: string | null | undefined;
  /** Ya se ejecuta instalada (`display-mode: standalone` o `navigator.standalone`). */
  standalone: boolean;
  /** Hay un `beforeinstallprompt` guardado (Chrome, Edge, Samsung…). */
  canPrompt: boolean;
  platform: InstallPlatform;
}

export function shouldOfferInstall({ state, now, pathname, standalone, canPrompt, platform }: OfferInput): boolean {
  if (standalone || state.installed) return false;
  if (!canPrompt && platform !== "ios") return false;
  if (state.dismissedAt !== undefined && now - state.dismissedAt < DISMISS_MS && now >= state.dismissedAt) {
    return false;
  }
  return isLibraryPath(pathname);
}
