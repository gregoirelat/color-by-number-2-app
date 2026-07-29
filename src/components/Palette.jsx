// ---------------------------------------------------------------------------
// Palette de couleurs affichée en bas de l'écran.
//
// Deux affichages :
//   - normal (peu de couleurs) : pastille + numéro + jauge de progression.
//   - compact (beaucoup de couleurs, ex. dessins « photo » à 100+ tons) : une
//     grille de pastilles numérotées, pour rester utilisable.
// ---------------------------------------------------------------------------

const COMPACT_THRESHOLD = 16

export function Palette({ colors, progress, activeColor, onSelect }) {
  const compact = colors.length > COMPACT_THRESHOLD

  if (compact) {
    return (
      <div className="palette palette--compact">
        {colors.map((color) => {
          const p = progress[color.number] || { done: 0, total: 0, complete: false }
          const isActive = color.number === activeColor
          return (
            <button
              type="button"
              key={color.number}
              className={
                'cswatch' +
                (isActive ? ' cswatch--active' : '') +
                (p.complete ? ' cswatch--complete' : '')
              }
              onClick={() => onSelect(color.number)}
              disabled={p.complete}
              title={`${p.done}/${p.total}`}
              aria-label={`Couleur ${color.number} : ${p.done} sur ${p.total}`}
            >
              <span className="cswatch__dot" style={{ backgroundColor: color.hex }}>
                {p.complete ? '✓' : color.number}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

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
