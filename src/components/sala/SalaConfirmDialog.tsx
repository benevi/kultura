"use client";

import * as React from "react";
import type { ImagePalette } from "@/lib/design/image-palette";
import { SalaButton } from "./SalaButton";
import { SalaDialog } from "./SalaDialog";

/**
 * Confirmación de «Sala» (fase 8.4), sobre `SalaDialog`. Convive con
 * `ConfirmModal`. Para preguntar antes de algo que no tiene vuelta atrás.
 *
 * - Es un `alertdialog`: el lector lee el título y el mensaje al abrir.
 * - **El foco empieza en lo seguro**, que es cancelar. Enter recién abierto no
 *   borra nada.
 * - **Sin cierre accidental.** No lleva aspa (repetiría «Cancelar») y pulsar
 *   fuera no lo cierra: una pregunta se contesta. Escape sí, y cancela.
 *   Mientras confirma (`loading`) no cierra nada.
 * - `danger` pinta la confirmación de peligro. El color no lo dice solo:
 *   `confirmLabel` nombra lo que se pierde («Borrar la lista», no «Aceptar»).
 * - Cancelar va primero y confirmar al final, a la derecha; si no caben, una
 *   debajo de otra y a todo el ancho.
 * - `error`: si confirmar falla, se ve y se anuncia dentro del diálogo.
 * - `children`: campos entre el mensaje y los botones (la contraseña para
 *   borrar la cuenta).
 */
export interface SalaConfirmDialogProps {
  open: boolean;
  title: React.ReactNode;
  /** Qué va a pasar y qué se pierde. */
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Acción destructiva: la confirmación va de peligro. */
  danger?: boolean;
  /** Confirmando: el botón espera y el diálogo no se puede cerrar. */
  loading?: boolean;
  /** Lo que oye el lector mientras confirma, ya traducido. Obligatorio si se usa `loading`. */
  loadingLabel?: string;
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  error?: string | null;
  children?: React.ReactNode;
  palette?: ImagePalette;
}

export function SalaConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
  loading = false,
  loadingLabel,
  finalFocusRef,
  error = null,
  children,
  palette,
}: SalaConfirmDialogProps) {
  return (
    <SalaDialog
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      role="alertdialog"
      showClose={false}
      closeOnOutside={false}
      dismissible={!loading}
      finalFocusRef={finalFocusRef}
      error={error}
      palette={palette}
      footer={
        <>
          <SalaButton variant="secondary" onClick={onCancel} disabled={loading} data-autofocus="" className="max-sm:w-full">
            {cancelLabel}
          </SalaButton>
          <SalaButton
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            loadingLabel={loadingLabel ?? confirmLabel}
            className="max-sm:w-full"
          >
            {confirmLabel}
          </SalaButton>
        </>
      }
    >
      {children}
    </SalaDialog>
  );
}
