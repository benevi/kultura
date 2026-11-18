// Prototipo fase 8.3 — índice: todas las combinaciones dirección × obra.

import { ProtoShell } from "./_base/ProtoShell";
import { DIRS, WORKS, fichaPath } from "./_base/works";

const IDEAS: Record<string, string> = {
  a: "La portada llena la pantalla y el título vive dentro de ella. Debajo, una franja con el color de la portada y la ficha.",
  b: "La portada es un objeto con cuerpo sobre un ambiente del color que ella misma da. Todo lo demás se tiñe de ese color.",
  c: "Página limpia en un tono de papel, mucha letra y aire; la portada es una ventana que se mueve despacio.",
};

export default async function ProtoIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <ProtoShell locale={locale}>
      <main id="main-content">
        <h1>Tres direcciones para la ficha</h1>
        <p className="kp-index-lead">
          Prototipo de la fase 8.3 con obras y portadas reales. Arriba a la derecha se cambia entre claro y oscuro y se
          quita el movimiento; dentro de una ficha, la barra cambia de dirección (A, B, C) y de obra.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Obra</th>
              <th scope="col">Direcciones</th>
            </tr>
          </thead>
          <tbody>
            {WORKS.map((w) => (
              <tr key={w.slug}>
                <th scope="row">
                  {w.name}
                  <small>{w.note}</small>
                </th>
                <td>
                  {DIRS.map((d) => (
                    <a key={d.id} href={fichaPath(locale, d.id, w)}>
                      {d.id.toUpperCase()} · {d.name}
                    </a>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>Las direcciones</h2>
        <ul className="kp-index-dirs">
          {DIRS.map((d) => (
            <li key={d.id}>
              <strong>
                {d.id.toUpperCase()} · {d.name}.
              </strong>{" "}
              {IDEAS[d.id]}
            </li>
          ))}
        </ul>
      </main>
    </ProtoShell>
  );
}
