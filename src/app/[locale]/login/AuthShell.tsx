import type { Ref } from "react";
import { Link } from "@/i18n/navigation";
import { AlbumPage } from "@/components/album/AlbumPage";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils/index";

/**
 * La etiqueta blanca de la tapa del álbum («este álbum es de…»), donde va el
 * formulario: papel blanco, raya de 2 px en tinta y radio de contenedor. Sin
 * sombra (nada en reposo). La usa también /welcome.
 */
export const AUTH_CARD =
  "w-full rounded-bento border-2 border-text-primary bg-surface-default p-6 md:p-8";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

interface AuthShellProps {
  /** Lo que va en la etiqueta: el formulario o el aviso. */
  children: React.ReactNode;
  /** Nombre accesible del logotipo, que lleva a la portada. */
  backLabel: string;
  /** Titular de la tapa (el h1 de la página). */
  title: React.ReactNode;
  /** Para llevar el foco al titular (p. ej. al pasar a «Revisa tu correo»). */
  titleRef?: Ref<HTMLHeadingElement>;
  /** Una línea bajo el titular. */
  lead?: React.ReactNode;
  /** El sobre con los cromos: a la derecha en escritorio, bajo la etiqueta en móvil. */
  aside?: React.ReactNode;
  cardClassName?: string;
}

/**
 * Portada de acceso = la tapa del álbum: campo cian de imprenta a toda la
 * página, el titular en tinta marina, la etiqueta blanca con el formulario y,
 * al lado, el sobre del que salen los cromos. El formulario está en el HTML
 * desde el primer pintado; el sobre llega aparte y nunca lo retrasa.
 */
export function AuthShell({ children, backLabel, title, titleRef, lead, aside, cardClassName }: AuthShellProps) {
  return (
    <AlbumPage as="main" id="main" tone="cyan" className="min-h-dvh">
      <div className="flex min-h-dvh flex-col pb-10 pt-2 md:pt-4">
        <Link
          href="/"
          aria-label={backLabel}
          className={cn("inline-flex min-h-11 items-center self-start rounded-lg", FOCUS)}
        >
          <Logo size={28} />
        </Link>
        <div
          className={cn(
            "flex flex-1 flex-col gap-10 pt-6 md:pt-10",
            aside != null && "lg:grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:pt-0"
          )}
        >
          <div className="flex w-full min-w-0 max-w-md flex-col gap-6">
            <div>
              <h1
                ref={titleRef}
                tabIndex={titleRef ? -1 : undefined}
                className="text-balance font-display text-3xl text-text-primary outline-none lg:text-5xl"
              >
                {title}
              </h1>
              {lead ? <p className="mt-3 font-body text-base text-text-primary">{lead}</p> : null}
            </div>
            <div className={cn("theme-paper", AUTH_CARD, cardClassName)}>{children}</div>
          </div>
          {aside != null ? <div className="w-full min-w-0 max-w-md lg:max-w-none">{aside}</div> : null}
        </div>
      </div>
    </AlbumPage>
  );
}
