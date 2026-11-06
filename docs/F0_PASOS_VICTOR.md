# F0 — lo que falta (lo hace Víctor)

Estado a 2026-11-06: todo lo que tocaba a Claude en F0 está en `master`
(#67, #69–#75). La puerta de F0 (`PLAN_ESTRATEGICO.md` §7.2) queda pendiente
de estos 5 pasos. Marca cada uno con fecha al terminarlo y díselo a Claude
para registrarlo en `04_DECISIONES_Y_RIESGOS.md` y `HANDOVER.md`.

Orden recomendado: 1 → 2 → 3 → 4. El 5 depende de D3.

---

## 1. Medición: Web Analytics + evento visto (≈ 20 min) — puerta F0

El código ya está: `src/components/analytics/VercelAnalytics.tsx` (páginas
vistas, sin cookies) y `src/lib/analytics/track.ts` (eventos de usuarios
registrados en `analytics_events`).

0. Antes, fusionar el PR #77 (Speed Insights necesita el paquete `@vercel/speed-insights` en la app).
1. Vercel → proyecto `kultura` → **Analytics** → *Enable* Web Analytics.
2. Vercel → `kultura` → **Speed Insights** → *Enable*.
3. Redesplegar producción (Deployments → último → *Redeploy*) para que el
   script `/_vercel/insights` responda.
4. Abrir la web de producción en una ventana privada y visitar 2–3 páginas.
5. Con **tu** cuenta, añadir un título a la biblioteca (evento `library_add`).
6. Comprobar:
   - Vercel → Analytics: aparecen las visitas (puede tardar unos minutos).
   - Supabase **producción** → SQL Editor (solo lectura):
     ```sql
     select name, created_at
     from public.analytics_events
     order by created_at desc
     limit 5;
     ```
     Debe salir `library_add` con la hora de ahora.
7. Pasa a Claude las dos pruebas: una captura de Vercel y la fila de la consulta, sin ids.

Estado comprobado por Claude el 2026-11-06 (solo lectura en producción): `analytics_events` tiene **0 filas**, pero tampoco hay actividad desde el 2026-10-10 (último usuario y último `user_media`; 7 usuarios y 123 títulos en total). El 0 no prueba que `track()` falle: hace falta la acción del punto 5.

Si no aparece la fila: Vercel → `kultura` → Settings → Environment Variables
→ comprobar que `SUPABASE_SERVICE_ROLE_KEY` existe en *Production* (`track()`
no escribe sin ella y no da error).

## 2. R9 — reparar el historial de migraciones de producción (≈ 15 min)

**Verificado por Claude el 2026-11-06 (solo lectura):** las 22 de abajo están aplicadas en producción y las 2 de push no (detalle en `04_DECISIONES` R9). Falta solo escribir el historial. Claude no puede: su clasificador bloquea escrituras en producción.

Alternativa sin CLI: Supabase **producción** → SQL Editor, pegar `docs/sql/r9_repair_history.sql` y ejecutar. Inserta solo las filas que faltan (idempotente) y devuelve las versiones añadidas: deben salir 22.

Producción tiene aplicadas 29 de 31 migraciones, pero su historial solo
registra 7 (comprobado de nuevo el 2026-11-06 con `list_migrations`: la última es `20260520000001`). Mientras no se repare, **nunca** ejecutes `supabase db push`
contra producción: intentaría reaplicar 24 migraciones.

```bash
supabase link --project-ref zfrbyphzvfuvejdwjfea
```

```bash
supabase migration repair --status applied 20260531000001 20260531180450 20260531201838 20260601000001 20260601000002 20260716000001 20260913220000 20260914090000 20261008000001 20261014000001 20261023020001 20261023030001 20261023040001 20261101110001 20261101120001 20261115170001 20261208240001 20261208250001 20261215270001 20261215280001 20261215290001 20261229350001
```

```bash
supabase migration list
```

Resultado esperado: todas con *Local* y *Remote* salvo
`20261222330001_push` y `20261222340001_push_throttle`, que solo tienen
*Local*. Esas 2 **no** se aplican ahora: primero Claude las prueba en
`kultura-test` en una sesión aparte.

Al terminar, vuelve a enlazar la CLI a test para no equivocarte después:

```bash
supabase link --project-ref xqvicvypoxxfbezqnkwr
```

## 3. Simulacro de restauración del backup (≈ 30 min)

La guía está en `supabase/README.md` § «Restaurar».

1. Confirma dónde está la clave privada `age` (`kultura-backup.key`). Si no
   la encuentras, los backups no sirven: díselo a Claude y se genera una
   pareja nueva (nueva clave pública en el secreto `BACKUP_AGE_RECIPIENT`).
2. GitHub → Actions → **Backup BD** → última ejecución verde → descargar
   el artefacto `.age`. Si no hay ninguno de menos de 90 días: *Run workflow*.
3. En `kultura-test`: Settings → Database → **Reset database**. Esto borra el
   usuario de prueba del CUJ; no pasa nada, porque CI usa Supabase local.
4. Sigue los pasos 1 y 2 de `supabase/README.md` § «Restaurar».
5. Lanza las 3 consultas de «Comprobación rápida» en test y en producción. Los
   números deben coincidir.
6. Apunta la fecha en la tabla «Prueba trimestral» del README, o pásale el
   resultado a Claude.

Ojo: test quedará con datos reales de producción. Vuelve a pausarlo cuando
acabes si no lo necesitas.

## 4. Proyecto «KULTURA 2.0» en claude.ai (≈ 10 min) — D8

1. claude.ai → Projects → *New project* «KULTURA 2.0».
2. Sube como conocimiento: `docs/PLAN_ESTRATEGICO.md`, `docs/HANDOVER.md`,
   `docs/04_DECISIONES_Y_RIESGOS.md` y la carpeta `docs/auditoria/`.
3. En las instrucciones del proyecto pon: «La fuente de verdad es `docs/` del
   repo; esto es una copia de consulta».
4. El proyecto antiguo se queda como archivo, sin borrarlo.

## 5. Dominio — fuera de F0

D3 actualizada el 2026-11-06: el dominio se compra cuando la app esté al
100 % (fin de F3). Sale de la puerta de F0 y pasa a F4. Cuando lo compres
(`kulturaapp.es` recomendado), Claude te prepara la lista de pasos con:
dominio en Vercel con 308, `NEXT_PUBLIC_SITE_URL`, Site URL y Redirect URLs
de Supabase, Google OAuth, Search Console, Bing y `sitemap.xml`.
