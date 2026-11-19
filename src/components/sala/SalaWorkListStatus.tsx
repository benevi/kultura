"use client";

import * as React from "react";

/**
 * Lo único de cliente de `SalaWorkList`: la región viva que anuncia la carga.
 *
 * Una región `status` que nace ya con texto no se anuncia de forma fiable: el
 * lector de pantalla avisa de los **cambios**. Por eso esta nace vacía, está
 * montada siempre y su texto se pone después: al empezar la carga
 * (`loadingLabel`) y al acabar (`loadedLabel`). Si la lista llega ya cargada
 * no dice nada.
 */
export function SalaWorkListStatus({
  loading,
  loadingLabel,
  loadedLabel,
}: {
  loading: boolean;
  loadingLabel: string;
  loadedLabel?: string;
}) {
  const [texto, setTexto] = React.useState("");
  const cargaba = React.useRef(false);

  React.useEffect(() => {
    if (loading) setTexto(loadingLabel);
    // Solo al acabar una carga: una lista que llega hecha no interrumpe a nadie.
    else if (cargaba.current) setTexto(loadedLabel ?? "");
    cargaba.current = loading;
  }, [loading, loadingLabel, loadedLabel]);

  return (
    <p role="status" data-sala-list-status="" className="sr-only">
      {texto}
    </p>
  );
}
