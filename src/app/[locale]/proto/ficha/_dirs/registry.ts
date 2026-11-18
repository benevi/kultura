// Prototipo fase 8.3 — registro de direcciones. Es de la BASE: quien construye
// B o C no lo toca; solo rellena su carpeta (`Ficha.tsx`, `fonts.ts`, su CSS).

import type { ComponentType } from "react";
import type { DirId, DirectionProps } from "../_base/types";
import FichaA from "./a/Ficha";
import { fontClassName as fontsA } from "./a/fonts";
import FichaB from "./b/Ficha";
import { fontClassName as fontsB } from "./b/fonts";
import FichaC from "./c/Ficha";
import { fontClassName as fontsC } from "./c/fonts";

export const DIRECTIONS: Record<DirId, { Ficha: ComponentType<DirectionProps>; fontClassName: string }> = {
  a: { Ficha: FichaA, fontClassName: fontsA },
  b: { Ficha: FichaB, fontClassName: fontsB },
  c: { Ficha: FichaC, fontClassName: fontsC },
};
