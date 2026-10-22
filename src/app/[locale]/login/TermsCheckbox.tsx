"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";

interface TermsCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Mensaje de error (casilla obligatoria sin marcar). */
  error?: string;
}

const LINK =
  "font-bold text-text-primary underline underline-offset-4 hover:text-accent-pink";

/**
 * SEG-7: casilla obligatoria "tengo 14 años o más y acepto los términos y la
 * privacidad" del registro por email y del paso 1 de /welcome (alta con
 * Google). Casilla nativa (teclado y lector gratis) con el acento pink y la
 * fila entera de 44 px como zona táctil; los enlaces abren en otra pestaña
 * para no perder lo escrito.
 */
export const TermsCheckbox = forwardRef<HTMLInputElement, TermsCheckboxProps>(
  function TermsCheckbox({ id, checked, onChange, error }, ref) {
    const t = useTranslations("auth");
    const errorId = `${id}-error`;
    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={id}
          className={cn(
            "flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[14px] bg-surface-elevated px-[18px] py-3",
            error && "outline outline-1 outline-accent-danger"
          )}
        >
          <input
            ref={ref}
            id={id}
            name="terms"
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-accent-pink"
          />
          <span className="font-body text-[13px] leading-5 text-text-secondary">
            {t.rich("termsLabel", {
              terms: (chunks) => (
                <Link href="/terms" target="_blank" rel="noopener" className={LINK}>
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" target="_blank" rel="noopener" className={LINK}>
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {error && (
          <p id={errorId} role="alert" className="px-1 font-body text-[13px] text-accent-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);
