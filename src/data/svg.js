// ---------------------------------------------------------------------------
// Petits utilitaires pour générer des formes vectorielles (chemins SVG).
//
// Les dessins ne sont plus des grilles de pixels mais des ensembles de
// « régions » : des formes courbes délimitées par un contour, chacune associée
// à un numéro de couleur. On remplit une région entière en tapant dessus.
//
// Ces helpers produisent des chaînes `d` de <path> propres et lisses, et de
// quoi placer le petit numéro au centre de chaque forme.
// ---------------------------------------------------------------------------

const r2 = (n) => Math.round(n * 100) / 100

// Bande lisse comprise entre deux courbes y = top(x) et y = bottom(x).
// top/bottom peuvent être des nombres (droites) ou des fonctions de x.
export function band(top, bottom, { x0 = 0, x1 = 100, step = 2 } = {}) {
  const fTop = typeof top === 'function' ? top : () => top
  const fBot = typeof bottom === 'function' ? bottom : () => bottom
  let d = `M ${r2(x0)} ${r2(fTop(x0))}`
  for (let x = x0 + step; x <= x1; x += step) d += ` L ${r2(x)} ${r2(fTop(x))}`
  d += ` L ${r2(x1)} ${r2(fBot(x1))}`
  for (let x = x1 - step; x >= x0; x -= step) d += ` L ${r2(x)} ${r2(fBot(x))}`
  return d + ' Z'
}

// Disque plein (cercle) sous forme de chemin.
export function disc(cx, cy, r) {
  return (
    `M ${r2(cx - r)} ${r2(cy)} ` +
    `a ${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0 ` +
    `a ${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0 Z`
  )
}

// Ellipse pleine.
export function ellipse(cx, cy, rx, ry) {
  return (
    `M ${r2(cx - rx)} ${r2(cy)} ` +
    `a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(2 * rx)} 0 ` +
    `a ${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-2 * rx)} 0 Z`
  )
}

// Polygone à partir de points [[x,y], ...].
export function polygon(points) {
  return (
    'M ' +
    points.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(' L ') +
    ' Z'
  )
}

// Chemin fermé lisse passant par des points de contrôle (Catmull-Rom -> Bézier).
// Idéal pour des silhouettes organiques (pétales, ailes, corps d'animaux).
export function smoothClosed(points) {
  const p = points
  const n = p.length
  if (n < 3) return polygon(points)
  let d = `M ${r2(p[0][0])} ${r2(p[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]
    const p1 = p[i]
    const p2 = p[(i + 1) % n]
    const p3 = p[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${r2(c1x)} ${r2(c1y)}, ${r2(c2x)} ${r2(c2y)}, ${r2(p2[0])} ${r2(p2[1])}`
  }
  return d + ' Z'
}

// Secteur / part de disque (utile pour les pétales rayonnants, la montgolfière).
export function sector(cx, cy, rInner, rOuter, a0, a1, steps = 10) {
  const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  let d = `M ${pts(pt(rInner, a0))}`
  for (let i = 0; i <= steps; i++) d += ` L ${pts(pt(rOuter, a0 + ((a1 - a0) * i) / steps))}`
  for (let i = steps; i >= 0; i--) d += ` L ${pts(pt(rInner, a0 + ((a1 - a0) * i) / steps))}`
  return d + ' Z'
}

const pts = ([x, y]) => `${r2(x)} ${r2(y)}`

// Rotation d'un point autour d'un centre (radians).
export function rotate([x, y], cx, cy, a) {
  const dx = x - cx
  const dy = y - cy
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]
}
