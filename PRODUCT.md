# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Respuesta de Víctor (2026-11-09): web con PWA y también nativa. Hoy solo existe la web (Next.js); ni el plan ni el presupuesto incluyen apps nativas. **Abierto:** cuándo y con qué alcance.

## Users

Fan de varios formatos: ve series, lee manga, juega, y quiere tenerlo todo en un sitio. Habla español.

## Product Purpose

Kultura sirve para llevar en un solo sitio lo que ves, lees y juegas, y saber por dónde vas en cada obra.

Éxito de la primera visita: **entender qué es y volver**. No se fuerza el registro para que la visita cuente.

## Positioning

Lo que Kultura dice antes que nada:
1. **7 formatos juntos:** series, películas, anime, manga, libros, cómics y juegos.
2. **Español de verdad:** hecha en español, no traducida.
3. **Control por episodio:** saber exactamente por dónde vas y marcarlo.

Comprobado en el plan §3: ningún producto consumer encontrado reúne esa combinación; ninguna función aislada es inédita. Exportar e importar tus datos sigue existiendo, pero no lidera el mensaje.

## Capabilities and Constraints

- Alcance v2.0: `docs/FUNCIONES_V2.md`. Textos en `messages/{es,en}.json`.
- JS inicial ≤ 150 KB por ruta y CLS ≤ 0,05 (`lighthouserc.json`). Vercel Hobby.
- **Nada de dinero** en la web: ni precios, ni planes, ni donaciones.
- **Sin cifras ni IA:** ni métricas de usuarios, ni vender «con IA».
- **Abierto:** las portadas reales ya no son obligatorias (Víctor no las marcó como límite el 2026-11-09). Licencias de imágenes: `docs/04_DECISIONES_Y_RIESGOS.md` R4.
- **Abierto:** el usuario multiformato se aparta de la cuña A provisional (D-F1c/D-F1d), que aún espera datos de F1.

## Brand Commitments

Nombre: Kultura. Español de España.

Personalidad: apasionada, ambiciosa, precisa y directa.

Nunca: corporativa, infantil o artesanal, red social ruidosa.

Vetos de Víctor: mucho texto, etiquetas innecesarias, que se vea en pantalla lo que el usuario escribe, repetir la composición de la portada en otras pantallas (más `CLAUDE.md` y plan §6.2). Sin identidad visual fijada: se decide después.

## Evidence on Hand

Sin testimonios, prensa ni métricas publicables: no se inventan. Investigación de mercado en el plan §2 y §3. Entrevistas de F1 sin hacer.

## Product Principles

1. Se entiende en 5 segundos que aquí cabe todo lo que ves, lees y juegas.
2. Saber por dónde vas es el gesto central, y es exacto.
3. Volver merece la pena: se gana con el producto, no con avisos ni métricas.
4. Pocas palabras, en español de verdad.

## Accessibility & Inclusion

WCAG 2.2 AA (plan §6.3 y §8.5). Lector de pantalla probado, no supuesto. Sin depender de animación ni de WebGL.
