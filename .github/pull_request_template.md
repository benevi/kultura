## Qué cambia y por qué

<!-- Una o dos frases. Un PR, un cambio. -->

## Lista (borra lo que no aplique, no lo dejes sin marcar)

- [ ] **¿Migración?** Nombre: `…`. Fecha posterior a la última de `master`.
- [ ] **¿Aplicada en `kultura-test`** antes de abrir el PR?
- [ ] **¿Paso del patrón de 3 PRs?** (expandir / usar / contraer, ver `CLAUDE.md`). Si borra una columna o tabla: el código que dejó de usarla ya está en producción.
- [ ] **¿Copia hecha** (`backup.yml`) antes de aplicarla en producción? Se aplica después de fusionar y con el visto bueno.
- [ ] **¿Versión del service worker?** Si cambia servidor y cliente a la vez, `public/sw.js` sube de versión.
- [ ] **¿Bandera nueva?** Registrada en `docs/banderas.json` con dueño y fecha.
- [ ] **¿Cómo se deshace?** <!-- revert del PR, migración inversa, bandera a 0… -->

## Probado

<!-- Qué se ha corrido en local o en test. -->
