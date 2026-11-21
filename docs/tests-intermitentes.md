# Tests intermitentes

Saneamiento 12.4. Un test que falla sin cambios en lo que prueba se apunta aquí con su motivo y una fecha límite para arreglarlo. Mientras tanto se puede saltar con `it.skip` y un comentario que remita a este archivo, nunca más allá de la fecha límite. Relanzar el CI hasta que pase no cuenta como arreglo.

Revisado el 15-11-2026 con los fallos del CI desde el 7-11 (`gh run list --workflow ci.yml`, ejecuciones fallidas y relanzadas).

## En cuarentena

Ninguno.

## Arreglados

| Test | Fallo | Motivo | Arreglo |
| --- | --- | --- | --- |
| `tests/integration/db/friends.test.ts`, `library-upsert.test.ts`, `rls-policies.test.ts` | Filas de otro test, `23505`, estados cruzados (11-11) | Dos ejecuciones a la vez contra `kultura-test` con los mismos usuarios fijos | El job de integración corre de uno en uno (`concurrency: integration-test-db` en `ci.yml`). Sin fallos desde el 11-11. |
| `tests/unit/identity/home-identity.test.tsx` · nombre generado | `expected 'NO' not to be 'NO'` (11-11) | El test exigía que las iniciales no fueran «NO» (las del email «nombre@…»), pero el nombre aleatorio a veces empezaba por «no» | Compara las iniciales con las del nombre generado (#104). |
| `tests/unit/components/home/AiRecommendations.test.tsx` · foco | `toHaveFocus()` (13-11, #162) | El foco llega en un `useEffect` después de pintar; con la suite cargada iba un tick por detrás | `waitFor` sobre el foco (este PR). |
| `tests/unit/components/auth/register-form.test.tsx` · «Revisa tu correo» | `h.replace` llamado (15-11, con cobertura) | El test anterior acababa al llamar a `signUp` y su redirección a `/welcome` llegaba en el siguiente | El test anterior espera la redirección (#165). No bastó: ver la fila siguiente. |
| `tests/unit/components/auth/register-form.test.tsx` · «Revisa tu correo» (recaída) | `h.replace` llamado con `/es/welcome?next=%2Fes%2Fhome` (18-11, en `master` y en local; con carga, otros dos tests del archivo) | Defecto del test, no del formulario. El alta con sesión avisa al callback con `fetch` antes de redirigir (`recordImmediateSignup`, hasta 3,5 s) y el test no ponía doble: la petición salía de verdad a `localhost:3000` y la redirección llegaba cuando contestara la red. Dos tests dejaban el alta a medias: «llama a signUp con emailRedirectTo…» no esperaba nada, y el arreglo de #165 esperaba «alguna» redirección, que podía ser la del test anterior; la suya caía dos tests después | `fetch` con doble en `beforeEach`; los dos tests esperan SU redirección (con su destino) y un `afterEach` espera una redirección por cada `signUp` con sesión, así que ningún test deja un alta a medias. Comprobado repitiendo el archivo solo: antes 10 fallos de 12, después 0 de 30. Con la suite entera, las dos versiones del archivo a la vez en 5 pasadas: la anterior falló en las 5, la nueva en ninguna. |
| `tests/unit/csp/static-csp.test.ts`, `tests/unit/plataforma/next-config.test.ts` | `Hook timed out in 10000ms` (15-11, con cobertura) | Importar `next.config.mjs` (arrastra Sentry) pasa de 10 s con la medición | `beforeAll` con 30 s (#165). |
| `tests/unit/push/push-offer.test.tsx` · Esc cierra | `aside` sigue en el DOM (16-11, #171; otra vez el 16-11 en #198) | El listener de Esc se engancha en un `useEffect` después de pintar: ni el contenedor ni la X garantizan que ya escuche | Primero esperaba a la X (#171); no bastó. Ahora pulsa Esc dentro del `waitFor` hasta que cierra (este PR). |
| `tests/unit/progress/home-progress-columns.test.tsx` | `Test timed out in 5000ms` (16-11, en local con la suite completa, #186) | El `import()` de la página de Inicio estaba dentro del test y con la suite cargada pasaba de 5 s | El import va en `beforeAll` con 30 s (este PR). |
| `tests/unit/design/sala-title.test.ts` · propiedad (1 a 120 caracteres) | `Test timed out in 5000ms` (20-11, en local con la suite completa y con tres agentes a la vez) | Miles de composiciones por test: trabajo de CPU que con la máquina cargada pasa de 5 s | `describe` con 30 s (este PR). |

## Vigilados

| Test | Último fallo | Nota |
| --- | --- | --- |
| `tests/e2e/a11y/push-offer.spec.ts:46` · aviso de push en el chat (`movil-390`) | 7-11 (en `master`) y 9-11 (rama de la UI v2) | Sin fallos desde que se quitó la UI v2 (#95) y se rehízo el chat (#123). Si vuelve a fallar, pasa a cuarentena con fecha. |
| `tests/unit/ai/home-page-recs.test.tsx` | 21-11 (en local, con un `next build` a la vez) | Pasó de 13 s; con la máquina libre pasa (6 de 6). Si falla en el CI, a cuarentena con fecha. |
| `tests/unit/progress/library-route-progress.test.ts` | 21-11 (en local, con la suite completa) | Un `Test timed out in 5000ms` y un fallo de comparación que viene de él; solo pasa (12 de 12). Mismo patrón que `home-progress-columns`: probar el import en `beforeAll`. |
| `tests/unit/library/route.test.ts` y `tests/unit/diary/library-route.test.ts` | 20-11 (en local, con un build a la vez) | `Test timed out in 5000ms`; solos pasan. Mismo patrón de import pesado dentro del test. |
| `tests/unit/import/tmdb-find.test.ts` | 20-11 (en local) | Visto una vez durante la 8.4; sin reproducir. |
