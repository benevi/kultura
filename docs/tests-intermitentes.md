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
| `tests/unit/components/auth/register-form.test.tsx` · «Revisa tu correo» | `h.replace` llamado (15-11, con cobertura) | El test anterior acababa al llamar a `signUp` y su redirección a `/welcome` llegaba en el siguiente | El test anterior espera la redirección (#165). |
| `tests/unit/csp/static-csp.test.ts`, `tests/unit/plataforma/next-config.test.ts` | `Hook timed out in 10000ms` (15-11, con cobertura) | Importar `next.config.mjs` (arrastra Sentry) pasa de 10 s con la medición | `beforeAll` con 30 s (#165). |
| `tests/unit/push/push-offer.test.tsx` · Esc cierra | `aside` sigue en el DOM (16-11, #171; otra vez el 16-11 en #198) | El listener de Esc se engancha en un `useEffect` después de pintar: ni el contenedor ni la X garantizan que ya escuche | Primero esperaba a la X (#171); no bastó. Ahora pulsa Esc dentro del `waitFor` hasta que cierra (este PR). |
| `tests/unit/progress/home-progress-columns.test.tsx` | `Test timed out in 5000ms` (16-11, en local con la suite completa, #186) | El `import()` de la página de Inicio estaba dentro del test y con la suite cargada pasaba de 5 s | El import va en `beforeAll` con 30 s (este PR). |

## Vigilados

| Test | Último fallo | Nota |
| --- | --- | --- |
| `tests/e2e/a11y/push-offer.spec.ts:46` · aviso de push en el chat (`movil-390`) | 7-11 (en `master`) y 9-11 (rama de la UI v2) | Sin fallos desde que se quitó la UI v2 (#95) y se rehízo el chat (#123). Si vuelve a fallar, pasa a cuarentena con fecha. |
