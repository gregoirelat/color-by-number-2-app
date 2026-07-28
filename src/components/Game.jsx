import { useEffect, useState } from 'react'
import { useColorByNumber } from '../hooks/useColorByNumber.js'
import { Grid } from './Grid.jsx'
import { Palette } from './Palette.jsx'

// ---------------------------------------------------------------------------
// Une partie de coloriage pour un dessin donné.
//
// Ce composant est monté avec une `key` égale à l'id du dessin (voir App),
// il repart donc d'un état propre à chaque changement de dessin.
// ---------------------------------------------------------------------------

export function Game({ puzzle, onBack }) {
  const {
    filled,
    flatGrid,
    activeColor,
    progress,
    isComplete,
    selectColor,
    paintCell,
    reset,
  } = useColorByNumber(puzzle)

  // Célébration affichée une seule fois au passage à 100%.
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (isComplete) {
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 4000)
      return () => clearTimeout(t)
    }
  }, [isComplete])

  const totalDone = filled.filter(Boolean).length
  const totalPct = Math.round((totalDone / filled.length) * 100)

  return (
    <div className="app">
      <header className="app__header">
        <button type="button" className="app__back" onClick={onBack} aria-label="Retour aux dessins">
          ‹
        </button>
        <h1 className="app__title">{puzzle.name}</h1>
        <div className="app__progress">
          <span>{totalPct}%</span>
          <button type="button" className="app__reset" onClick={reset}>
            Recommencer
          </button>
        </div>
      </header>

      <Grid
        puzzle={puzzle}
        filled={filled}
        flatGrid={flatGrid}
        onPaint={paintCell}
      />

      <Palette
        colors={puzzle.colors}
        progress={progress}
        activeColor={activeColor}
        onSelect={selectColor}
      />

      {celebrate && <Celebration />}
    </div>
  )
}

// Confettis + message quand le dessin est terminé.
function Celebration() {
  const pieces = Array.from({ length: 50 })
  const colors = ['#ff5d8f', '#7ed957', '#ffd166', '#4d96ff', '#c77dff', '#ff9f1c']
  return (
    <div className="celebration" role="status">
      <div className="celebration__banner">🎉 Bravo, dessin terminé ! 🎉</div>
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.8}s`,
            animationDuration: `${1.8 + Math.random() * 1.4}s`,
          }}
        />
      ))}
    </div>
  )
}
