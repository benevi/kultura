// @vitest-environment node
/**
 * TXT-8: ni claves muertas ni duplicadas.
 *
 * - Muertas: toda clave de es.json la usa el código (ver `usage.ts`). Una
 *   clave preparada para un componente que aún no la lee va en
 *   `PENDING_WIRING` con el archivo que la tiene que usar; si ya se usa, el
 *   test pide quitarla de la lista.
 * - Duplicadas: dentro de un namespace, dos claves con el mismo texto en los
 *   dos idiomas son la misma frase dos veces (pasó con los dos estados vacíos
 *   de la biblioteca). Las que repiten texto a propósito, porque hacen papeles
 *   distintos (el título de la página y su `<title>`), van en
 *   `SAME_TEXT_DIFFERENT_ROLE` con el motivo.
 *
 * El bloque `push` (notificaciones) lo mantiene su propio frente y no entra.
 */
import { describe, it, expect } from "vitest";
import en from "../../../messages/en.json";
import { flatten } from "./scan";
import { ES, usedKeys } from "./usage";

type Tree = { [key: string]: string | Tree };
const EN = flatten(en as Tree);
const OWN = (k: string) => !(k === "push" || k.startsWith("push."));
const USED = usedKeys();

/** Clave → archivo que la tiene que leer (no se ha podido tocar aquí). */
export const PENDING_WIRING: Record<string, string> = {};

/** Grupos de claves con el mismo texto a propósito, con el motivo. */
const SAME_TEXT_DIFFERENT_ROLE: { keys: string[]; why: string }[] = [
  { keys: ["media_detail.steamFree", "media_detail.watchType.free"], why: "precio de Steam y tipo de oferta en streaming" },
  { keys: ["share.og.genericAlt", "share.page.genericMetaTitle"], why: "alt de la imagen y <title> de la página" },
  { keys: ["library.counters.inProgress", "library.status.in_progress"], why: "contador de la barra y estado del selector" },
  { keys: ["diary.title", "diary.viewDiary"], why: "título de la sección y pestaña de la vista" },
  { keys: ["lists.descriptionHint", "lists.noteHint"], why: "contador de caracteres de dos campos distintos" },
  { keys: ["lists.noteFor", "lists.noteLabel"], why: "nombre accesible y etiqueta visible del mismo campo" },
  { keys: ["import.diaryImported", "import.summary.logs"], why: "resultado final y vista previa del archivo" },
  { keys: ["friends.friends", "friends.title"], why: "pestaña y título de la página" },
  { keys: ["groups.private", "groups.privateBadge"], why: "opción del formulario y etiqueta de la tarjeta" },
  { keys: ["settings.changeEmailCancel", "settings.deleteAccountCancel"], why: "botón de cancelar de dos formularios" },
  { keys: ["calendar.nav.label", "calendar.title"], why: "enlace de navegación (viaja en el shell) y título de la página" },
  { keys: ["email.optin.greeting", "email.weekly.greeting"], why: "saludo de dos correos distintos" },
  { keys: ["email.confirm.calendar", "email.weekly.cta"], why: "botón de la página de confirmación y del correo" },
  { keys: ["email.unsubscribe.confirm", "email.weekly.unsubscribe"], why: "botón de la página de baja y enlace del correo" },
  { keys: ["email.confirm.invalidTitle", "email.unsubscribe.invalidTitle"], why: "páginas de confirmación y de baja" },
  { keys: ["email.confirm.retry", "email.unsubscribe.retry"], why: "páginas de confirmación y de baja" },
  { keys: ["email.confirm.settings", "email.unsubscribe.settings"], why: "páginas de confirmación y de baja" },
  { keys: ["email.confirm.confirm", "email.optin.cta"], why: "botón de la página y del correo de alta" },
  { keys: ["report.errorReason", "report.page.errors.reason"], why: "diálogo con sesión y formulario público" },
  { keys: ["report.page.submit", "report.submit"], why: "formulario público y diálogo con sesión" },
  { keys: ["landing.hero.sub", "landing.seo.description"], why: "D-11: la misma promesa en el hero y en la meta description" },
  { keys: ["discoverFilters.options.sort.rating", "discoverFilters.trigger.valoracion"], why: "opción de orden y botón del filtro" },
  { keys: ["discoverFilters.trigger.estado", "discoverFilters.trigger.status"], why: "filtro de estado de publicación y de biblioteca" },
  { keys: ["discoverFilters.options.temporadas.7plus", "discoverFilters.options.valoracion.7"], why: "temporadas y nota mínima" },
  { keys: ["discoverFilters.options.demografia.kids", "discoverFilters.options.genre.infantil"], why: "demografía de manga y género" },
  { keys: ["legal.footerPrivacy", "legal.nav.privacy"], why: "pie de página y navegación entre documentos" },
  { keys: ["legal.footerTerms", "legal.nav.terms"], why: "pie de página y navegación entre documentos" },
  { keys: ["legal.nav.notice", "legal.notice.title"], why: "navegación y título del documento" },
  { keys: ["legal.notice.updated", "legal.privacy.updated", "legal.terms.updated"], why: "cada documento lleva su fecha" },
  { keys: ["legal.notice.version", "legal.privacy.version", "legal.terms.version"], why: "cada documento lleva su versión" },
  { keys: ["legal.privacy.sections.minors.title", "legal.terms.sections.age.title"], why: "sección de dos documentos distintos" },
  { keys: ["legal.notice.sections.law.title", "legal.terms.sections.law.title"], why: "sección de dos documentos distintos" },
  { keys: ["pwa.offline.metaTitle", "pwa.offline.title"], why: "<title> y h1 de la página" },
  { keys: ["collection.heading", "collection.metaTitle"], why: "h1 y <title> de la página" },
];

/**
 * Frases largas repetidas en DOS namespaces: el mismo texto mantenido dos
 * veces. Cada grupo dice por qué (los textos viajan al navegador por
 * namespaces y una zona no ve los de otra) o qué componente lo resuelve.
 */
const CROSS_NAMESPACE_DEBT: Record<string, string> = {
  "auth.valueLine invite.bannerText": "login (shell) y banner de invitación (/u): proveedores distintos",
  "landing.seo.title meta.defaultTitle": "D-11: la misma promesa en la landing y en el título por defecto",
  "onboarding.nameReserved settings.errorUsernameReserved": "/welcome y Ajustes: proveedores distintos",
};

describe("TXT-8 — sin claves muertas", () => {
  it("toda clave de es.json la usa el código", () => {
    const dead = Array.from(ES.keys()).filter((k) => OWN(k) && !USED.has(k) && !(k in PENDING_WIRING));
    expect(dead).toEqual([]);
  });

  it("las claves pendientes de conectar existen y siguen sin usarse", () => {
    for (const [key, file] of Object.entries(PENDING_WIRING)) {
      expect(ES.has(key), key).toBe(true);
      expect(USED.has(key), `${key} ya se usa: quitarla de PENDING_WIRING (${file})`).toBe(false);
    }
  });
});

describe("TXT-8 — sin claves duplicadas", () => {
  it("ningún namespace repite el mismo texto en los dos idiomas", () => {
    const allowed = new Set(SAME_TEXT_DIFFERENT_ROLE.map((g) => [...g.keys].sort().join(" ")));
    const groups = new Map<string, string[]>();
    for (const [key, value] of Array.from(ES)) {
      if (!OWN(key)) continue;
      const id = [key.split(".")[0], value, EN.get(key)].join("\u0000");
      groups.set(id, [...(groups.get(id) ?? []), key]);
    }
    const dupes = Array.from(groups.values())
      .filter((keys) => keys.length > 1)
      .map((keys) => keys.sort().join(" "))
      .filter((g) => !allowed.has(g));
    expect(dupes).toEqual([]);
  });

  it("ninguna frase larga se repite entre namespaces (salvo la deuda conocida)", () => {
    const groups = new Map<string, string[]>();
    for (const [key, value] of Array.from(ES)) {
      // Los contadores ICU ("# título") se repiten a propósito en cada sitio.
      if (!OWN(key) || value.length < 40 || /^\{\w+, plural,/.test(value)) continue;
      const id = `${value}\u0000${EN.get(key)}`;
      groups.set(id, [...(groups.get(id) ?? []), key]);
    }
    const cross = Array.from(groups.values())
      .filter((keys) => new Set(keys.map((k) => k.split(".")[0])).size > 1)
      .map((keys) => keys.sort().join(" "));
    expect(cross.sort()).toEqual(Object.keys(CROSS_NAMESPACE_DEBT).sort());
  });

  it("la lista de duplicados a propósito no tiene grupos que ya no existen", () => {
    for (const g of SAME_TEXT_DIFFERENT_ROLE) {
      const values = new Set(g.keys.map((k) => `${ES.get(k)}\u0000${EN.get(k)}`));
      expect(values.size, g.keys.join(" ")).toBe(1);
      expect(g.why.length).toBeGreaterThan(10);
    }
  });
});
