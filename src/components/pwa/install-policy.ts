// ============================================================
// KULTURA — Cuándo ofrecer "Instalar la app" (MOV-3). Lógica pura.
//
// - Se ofrece en la 2.ª visita o en la 1.ª entrada en la biblioteca.
// - "Visita" = volver tras 30 min sin actividad (como una sesión de analítica).
// - Descartado ("Ahora no", la X o cancelar el diálogo nativo): no reaparece
//   en 30 días.
// - Nunca si ya está instalada (modo standalone o `appinstalled`) ni si el
//   navegador no puede instalar (sin `beforeinstallprompt` y no es iOS, donde
//   se enseñan las instrucciones de "Añadir a pantalla de inicio").
//
// El estado vive en `localStorage` del dispositivo (no es analítica: D-12 no
// aplica; solo recuerda si ya se le preguntó). Una lectura rota o bloqueada
// no rompe nada: se empieza de cero.
// ============================================================

export const INSTALL_STORAGE_KEY = "kultura.pwa.install";
export const DISMISS_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
export const DISMISS_MS = DISMISS_DAYS * DAY_MS;
export const VISIT_GAP_MS = 30 * 60 * 1000;

export interface InstallState {
  /** Visitas contadas (ver `VISIT_GAP_MS`). */
  visits: number;
  /** Última actividad (ms), para saber si esta carga es una visita nueva. */
  lastSeenAt: number;
  /** Cuándo se descartó por última vez (ms). */
  dismissedAt?: number;
  /** Instalada desde este navegador (`appinstalled` o diálogo aceptado). */
  installed?: boolean;
}

export const EMPTY_STATE: InstallState = { visits: 0, lastSeenAt: 0 };

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Lee y valida el estado; cualquier cosa rara vale como "nada guardado". */
export function readInstallState(storage: StorageLike | null | undefined): InstallState {
  try {
    const raw = storage?.getItem(INSTALL_STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    const parsed = JSON.parse(raw) as Partial<InstallState> | null;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_STATE };
    return {
      visits: finite(parsed.visits) && parsed.visits >= 0 ? Math.floor(parsed.visits) : 0,
      lastSeenAt: finite(parsed.lastSeenAt) ? parsed.lastSeenAt : 0,
      ...(finite(parsed.dismissedAt) ? { dismissedAt: parsed.dismissedAt } : {}),
      ...(parsed.installed === true ? { installed: true } : {}),
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function writeInstallState(storage: StorageLike | null | undefined, state: InstallState): void {
  try {
    storage?.setItem(INSTALL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Modo privado o cuota llena: el aviso simplemente podrá volver a salir.
  }
}

/** Cuenta una visita si hace más de `VISIT_GAP_MS` de la última actividad. */
export function registerVisit(state: InstallState, now: number): InstallState {
  const isNewVisit = !state.lastSeenAt || now - state.lastSeenAt > VISIT_GAP_MS || now < state.lastSeenAt;
  return { ...state, visits: state.visits + (isNewVisit ? 1 : 0), lastSeenAt: now };
}

export function dismiss(state: InstallState, now: number): InstallState {
  return { ...state, dismissedAt: now };
}

export function markInstalled(state: InstallState): InstallState {
  return { ...state, installed: true };
}

/** `/es/library`, `/en/library/…` (con o sin barra final). */
export function isLibraryPath(pathname: string | null | undefined): boolean {
  return /^\/(?:es|en)\/library(?:\/|$)/.test(pathname ?? "");
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
  return state.visits >= 2 || isLibraryPath(pathname);
}
