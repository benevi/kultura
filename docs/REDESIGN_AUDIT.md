# KULTURA — Auditoría y estado del rediseño v2 (2026-11-09)

Rama `feat/v2-rediseno-integral`. Todo va tras el interruptor `ui_v2`: sin cookie ni `UI_V2_DEFAULT=1` la web sigue igual (comprobado: `/es` sin cookie sirve la v1).

## 1. Estado de partida
- Next.js 15.5.28, React 19, next-intl, Supabase, Vercel Hobby. 45 `page.tsx` bajo `[locale]`, 51 rutas de API. Inventario por flujo: `docs/FUNCIONES_V2.md`.
- La v1 canaliza casi todo el color por variables CSS (`globals.css`, `tailwind.config.ts`). Eso permite cambiar la identidad sin tocar cada pantalla.
- Rutas cacheables (`STATIC_CSP_ROUTES`: portada, rankings, legales, offline, cuñas) no pueden leer cookies.
- Problemas heredados: identidad genérica (píldoras, rosa de acción, grano), portada v1 en 149.793 B de 153.600 B.

## 2. Dirección: «Láminas»
Cada obra es un bloque de láminas; cada lámina, un episodio, tomo o capítulo. El canto del bloque es tu progreso. Siete letras en KULTURA, siete formatos, siete colores planos, sin inventar significado para el logotipo: la coincidencia 7 = 7 es solo un recurso gráfico, y el logotipo existente se conserva.

Referencias, sin copiar: Bruno Simon (objeto 3D con personalidad que reacciona al cursor), Immersive Garden (scroll narrativo), Dropbox Brand (tipografía protagonista, paleta controlada).

## 3. Qué se ha hecho
| Pieza | Archivo | Alcance |
|---|---|---|
| Tokens | `src/v2/tokens.css` | Color, tipo, espacio, movimiento y botón |
| Piel | `src/v2/skin.css`, `src/v2/V2Scope.tsx` | Re-valora los tokens v1 en toda ruta dinámica, portales incluidos |
| Bloque-logotipo | `src/v2/Blocks.tsx` | Portada y acceso |
| Portada | `src/v2/portada/*`, `portada-v2/page.tsx`, rewrite en `src/middleware.ts` | **Reconstruida** |
| 3D | `src/v2/portada/portada.css` | Solo CSS. El motor WebGL se retiró (D-V2h) |

### Alcance real por pantalla
- **Reconstruida:** portada (`/es`, `/en`).
- **Piel + ajustes propios, verificada con captura:** login/registro (`AuthShell`), ficha (`media`, con color por formato).
- **Piel, sin captura porque exige sesión:** home, discover, search, library, lists, profile, settings, import, calendar, chat, groups, friends, notifications, suggestions, welcome. **No verificadas visualmente.**
- **Piel, sin captura:** perfiles públicos `u/*`, report, reset-password, email/*.
- **Sin piel hasta `UI_V2_DEFAULT`:** rankings `best/*`, legales, offline, cuñas `series`/`anime` (estáticas, no leen la cookie). Con `UI_V2_DEFAULT=1` tampoco la reciben hoy: falta decidir cómo (ver §7).
- **No reconstruidas:** el master prompt pide rediseñar todas. Aquí hay identidad común, no una composición nueva por pantalla. Es la parte pendiente más grande.

## 4. Tecnología y por qué
- **Sin Three.js ni GSAP:** la portada v1 ya rozaba los 150 KB; WebGL propio y scroll propio dejan la v2 en 148.300 B. Decisión técnica: si se quiere GSAP en pantallas interiores, se mide antes.
- **CSS plano con prefijo `k2-`:** Tailwind tiene escalas cerradas vigiladas por tests y ESLint.
- **Colores en `oklch` en `skin.css`:** el `color-mix` de `tailwind.config.ts` deja sin matiz un hex (el hueso salía rosa).
- **Rewrite en middleware:** `/es` es estática; el middleware corre antes y sirve otra ruta sin cambiar la URL.

## 5. Contraste (texto `--k-ink` sobre color de formato)
Series 5,89 · Películas 12,74 · Anime 7,63 · Manga 16,37 · Libros 7,66 · Cómics 5,13 · Juegos 14,85. Todos ≥ 4,5:1. axe confirma sin serious/critical en las rutas de §6.

## 6. Informe de pruebas (build de producción local, 2026-11-09)
| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit`, `npx next lint` | Limpios |
| `npx vitest run` | 15 fallan, 4667 pasan. Antes de la rama fallaban 16: esos 15 y `register-form`, intermitente por tiempo |
| Fuga a la v1 | `/es/login` sin cookie: bloque `display:none`. Con cookie: `grid`, 7 columnas, a 390 y 1440 |
| axe a 1440 y 390 | 0 serious/critical: portada es/en, reduced-motion, sin WebGL, login, ficha |
| Desbordamiento horizontal | 0 en todas |
| Reduced-motion y sin WebGL | El motor no arranca; queda la imagen fija |
| `+1`, cambio de obra, `aria-pressed` | Episodio 4→5, Anime activo |
| Enlaces | Alta `?mode=register`, entrar `?mode=login`, demo por POST (`/api/auth/demo`). La demo no se probó: sin `DEMO_USER_EMAIL` local |
| `/es/portada-v2` directa | 404 con CSP y `no-store` |
| JS `/es` (build final) | v2 148.365 B, v1 148.467 B (presupuesto 153.600) |
| JS `/es/login` tras cargar | v2 257.363 B, v1 261.717 B. Por encima de 150 KB ya en la v1; la v2 no lo empeora. Ficha v2: 316.017 B, sin comparar con v1 |
| CLS | 0,000 portada, 0,000 login, 0,044 ficha (una medida anterior dio 0,010) |
| Lighthouse móvil, 1 pasada local, antes de los últimos arreglos | Rendimiento 94, Accesibilidad 100, Buenas prácticas 96, SEO 100. LCP 2,9 s (aviso, presupuesto 2,5 s). Buenas prácticas baja por los 404 de `/_vercel/*`, que solo existen en Vercel |
| `impeccable detect` en `src/v2` | Sin hallazgos |
| `taste inspect` en `/es` v2 | Ver abajo |

**Hallazgos de `taste inspect`:** titulares de 3 líneas (decisión: el muro «Ves. Lees. Juegas.»), texto tapado por las hojas apiladas (es el recurso), `ui-wrapper` (falso positivo: confunde nuestro `data-ui`), `few-pictures` (las portadas son `lazy` y no llegaron a cargar), `still-page` (el movimiento es del canvas). `broken-image`: ver §8. Huecos a 768: se agrandó la portada de las hojas, sin volver a medir.

**No probado:** CUJ con BD real, pantallas con sesión, dispositivos físicos, Safari y Firefox, el 3D en GPU real con 60 fps medidos (se vio en GTX 1070, sin medir fps), Lighthouse en Vercel.

## 7. Riesgos y decisiones abiertas
1. **Caché de `/es` en el CDN:** el revisor lo da por correcto según la documentación de Vercel (el middleware corre antes de la caché). **Sin probar:** en una preview, pedir `/es` con y sin `ui_v2=1` y mirar `x-vercel-cache` y ETag antes de activar `UI_V2_DEFAULT`.
2. **Estáticas sin piel:** con `UI_V2_DEFAULT=1` hay que encenderlas en build, o reescribirlas como la portada.
3. **`+1` de la portada es una muestra:** no guarda nada ni se presenta como dato de nadie.
4. **Choque con el plan:** §6 pide puertas y aprobación antes de construir; el master prompt pide no parar. Manda el prompt de Víctor; la rama y el interruptor protegen producción, y el merge sigue requiriendo su OK.

## 8. Dudas sin resolver
- La build local mostró portadas rotas `image.tmdb.org/.../a11y-550.jpg` en dos hojas. El prefijo `a11y-` solo existe en `tests/e2e/a11y/`, así que apunta a una caché local de una prueba anterior (**no verificado**). Se comprueba en la preview.
- El aviso de hidratación del login en desarrollo no se investigó: no aparece en la build de producción.

## 9. Portada rehecha (2026-11-09, sustituye a lo dicho sobre la portada en §2–§6)
Abanico de portadas + lista «Sigue por donde ibas» (D-V2h). Datos de un build de producción local:

| Puerta | Resultado |
|---|---|
| `tsc`, lint | Limpios |
| `vitest` | 16 fallos: los 15 heredados de Windows/CRLF y `register-form`, por tiempo (pasa solo) |
| 8 escenarios (es/en 1440, 390, 1920, 768, 1366×650, reduced-motion, sin WebGL) | Sin desbordamiento, 0 imágenes rotas, axe sin serious/critical |
| Consola | Solo 2 errores: `_vercel/*`, inexistentes en local |
| JS inicial | 144 KB transferidos (tope 150 KB); `next build` da 121 kB |
| CLS | 0,000 |
| TBT | 63–66 ms |
| LCP móvil simulado | **6,0 s: por encima del aviso de 2,5 s.** Tope de aviso, no de error. Sin medir en Vercel |
| Imágenes | 1.315 KB (antes 2.530 KB) |

**Sin probar:** preview de Vercel, Safari, Firefox, táctil real, lector de pantalla real, fallo real de proveedores. **Abierto:** licencias de imágenes de TMDB, AniList, Steam y Open Library.
