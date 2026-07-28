import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Canevas vectoriel : affiche un dessin comme un ensemble de régions SVG et
// gère le zoom / déplacement / pincement.
//
// - Tant qu'une région n'est pas remplie : contour fin + petit numéro au centre.
// - On tape une région : si elle correspond à la couleur active, elle se
//   remplit ; sinon petit clignotement de contour (feedback).
// - Molette / pincement à deux doigts : zoom. Glisser : déplacement.
// - Le dessin est ajusté automatiquement à l'écran (fit-to-view).
// ---------------------------------------------------------------------------

const BASE = 8 // pixels « contenu » par unité de viewBox (avant zoom)
const DRAG_THRESHOLD = 6

export function RegionCanvas({ puzzle, filled, onPaint }) {
  const viewportRef = useRef(null)
  const contentRef = useRef(null)

  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(transform)
  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  const scaleBounds = useRef({ min: 0.2, max: 6 })

  const [wrongId, setWrongId] = useState(null)
  const wrongTimer = useRef(null)

  const pointers = useRef(new Map())
  const gesture = useRef(null)

  const clampScale = (s) =>
    Math.min(scaleBounds.current.max, Math.max(scaleBounds.current.min, s))

  const cw = puzzle.viewBox.w * BASE
  const ch = puzzle.viewBox.h * BASE

  // ----- Ajustement automatique à l'écran ---------------------------------

  const fitToView = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const rawFit = Math.min(rect.width / cw, rect.height / ch)
    const fit = rawFit * 0.92
    scaleBounds.current = { min: fit * 0.9, max: Math.max(fit * 6, 2) }
    setTransform({
      scale: fit,
      x: (rect.width - cw * fit) / 2,
      y: (rect.height - ch * fit) / 2,
    })
  }, [cw, ch])

  useLayoutEffect(() => {
    fitToView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id])

  useEffect(() => {
    const onResize = () => fitToView()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitToView])

  // ----- Zoom centré sur un point -----------------------------------------

  const zoomAround = useCallback((nextScale, px, py) => {
    setTransform((prev) => {
      const scale = clampScale(nextScale)
      const ratio = scale / prev.scale
      return constrain(
        { scale, x: px - (px - prev.x) * ratio, y: py - (py - prev.y) * ratio },
        viewportRef.current,
        cw,
        ch
      )
    })
  }, [cw, ch])

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault()
      const rect = viewportRef.current.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      zoomAround(transformRef.current.scale * factor, e.clientX - rect.left, e.clientY - rect.top)
    },
    [zoomAround]
  )

  // ----- Feedback « mauvaise couleur » ------------------------------------

  const flashWrong = useCallback((id) => {
    setWrongId(id)
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
    wrongTimer.current = setTimeout(() => setWrongId(null), 320)
  }, [])

  const handlePaint = useCallback(
    (index) => {
      const ok = onPaint(index)
      if (!ok && !filled[index]) flashWrong(index)
    },
    [onPaint, filled, flashWrong]
  )

  // ----- Gestes ------------------------------------------------------------

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
      /* capture refusée : non bloquant */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      gesture.current = {
        mode: 'pending',
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

    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = distance(a, b)
      const mc = midpoint(a, b)
      const mid = toLocal(mc.x, mc.y)
      const scale = clampScale(g.startScale * (dist / g.startDist))
      const kx = (g.startMid.x - g.startTf.x) / g.startScale
      const ky = (g.startMid.y - g.startTf.y) / g.startScale
      setTransform(
        constrain(
          { scale, x: mid.x - kx * scale, y: mid.y - ky * scale },
          viewportRef.current,
          cw,
          ch
        )
      )
      return
    }

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
          cw,
          ch
        )
      )
    }
  }, [cw, ch])

  const onPointerUp = useCallback((e) => {
    const g = gesture.current
    pointers.current.delete(e.pointerId)

    if (g && g.mode === 'pending' && !g.noTap) {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const target = el && el.closest('[data-region]')
      if (target) handlePaint(Number(target.getAttribute('data-region')))
    }

    if (pointers.current.size === 0) {
      gesture.current = null
    } else if (pointers.current.size === 1) {
      const [only] = [...pointers.current.values()]
      gesture.current = {
        mode: 'pending',
        noTap: true,
        startX: only.x,
        startY: only.y,
        startTf: { ...transformRef.current },
      }
    }
  }, [handlePaint])

  const zoomButton = (factor) => () => {
    const rect = viewportRef.current.getBoundingClientRect()
    zoomAround(transformRef.current.scale * factor, rect.width / 2, rect.height / 2)
  }

  // ----- Rendu -------------------------------------------------------------

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
          className="canvas"
          style={{
            width: `${cw}px`,
            height: `${ch}px`,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <Artwork puzzle={puzzle} filled={filled} wrongId={wrongId} cw={cw} ch={ch} />
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

// ---------------------------------------------------------------------------
// Rendu SVG du dessin, isolé dans un composant mémoïsé : il ne se re-rend que
// lorsqu'une région change (coloriage / feedback), PAS pendant le zoom ou le
// déplacement. Indispensable pour rester fluide sur les dessins « low-poly »
// de plusieurs centaines de facettes.
// ---------------------------------------------------------------------------

const Artwork = memo(function Artwork({ puzzle, filled, wrongId, cw, ch }) {
  const colorOf = (n) => {
    const c = puzzle.colors.find((col) => col.number === n)
    return c ? c.hex : '#fff'
  }
  // Taille du numéro relative au dessin.
  const fontSize = Math.max(1.8, Math.min(puzzle.viewBox.w, puzzle.viewBox.h) / 26)

  return (
    <svg
      viewBox={`0 0 ${puzzle.viewBox.w} ${puzzle.viewBox.h}`}
      width={cw}
      height={ch}
      className="art"
    >
      {puzzle.regions.map((region, index) => {
        const done = filled[index]
        return (
          <path
            key={index}
            data-region={index}
            d={region.d}
            fill={done ? colorOf(region.number) : '#fcfcfd'}
            className={
              'region' +
              (done ? ' region--done' : '') +
              (wrongId === index ? ' region--wrong' : '')
            }
          />
        )
      })}
      {puzzle.regions.map((region, index) =>
        filled[index] ? null : (
          <text
            key={`t${index}`}
            x={region.label.x}
            y={region.label.y}
            className="region__num"
            fontSize={fontSize}
            dominantBaseline="central"
            textAnchor="middle"
          >
            {region.number}
          </text>
        )
      )}
    </svg>
  )
})

// --- Helpers ---------------------------------------------------------------

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function constrain(t, viewport, cw, ch) {
  if (!viewport) return t
  const rect = viewport.getBoundingClientRect()
  const w = cw * t.scale
  const h = ch * t.scale
  const rangeX = rect.width - w
  const rangeY = rect.height - h
  const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b))
  return { scale: t.scale, x: clamp(t.x, 0, rangeX), y: clamp(t.y, 0, rangeY) }
}
