import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Cell } from './Cell.jsx'

// ---------------------------------------------------------------------------
// Grille de coloriage avec zoom et déplacement.
//
// - Molette : zoom centré sur le curseur.
// - Pincement (2 doigts) : zoom + déplacement fluides.
// - Glisser (souris ou 1 doigt) : déplacement.
// - Tap/clic net sur une case : coloriage.
//
// Au chargement (et quand on change de dessin), la grille est automatiquement
// ajustée pour tenir entièrement à l'écran — essentiel pour les grands dessins
// de plusieurs centaines de cases. Les bornes de zoom sont calculées à partir
// de cet ajustement : on peut toujours revenir à la vue d'ensemble, ou zoomer
// pour atteindre les petites cases.
// ---------------------------------------------------------------------------

const CELL = 40 // taille d'une case en pixels « contenu » (avant zoom)

export function Grid({ puzzle, filled, flatGrid, onPaint }) {
  const viewportRef = useRef(null)
  const contentRef = useRef(null)

  // Transform courante : échelle + translation (en pixels écran).
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })

  // Miroir de `transform` en ref pour être lu dans les gestionnaires de
  // gestes sans dépendances périmées (closures).
  const transformRef = useRef(transform)
  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  // Bornes de zoom, recalculées à chaque ajustement.
  const scaleBounds = useRef({ min: 0.2, max: 6 })

  // Feedback « mauvaise couleur ».
  const [wrongIndex, setWrongIndex] = useState(null)
  const wrongTimer = useRef(null)

  // Suivi des pointeurs et du geste en cours (refs : pas de re-render).
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  const clampScale = (s) =>
    Math.min(scaleBounds.current.max, Math.max(scaleBounds.current.min, s))

  // ----- Ajustement automatique à l'écran ---------------------------------

  const fitToView = useCallback(() => {
    const vp = viewportRef.current
    const content = contentRef.current
    if (!vp || !content) return
    const rect = vp.getBoundingClientRect()
    const cw = content.offsetWidth
    const ch = content.offsetHeight
    if (!cw || !ch) return

    const rawFit = Math.min(rect.width / cw, rect.height / ch)
    const fit = Math.min(rawFit * 0.95, 2) // marge, et on évite des cases géantes
    scaleBounds.current = {
      min: Math.min(rawFit * 0.9, fit), // on peut toujours voir tout le dessin
      max: Math.max(fit * 4, 1.6), // et zoomer assez pour les petites cases
    }
    setTransform({
      scale: fit,
      x: (rect.width - cw * fit) / 2,
      y: (rect.height - ch * fit) / 2,
    })
  }, [])

  // Ajuste au montage et à chaque changement de dessin.
  useLayoutEffect(() => {
    fitToView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id])

  // Réajuste si la fenêtre change de taille.
  useEffect(() => {
    const onResize = () => fitToView()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitToView])

  // ----- Zoom centré sur un point (molette / boutons) ---------------------

  const zoomAround = useCallback((nextScale, px, py) => {
    setTransform((prev) => {
      const scale = clampScale(nextScale)
      const ratio = scale / prev.scale
      const x = px - (px - prev.x) * ratio
      const y = py - (py - prev.y) * ratio
      return constrain({ scale, x, y }, viewportRef.current, contentRef.current)
    })
  }, [])

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault()
      const rect = viewportRef.current.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      zoomAround(
        transformRef.current.scale * factor,
        e.clientX - rect.left,
        e.clientY - rect.top
      )
    },
    [zoomAround]
  )

  // ----- Feedback « mauvaise couleur » ------------------------------------

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

  // ----- Gestes (pointer events) ------------------------------------------

  // Coordonnées d'un point relatif au viewport.
  const toLocal = (clientX, clientY) => {
    const rect = viewportRef.current.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()]
    const mid = midpoint(a, b)
    gesture.current = {
      mode: 'pinch',
      startDist: distance(a, b),
      startScale: transformRef.current.scale,
      startMid: toLocal(mid.x, mid.y),
      startTf: { ...transformRef.current },
    }
  }

  const onPointerDown = useCallback((e) => {
    try {
      viewportRef.current.setPointerCapture(e.pointerId)
    } catch {
      // Certains navigateurs peuvent refuser la capture : ce n'est pas bloquant.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1) {
      gesture.current = {
        mode: 'pending', // deviendra tap, drag...
        startX: e.clientX,
        startY: e.clientY,
        startTf: { ...transformRef.current },
      }
    } else if (pointers.current.size === 2) {
      startPinch()
    }
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return

    // Pincement : zoom + déplacement en gardant le point sous les doigts fixe.
    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = distance(a, b)
      const midClient = midpoint(a, b)
      const mid = toLocal(midClient.x, midClient.y)
      const scale = clampScale(g.startScale * (dist / g.startDist))
      // Coordonnée « contenu » qui était sous le milieu au départ.
      const cx = (g.startMid.x - g.startTf.x) / g.startScale
      const cy = (g.startMid.y - g.startTf.y) / g.startScale
      setTransform(
        constrain(
          { scale, x: mid.x - cx * scale, y: mid.y - cy * scale },
          viewportRef.current,
          contentRef.current
        )
      )
      return
    }

    // Passage tap -> drag une fois le seuil de déplacement franchi.
    if (g.mode === 'pending') {
      const moved = Math.hypot(e.clientX - g.startX, e.clientY - g.startY)
      if (moved > DRAG_THRESHOLD) g.mode = 'drag'
    }

    if (g.mode === 'drag') {
      const dx = e.clientX - g.startX
      const dy = e.clientY - g.startY
      setTransform(
        constrain(
          { scale: g.startTf.scale, x: g.startTf.x + dx, y: g.startTf.y + dy },
          viewportRef.current,
          contentRef.current
        )
      )
    }
  }, [])

  const onPointerUp = useCallback((e) => {
    const g = gesture.current
    pointers.current.delete(e.pointerId)

    // Tap net (sans déplacement) => coloriage. On retrouve la case par ses
    // coordonnées : à cause de la capture de pointeur, e.target vise le viewport.
    if (g && g.mode === 'pending' && !g.noTap) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const target = el && el.closest('[data-index]')
      if (target) handlePaint(Number(target.getAttribute('data-index')))
    }

    if (pointers.current.size === 0) {
      gesture.current = null
    } else if (pointers.current.size === 1) {
      // On passait d'un pincement à un seul doigt : on prépare un déplacement,
      // sans déclencher de coloriage accidentel au relâchement.
      const [only] = [...pointers.current.entries()]
      gesture.current = {
        mode: 'pending',
        noTap: true,
        startX: only[1].x,
        startY: only[1].y,
        startTf: { ...transformRef.current },
      }
    }
  }, [handlePaint])

  // ----- Boutons de zoom ---------------------------------------------------

  const zoomButton = (factor) => () => {
    const rect = viewportRef.current.getBoundingClientRect()
    zoomAround(transformRef.current.scale * factor, rect.width / 2, rect.height / 2)
  }

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
          ref={contentRef}
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${puzzle.width}, ${CELL}px)`,
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
                  onPaint={() => handlePaint(index)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="zoom-controls">
        <button type="button" onClick={zoomButton(1 / 1.3)} aria-label="Dézoomer">−</button>
        <button type="button" onClick={fitToView} aria-label="Voir tout le dessin">⤢</button>
        <button type="button" onClick={zoomButton(1.3)} aria-label="Zoomer">+</button>
      </div>
    </div>
  )
}

// --- Constantes & helpers ---------------------------------------------------

const DRAG_THRESHOLD = 6 // px au-delà desquels un geste devient un déplacement

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// Empêche la grille de sortir complètement de l'écran, tout en autorisant son
// centrage quand elle est plus petite que le viewport.
function constrain(t, viewport, content) {
  if (!viewport || !content) return t
  const rect = viewport.getBoundingClientRect()
  const w = content.offsetWidth * t.scale
  const h = content.offsetHeight * t.scale
  const rangeX = rect.width - w
  const rangeY = rect.height - h
  const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b))
  return {
    scale: t.scale,
    x: clamp(t.x, 0, rangeX),
    y: clamp(t.y, 0, rangeY),
  }
}
