import { memo } from 'react'

// ---------------------------------------------------------------------------
// Une case de la grille.
//
// - Tant qu'elle n'est pas remplie, elle affiche son numéro sur fond clair.
// - Une fois remplie, elle prend la couleur correspondante et le numéro
//   disparaît.
// - `wrong` déclenche une petite animation de secousse quand l'utilisateur
//   tape avec la mauvaise couleur (feedback visuel).
// ---------------------------------------------------------------------------

function CellComponent({ number, hex, isFilled, wrong, onPaint }) {
  const style = isFilled ? { backgroundColor: hex } : undefined

  return (
    <button
      type="button"
      className={
        'cell' +
        (isFilled ? ' cell--filled' : '') +
        (wrong ? ' cell--wrong' : '')
      }
      style={style}
      onClick={onPaint}
      aria-label={isFilled ? `Case coloriée` : `Case numéro ${number}`}
    >
      {!isFilled && <span className="cell__number">{number}</span>}
    </button>
  )
}

export const Cell = memo(CellComponent)
