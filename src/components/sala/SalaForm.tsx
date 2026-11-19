"use client";

import * as React from "react";
import { SalaFormContext, salaFieldAnnouncement } from "./SalaField";

/**
 * Formulario de «Sala» (fase 8.4): un `<form>` nativo que, al enviar con
 * errores, hace lo que si no cada pantalla tendría que copiar.
 *
 * La validación y los textos son de la pantalla: en `onSubmit` valida y pasa
 * a cada campo su `error`. Después de pintar, el formulario:
 *
 * 1. **Lleva el foco al primer campo con error** (el primero con
 *    `aria-invalid`, en el orden de la página; en un grupo de radios, a la
 *    opción elegida o a la primera). El lector lee el campo con su error.
 * 2. **Anuncia una vez cuántos campos hay que corregir**, en un `role="status"`
 *    propio, con el texto de `errorSummary`. Si el foco ya estaba en ese
 *    primer campo (enviar con Enter), el lector no lo vuelve a leer: el aviso
 *    añade entonces la etiqueta y el error de ese campo.
 * 3. **Hace callar a los campos** en ese envío: no anuncian cada uno su error,
 *    todos a la vez y sin decir de quién es.
 *
 * Fuera de un envío (validar al salir de un campo), cada campo anuncia el suyo.
 *
 * ```tsx
 * <SalaForm onSubmit={alEnviar} errorSummary={(n) => t("form.errors", { count: n })}>
 *   <SalaInput label={t("name")} name="name" error={errores.name} />
 *   <SalaButton type="submit">{t("save")}</SalaButton>
 * </SalaForm>
 * ```
 *
 * - `ref`, `className` y el resto de props llegan al `<form>`.
 * - `noValidate` va puesto: los globos del navegador salen en el idioma del
 *   navegador, no en el de la interfaz, y no se pueden escribir. Con
 *   `noValidate={false}` vuelven.
 * - **Errores que llegan después** (los devuelve el servidor): en el mismo
 *   manejador que los pone, `handle.current.reportErrors()` hace lo mismo que
 *   un envío. Sin esa llamada, cada campo anuncia el suyo con su etiqueta.
 * - El aviso se retira cuando se cambia algo en el formulario o se vacía.
 */
export interface SalaFormHandle {
  /** Foco al primer campo con error y aviso, para errores que no salen de un envío. */
  reportErrors: () => void;
}

export interface SalaFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  /** El aviso a partir de cuántos campos hay que corregir («Hay 3 campos por corregir»), ya traducido. */
  errorSummary: (count: number) => string;
  handle?: React.Ref<SalaFormHandle>;
}

/** Dónde se pone el foco: un grupo no lo admite; va a su opción elegida o a la primera. */
function destino(campo: HTMLElement): HTMLElement {
  if (campo.tagName !== "FIELDSET") return campo;
  return campo.querySelector<HTMLElement>("input:checked:enabled") ?? campo.querySelector<HTMLElement>("input:enabled, select:enabled, textarea:enabled, button:enabled") ?? campo;
}

export const SalaForm = React.forwardRef<HTMLFormElement, SalaFormProps>(function SalaForm(
  { errorSummary, handle, onSubmit, onChange, onReset, noValidate = true, children, ...props },
  ref
) {
  const propio = React.useRef<HTMLFormElement | null>(null);
  const silent = React.useRef(false);
  const contexto = React.useMemo(() => ({ silent }), []);
  /** Cada envío (o `reportErrors`) es una vez más: da cuenta después de pintar. */
  const [vez, setVez] = React.useState(0);
  const [aviso, setAviso] = React.useState({ texto: "", vez: 0 });

  const resumen = React.useRef(errorSummary);
  React.useLayoutEffect(() => {
    resumen.current = errorSummary;
  });

  const reportErrors = React.useCallback(() => {
    silent.current = true;
    setVez((antes) => antes + 1);
  }, []);
  React.useImperativeHandle(handle, () => ({ reportErrors }), [reportErrors]);

  // Corre después de los efectos de los campos, que ya han visto `silent`.
  React.useEffect(() => {
    if (!vez) return;
    silent.current = false;
    const malos = Array.from(propio.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? []);
    if (malos.length === 0) {
      setAviso({ texto: "", vez });
      return;
    }
    const primero = malos[0];
    const yaEstaba = primero.contains(document.activeElement);
    // Primero el foco y después el aviso: el lector lee el campo y luego la cuenta.
    if (!yaEstaba) destino(primero).focus();
    const cuenta = resumen.current(malos.length);
    setAviso({ texto: yaEstaba ? `${cuenta} ${salaFieldAnnouncement(primero)}` : cuenta, vez });
  }, [vez]);

  const unir = React.useCallback(
    (nodo: HTMLFormElement | null) => {
      propio.current = nodo;
      if (typeof ref === "function") ref(nodo);
      else if (ref) ref.current = nodo;
    },
    [ref]
  );

  const callar = () => setAviso((antes) => (antes.texto ? { ...antes, texto: "" } : antes));

  return (
    <form
      ref={unir}
      noValidate={noValidate}
      onSubmit={(event) => {
        reportErrors();
        onSubmit?.(event);
      }}
      onChange={(event) => {
        callar();
        onChange?.(event);
      }}
      onReset={(event) => {
        callar();
        onReset?.(event);
      }}
      {...props}
    >
      <SalaFormContext.Provider value={contexto}>{children}</SalaFormContext.Provider>
      {/* Cada aviso es un nodo nuevo: el mismo texto dos veces seguidas se vuelve a anunciar. */}
      <p role="status" data-sala-form-status="" className="sr-only">
        {aviso.texto ? <span key={aviso.vez}>{aviso.texto}</span> : null}
      </p>
    </form>
  );
});
