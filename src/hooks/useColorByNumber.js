import { useCallback, useEffect, useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Hook qui gère tout l'état du jeu de coloriage pour un puzzle donné.
//
// Il expose :
//   - filled : tableau à plat (length = width*height) où chaque case vaut
//              `true` une fois correctement coloriée, `false` sinon.
//   - activeColor : le numéro de couleur actuellement sélectionné.
//   - progress : pour chaque numéro de couleur, { done, total, complete }.
//   - isComplete : true quand tout le dessin est terminé.
//   - selectColor(number) / paintCell(index) : actions.
//
// La progression est sauvegardée automatiquement dans le localStorage pour
// pouvoir reprendre plus tard.
// ---------------------------------------------------------------------------

const storageKey = (puzzleId) => `cbn:progress:${puzzleId}`

export function useColorByNumber(puzzle) {
  const total = puzzle.width * puzzle.height

  // Version à plat de la grille : le numéro attendu pour chaque case.
  const flatGrid = useMemo(() => puzzle.grid.flat(), [puzzle])

  // État des cases remplies, restauré depuis le localStorage si disponible.
  const [filled, setFilled] = useState(() => loadProgress(puzzle.id, total))

  // Couleur active : par défaut la première de la palette.
  const [activeColor, setActiveColor] = useState(puzzle.colors[0].number)

  // Sauvegarde automatique à chaque changement.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(puzzle.id), JSON.stringify(filled))
    } catch {
      // Stockage indisponible (mode privé, quota...) : on ignore.
    }
  }, [filled, puzzle.id])

  // Colorie une case si le numéro correspond à la couleur active.
  // Renvoie true si la case a bien été remplie (utile pour un feedback).
  const paintCell = useCallback(
    (index) => {
      if (filled[index]) return false // déjà remplie
      if (flatGrid[index] !== activeColor) return false // mauvaise couleur
      setFilled((prev) => {
        const next = prev.slice()
        next[index] = true
        return next
      })
      return true
    },
    [filled, flatGrid, activeColor]
  )

  const selectColor = useCallback((number) => setActiveColor(number), [])

  // Réinitialise le puzzle.
  const reset = useCallback(() => {
    setFilled(new Array(total).fill(false))
  }, [total])

  // Progression par couleur.
  const progress = useMemo(() => {
    const map = {}
    for (const color of puzzle.colors) {
      map[color.number] = { done: 0, total: 0, complete: false }
    }
    flatGrid.forEach((number, index) => {
      const entry = map[number]
      if (!entry) return
      entry.total += 1
      if (filled[index]) entry.done += 1
    })
    for (const key of Object.keys(map)) {
      map[key].complete = map[key].total > 0 && map[key].done === map[key].total
    }
    return map
  }, [puzzle.colors, flatGrid, filled])

  const isComplete = useMemo(
    () => filled.length === total && filled.every(Boolean),
    [filled, total]
  )

  return {
    filled,
    flatGrid,
    activeColor,
    progress,
    isComplete,
    selectColor,
    paintCell,
    reset,
  }
}

// Nombre de cases déjà remplies pour un dessin (lecture seule, pour l'écran
// de sélection).
export function getSavedCount(puzzleId, total) {
  return loadProgress(puzzleId, total).filter(Boolean).length
}

// Charge la progression enregistrée, en vérifiant qu'elle correspond à la
// taille attendue (sinon on repart de zéro).
function loadProgress(puzzleId, total) {
  try {
    const raw = localStorage.getItem(storageKey(puzzleId))
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === total) {
        return parsed.map(Boolean)
      }
    }
  } catch {
    // Ignoré : on retombe sur un état vierge.
  }
  return new Array(total).fill(false)
}
