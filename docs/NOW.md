# B3.5c-3-VERIFY — Verificación visual del usuario

## Qué cambia
Nada de código. El usuario abre la app en `npm run dev` (que apunta a Supabase producción) y confirma que los 4 bugs están arreglados.

## Cómo sé que funciona

- /chat: elegir amigo → redirige a /chat/[id] sin error 500
- /groups/[id]: publicar post → aparece en el feed; si falla, mensaje de error visible
- /notifications: página carga sin crash, items con texto coherente
- /discover: grid con cards para tab movie/tv (anime/manga pueden estar vacíos por rate-limit Jikan, OK)
- Ningún flujo previo se rompe (login, library, friends, profile)
- **Bonus check:** tras enviar un mensaje en /chat, confirmar que la URL final es `/[locale]/chat/[id]` (con prefijo de locale). Si aterriza en `/chat/[id]` sin prefijo, anotar — es bug real para B3.5c-4 (`ChatClient.tsx:69` usa `window.location.href` sin locale).

## Archivos que toco
Ninguno.

## Cuándo paro
Tras pegar los resultados (✓/✗ por check + observaciones).
