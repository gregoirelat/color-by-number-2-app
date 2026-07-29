import { useState } from 'react'
import { puzzles } from './data/puzzles.js'
import { PuzzleSelect } from './components/PuzzleSelect.jsx'
import { Game } from './components/Game.jsx'

// ---------------------------------------------------------------------------
// Composant racine : gère la navigation entre l'écran de sélection des dessins
// et une partie de coloriage.
// ---------------------------------------------------------------------------

export default function App() {
  const [currentId, setCurrentId] = useState(null)

  const puzzle = puzzles.find((p) => p.id === currentId)

  if (!puzzle) {
    return <PuzzleSelect onSelect={setCurrentId} />
  }

  // La `key` force le remontage (donc un état propre) quand on change de dessin.
  return <Game key={puzzle.id} puzzle={puzzle} onBack={() => setCurrentId(null)} />
}
