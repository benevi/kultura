# VOZ.md — cómo habla KULTURA

Guía de textos de la interfaz (es-ES y en). Va con `DISENO.md`: aquel dice cómo se ve, este cómo suena. Los textos viven en `messages/es.json` y `messages/en.json`; lo que se puede comprobar solo lo comprueban los tests de `tests/unit/i18n/`.

## La voz en diez líneas

1. **Tú, siempre.** Nunca «usted». El plural («montad listas entre todos») solo cuando el texto habla a un grupo.
2. **Lo hace una persona.** En sugerencias, legal y errores graves, primera persona del singular: «lo leo yo», «escríbeme». En el resto, «nosotros» ligero («no hemos podido guardarlo»).
3. **Directo y concreto.** Qué pasa y qué puedes hacer. Nada de «Ha ocurrido un error inesperado». Frases cortas; una idea por frase.
4. **Cada error dice causa y salida.** «No hemos podido guardarlo. Revisa la conexión y reintenta.» Prohibido «Error al…» / «Failed to…» a secas (test).
5. **Humor medido.** Un guiño donde no estorba (la demo, el 404, las pegatinas). Nunca en errores con pérdida de datos, legal o borrado de cuenta.
6. **No prometas lo que no hay.** Nada de «tu IA cree que…»: la IA recomienda cuando la pides y con tope diario. «Gratis y sin anuncios» solo mientras sea verdad.
7. **Sin mayúsculas sostenidas** salvo en las pegatinas (claves `*Badge`) y las siglas. El énfasis lo pone el diseño, no el texto (test).
8. **Sin emojis en los textos.** Los iconos salen de `src/components/icons`; los glifos ★ (nota) y ▶ (seguir) sí valen (test).
9. **Tipografía:** «…» de un carácter (test), comillas «» en español y “ ” en inglés, raya — solo para incisos, cifras con el formato del idioma (`{n, number}`).
10. **Plurales con ICU, siempre.** Nada de «{count} títulos»: `{count, plural, one {# título} other {# títulos}}`. Un «1 títulos» rompe el test.

## Glosario

| Concepto | Español | Inglés | No usar |
|---|---|---|---|
| Lo que has guardado | Biblioteca, «Mi biblioteca» | Library, «My library» | colección, registro, archivo |
| Agrupación que creas | Lista | List | colección |
| Página pública de alguien | Colección («La colección de X») | Collection | — (solo ahí) |
| Estados | Pendiente · En curso · Completado · Abandonado | Pending · In progress · Completed · Dropped | En progreso, Abandoned |
| Configuración de la cuenta | Ajustes | Settings | Configuración |
| Dirección de correo | Correo electrónico (etiqueta), correo (en frase) | Email address (etiqueta), email | email, e-mail |
| Entrar | Entrar / Iniciar sesión | Sign in | Log in, Login |
| Formatos | Película(s), Serie(s), Anime, Manga, Videojuego(s), Libro(s), Cómic(s) | Movie(s), TV show(s), Anime, Manga, Game(s), Book(s), Comic(s) | TV Shows (en mayúsculas), Shōnen (macrones) |
| Puntuar | Nota, puntuar | Rating, rate | Puntuación (solo en filtros de mínimo) |
| Apunte del diario | Apunte | Entry | registro, log |

En la portada, el titular usa «cine» y «juegos» por ritmo (D-11); el resto de la interfaz, las palabras de la tabla.

En inglés: ortografía de EE. UU. (catalog, favorites, canceled) y *sentence case* («My library», no «My Library»). El inglés se escribe, no se traduce: si una frase no suena nativa, se reescribe entera.

## Patrones

| Situación | Patrón | Ejemplo |
|---|---|---|
| Estado vacío | Qué verás aquí + cómo empezar + botón con verbo | «Aún no hay nada aquí» · «Busca algo que hayas visto…» · «Buscar mi primer título» |
| Error recuperable | Qué no ha salido + qué hacer | «Ahora mismo no llegamos a los catálogos. Reintenta en un minuto.» |
| Límite de uso | Por qué + cuánto esperar | «Hay mucha gente consultando. Dale unos segundos y reintenta.» |
| Confirmación destructiva | Pregunta corta + consecuencia + botón con el verbo | «¿Eliminar esta lista?» · «Se eliminará para todos los miembros.» · «Eliminar» |
| Botón | Verbo + objeto, sin «Haz clic» | «Crear mi cuenta gratis», «Reintentar» |
| Contador | ICU plural; si la cifra va aparte, la etiqueta concuerda | `{count, plural, one {título} other {títulos}}` |

## Cómo se comprueba

- `missing-messages.test.ts`: toda clave que pide el código existe en los dos idiomas (ningún `MISSING_MESSAGE`).
- `dead-keys.test.ts`: ninguna clave sobra ni se repite sin motivo.
- `icu.test.ts`: ICU válido, mismos valores en es y en, el código pasa todos, y ningún «1 títulos».
- `glossary.test.ts`: el glosario y las reglas 4, 7, 8 y 9 de arriba.
- `jsx-strings.test.ts`: ningún texto fijo ni emoji en el JSX; lo que queda, en su lista de deuda con el archivo.
- Lo que no se puede comprobar con un test (tono, naturalidad del inglés) se revisa a mano en cada PR que toque textos.
