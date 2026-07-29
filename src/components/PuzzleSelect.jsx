import { puzzles, difficultyOrder } from '../data/puzzles.js'
import { getSavedCount } from '../hooks/useColorByNumber.js'

// ---------------------------------------------------------------------------
// Écran d'accueil : choix du dessin, regroupé par difficulté.
//
// Chaque carte montre un aperçu miniature du dessin, son nom, sa taille
// (nombre de cases) et la progression déjà enregistrée.
// ---------------------------------------------------------------------------

export function PuzzleSelect({ onSelect }) {
  return (
    <div className="select">
      <header className="select__header">
        <h1 className="select__title">🎨 Coloriage par numéros</h1>
        <p className="select__subtitle">Choisis un dessin</p>
      </header>

      {difficultyOrder.map((level) => {
        const group = puzzles.filter((p) => p.difficulty === level)
        if (group.length === 0) return null
        return (
          <section key={level} className="select__group">
            <h2 className={`select__level select__level--${level.toLowerCase()}`}>
              {level}
            </h2>
            <div className="select__grid">
              {group.map((puzzle) => (
                <PuzzleCard key={puzzle.id} puzzle={puzzle} onSelect={onSelect} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function PuzzleCard({ puzzle, onSelect }) {
  const done = getSavedCount(puzzle.id, puzzle.regionCount)
  const pct = Math.round((done / puzzle.regionCount) * 100)
  const complete = done === puzzle.regionCount

  return (
    <button type="button" className="card" onClick={() => onSelect(puzzle.id)}>
      <div className="card__preview">
        <Thumbnail puzzle={puzzle} />
        {complete && <span className="card__done">✓</span>}
      </div>
      <div className="card__body">
        <span className="card__name">{puzzle.name}</span>
        <span className="card__meta">
          {puzzle.colors.length} couleurs · {puzzle.regionCount} zones
        </span>
        <span className="card__bar">
          <span className="card__bar-fill" style={{ width: `${pct}%` }} />
        </span>
        <span className="card__pct">{pct > 0 ? `${pct}%` : 'Nouveau'}</span>
      </div>
    </button>
  )
}

// Aperçu du dessin final rendu en SVG (chaque région avec sa couleur).
function Thumbnail({ puzzle }) {
  const colorOf = (n) => {
    const c = puzzle.colors.find((col) => col.number === n)
    return c ? c.hex : '#fff'
  }
  return (
    <svg
      className="thumb"
      viewBox={`0 0 ${puzzle.viewBox.w} ${puzzle.viewBox.h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {puzzle.regions.map((region, i) => (
        <path key={i} d={region.d} fill={colorOf(region.number)} />
      ))}
    </svg>
  )
}
