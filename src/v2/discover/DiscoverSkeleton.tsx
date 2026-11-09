import "./discover.css";

const PULSE = "k2d-skel motion-safe:animate-pulse";

// Esqueleto de Descubrir: mismo CSS que la pantalla, para que al cargar nada salte.
// Solo se ve al llegar a la ruta: filtrar y paginar no vuelven al servidor.
export function DiscoverSkeleton() {
  return (
    <main className="k2d page-grid">
      <div aria-hidden="true" style={{ display: "contents" }}>
        <div className="k2d-head">
          <div className={`${PULSE} k2d-skel--title`} />
          <div className={`${PULSE} k2d-skel--search`} />
          <div className={`${PULSE} k2d-skel--dice`} />
        </div>
        <div className="k2d-controls">
          <div className="k2d-formats">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={`${PULSE} k2d-skel--format`} />
            ))}
          </div>
          <div className="k2d-filters">
            {[88, 64, 104, 96].map((w) => (
              <div key={w} className={`${PULSE} k2d-skel--filter`} style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="k2d-wall">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="k2d-work">
              <div className={`${PULSE} k2d-skel--poster`} />
              <div className={`${PULSE} k2d-skel--line`} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
