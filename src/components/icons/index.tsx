// ============================================================
// KULTURA — Sistema de iconos propio (F1b)
// Sustituye lucide-react. Todos los iconos: formas RELLENAS (currentColor),
// geometría chunky/redondeada — nunca el trazo fino de las librerías
// estándar (Feather/Heroicons/Material). viewBox 24x24 consistente.
//
// Uso: idéntico a un icono de lucide-react en className, pero SIN las
// props `size`/`strokeWidth` (que no existen en SVG estándar) — el tamaño
// se controla por className (Tailwind `w-*/h-*`) igual que ya hacía FilterBar.
// ============================================================

import type { SVGProps } from 'react'

export type KIcon = (props: SVGProps<SVGSVGElement>) => React.JSX.Element

function base(props: SVGProps<SVGSVGElement>) {
  return { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, ...props }
}

/** Inicio — casa: tejado triangular redondeado fusionado con el cuerpo. */
export const IconHome: KIcon = (props) => (
  <svg {...base(props)}>
    <polygon points="12 2.5 22 11 2 11" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round" />
    <rect x="4.5" y="10" width="15" height="11.5" rx="2.5" />
  </svg>
)

/** Descubrir — brújula/estrella de 4 puntas con centro hueco (recorte SVG real, no asume fondo). */
export const IconCompass: KIcon = (props) => (
  <svg {...base(props)}>
    <path
      fillRule="evenodd"
      d="M12 1.5c.9 3.2 2.3 5.2 5 6.5s3.3 4.1 5 5c-3.2.9-5.2 2.3-6.5 5s-4.1 3.3-5 5c-.9-3.2-2.3-5.2-5-6.5s-3.3-4.1-5-5c3.2-.9 5.2-2.3 6.5-5s4.1-3.3 5-5zM12 9.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2z"
    />
  </svg>
)

/** Chat — bocadillo con cola. */
export const IconChat: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.6 4V16A2.5 2.5 0 0 1 4 13.5v-8z" />
  </svg>
)

/** Biblioteca — libro abierto (dos páginas fusionadas en el lomo). */
export const IconLibrary: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M12 5.2C10.1 3.9 7.6 3.3 4.8 3.5A1.3 1.3 0 0 0 3.6 4.8v12.6c0 .8.7 1.4 1.5 1.3 2.4-.2 4.6.3 6.3 1.4V5.2z" />
    <path d="M12 5.2c1.9-1.3 4.4-1.9 7.2-1.7 .7 0 1.2.6 1.2 1.3v12.6c0 .8-.7 1.4-1.5 1.3-2.4-.2-4.6.3-6.3 1.4V5.2z" opacity="0.55" />
  </svg>
)

/** Más — tres píldoras (eco del icono de marca), no tres puntos genéricos. */
export const IconMore: KIcon = (props) => (
  <svg {...base(props)}>
    <rect x="2.5" y="10.7" width="7" height="4.4" rx="2.2" transform="rotate(-8 6 13)" />
    <rect x="8.5" y="9.8" width="7" height="4.4" rx="2.2" transform="rotate(6 12 12)" />
    <rect x="14.5" y="10.7" width="7" height="4.4" rx="2.2" transform="rotate(-4 18 13)" />
  </svg>
)

/** Amigos — dos cabezas + cuerpos solapados. */
export const IconFriends: KIcon = (props) => (
  <svg {...base(props)}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.5 20.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z" />
    <circle cx="16.5" cy="7.5" r="2.6" opacity="0.55" />
    <path d="M14.8 13.3c.9-.4 1.8-.6 2.7-.6 2.9 0 5 1.9 5 5.2h-4.3" opacity="0.55" />
  </svg>
)

/** Grupos — tres cabezas en clúster. */
export const IconGroups: KIcon = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="6.6" r="3.1" />
    <circle cx="5.6" cy="10.2" r="2.4" opacity="0.55" />
    <circle cx="18.4" cy="10.2" r="2.4" opacity="0.55" />
    <path d="M12 11.2c-4 0-7 2.6-7 6.4v2.9h14v-2.9c0-3.8-3-6.4-7-6.4z" />
  </svg>
)

/** Listas — pilas de tarjetas apiladas (tu biblioteca en filas). */
export const IconLists: KIcon = (props) => (
  <svg {...base(props)}>
    <rect x="3" y="4.2" width="18" height="4.6" rx="2.3" />
    <rect x="3" y="9.7" width="18" height="4.6" rx="2.3" opacity="0.75" />
    <rect x="3" y="15.2" width="18" height="4.6" rx="2.3" opacity="0.5" />
  </svg>
)

/** Sugerencias — bombilla redondeada. */
export const IconIdea: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.45.8 1 .8 1.7v.5h6v-.5c0-.7.2-1.25.8-1.7A6.5 6.5 0 0 0 12 2.5z" />
    <rect x="9" y="18" width="6" height="2" rx="1" />
    <rect x="9.6" y="20.4" width="4.8" height="1.6" rx="0.8" />
  </svg>
)

/** Buscar — lente sólida chunky. Monocromo (currentColor): el punto de color es
 * exclusivo del logotipo/marca, no de iconografía funcional — y --accent-danger
 * es semánticamente "solo destructivo" (ver globals.css), no aplica aquí. */
export const IconSearch: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M9 2c3.9 0 7 3.1 7 7 0 1.7-.6 3.2-1.6 4.4l5.1 5.1c.5.5.5 1.3 0 1.8s-1.3.5-1.8 0l-5.1-5.1C11.2 16.4 9.7 17 8 17c-3.9 0-7-3.1-7-7s3.1-7 7-7z" />
  </svg>
)

/** Destellos — recomendación IA: cúmulo de 2 estrellas de 4 puntas. */
export const IconSparkles: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M8 2c.6 2.3 1.6 3.6 3.6 4.4-2 .8-3 2.1-3.6 4.4-.6-2.3-1.6-3.6-3.6-4.4C6.4 5.6 7.4 4.3 8 2z" />
    <path d="M16.5 9c.9 3.3 2.3 5.1 5 6-2.7.9-4.1 2.7-5 6-.9-3.3-2.3-5.1-5-6 2.7-.9 4.1-2.7 5-6z" opacity="0.7" />
  </svg>
)

/** Campana de notificaciones. */
export const IconBell: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M12 2.3c-.8 0-1.4.6-1.4 1.4v.6C7.5 4.9 5.4 7.4 5.4 10.4v4L3.8 16.9c-.4.5 0 1.3.7 1.3h15c.7 0 1.1-.8.7-1.3l-1.6-2.5v-4c0-3-2.1-5.5-5.2-6.1v-.6c0-.8-.6-1.4-1.4-1.4z" />
    <path d="M9.3 20.2a2.7 2.7 0 0 0 5.4 0z" />
  </svg>
)

/** Invitar/añadir persona — cabeza+cuerpo con badge "+". */
export const IconUserPlus: KIcon = (props) => (
  <svg {...base(props)}>
    <circle cx="10" cy="8" r="3.6" />
    <path d="M3 20.5c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5z" />
    <rect x="17.2" y="3" width="3" height="8" rx="1.5" />
    <rect x="14.2" y="6" width="9" height="3" rx="1.5" />
  </svg>
)

/** Rejilla "todos" — 2x2 bloques redondeados. */
export const IconGrid: KIcon = (props) => (
  <svg {...base(props)}>
    <rect x="3" y="3" width="8" height="8" rx="2.4" />
    <rect x="13" y="3" width="8" height="8" rx="2.4" opacity="0.7" />
    <rect x="3" y="13" width="8" height="8" rx="2.4" opacity="0.7" />
    <rect x="13" y="13" width="8" height="8" rx="2.4" opacity="0.45" />
  </svg>
)

/** Género — etiqueta con ojal hueco (recorte SVG real, no asume fondo). */
export const IconTag: KIcon = (props) => (
  <svg {...base(props)}>
    <path
      fillRule="evenodd"
      d="M3 4.8C3 3.8 3.8 3 4.8 3h7.6c.5 0 1 .2 1.4.6l7.2 7.2c.8.8.8 2 0 2.8l-7.8 7.8c-.8.8-2 .8-2.8 0L3.2 14.2c-.4-.4-.6-.9-.6-1.4zM7.6 5.8a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"
    />
  </svg>
)

/** Año — calendario con banda separadora hueca (recorte SVG real, no asume fondo). */
export const IconCalendar: KIcon = (props) => (
  <svg {...base(props)}>
    <path
      fillRule="evenodd"
      d="M6,5 H18 A3,3 0 0 1 21,8 V18 A3,3 0 0 1 18,21 H6 A3,3 0 0 1 3,18 V8 A3,3 0 0 1 6,5 Z M3,9.5 H21 V12.1 H3 Z"
    />
    <rect x="6.4" y="2" width="2.6" height="5" rx="1.3" />
    <rect x="15" y="2" width="2.6" height="5" rx="1.3" />
  </svg>
)

/** Valoración — estrella de 5 puntas. */
export const IconStar: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M12 2.2l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 16.9l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.7z" />
  </svg>
)

/** Plataforma — pantalla + peana. */
export const IconMonitor: KIcon = (props) => (
  <svg {...base(props)}>
    <rect x="2.5" y="4" width="19" height="13" rx="2.4" />
    <rect x="9.5" y="18.3" width="5" height="2" rx="1" />
    <rect x="7.5" y="20.5" width="9" height="1.8" rx="0.9" />
  </svg>
)

/** Duración — reloj con anillo hueco y manecillas. */
export const IconClock: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M12 2a10 10 0 1 0 .001 20A10 10 0 0 0 12 2zm0 3.2a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6z" />
    <rect x="11" y="7.5" width="2" height="5.2" rx="1" />
    <rect x="11.9" y="11.3" width="4.6" height="2" rx="1" transform="rotate(45 12 12)" />
  </svg>
)

/** Idioma — globo con meridiano y ecuador huecos (recorte SVG real, no asume fondo). */
export const IconGlobe: KIcon = (props) => (
  <svg {...base(props)}>
    <path
      fillRule="evenodd"
      d="M2.5,12 A9.5,9.5 0 1 0 21.5,12 A9.5,9.5 0 1 0 2.5,12 Z M2.5,11.25 H21.5 V12.75 H2.5 Z M11.25,2.5 H12.75 V21.5 H11.25 Z"
    />
  </svg>
)

/** Estado — línea de actividad/pulso. */
export const IconActivity: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M2.5 12h4l2-6 4 12 2-9 1.5 3h5.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Temporadas/volúmenes — capas apiladas. */
export const IconLayers: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M12 2.5l9 4.6-9 4.6-9-4.6z" />
    <path d="M3 12.3l9 4.6 9-4.6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    <path d="M3 16.8l9 4.6 9-4.6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
  </svg>
)

/** Colección/tomos — dos libros apilados. */
export const IconVolumes: KIcon = (props) => (
  <svg {...base(props)}>
    <rect x="3" y="3.5" width="18" height="6" rx="2" opacity="0.6" />
    <rect x="3" y="11.5" width="18" height="9" rx="2" />
  </svg>
)

/** Estudio/editorial — edificio con ventanas y puerta huecas (recorte SVG real, no asume fondo). */
export const IconStudio: KIcon = (props) => (
  <svg {...base(props)}>
    <path
      fillRule="evenodd"
      d="M6,3 H18 A2,2 0 0 1 20,5 V20 A2,2 0 0 1 18,22 H6 A2,2 0 0 1 4,20 V5 A2,2 0 0 1 6,3 Z
         M7,6.5 H10 V9.5 H7 Z
         M13,6.5 H16 V9.5 H13 Z
         M7,12 H10 V15 H7 Z
         M13,12 H16 V15 H13 Z
         M9.5,17.5 H14.5 V22 H9.5 Z"
    />
  </svg>
)

/** Formato — página con esquina doblada y líneas de texto huecas (recorte SVG real, no asume fondo). */
export const IconFormat: KIcon = (props) => (
  <svg {...base(props)}>
    <path
      fillRule="evenodd"
      d="M6 2.5h8l5 5V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z
         M14,2.5 V7 A1,1 0 0 0 15,8 H19 Z
         M7.5,13 H16.5 V14.8 H7.5 Z
         M7.5,16.4 H13.5 V18.2 H7.5 Z"
    />
  </svg>
)

/** Modo de juego — mando chunky con cruceta y botones huecos (recorte SVG real, no asume fondo). */
export const IconGamepad: KIcon = (props) => (
  <svg {...base(props)}>
    <path
      fillRule="evenodd"
      d="M6.5 6h11a5 5 0 0 1 4.9 6l-.7 3.5a2.6 2.6 0 0 1-4.6 1.1L15.8 15h-7.6l-1.3 1.6a2.6 2.6 0 0 1-4.6-1.1L1.6 12A5 5 0 0 1 6.5 6z
         M6,9.2 H7.8 V13.8 H6 Z
         M4.6,10.6 H9.2 V12.4 H4.6 Z
         M15.7,9.6 A1.3,1.3 0 1 0 18.3,9.6 A1.3,1.3 0 1 0 15.7,9.6 Z
         M13.3,12 A1.3,1.3 0 1 0 15.9,12 A1.3,1.3 0 1 0 13.3,12 Z"
    />
  </svg>
)

/** Duración de partida — cronómetro (peana lateral lo distingue del reloj). */
export const IconTimer: KIcon = (props) => (
  <svg {...base(props)}>
    <rect x="9.5" y="1.5" width="5" height="2.4" rx="1.2" />
    <path d="M12 4.8a8.6 8.6 0 1 0 .001 17.2A8.6 8.6 0 0 0 12 4.8zm0 2.9a5.7 5.7 0 1 1 0 11.4 5.7 5.7 0 0 1 0-11.4z" />
    <rect x="11" y="9.5" width="2" height="4.6" rx="1" />
  </svg>
)

/** Orden — dos flechas chunky. */
export const IconSort: KIcon = (props) => (
  <svg {...base(props)}>
    <polygon points="7 2.5 11.5 8.5 2.5 8.5" />
    <polygon points="17 21.5 12.5 15.5 21.5 15.5" opacity="0.6" />
  </svg>
)

/** Chevron abajo — triángulo chunky, no el trazo fino habitual. */
export const IconChevronDown: KIcon = (props) => (
  <svg {...base(props)}>
    <polygon points="4 8 20 8 12 17" />
  </svg>
)

/** Chevron arriba. */
export const IconChevronUp: KIcon = (props) => (
  <svg {...base(props)}>
    <polygon points="4 16 20 16 12 7" />
  </svg>
)

/** Dado — cara "5": cuerpo redondeado + 5 pips (círculos huecos vía evenodd). */
export const IconDice: KIcon = (props) => (
  <svg {...base(props)}>
    <path
      fillRule="evenodd"
      d="M5.5,3 H18.5 A2.5,2.5 0 0 1 21,5.5 V18.5 A2.5,2.5 0 0 1 18.5,21 H5.5 A2.5,2.5 0 0 1 3,18.5 V5.5 A2.5,2.5 0 0 1 5.5,3 Z
         M7.1,5.7 A1.6,1.6 0 1 0 7.1,8.9 A1.6,1.6 0 1 0 7.1,5.7 Z
         M16.9,5.7 A1.6,1.6 0 1 0 16.9,8.9 A1.6,1.6 0 1 0 16.9,5.7 Z
         M7.1,15.1 A1.6,1.6 0 1 0 7.1,18.3 A1.6,1.6 0 1 0 7.1,15.1 Z
         M16.9,15.1 A1.6,1.6 0 1 0 16.9,18.3 A1.6,1.6 0 1 0 16.9,15.1 Z
         M12,10.4 A1.6,1.6 0 1 0 12,13.6 A1.6,1.6 0 1 0 12,10.4 Z"
    />
  </svg>
)

/** Película — claqueta: barra superior a rayas + cuerpo. */
export const IconFilm: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M3 8.3l1-3.6a1.2 1.2 0 0 1 1.47-.85l13 3.5a1.2 1.2 0 0 1 .85 1.47L18.8 10 3 8.3z" />
    <path
      d="M6.3 4.2l3 3.4-2 .5-3-3.3z M11 5.5l3 3.4-2 .5-3-3.4z M15.7 6.7l3 3.4-2 .5-3-3.4z"
      opacity="0.55"
    />
    <rect x="3" y="10" width="18" height="10.5" rx="2.2" />
  </svg>
)

/** Serie/TV — pantalla con antenas diagonales. */
export const IconTv: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M7.8 4.3l3.7 3.2h1l3.7-3.2c.4-.4 1-.4 1.4.1.3.4.3.9-.1 1.3l-2.2 1.9h3.2A2.5 2.5 0 0 1 21 10.1v7.4a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 17.5v-7.4a2.5 2.5 0 0 1 2.5-2.5h3.2L6.5 5.7c-.4-.4-.4-.9-.1-1.3.4-.5 1-.5 1.4-.1z" />
  </svg>
)

/** Anime — torii chunky (pilares + dinteles curvados). */
export const IconAnime: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M2.3 6.6c0-.8.6-1.3 1.4-1.1 5.6 1.2 10.9 1.2 16.5 0 .8-.2 1.5.3 1.5 1.1 0 .7-.4 1.2-1.1 1.4-.5.1-1 .2-1.5.3v1.3c0 .8-.6 1.4-1.4 1.4S16.3 10.3 16.3 9.5V8.6c-2.9.4-5.7.4-8.6 0v.9c0 .8-.6 1.4-1.4 1.4S5 10.1 5 9.3V8c-.5-.1-1-.2-1.5-.3-.7-.2-1.2-.7-1.2-1.1z" />
    <rect x="5" y="11.2" width="2.6" height="9.3" rx="1.3" />
    <rect x="16.4" y="11.2" width="2.6" height="9.3" rx="1.3" />
    <rect x="4.2" y="13.6" width="15.6" height="2.2" rx="1.1" opacity="0.6" />
  </svg>
)

/** Cómic — estallido de acción (burst) en vez de estrella de 5 puntas. */
export const IconComic: KIcon = (props) => (
  <svg {...base(props)}>
    <path d="M12 1.5l1.8 4.6 4.3-2.6-1.2 4.8 4.9-.6-3.4 3.6 4.4 2.4-4.8.9 2.4 4.3-4.7-1.7.3 4.9-3.6-3.4-2.2 4.4-1.3-4.8-4.1 2.9.9-4.9-4.9.2 3.1-3.9-4.6-2 4.4-2.6L2 8.8l4.9.4-.9-4.8 4.2 2.7z" />
  </svg>
)

/** Manga — tomo con lomo a la derecha (lectura JP) y solapa de cubierta hueca. */
export const IconManga: KIcon = (props) => (
  <svg {...base(props)}>
    <path
      fillRule="evenodd"
      d="M4.5,3 H15.5 A1.5,1.5 0 0 1 17,4.5 V19.5 A1.5,1.5 0 0 1 15.5,21 H4.5 A1.5,1.5 0 0 1 3,19.5 V4.5 A1.5,1.5 0 0 1 4.5,3 Z
         M6.5,6.2 H13.5 V7.6 H6.5 Z
         M6.5,9.4 H11.5 V10.8 H6.5 Z"
    />
    <rect x="18" y="3" width="3" height="18" rx="1.4" opacity="0.55" />
  </svg>
)
