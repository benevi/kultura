## NOW — Sprint B3.5e: red de seguridad antes de bug fixes

El diagnóstico estructural (B3.5d) reveló que los 5 flujos rotos en
runtime no tienen cobertura de tests. Antes de arreglarlos, hay que
crear la red de seguridad para detectar regresiones.

Subtareas:
- Tests E2E mínimos (Playwright) para los 5 flujos rotos: chat send,
  GroupFeed post, language switch, notifications render, Discover pagination.
  Empiezan en rojo (fallan), eso es lo que queremos. Los fixes los pondrán en verde.
- Crear src/lib/social/groups.ts extrayendo lógica existente de
  route handlers y server components. No es implementación nueva, es refactor.

Tras B3.5e: arrancar B3.5c-1 (diagnóstico de bugs concretos).
