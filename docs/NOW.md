# B3.5c-3-VERIFY-RETRY — Verificación visual completa del usuario

## Qué cambia
Nada de código. El usuario repite los 6 checks de B3.5c-3-VERIFY tras el fix de recursión RLS.

## Cómo sé que funciona
- /chat: redirige a /[locale]/chat/[id] sin error 500 ✓
- /groups/[id]: post se publica ✓
- /notifications: carga sin crash ✓
- /discover: tab movie con cards ✓
- Sin regresiones en login, library, friends, profile ✓
- Bonus: redirect de chat respeta locale prefix (E26 en BACKLOG si no)

## Archivos que toco
Ninguno.

## Cuándo paro
Tras pegar resultados de verificación visual.
