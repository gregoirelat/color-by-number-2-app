// ---------------------------------------------------------------------------
// Palette de couleurs affichée en bas de l'écran.
//
// Pour chaque couleur :
//   - une pastille de la couleur avec son numéro,
//   - une jauge de progression "done/total",
//   - un état sélectionné (couleur active),
//   - un état terminé (grisé) quand toutes les cases sont remplies.
// ---------------------------------------------------------------------------

export function Palette({ colors, progress, activeColor, onSelect }) {
  return (
    <div className="palette">
      {colors.map((color) => {
        const p = progress[color.number] || { done: 0, total: 0, complete: false }
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
        const isActive = color.number === activeColor

        return (
          <button
            type="button"
            key={color.number}
            className={
              'swatch' +
              (isActive ? ' swatch--active' : '') +
              (p.complete ? ' swatch--complete' : '')
            }
            onClick={() => onSelect(color.number)}
            disabled={p.complete}
            aria-label={`Couleur ${color.number} ${color.name} : ${p.done} sur ${p.total} cases`}
          >
            <span className="swatch__dot" style={{ backgroundColor: color.hex }}>
              {p.complete ? '✓' : color.number}
            </span>
            <span className="swatch__meta">
              <span className="swatch__count">{p.done}/{p.total}</span>
              <span className="swatch__bar">
                <span className="swatch__bar-fill" style={{ width: `${pct}%` }} />
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
