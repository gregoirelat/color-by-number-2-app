import { useCallback, useEffect, useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Hook qui gère l'état d'une partie de coloriage pour un dessin vectoriel.
//
// Le dessin est une liste de régions ; `filled` est un tableau de booléens
// indexé comme `puzzle.regions`. La progression est sauvegardée automatiquement
// dans le localStorage (indépendamment par dessin).
// ---------------------------------------------------------------------------

const storageKey = (puzzleId) => `cbn:progress:${puzzleId}`

export function useColorByNumber(puzzle) {
  const total = puzzle.regions.length

  // Numéro de couleur attendu pour chaque région.
  const regionNumbers = useMemo(
    () => puzzle.regions.map((r) => r.number),
    [puzzle]
  )

  const [filled, setFilled] = useState(() => loadProgress(puzzle.id, total))
  const [activeColor, setActiveColor] = useState(puzzle.colors[0].number)
  // Incrémenté à chaque réinitialisation / remplissage massif : sert de signal
  // pour forcer un re-rendu complet du dessin (le coloriage normal, lui, met à
  // jour le DOM sans re-rendu, pour rester rapide sur les gros dessins).
  const [renderTick, setRenderTick] = useState(0)

  // Sauvegarde automatique.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(puzzle.id), JSON.stringify(filled))
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, [filled, puzzle.id])

  // Colorie une région si son numéro correspond à la couleur active.
  // Renvoie true si la région a bien été remplie.
  const paintRegion = useCallback(
    (index) => {
      if (filled[index]) return false
      if (regionNumbers[index] !== activeColor) return false
      setFilled((prev) => {
        const next = prev.slice()
        next[index] = true
        return next
      })
      return true
    },
    [filled, regionNumbers, activeColor]
  )

  const selectColor = useCallback((number) => setActiveColor(number), [])
  const reset = useCallback(() => {
    setFilled(new Array(total).fill(false))
    setRenderTick((t) => t + 1)
  }, [total])

  // Progression par couleur.
  const progress = useMemo(() => {
    const map = {}
    for (const color of puzzle.colors) {
      map[color.number] = { done: 0, total: 0, complete: false }
    }
    regionNumbers.forEach((number, index) => {
      const entry = map[number]
      if (!entry) return
      entry.total += 1
      if (filled[index]) entry.done += 1
    })
    for (const key of Object.keys(map)) {
      map[key].complete = map[key].total > 0 && map[key].done === map[key].total
    }
    return map
  }, [puzzle.colors, regionNumbers, filled])

  const isComplete = useMemo(
    () => filled.length === total && filled.every(Boolean),
    [filled, total]
  )

  return {
    filled,
    activeColor,
    progress,
    isComplete,
    renderTick,
    selectColor,
    paintRegion,
    reset,
  }
}

// Nombre de régions déjà remplies (lecture seule, pour l'écran de sélection).
export function getSavedCount(puzzleId, total) {
  return loadProgress(puzzleId, total).filter(Boolean).length
}

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
    /* ignoré */
  }
  return new Array(total).fill(false)
}
