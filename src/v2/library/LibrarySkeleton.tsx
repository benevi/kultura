import "./library.css";

const PULSE = "motion-safe:animate-pulse k2b-skel";

// Esqueleto de la Biblioteca v2: mismo CSS que la pantalla, tanto en el raíl de
// escritorio como en las filas de móvil. No lee la URL: la vista de diario también
// pasa por él un instante.
export function LibrarySkeleton() {
  return (
    <main className="k2b page-grid">
      <div aria-hidden="true" className="k2b-skelwrap">
        <div className="k2b-head">
          <div className={`${PULSE} k2b-skel--title`} />
          <div className={`${PULSE} k2b-skel--views`} />
        </div>
        <div className="k2b-rail">
          {[5, 7].map((rows) => (
            <div key={rows} className="k2b-rail__group">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className={`${PULSE} k2b-skel--row`} />
              ))}
            </div>
          ))}
        </div>
        <div className="k2b-shelf">
          <div className="k2b-shelf__head" />
          <div className="k2b-wall">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i}>
                <div className={`${PULSE} k2b-skel--cover`} />
                <div className={`${PULSE} k2b-skel--line`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
