# B3.5c-2-VERIFY — Verificación visual del usuario

## Qué cambia
Nada de código. El usuario abre la app en `npm run dev` y confirma que B3.5c-2 funciona sin regresiones.

## Cómo sé que funciona
El usuario confirma:
- Los 3 enlaces (chat, lists, suggestions) aparecen en NavLinks (desktop).
- Chat aparece en BottomNav (mobile), sustituyendo a Search.
- En `/es/home`, click switcher → `/en/home` → textos del Home cambian a inglés (HeroSection, AiRecommendations, PopularInCircle, GenreNews).
- En `/discover`, el tab "comic" NO aparece.
- `/media/comic/123` da 404.
- Ningún flujo previo se rompe (login, library, friends, profile).

## Archivos que toco
Ninguno. Solo verificación.

## Cuándo paro
Tras pegar los resultados de la verificación visual.
