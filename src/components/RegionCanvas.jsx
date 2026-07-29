import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Canevas vectoriel : affiche un dessin comme un ensemble de régions SVG et
// gère le zoom / déplacement / pincement.
//
// Performance : les dessins « photo » comptent plusieurs milliers de facettes.
// Deux principes pour rester fluide :
//   - le SVG (mémoïsé) n'est PAS re-rendu pendant le zoom/déplacement (seul le
//     `transform` du conteneur change) ;
//   - colorier une facette met à jour SON nœud DOM directement, sans re-rendre
//     les milliers d'autres. Un re-rendu complet n'a lieu que sur les
//     changements globaux (couleur active, réinitialisation).
// ---------------------------------------------------------------------------

const BASE = 8
const DRAG_THRESHOLD = 6

export function RegionCanvas({ puzzle, filled, activeColor, renderTick, onPaint }) {
  const viewportRef = useRef(null)
  const contentRef = useRef(null)

  // Miroir de `filled` mis à jour pendant le rendu : le SVG mémoïsé le lit au
  // moment où il se re-rend (couleur active / reset) pour afficher l'état exact.
  const filledRef = useRef(filled)
  filledRef.current = filled

  const colorMap = useMemo(() => new Map(puzzle.colors.map((c) => [c.number, c.hex])), [puzzle])
  const regionNumbers = useMemo(() => puzzle.regions.map((r) => r.number), [puzzle])
  // Indices des régions par numéro de couleur (pour la surbrillance).
  const indicesByColor = useMemo(() => {
    const m = new Map()
    puzzle.regions.forEach((r, i) => {
      if (!m.has(r.number)) m.set(r.number, [])
      m.get(r.number).push(i)
    })
    return m
  }, [puzzle])
  const prevActive = useRef(null)

  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(transform)
  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  const scaleBounds = useRef({ min: 0.2, max: 6 })
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const wrongTimers = useRef(new Map())

  const clampScale = (s) => Math.min(scaleBounds.current.max, Math.max(scaleBounds.current.min, s))

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
    setTransform({ scale: fit, x: (rect.width - cw * fit) / 2, y: (rect.height - ch * fit) / 2 })
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

  // ----- Zoom centré ------------------------------------------------------

  const zoomAround = useCallback(
    (nextScale, px, py) => {
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
    },
    [cw, ch]
  )

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault()
      const rect = viewportRef.current.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      zoomAround(transformRef.current.scale * factor, e.clientX - rect.left, e.clientY - rect.top)
    },
    [zoomAround]
  )

  // ----- Coloriage (mise à jour DOM directe) ------------------------------

  const svgEl = () => contentRef.current && contentRef.current.querySelector('svg.art')

  // Applique visuellement le coloriage d'une facette sans re-rendre le SVG.
  const applyFilled = useCallback(
    (index) => {
      const svg = svgEl()
      if (!svg) return
      const path = svg.querySelector(`path[data-region="${index}"]`)
      if (path) {
        const base = colorMap.get(regionNumbers[index]) || '#fff'
        path.setAttribute('fill', base)
        path.classList.add('region--done')
        path.classList.remove('region--target')
        if (puzzle.smooth) {
          path.setAttribute('stroke', base)
          path.classList.add('region--blend')
        }
      }
      // On masque le numéro par l'opacité (changement « peinture », pas de
      // recalcul de mise en page — contrairement à display:none).
      const txt = svg.querySelector(`text[data-num="${index}"]`)
      if (txt) {
        txt.style.opacity = '0'
        txt.classList.remove('region__num--target')
      }
    },
    [colorMap, regionNumbers, puzzle.smooth]
  )

  // Surbrillance de la couleur active, appliquée en DOM direct (jamais via un
  // re-rendu React) : uniquement des changements de peinture -> aucun recalcul
  // de mise en page, donc les taps restent instantanés même à plusieurs
  // milliers de facettes.
  useEffect(() => {
    const svg = svgEl()
    if (!svg) return
    const setTarget = (i, on) => {
      if (filledRef.current[i]) return
      const path = svg.querySelector(`path[data-region="${i}"]`)
      if (path) {
        path.setAttribute('fill', on ? tint(colorMap.get(regionNumbers[i]) || '#fff', 0.3) : '#fcfcfd')
        path.classList.toggle('region--target', on)
      }
      const txt = svg.querySelector(`text[data-num="${i}"]`)
      if (txt) txt.classList.toggle('region__num--target', on)
    }
    if (prevActive.current != null && prevActive.current !== activeColor) {
      for (const i of indicesByColor.get(prevActive.current) || []) setTarget(i, false)
    }
    for (const i of indicesByColor.get(activeColor) || []) setTarget(i, true)
    prevActive.current = activeColor
    // renderTick : après un « Recommencer », le SVG est re-rendu neutre -> on
    // réapplique la surbrillance.
  }, [activeColor, renderTick, indicesByColor, colorMap, regionNumbers])

  const flashWrong = useCallback((index) => {
    const svg = svgEl()
    const path = svg && svg.querySelector(`path[data-region="${index}"]`)
    if (!path) return
    path.classList.add('region--wrong')
    if (wrongTimers.current.has(index)) clearTimeout(wrongTimers.current.get(index))
    wrongTimers.current.set(
      index,
      setTimeout(() => path.classList.remove('region--wrong'), 320)
    )
  }, [])

  const handlePaint = useCallback(
    (index) => {
      if (filledRef.current[index]) return
      const ok = onPaint(index)
      if (ok) applyFilled(index)
      else flashWrong(index)
    },
    [onPaint, applyFilled, flashWrong]
  )

  // ----- Gestes -----------------------------------------------------------

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
      gesture.current = { mode: 'pending', startX: e.clientX, startY: e.clientY, startTf: { ...transformRef.current } }
    } else if (pointers.current.size === 2) {
      startPinch()
    }
  }, [])

  const onPointerMove = useCallback(
    (e) => {
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
        setTransform(constrain({ scale, x: mid.x - kx * scale, y: mid.y - ky * scale }, viewportRef.current, cw, ch))
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
          constrain({ scale: g.startTf.scale, x: g.startTf.x + dx, y: g.startTf.y + dy }, viewportRef.current, cw, ch)
        )
      }
    },
    [cw, ch]
  )

  const onPointerUp = useCallback(
    (e) => {
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
        gesture.current = { mode: 'pending', noTap: true, startX: only.x, startY: only.y, startTf: { ...transformRef.current } }
      }
    },
    [handlePaint]
  )

  const zoomButton = (factor) => () => {
    const rect = viewportRef.current.getBoundingClientRect()
    zoomAround(transformRef.current.scale * factor, rect.width / 2, rect.height / 2)
  }

  // Remplit les zones de la couleur active actuellement visibles à l'écran.
  const fillVisible = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const t = transformRef.current
    const sx = cw / puzzle.viewBox.w
    const sy = ch / puzzle.viewBox.h
    puzzle.regions.forEach((region, index) => {
      if (filledRef.current[index] || region.number !== activeColor) return
      const px = t.x + t.scale * region.label.x * sx
      const py = t.y + t.scale * region.label.y * sy
      if (px >= 0 && px <= rect.width && py >= 0 && py <= rect.height) {
        if (onPaint(index)) applyFilled(index)
      }
    })
  }, [puzzle, activeColor, onPaint, applyFilled, cw, ch])

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
          <Artwork
            puzzle={puzzle}
            filledRef={filledRef}
            renderTick={renderTick}
            colorMap={colorMap}
            cw={cw}
            ch={ch}
          />
        </div>
      </div>

      <button type="button" className="assist-btn" onClick={fillVisible}>
        🪣 Remplir la vue
      </button>

      <div className="zoom-controls">
        <button type="button" onClick={zoomButton(1 / 1.3)} aria-label="Dézoomer">−</button>
        <button type="button" onClick={fitToView} aria-label="Voir tout le dessin">⤢</button>
        <button type="button" onClick={zoomButton(1.3)} aria-label="Zoomer">+</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rendu SVG complet. Mémoïsé : ne se re-rend que sur un changement global
// (couleur active, réinitialisation, taille), jamais pendant le zoom, le
// déplacement ou le coloriage d'une facette (géré en DOM direct).
// ---------------------------------------------------------------------------

const Artwork = memo(function Artwork({ puzzle, filledRef, colorMap, cw, ch }) {
  const filled = filledRef.current
  const colorOf = (n) => colorMap.get(n) || '#fff'
  // Taille du numéro : adaptée à la facette pour les dessins low-poly, sinon
  // relative à la taille du dessin.
  const fontSize = puzzle.numberSize || Math.max(1.8, Math.min(puzzle.viewBox.w, puzzle.viewBox.h) / 26)
  const smooth = !!puzzle.smooth
  const faint = !!puzzle.faint

  // Le rendu React est « neutre » : état rempli / non rempli seulement. La
  // surbrillance de la couleur active est appliquée ensuite en DOM direct
  // (voir RegionCanvas) pour ne jamais invalider la mise en page du SVG.
  return (
    <svg viewBox={`0 0 ${puzzle.viewBox.w} ${puzzle.viewBox.h}`} width={cw} height={ch} className="art">
      {puzzle.regions.map((region, index) => {
        const done = !!filled[index]
        return (
          <RegionItem
            key={index}
            index={index}
            d={region.d}
            base={colorOf(region.number)}
            done={done}
            smooth={smooth}
            faint={faint}
            lx={region.label.x}
            ly={region.label.y}
            num={region.number}
            fontSize={fontSize}
          />
        )
      })}
    </svg>
  )
})

const RegionItem = memo(function RegionItem({ index, d, base, done, smooth, faint, lx, ly, num, fontSize }) {
  const stroke = done && smooth ? base : undefined
  return (
    <>
      <path
        data-region={index}
        d={d}
        fill={done ? base : '#fcfcfd'}
        stroke={stroke}
        className={
          'region' +
          (done ? ' region--done' : '') +
          (stroke ? ' region--blend' : '') +
          (done && faint ? ' region--faint' : '')
        }
      />
      {!done && (
        <text
          data-num={index}
          x={lx}
          y={ly}
          className="region__num"
          fontSize={fontSize}
          dominantBaseline="central"
          textAnchor="middle"
        >
          {num}
        </text>
      )}
    </>
  )
})

// Convertit un hex #rrggbb en rgba() avec transparence (pour la teinte d'aide).
function tint(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

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
  const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b))
  return { scale: t.scale, x: clamp(t.x, 0, rect.width - w), y: clamp(t.y, 0, rect.height - h) }
}
