# VOZ v2 — cómo suena KULTURA 2.0

Complementa el brief (`docs/02_DISEÑO_BRIEF.md` §A). Las **reglas mecánicas** del `VOZ.md` de la raíz (tuteo, ICU, comillas «», «…» de un carácter, glosario y sus tests) **siguen vigentes**. Este archivo añade lo que cambia en la v2: el registro, cuántas palabras caben y qué no se dice nunca. Cuando la UI v2 sirva el 100 %, los dos se funden en uno (paso 5 o F3).

## Registro
- **Cómplice, no simpática.** Habla como alguien que va por el mismo episodio que tú. No explica la app ni vende. No hace chistes en la interfaz: si hay un guiño, va en el 404, en el estado vacío o al completar una serie, nunca en errores, legal o borrado.
- **Exacta.** Un dato antes que un adjetivo: «Te quedan 3 episodios», no «¡Ya casi lo tienes!».
- **Corta.** Una idea por frase y ≤ 12 palabras por frase en la interfaz.
- **Sin signos de exclamación** en la interfaz. La celebración la pone el gesto (D4 del brief), no la puntuación.

## Presupuesto de palabras (se mide en la captura de 390)
| Superficie | Límite |
|---|---|
| Titular | ≤ 32 caracteres; 2 líneas como máximo con zoom por defecto (con zoom 200 % puede partirse, sin desbordar) |
| Frase de apoyo | ≤ 90 caracteres, una sola |
| Pantallazo de la portada | ≤ 40 palabras visibles, contando botones y pie |
| Botón | verbo + objeto, ≤ 3 palabras («Crear cuenta», «Marcar visto») |
| Estado vacío | ≤ 2 frases + 1 botón |
| Error | causa + salida, ≤ 2 frases (regla 4 del `VOZ.md` de la raíz) |

## Lo que no se dice nunca (lista negra)
- Micro-copy de SaaS: «Empieza gratis», «Potencia tu…», «Descubre», «Todo en un solo lugar», «La mejor forma de…», «Únete a miles».
- Dinero en la portada: precio, «gratis», donar, apoyo (D4). «Sin anuncios» va en el Manifiesto, no en la portada.
- Cifras sin fuente: «miles de usuarios», «la comunidad más grande».
- IA en la portada.
- «Sustituto de TV Time» o cualquier mención a competidores en la portada. En las páginas «Vengo de…» de F4 sí se nombran, porque es su función.
- **El eco de lo que escribe el usuario:** ni «Resultados para "…"» ni «Hola, {nombre}» como titular. El nombre del usuario solo aparece donde es un dato (su perfil y su menú). No se prohíbe el campo en sí; para que no se pierda el contexto, la búsqueda cumple tres cosas:
  1. el campo conserva lo escrito y queda visible (fijo) al desplazarse;
  2. un `aria-live` anuncia el recuento («12 resultados», ICU);
  3. sin resultados, se da una salida (otra búsqueda o importar), sin repetir la consulta.
- Instrucciones de uso de un control («Haz clic aquí para…», «Desliza para…»): si un control necesita explicación, se rediseña.

## Palabras de la cuña
| Concepto | Usar | No usar |
|---|---|---|
| Unidad de serie | **episodio** (una palabra por concepto) | capítulo, ep., cap. |
| Notación | **T2 E5** en ES y **S2 E5** en EN, cada una con su clave; el lector oye «Temporada 2, episodio 5» (`aria-label`) | 2x05, S02E05 en español |
| Unidad en los demás formatos (pack, P3 del brief) | manga y cómic: **cap. 112**; libro: **p. 240**; juego: **12 h**; película: **48 min** (lo que falta). Cada una con su clave ES/EN y su `aria-label` completo («capítulo 112») | mezclar unidades en un mismo dato |
| El conjunto de formatos | no se nombra en la interfaz: se enseña con portadas (P1 del brief). «Pack» es una palabra interna | «7 formatos», «todo en un solo lugar», «multiformato» |
| Ver uno | **Marcar visto** | Check, completar episodio |
| Ir al día | **al día** | actualizado, sincronizado |
| Lo que te falta | **{n, plural, one {te queda # episodio} other {te quedan # episodios}}** (el verbo también concuerda) | pendientes ({n}) como titular |
| Lo tuyo | **tus datos**, **exportar** | backup, descarga de información |

Los títulos de obras en otro idioma llevan `lang` (por ejemplo, `lang="en"`) para que el lector los pronuncie bien.

## Qué reglas del `VOZ.md` de la raíz se anulan en v2
| Raíz | v2 | Motivo |
|---|---|---|
| Ejemplo de botón «Crear mi cuenta gratis» | «Crear cuenta» | X4/X12: sin dinero ni «gratis» en la portada |
| Estado vacío «Buscar mi primer título» (4 palabras) | «Buscar una serie» | botón ≤ 3 palabras |
| Nota del titular «cine» y «juegos» por ritmo (D-11) | obsoleta | el titular nuevo es de series (§A.3 del brief) |
| Regla 5, «humor medido» | se mantiene, más restringida: el guiño solo va en el 404, en los estados vacíos o al completar | registro «cómplice» |

Cuando la v2 sirva el 100 %, estas filas pasan al `VOZ.md` único y a `glossary.test.ts` (paso 5 o F3). Hasta entonces, los tests siguen las reglas de la raíz.

## Ejemplos (antes → v2)
| Antes | v2 |
|---|---|
| «Organiza todo lo que ves, lees y juegas en un solo lugar» | «Tus series, al día.» (D-F2a) |
| «¡Empieza gratis!» | «Crear cuenta» |
| «Resultados de búsqueda para "breaking"» | (sin rótulo: los resultados) |
| «Aún no has añadido ningún título a tu biblioteca. ¡Explora y añade!» | «Aquí irá lo que veas.» · botón «Buscar una serie» |
| «Has completado la serie. ¡Enhorabuena!» | «Completada. 62 episodios.» (estado del glosario: Completado) |

## Inglés
Se genera, no se traduce (`VOZ.md` de la raíz). Mismos límites de caracteres; si no caben, se reescribe la frase. La paridad ES/EN es obligatoria, pero el EN no bloquea.
