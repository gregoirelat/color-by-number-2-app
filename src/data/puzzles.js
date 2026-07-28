import { band, disc, ellipse, polygon, smoothClosed } from './svg.js'

// ---------------------------------------------------------------------------
// Catalogue des dessins.
//
// Chaque dessin est vectoriel : une liste de « régions » (formes courbes)
// portant chacune un numéro de couleur. On remplit une région en tapant dessus.
// La profondeur vient des palettes en dégradé de tons (clair -> foncé) et de
// formes emboîtées (une zone claire au centre d'une zone plus foncée).
//
// Format :
//   { id, name, difficulty, viewBox:{w,h}, colors:[{number,hex,name}],
//     regions:[ { number, d, label:{x,y} } ] }
// ---------------------------------------------------------------------------

function make(def) {
  return { ...def, regionCount: def.regions.length }
}

// Barycentre d'un nuage de points (pour placer un numéro au centre d'une forme).
function centroid(points) {
  const s = points.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0])
  return { x: s[0] / points.length, y: s[1] / points.length }
}

// Couronne de pétales rayonnants autour d'un centre. Renvoie des régions.
// `colors` est parcouru en boucle (alternance de tons -> relief).
function petalRing(cx, cy, rIn, rOut, count, colors, start = -Math.PI / 2) {
  const regs = []
  const w = (Math.PI / count) * 0.92 // demi-largeur angulaire d'un pétale
  for (let i = 0; i < count; i++) {
    const a = start + (i * 2 * Math.PI) / count
    const P = (r, ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]
    const pts = [
      P(rIn, a - w),
      P(rOut * 0.72, a - w * 0.6),
      P(rOut, a),
      P(rOut * 0.72, a + w * 0.6),
      P(rIn, a + w),
    ]
    const lab = P((rIn + rOut) / 2, a)
    regs.push({
      number: colors[i % colors.length],
      d: smoothClosed(pts),
      label: { x: lab[0], y: lab[1] },
    })
  }
  return regs
}

// ===========================================================================
// 1. Coucher de soleil (Facile)
// ===========================================================================

const sunset = make({
  id: 'sunset',
  name: 'Coucher de soleil',
  difficulty: 'Facile',
  viewBox: { w: 100, h: 100 },
  colors: [
    { number: 1, hex: '#5b4b8a', name: 'Ciel nuit' },
    { number: 2, hex: '#9b5c8f', name: 'Ciel mauve' },
    { number: 3, hex: '#e0728a', name: 'Ciel rose' },
    { number: 4, hex: '#ff9e6d', name: 'Ciel orangé' },
    { number: 5, hex: '#ffd27d', name: 'Halo' },
    { number: 6, hex: '#fff1b8', name: 'Soleil' },
    { number: 7, hex: '#b98cae', name: 'Collines loin' },
    { number: 8, hex: '#7d5c86', name: 'Collines' },
    { number: 9, hex: '#4a3a5e', name: 'Collines près' },
  ],
  regions: (() => {
    const wFar = (x) => 55 + 4 * Math.sin((x / 100) * Math.PI * 2 + 0.6)
    const wMid = (x) => 68 + 5 * Math.sin((x / 100) * Math.PI * 2 + 2.4)
    const wNear = (x) => 82 + 6 * Math.sin((x / 100) * Math.PI * 2 + 4.1)
    return [
      { number: 1, d: band(0, 15), label: { x: 12, y: 8 } },
      { number: 2, d: band(15, 28), label: { x: 12, y: 21 } },
      { number: 3, d: band(28, 40), label: { x: 12, y: 34 } },
      { number: 4, d: band(40, 50), label: { x: 12, y: 45 } },
      { number: 5, d: band(50, 58), label: { x: 88, y: 53 } },
      { number: 6, d: disc(54, 50, 15), label: { x: 54, y: 44 } },
      { number: 7, d: band(wFar, wMid), label: { x: 30, y: 62 } },
      { number: 8, d: band(wMid, wNear), label: { x: 70, y: 74 } },
      { number: 9, d: band(wNear, 100), label: { x: 50, y: 92 } },
    ]
  })(),
})

// ===========================================================================
// 2. Tournesol (Moyen)
// ===========================================================================

const sunflower = make({
  id: 'sunflower',
  name: 'Tournesol',
  difficulty: 'Moyen',
  viewBox: { w: 100, h: 100 },
  colors: [
    { number: 1, hex: '#dff1ff', name: 'Ciel' },
    { number: 2, hex: '#ffd23f', name: 'Pétales clairs' },
    { number: 3, hex: '#ff9f1c', name: 'Pétales foncés' },
    { number: 4, hex: '#b5732e', name: 'Cœur' },
    { number: 5, hex: '#5e3a1e', name: 'Graines' },
    { number: 6, hex: '#7ec850', name: 'Feuille claire' },
    { number: 7, hex: '#4f9e3a', name: 'Tige & feuille' },
  ],
  regions: (() => {
    const cx = 50
    const cy = 40
    const regs = []
    regs.push({ number: 1, d: 'M 0 0 H 100 V 100 H 0 Z', label: { x: 12, y: 12 } })
    // Tige
    regs.push({
      number: 7,
      d: polygon([[47, 52], [53, 52], [54, 100], [46, 100]]),
      label: { x: 50, y: 82 },
    })
    // Feuilles
    const leafL = [[47, 70], [30, 66], [20, 74], [33, 80], [47, 76]]
    const leafR = [[53, 78], [68, 74], [80, 82], [66, 88], [53, 84]]
    regs.push({ number: 6, d: smoothClosed(leafL), label: centroid(leafL) })
    regs.push({ number: 7, d: smoothClosed(leafR), label: centroid(leafR) })
    // Pétales (deux couronnes décalées : relief)
    petalRing(cx, cy, 18, 30, 16, [3], -Math.PI / 2 + Math.PI / 16).forEach((r) => regs.push(r))
    petalRing(cx, cy, 14, 27, 16, [2], -Math.PI / 2).forEach((r) => regs.push(r))
    // Cœur
    regs.push({ number: 4, d: disc(cx, cy, 15), label: { x: cx, y: cy - 9 } })
    regs.push({ number: 5, d: disc(cx, cy, 10), label: { x: cx, y: cy } })
    return regs
  })(),
})

// ===========================================================================
// 3. Montgolfière (Moyen)
// ===========================================================================

const balloon = make({
  id: 'balloon',
  name: 'Montgolfière',
  difficulty: 'Moyen',
  viewBox: { w: 100, h: 120 },
  colors: [
    { number: 1, hex: '#cdeafd', name: 'Ciel' },
    { number: 2, hex: '#ffffff', name: 'Nuage' },
    { number: 3, hex: '#ff6b6b', name: 'Rouge' },
    { number: 4, hex: '#ff9f43', name: 'Orange' },
    { number: 5, hex: '#ffd23f', name: 'Jaune' },
    { number: 6, hex: '#2ec4b6', name: 'Turquoise' },
    { number: 7, hex: '#4d96ff', name: 'Bleu' },
    { number: 8, hex: '#a06a3f', name: 'Nacelle' },
    { number: 9, hex: '#6b4a2b', name: 'Cordes' },
  ],
  regions: (() => {
    const cx = 50
    const cy = 44
    const rx = 33
    const ry = 40
    const regs = []
    regs.push({ number: 1, d: 'M 0 0 H 100 V 120 H 0 Z', label: { x: 12, y: 12 } })

    // Fuseaux qui bombent et convergent aux pôles (volume du ballon).
    const gores = 8
    const goreColors = [3, 4, 5, 6, 7, 3, 4, 5]
    const steps = 14
    const meridian = (s) => {
      const pts = []
      for (let k = 0; k <= steps; k++) {
        const phi = -Math.PI / 2 + (Math.PI * k) / steps
        pts.push([cx + rx * s * Math.cos(phi), cy + ry * Math.sin(phi)])
      }
      return pts
    }
    for (let i = 0; i < gores; i++) {
      const s0 = -1 + (2 * i) / gores
      const s1 = -1 + (2 * (i + 1)) / gores
      const L = meridian(s0)
      const R = meridian(s1)
      let d = `M ${L[0][0].toFixed(2)} ${L[0][1].toFixed(2)}`
      for (let k = 1; k <= steps; k++) d += ` L ${L[k][0].toFixed(2)} ${L[k][1].toFixed(2)}`
      for (let k = steps; k >= 0; k--) d += ` L ${R[k][0].toFixed(2)} ${R[k][1].toFixed(2)}`
      d += ' Z'
      regs.push({ number: goreColors[i], d, label: { x: cx + rx * ((s0 + s1) / 2) * 0.75, y: cy } })
    }

    // Cordes
    const cordL = [[cx - 18, 78], [cx - 14, 79], [cx - 11, 96], [cx - 13, 96]]
    const cordR = [[cx + 18, 78], [cx + 14, 79], [cx + 11, 96], [cx + 13, 96]]
    regs.push({ number: 9, d: polygon(cordL), label: centroid(cordL) })
    regs.push({ number: 9, d: polygon(cordR), label: centroid(cordR) })
    // Nacelle
    const basket = [[cx - 11, 96], [cx + 11, 96], [cx + 8, 110], [cx - 8, 110]]
    regs.push({ number: 8, d: polygon(basket), label: centroid(basket) })
    // Nuages
    regs.push({ number: 2, d: ellipse(20, 92, 12, 5), label: { x: 20, y: 92 } })
    regs.push({ number: 2, d: ellipse(82, 30, 11, 5), label: { x: 82, y: 30 } })
    return regs
  })(),
})

// ===========================================================================
// 4. Papillon (Difficile) — symétrique, ailes à tons emboîtés.
// ===========================================================================

const butterflyColors = [
  { number: 1, hex: '#eaf3f7', name: 'Fond' },
  { number: 2, hex: '#4d7cff', name: 'Aile bleue' },
  { number: 3, hex: '#8fb3ff', name: 'Aile claire' },
  { number: 4, hex: '#ff8c42', name: 'Ocelle' },
  { number: 5, hex: '#ffd23f', name: 'Point doré' },
  { number: 6, hex: '#7a4fd0', name: 'Aile violette' },
  { number: 7, hex: '#b18cf0', name: 'Violet clair' },
  { number: 8, hex: '#3a3550', name: 'Corps' },
]
const butterflyRegions = (() => {
  const W = 100
  const mir = (pts) => pts.map(([x, y]) => [W - x, y])
  const scaleTo = (pts, c, f) => pts.map(([x, y]) => [c.x + (x - c.x) * f, c.y + (y - c.y) * f])
  const regs = []
  regs.push({ number: 1, d: 'M 0 0 H 100 V 100 H 0 Z', label: { x: 10, y: 10 } })

  // --- Aile supérieure gauche (le numéro externe est placé dans l'anneau
  // extérieur, hors de la zone claire emboîtée). ---
  const upper = [[48, 40], [40, 22], [24, 12], [11, 20], [10, 38], [22, 48], [46, 47]]
  const upperC = centroid(upper)
  regs.push({ number: 2, d: smoothClosed(upper), label: { x: 14, y: 24 } })
  const upperIn = scaleTo(upper, upperC, 0.6)
  regs.push({ number: 3, d: smoothClosed(upperIn), label: centroid(upperIn) })
  regs.push({ number: 4, d: disc(22, 26, 5), label: { x: 22, y: 26 } })
  regs.push({ number: 5, d: disc(22, 26, 2.4), label: { x: 22, y: 26 } })

  // --- Aile inférieure gauche ---
  const lower = [[48, 56], [38, 62], [26, 74], [30, 88], [44, 82], [48, 68]]
  const lowerC = centroid(lower)
  regs.push({ number: 6, d: smoothClosed(lower), label: { x: 31, y: 84 } })
  const lowerIn = scaleTo(lower, lowerC, 0.58)
  regs.push({ number: 7, d: smoothClosed(lowerIn), label: centroid(lowerIn) })
  regs.push({ number: 5, d: disc(34, 76, 3), label: { x: 34, y: 76 } })

  // --- Miroir : aile supérieure/inférieure droites ---
  const upperR = mir(upper)
  const upperRC = centroid(upperR)
  regs.push({ number: 2, d: smoothClosed(upperR), label: { x: W - 14, y: 24 } })
  const upperRIn = scaleTo(upperR, upperRC, 0.6)
  regs.push({ number: 3, d: smoothClosed(upperRIn), label: centroid(upperRIn) })
  regs.push({ number: 4, d: disc(W - 22, 26, 5), label: { x: W - 22, y: 26 } })
  regs.push({ number: 5, d: disc(W - 22, 26, 2.4), label: { x: W - 22, y: 26 } })

  const lowerR = mir(lower)
  const lowerRC = centroid(lowerR)
  regs.push({ number: 6, d: smoothClosed(lowerR), label: { x: W - 31, y: 84 } })
  const lowerRIn = scaleTo(lowerR, lowerRC, 0.58)
  regs.push({ number: 7, d: smoothClosed(lowerRIn), label: centroid(lowerRIn) })
  regs.push({ number: 5, d: disc(W - 34, 76, 3), label: { x: W - 34, y: 76 } })

  // --- Corps + tête + antennes ---
  regs.push({ number: 8, d: ellipse(50, 55, 3.4, 22), label: { x: 50, y: 62 } })
  regs.push({ number: 8, d: disc(50, 28, 4.5), label: { x: 50, y: 28 } })
  regs.push({
    number: 8,
    d: polygon([[50, 26], [42, 12], [43.5, 11], [51, 24]]),
    label: { x: 45, y: 16 },
  })
  regs.push({
    number: 8,
    d: polygon([[50, 26], [58, 12], [56.5, 11], [49, 24]]),
    label: { x: 55, y: 16 },
  })
  return regs
})()

const butterfly = make({
  id: 'butterfly',
  name: 'Papillon',
  difficulty: 'Difficile',
  viewBox: { w: 100, h: 100 },
  colors: butterflyColors,
  regions: butterflyRegions,
})

// ===========================================================================
// 5. Rosace (Expert) — mandala floral, plusieurs couronnes de pétales.
// ===========================================================================

const rosace = make({
  id: 'rosace',
  name: 'Rosace',
  difficulty: 'Expert',
  viewBox: { w: 100, h: 100 },
  colors: [
    { number: 1, hex: '#fbeefb', name: 'Fond' },
    { number: 2, hex: '#7a4fd0', name: 'Violet' },
    { number: 3, hex: '#9b6ae0', name: 'Violet clair' },
    { number: 4, hex: '#4d96ff', name: 'Bleu' },
    { number: 5, hex: '#2ec4b6', name: 'Turquoise' },
    { number: 6, hex: '#ff6b9d', name: 'Rose' },
    { number: 7, hex: '#ff9f1c', name: 'Orange' },
    { number: 8, hex: '#ffd23f', name: 'Jaune' },
  ],
  regions: (() => {
    const cx = 50
    const cy = 50
    const regs = []
    regs.push({ number: 1, d: 'M 0 0 H 100 V 100 H 0 Z', label: { x: 8, y: 8 } })
    // Trois couronnes concentriques, chacune en deux tons alternés.
    petalRing(cx, cy, 30, 47, 28, [2, 3]).forEach((r) => regs.push(r))
    petalRing(cx, cy, 17, 33, 20, [4, 5], Math.PI / 20).forEach((r) => regs.push(r))
    petalRing(cx, cy, 7, 20, 12, [6, 7]).forEach((r) => regs.push(r))
    regs.push({ number: 8, d: disc(cx, cy, 8), label: { x: cx, y: cy } })
    return regs
  })(),
})

// ===========================================================================

export const puzzles = [sunset, sunflower, balloon, butterfly, rosace]

export const difficultyOrder = ['Facile', 'Moyen', 'Difficile', 'Expert']
