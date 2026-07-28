import { useCallback, useRef, useState } from 'react'
import { Cell } from './Cell.jsx'

// ---------------------------------------------------------------------------
// Grille de coloriage avec zoom et déplacement.
//
// - Molette : zoom centré sur le curseur.
// - Pincement tactile (2 doigts) : zoom.
// - Glisser (souris ou 1 doigt) : déplacement, dès que le zoom > 1.
// - Un simple tap/clic sur une case la colorie.
//
// L'implémentation applique une transform CSS (translate + scale) sur un
// calque contenant la grille. On distingue un "tap" (colorier) d'un "drag"
// (déplacer) grâce à la distance parcourue par le pointeur.
// ---------------------------------------------------------------------------

const MIN_SCALE = 1
const MAX_SCALE = 6
const DRAG_THRESHOLD = 6 // pixels au-delà desquels un geste devient un déplacement

export function Grid({ puzzle, filled, flatGrid, activeColor, onPaint }) {
  const viewportRef = useRef(null)

  // Transform courante : échelle + translation (en pixels).
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })

  // Index de la case ayant reçu un feedback "mauvaise couleur".
  const [wrongIndex, setWrongIndex] = useState(null)
  const wrongTimer = useRef(null)

  // Références de suivi du geste en cours (pas d'état React pour rester fluide).
  const pointers = useRef(new Map()) // pointerId -> {x, y}
  const gesture = useRef(null)

  // ----- Utilitaires ------------------------------------------------------

  const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  // Applique un zoom autour d'un point (px, py) exprimé dans le viewport.
  const zoomAround = useCallback((nextScale, px, py) => {
    setTransform((prev) => {
      const scale = clampScale(nextScale)
      const ratio = scale / prev.scale
      // On garde le point sous le curseur fixe pendant le zoom.
      const x = px - (px - prev.x) * ratio
      const y = py - (py - prev.y) * ratio
      return constrain({ scale, x, y }, viewportRef.current)
    })
  }, [])

  // ----- Feedback "mauvaise couleur" --------------------------------------

  const flashWrong = useCallback((index) => {
    setWrongIndex(index)
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
    wrongTimer.current = setTimeout(() => setWrongIndex(null), 300)
  }, [])

  const handlePaint = useCallback(
    (index) => {
      const ok = onPaint(index)
      if (!ok && !filled[index]) flashWrong(index)
    },
    [onPaint, filled, flashWrong]
  )

  // ----- Molette (zoom) ---------------------------------------------------

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault()
      const rect = viewportRef.current.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setTransform((prev) => {
        const scale = clampScale(prev.scale * factor)
        const ratio = scale / prev.scale
        const x = px - (px - prev.x) * ratio
        const y = py - (py - prev.y) * ratio
        return constrain({ scale, x, y }, viewportRef.current)
      })
    },
    []
  )

  // ----- Pointer events (déplacement + pincement) -------------------------

  const onPointerDown = useCallback((e) => {
    viewportRef.current.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1) {
      // Début d'un geste simple : peut devenir un tap ou un drag.
      gesture.current = {
        mode: 'pending',
        startX: e.clientX,
        startY: e.clientY,
        originX: transform.x,
        originY: transform.y,
      }
    } else if (pointers.current.size === 2) {
      // Début d'un pincement.
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        mode: 'pinch',
        startDist: distance(a, b),
        startScale: transform.scale,
      }
    }
  }, [transform])

  const onPointerMove = useCallback((e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return

    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = distance(a, b)
      const rect = viewportRef.current.getBoundingClientRect()
      const mid = midpoint(a, b)
      zoomAround(g.startScale * (dist / g.startDist), mid.x - rect.left, mid.y - rect.top)
      return
    }

    if (g.mode === 'pending') {
      const moved = Math.hypot(e.clientX - g.startX, e.clientY - g.startY)
      if (moved > DRAG_THRESHOLD) g.mode = 'drag'
    }

    if (g.mode === 'drag') {
      const dx = e.clientX - g.startX
      const dy = e.clientY - g.startY
      setTransform((prev) =>
        constrain({ scale: prev.scale, x: g.originX + dx, y: g.originY + dy }, viewportRef.current)
      )
    }
  }, [zoomAround])

  const onPointerUp = useCallback((e) => {
    const g = gesture.current
    pointers.current.delete(e.pointerId)

    // Un tap net (pas de déplacement) sur une case la colorie.
    // On retrouve la case via les coordonnées plutôt que via e.target :
    // à cause de la capture de pointeur, e.target pointe sur le viewport.
    if (g && g.mode === 'pending') {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const target = el && el.closest('[data-index]')
      if (target) handlePaint(Number(target.getAttribute('data-index')))
    }

    if (pointers.current.size === 0) {
      gesture.current = null
    } else if (pointers.current.size === 1) {
      // On repasse d'un pincement à un éventuel déplacement.
      const [only] = [...pointers.current.values()]
      gesture.current = {
        mode: 'pending',
        startX: only.x,
        startY: only.y,
        originX: transform.x,
        originY: transform.y,
      }
    }
  }, [handlePaint, transform])

  // ----- Contrôles de zoom (boutons) --------------------------------------

  const zoomButton = (factor) => () => {
    const rect = viewportRef.current.getBoundingClientRect()
    zoomAround(transform.scale * factor, rect.width / 2, rect.height / 2)
  }
  const resetView = () => setTransform({ scale: 1, x: 0, y: 0 })

  return (
    <div className="grid-area">
      <div
        ref={viewportRef}
        className="grid-viewport"
        onWheel={handleWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${puzzle.width}, 1fr)`,
            width: `${puzzle.width * 40}px`,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          {flatGrid.map((number, index) => {
            const color = puzzle.colors.find((c) => c.number === number)
            return (
              <div key={index} data-index={index} className="cell-slot">
                <Cell
                  number={number}
                  hex={color ? color.hex : '#fff'}
                  isFilled={filled[index]}
                  wrong={wrongIndex === index}
                  // Le clic réel est géré au niveau du viewport (tap vs drag),
                  // mais on garde onPaint pour l'accessibilité clavier.
                  onPaint={() => handlePaint(index)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="zoom-controls">
        <button type="button" onClick={zoomButton(1 / 1.3)} aria-label="Dézoomer">−</button>
        <button type="button" onClick={resetView} aria-label="Réinitialiser la vue">⤢</button>
        <button type="button" onClick={zoomButton(1.3)} aria-label="Zoomer">+</button>
      </div>
    </div>
  )
}

// --- Helpers géométriques ---------------------------------------------------

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// Empêche la grille de partir trop loin hors de l'écran quand on la déplace.
function constrain(t, viewport) {
  if (!viewport) return t
  const rect = viewport.getBoundingClientRect()
  const content = viewport.querySelector('.grid')
  if (!content) return t
  const w = content.offsetWidth * t.scale
  const h = content.offsetHeight * t.scale
  // Marge autorisée : on garde toujours une partie de la grille visible.
  const margin = 40
  const minX = Math.min(0, rect.width - w) - margin
  const maxX = margin
  const minY = Math.min(0, rect.height - h) - margin
  const maxY = margin
  return {
    scale: t.scale,
    x: Math.min(maxX, Math.max(minX, t.x)),
    y: Math.min(maxY, Math.max(minY, t.y)),
  }
}
