import { band, disc, ellipse, polygon, smoothClosed } from './svg.js'
import { lowPoly, voronoiPhoto } from './lowpoly.js'

// Petits utilitaires de couleur pour les scènes « photo ».
const clampN = (v, a, b) => Math.min(b, Math.max(a, v))
const mixC = (c1, c2, t) => [
  c1[0] + (c2[0] - c1[0]) * t,
  c1[1] + (c2[1] - c1[1]) * t,
  c1[2] + (c2[2] - c1[2]) * t,
]
const gradC = (stops, t) => {
  t = clampN(t, 0, 1)
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i]
    const [p1, c1] = stops[i + 1]
    if (t <= p1) return mixC(c0, c1, clampN((t - p0) / (p1 - p0 || 1), 0, 1))
  }
  return stops[stops.length - 1][1]
}
// Bruit organique (somme de sinus) dans ~[-1, 1] pour nuages / aurores.
const noise2 = (x, y) =>
  Math.sin(x * 1.3 + y * 0.7) * 0.5 +
  Math.sin(x * 0.5 - y * 1.1 + 2.1) * 0.3 +
  Math.sin(x * 2.3 + y * 1.9 + 4.2) * 0.2
const fbm = (x, y) =>
  (noise2(x, y) + 0.5 * noise2(x * 2 + 3.1, y * 2 - 1.7) + 0.25 * noise2(x * 4 - 2.3, y * 4 + 5.1)) / 1.75
// Géométrie utilitaire pour composer des personnages.
const d2p = (x, y, cx, cy) => (x - cx) * (x - cx) + (y - cy) * (y - cy)
const inTri = (px, py, ax, ay, bx, by, cx, cy) => {
  const s1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const s2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const s3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const neg = s1 < 0 || s2 < 0 || s3 < 0
  const pos = s1 > 0 || s2 > 0 || s3 > 0
  return !(neg && pos)
}
const distSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = clampN(t, 0, 1)
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
// Étoiles déterministes.
function makeStars(n, w, h, seed) {
  let a = seed
  const rnd = () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff
    return a / 0x7fffffff
  }
  const s = []
  for (let i = 0; i < n; i++) s.push([rnd() * w, rnd() * h, 0.25 + rnd() * 0.6])
  return s
}

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
// 6. Poisson tropical (Moyen)
// ===========================================================================

const fish = make({
  id: 'fish',
  name: 'Poisson',
  difficulty: 'Moyen',
  viewBox: { w: 100, h: 72 },
  colors: [
    { number: 1, hex: '#bfe6ff', name: 'Eau' },
    { number: 2, hex: '#93d1f2', name: 'Eau profonde' },
    { number: 3, hex: '#ff9f43', name: 'Corps' },
    { number: 4, hex: '#ffc46b', name: 'Ventre' },
    { number: 5, hex: '#ef6b3a', name: 'Nageoires' },
    { number: 6, hex: '#ffe0a3', name: 'Rayures' },
    { number: 7, hex: '#ffffff', name: 'Œil' },
    { number: 8, hex: '#2b2b3a', name: 'Pupille' },
  ],
  regions: (() => {
    const regs = []
    regs.push({ number: 1, d: 'M 0 0 H 100 V 72 H 0 Z', label: { x: 10, y: 10 } })
    regs.push({ number: 2, d: band((x) => 54 + 4 * Math.sin(x / 12), 72), label: { x: 12, y: 66 } })
    // Nageoires (derrière le corps).
    regs.push({ number: 5, d: polygon([[70, 36], [92, 22], [86, 36], [92, 52]]), label: { x: 84, y: 36 } })
    regs.push({ number: 5, d: smoothClosed([[40, 20], [52, 6], [60, 20]]), label: { x: 51, y: 15 } })
    regs.push({ number: 5, d: smoothClosed([[40, 52], [48, 64], [56, 52]]), label: { x: 48, y: 57 } })
    // Corps
    const body = [[18, 36], [30, 20], [52, 16], [68, 26], [72, 36], [68, 47], [52, 56], [30, 52]]
    regs.push({ number: 3, d: smoothClosed(body), label: { x: 40, y: 30 } })
    // Ventre clair
    regs.push({ number: 4, d: smoothClosed([[26, 42], [46, 40], [62, 42], [52, 54], [32, 50]]), label: { x: 44, y: 46 } })
    // Rayures
    regs.push({ number: 6, d: smoothClosed([[44, 20], [50, 22], [48, 52], [42, 50]]), label: { x: 46, y: 36 } })
    regs.push({ number: 6, d: smoothClosed([[56, 22], [62, 26], [60, 48], [54, 50]]), label: { x: 58, y: 36 } })
    // Œil
    regs.push({ number: 7, d: disc(30, 30, 4.4), label: { x: 30, y: 30 } })
    regs.push({ number: 8, d: disc(29, 30, 2.1), label: { x: 29, y: 30 } })
    // Bulles
    regs.push({ number: 7, d: disc(15, 24, 2.6), label: { x: 15, y: 24 } })
    regs.push({ number: 7, d: disc(9, 16, 1.8), label: { x: 9, y: 16 } })
    return regs
  })(),
})

// ===========================================================================
// 7. Renard (Difficile) — face symétrique, tons emboîtés.
// ===========================================================================

const foxRegions = (() => {
  const W = 100
  const mir = (pts) => pts.map(([x, y]) => [W - x, y])
  const regs = []
  regs.push({ number: 1, d: 'M 0 0 H 100 V 100 H 0 Z', label: { x: 10, y: 10 } })

  // Oreilles (gauche puis miroir).
  const earOuter = [[47, 34], [30, 40], [17, 10]]
  const earInner = [[42, 32], [31, 36], [24, 17]]
  regs.push({ number: 2, d: smoothClosed(earOuter), label: { x: 30, y: 27 } })
  regs.push({ number: 5, d: smoothClosed(earInner), label: { x: 31, y: 26 } })
  regs.push({ number: 2, d: smoothClosed(mir(earOuter)), label: { x: W - 30, y: 27 } })
  regs.push({ number: 5, d: smoothClosed(mir(earInner)), label: { x: W - 31, y: 26 } })

  // Haut du visage (orange) gauche + miroir.
  const faceUp = [[50, 30], [30, 40], [26, 58], [42, 70], [50, 64]]
  regs.push({ number: 2, d: smoothClosed(faceUp), label: { x: 34, y: 46 } })
  regs.push({ number: 2, d: smoothClosed(mir(faceUp)), label: { x: W - 34, y: 46 } })
  // Front plus clair.
  const faceLight = [[50, 34], [39, 44], [38, 58], [50, 60]]
  regs.push({ number: 3, d: smoothClosed(faceLight), label: { x: 44, y: 48 } })
  regs.push({ number: 3, d: smoothClosed(mir(faceLight)), label: { x: W - 44, y: 48 } })

  // Joues blanches (bas du visage).
  const cheek = [[50, 64], [42, 70], [40, 84], [50, 88]]
  regs.push({ number: 4, d: smoothClosed(cheek), label: { x: 45, y: 78 } })
  regs.push({ number: 4, d: smoothClosed(mir(cheek)), label: { x: W - 45, y: 78 } })

  // Yeux.
  regs.push({ number: 5, d: smoothClosed([[41, 52], [36, 55], [41, 58], [45, 55]]), label: { x: 41, y: 55 } })
  regs.push({ number: 5, d: smoothClosed([[W - 41, 52], [W - 36, 55], [W - 41, 58], [W - 45, 55]]), label: { x: W - 41, y: 55 } })

  // Museau blanc central + truffe.
  regs.push({ number: 4, d: smoothClosed([[50, 62], [43, 82], [50, 92], [57, 82]]), label: { x: 50, y: 76 } })
  regs.push({ number: 5, d: smoothClosed([[50, 72], [45, 78], [50, 83], [55, 78]]), label: { x: 50, y: 78 } })
  return regs
})()

const fox = make({
  id: 'fox',
  name: 'Renard',
  difficulty: 'Difficile',
  viewBox: { w: 100, h: 100 },
  colors: [
    { number: 1, hex: '#eaf3f7', name: 'Fond' },
    { number: 2, hex: '#ef7d33', name: 'Orange' },
    { number: 3, hex: '#ffa24d', name: 'Orange clair' },
    { number: 4, hex: '#f7f2ec', name: 'Blanc' },
    { number: 5, hex: '#33303f', name: 'Noir' },
  ],
  regions: foxRegions,
})

// ===========================================================================
// 8. Montagnes (Expert) — scène low-poly, plusieurs centaines de facettes.
// ===========================================================================

const mountains = (() => {
  const w = 120
  const h = 84
  const colors = [
    { number: 1, hex: '#26315e', name: 'Ciel nuit' },
    { number: 2, hex: '#4a4e8c', name: 'Ciel' },
    { number: 3, hex: '#8a5e9c', name: 'Ciel mauve' },
    { number: 4, hex: '#d1738f', name: 'Ciel rose' },
    { number: 5, hex: '#f0956b', name: 'Horizon' },
    { number: 6, hex: '#ffcf86', name: 'Halo' },
    { number: 7, hex: '#fff0c2', name: 'Soleil' },
    { number: 8, hex: '#9aa6cf', name: 'Cime lointaine' },
    { number: 9, hex: '#7f8cbb', name: 'Mont lointain' },
    { number: 10, hex: '#6b6ea6', name: 'Cime' },
    { number: 11, hex: '#55568a', name: 'Montagne' },
    { number: 12, hex: '#3c3a67', name: 'Cime proche' },
    { number: 13, hex: '#2a2749', name: 'Montagne proche' },
    { number: 14, hex: '#1d1b36', name: 'Lac' },
  ]

  const ridgeBack = (u) => 30 + 7 * Math.sin(u * 5.2 + 1.5) + 3 * Math.sin(u * 11.3 + 2.1)
  const ridgeMid = (u) => 40 + 10 * Math.sin(u * 4.3 + 3.0) + 4 * Math.sin(u * 9.1 + 0.4)
  const ridgeFront = (u) => 50 + 12 * Math.sin(u * 3.1 + 0.6) + 5 * Math.sin(u * 7.7 + 1.2)
  const sun = { x: 0.72 * w, y: 25, r: 11 }

  // Choix du ton clair/foncé d'une montagne selon l'orientation de la pente.
  const shade = (ridge, u, light, dark) => {
    const s = ridge(u + 0.01) - ridge(u - 0.01)
    return s < 0 ? light : dark
  }

  const field = (x, y) => {
    const u = x / w
    if (y > 72) return 14 // lac au premier plan
    if (y >= ridgeFront(u)) return shade(ridgeFront, u, 12, 13)
    if (y >= ridgeMid(u)) return shade(ridgeMid, u, 10, 11)
    if (y >= ridgeBack(u)) return shade(ridgeBack, u, 8, 9)
    // Ciel
    const dSun = Math.hypot(x - sun.x, y - sun.y)
    if (dSun < sun.r) return 7
    if (dSun < sun.r + 8) return 6
    if (y < 9) return 1
    if (y < 17) return 2
    if (y < 24) return 3
    if (y < 30) return 4
    return 5
  }

  return lowPoly({
    id: 'mountains',
    name: 'Montagnes',
    difficulty: 'Expert',
    w,
    h,
    cols: 22,
    rows: 15,
    seed: 11,
    jitter: 0.62,
    colors,
    field,
  })
})()

// ===========================================================================
// 9. Forêt (Expert) — sapins low-poly en rangées qui s'éloignent.
// ===========================================================================

const forest = (() => {
  const w = 120
  const h = 84
  const colors = [
    { number: 1, hex: '#bfe3f5', name: 'Ciel' },
    { number: 2, hex: '#e3f3fb', name: 'Ciel bas' },
    { number: 3, hex: '#ffe9a8', name: 'Soleil' },
    { number: 4, hex: '#a7cf9a', name: 'Sapin loin clair' },
    { number: 5, hex: '#89bd86', name: 'Sapin loin' },
    { number: 6, hex: '#5f9e63', name: 'Sapin clair' },
    { number: 7, hex: '#417c49', name: 'Sapin' },
    { number: 8, hex: '#2c6138', name: 'Sapin proche clair' },
    { number: 9, hex: '#1c4a2a', name: 'Sapin proche' },
    { number: 10, hex: '#6b8a3f', name: 'Prairie' },
  ]

  // Un sapin = triangle pointe en haut. Renvoie 'L'/'R' (côté) ou null.
  const pine = (x, y, baseY, height, spacing, offset) => {
    const idx = Math.round((x - offset) / spacing)
    const xc = offset + idx * spacing
    const apexY = baseY - height
    if (y < apexY || y > baseY) return null
    const halfW = spacing * 0.6
    const wAtY = (halfW * (y - apexY)) / (baseY - apexY)
    if (Math.abs(x - xc) <= wAtY) return x < xc ? 'L' : 'R'
    return null
  }

  const sun = { x: 0.22 * w, y: 22, r: 8 }
  const field = (x, y) => {
    // Rangées de sapins, de la plus proche (devant) à la plus lointaine.
    const rows = [
      { baseY: 82, height: 40, sp: 16, off: 4, L: 8, R: 9 },
      { baseY: 68, height: 30, sp: 12, off: 9, L: 6, R: 7 },
      { baseY: 56, height: 22, sp: 10, off: 3, L: 4, R: 5 },
    ]
    for (const r of rows) {
      const s = pine(x, y, r.baseY, r.height, r.sp, r.off)
      if (s) return s === 'L' ? r.L : r.R
    }
    if (y > 72) return 10 // prairie
    // Ciel
    if (Math.hypot(x - sun.x, y - sun.y) < sun.r) return 3
    return y < 26 ? 1 : 2
  }

  return lowPoly({ id: 'forest', name: 'Forêt', difficulty: 'Expert', w, h, cols: 22, rows: 15, seed: 5, jitter: 0.55, colors, field })
})()

// ===========================================================================
// 10. Océan (Difficile) — houle low-poly en bandes dégradées, soleil.
// ===========================================================================

const ocean = (() => {
  const w = 120
  const h = 80
  const colors = [
    { number: 1, hex: '#ffe3b0', name: 'Ciel chaud' },
    { number: 2, hex: '#ffd0e0', name: 'Ciel rose' },
    { number: 3, hex: '#cfe4ff', name: 'Ciel' },
    { number: 4, hex: '#fff2c2', name: 'Soleil' },
    { number: 5, hex: '#8fe0e6', name: 'Écume' },
    { number: 6, hex: '#5fc6da', name: 'Mer claire' },
    { number: 7, hex: '#37a1c6', name: 'Mer' },
    { number: 8, hex: '#2079ac', name: 'Mer profonde' },
    { number: 9, hex: '#155688', name: 'Abysse' },
  ]

  const horizon = 30
  const sun = { x: 0.5 * w, y: 18, r: 9 }
  const field = (x, y) => {
    if (y < horizon) {
      if (Math.hypot(x - sun.x, y - sun.y) < sun.r) return 4
      if (y < 10) return 3
      if (y < 20) return 2
      return 1
    }
    // Mer : bandes ondulées, du clair (surface) au foncé (profondeur).
    const disp = 2.6 * Math.sin(x / 9 + y / 5) + 1.4 * Math.sin(x / 4 - y / 7)
    const depth = y - horizon + disp
    const bandH = (h - horizon) / 5
    const seaColors = [5, 6, 7, 8, 9]
    const bi = Math.max(0, Math.min(4, Math.floor(depth / bandH)))
    return seaColors[bi]
  }

  return lowPoly({ id: 'ocean', name: 'Océan', difficulty: 'Difficile', w, h, cols: 20, rows: 13, seed: 8, jitter: 0.6, colors, field })
})()

// ===========================================================================
// 11. Lac de montagne (Photo) — scène low-poly fine, quasi photographique.
// ===========================================================================

const lake = (() => {
  const W = 140
  const H = 100
  const horizon = 52
  const sun = { x: 0.62 * W, y: 39, r: 6.5 }

  // Crêtes des montagnes, de l'arrière (loin) vers l'avant (près de l'eau).
  const ridges = [
    { f: (u) => 46 - 4 * Math.sin(u * 3.3 + 0.6) - 2 * Math.sin(u * 7 + 1.0), base: [82, 84, 108], haze: 0.6, snow: [214, 214, 228] },
    { f: (u) => 49 - 6 * Math.sin(u * 2.6 + 2.0) - 3 * Math.sin(u * 6 + 0.3), base: [58, 56, 86], haze: 0.38, snow: [198, 190, 208] },
    { f: (u) => 52 - 9 * Math.sin(u * 2.0 + 0.2) - 4 * Math.sin(u * 5 + 1.5), base: [40, 36, 62], haze: 0.16, snow: [176, 158, 182] },
  ]

  const skyStops = [
    [0.0, [38, 30, 70]],
    [0.42, [96, 58, 112]],
    [0.7, [198, 96, 106]],
    [0.88, [242, 150, 108]],
    [1.0, [252, 198, 150]],
  ]

  const skyColor = (x, y) => {
    let c = gradC(skyStops, y / horizon)
    const dg = Math.hypot(x - sun.x, (y - sun.y) * 1.15)
    const glow = Math.exp(-(dg * dg) / (2 * 20 * 20))
    c = mixC(c, [255, 238, 184], glow * 0.92)
    if (Math.hypot(x - sun.x, y - sun.y) < sun.r) c = [255, 246, 208]
    return c
  }

  const mountainColor = (x, y, r) => {
    const u = x / W
    let c = mixC(r.base, [214, 150, 138], r.haze) // brume atmosphérique chaude
    // Lumière directionnelle : la pente tournée vers le soleil s'éclaire.
    const slope = r.f(u + 0.012) - r.f(u - 0.012)
    const litLeft = sun.x < W * 0.5
    const lit = litLeft ? slope > 0 : slope < 0
    c = mixC(c, lit ? [255, 216, 170] : [16, 14, 34], lit ? 0.28 : 0.34)
    // Neige au sommet.
    const below = y - r.f(u)
    if (below < 3.2) c = mixC(c, r.snow, clampN((3.2 - below) / 3.2, 0, 1) * 0.7)
    return c
  }

  // Couleur au-dessus de l'horizon (montagnes puis ciel).
  const aboveColor = (x, y) => {
    const u = x / W
    for (let i = ridges.length - 1; i >= 0; i--) {
      if (y >= ridges[i].f(u)) return mountainColor(x, y, ridges[i])
    }
    return skyColor(x, y)
  }

  const field = (x, y) => {
    if (y <= horizon) return aboveColor(x, y)
    // Lac : reflet compressé de ce qui est au-dessus, assombri + ondulations.
    const yr = horizon - (y - horizon) * 0.9
    let c = aboveColor(x, clampN(yr, 0, horizon))
    c = mixC(c, [22, 30, 58], 0.4)
    const rip = 0.5 + 0.5 * Math.sin((y - horizon) * 1.4 + Math.sin(x * 0.32) * 1.6)
    c = mixC(c, [14, 20, 44], rip * 0.14)
    // Colonne de reflet du soleil.
    const gl = Math.exp(-((x - sun.x) ** 2) / (2 * 9 * 9)) * clampN(1 - (y - horizon) / (H - horizon), 0, 1)
    c = mixC(c, [255, 232, 182], gl * 0.55)
    return c
  }

  return voronoiPhoto({
    id: 'lake',
    name: 'Lac de montagne',
    difficulty: 'Photo',
    w: W,
    h: H,
    cols: 56,
    rows: 40,
    seed: 3,
    jitter: 0.9,
    paletteSize: 120,
    field,
  })
})()

// ===========================================================================
// 12. Aurore boréale (Photo) — ciel nocturne, aurores, montagnes, reflet.
// ===========================================================================

const aurora = (() => {
  const W = 140
  const H = 100
  const horizon = 62
  const stars = makeStars(70, W, horizon - 6, 12345)
  const ridge = (u) => 60 - 5 * Math.sin(u * 3.4 + 0.5) - 3 * Math.sin(u * 8 + 1.2)

  const skyStops = [
    [0.0, [8, 10, 26]],
    [0.5, [16, 22, 50]],
    [1.0, [26, 40, 66]],
  ]
  // Intensité d'un rideau d'aurore ondulant centré sur la courbe cy(x).
  const curtain = (x, y, cyFn, spread, streak) => {
    const cy = cyFn(x)
    const band = Math.exp(-((y - cy) ** 2) / (2 * spread * spread))
    const str = 0.55 + 0.45 * Math.sin(x * streak + Math.sin(x * 0.3) * 2)
    return band * str
  }

  const skyOrAurora = (x, y) => {
    let c = gradC(skyStops, y / horizon)
    // étoiles
    for (const [sx, sy, sb] of stars) {
      if (Math.abs(x - sx) < 0.7 && Math.abs(y - sy) < 0.7) {
        c = mixC(c, [255, 255, 240], sb)
      }
    }
    // deux rideaux d'aurore (vert puis violet plus haut)
    const a1 = curtain(x, y, (xx) => 30 + 6 * Math.sin(xx * 0.08 + 0.5), 10, 0.55)
    c = mixC(c, [60, 230, 150], clampN(a1, 0, 1) * 0.85)
    const a2 = curtain(x, y, (xx) => 22 + 7 * Math.sin(xx * 0.06 + 2.5), 7, 0.4)
    c = mixC(c, [150, 90, 230], clampN(a2, 0, 1) * 0.7)
    return c
  }

  const field = (x, y) => {
    const u = x / W
    if (y >= ridge(u) && y <= horizon) return [8, 10, 20] // montagnes sombres
    if (y > horizon) {
      // lac : reflet atténué des aurores
      const yr = horizon - (y - horizon) * 0.85
      let c = skyOrAurora(x, clampN(yr, 0, horizon))
      c = mixC(c, [10, 14, 30], 0.5)
      return c
    }
    return skyOrAurora(x, y)
  }

  return voronoiPhoto({ id: 'aurora', name: 'Aurore boréale', difficulty: 'Photo', w: W, h: H, cols: 56, rows: 40, seed: 7, jitter: 0.9, paletteSize: 110, field })
})()

// ===========================================================================
// 13. Galaxie (Photo, fantaisie) — nébuleuse colorée et champ d'étoiles.
// ===========================================================================

const galaxy = (() => {
  const W = 130
  const H = 120
  const core = { x: 0.5 * W, y: 0.46 * H }
  const stars = makeStars(120, W, H, 777)
  const bigStars = makeStars(16, W, H, 4242)

  const field = (x, y) => {
    let c = [7, 8, 20]
    const dx = x - core.x
    const dy = y - core.y
    const glow = Math.exp(-(dx * dx + dy * dy) / (2 * 34 * 34))
    // nébuleuse : mélange de teintes piloté par le bruit
    const n = fbm(x * 0.05, y * 0.05)
    const n2 = fbm(x * 0.11 + 12, y * 0.11 - 6)
    let neb = mixC([210, 70, 160], [90, 70, 220], clampN(n * 0.5 + 0.5, 0, 1))
    neb = mixC(neb, [40, 150, 220], clampN(n2 * 0.5 + 0.5, 0, 1) * 0.6)
    const intensity = clampN(0.35 + 0.7 * n + 1.1 * glow, 0, 1)
    c = mixC(c, neb, intensity * 0.9)
    c = mixC(c, [255, 244, 230], glow * 0.6) // cœur lumineux
    // étoiles
    for (const [sx, sy, sb] of stars) {
      if (Math.abs(x - sx) < 0.6 && Math.abs(y - sy) < 0.6) c = mixC(c, [255, 255, 250], sb)
    }
    for (const [sx, sy, sb] of bigStars) {
      const d = Math.hypot(x - sx, y - sy)
      if (d < 1.6) c = mixC(c, [255, 255, 250], clampN(1 - d / 1.6, 0, 1) * (0.6 + sb * 0.4))
    }
    return c
  }

  return voronoiPhoto({ id: 'galaxy', name: 'Galaxie', difficulty: 'Photo', w: W, h: H, cols: 52, rows: 48, seed: 9, jitter: 0.9, paletteSize: 110, field })
})()

// ===========================================================================
// 14. Château féerique (Photo, fantaisie) — silhouette au coucher du soleil.
// ===========================================================================

const castle = (() => {
  const W = 140
  const H = 110
  const groundY = 90
  const sun = { x: 0.5 * W, y: 44, r: 12 }
  const skyStops = [
    [0.0, [46, 34, 82]],
    [0.4, [120, 60, 120]],
    [0.7, [226, 110, 120]],
    [1.0, [255, 186, 120]],
  ]
  // Tours : [xCentre, demiLargeur, yToit]. Toit conique au-dessus.
  const towers = [
    [40, 7, 44], [100, 7, 44],
    [56, 6, 34], [84, 6, 34],
    [70, 11, 18], // donjon central
    [26, 5, 56], [114, 5, 56],
  ]
  const windows = [
    [70, 40], [70, 52], [40, 58], [100, 58], [56, 50], [84, 50], [70, 66],
  ]

  const inTower = (x, y) => {
    for (const [cx, hw, roofY] of towers) {
      if (x >= cx - hw && x <= cx + hw && y >= roofY && y <= groundY) return true
      // toit conique
      const t = (groundY - y) // not used; roof triangle:
      void t
      if (y < roofY && y >= roofY - hw * 1.7) {
        const wAtY = hw * (1 - (roofY - y) / (hw * 1.7))
        if (Math.abs(x - cx) <= wAtY) return true
      }
    }
    return false
  }

  const field = (x, y) => {
    if (y >= groundY) return [24, 18, 40] // colline sombre
    if (inTower(x, y)) {
      // silhouette sombre, avec fenêtres éclairées
      for (const [wx, wy] of windows) {
        if (Math.abs(x - wx) < 1.4 && Math.abs(y - wy) < 2.0) return [255, 210, 120]
      }
      return [34, 22, 50]
    }
    // ciel
    let c = gradC(skyStops, y / groundY)
    const glow = Math.exp(-(((x - sun.x) ** 2 + ((y - sun.y) * 1.2) ** 2)) / (2 * 22 * 22))
    c = mixC(c, [255, 236, 180], glow * 0.9)
    if (Math.hypot(x - sun.x, y - sun.y) < sun.r) c = [255, 244, 206]
    return c
  }

  return voronoiPhoto({ id: 'castle', name: 'Château féerique', difficulty: 'Photo', w: W, h: H, cols: 56, rows: 44, seed: 4, jitter: 0.9, paletteSize: 100, field })
})()

// ===========================================================================
// 15. Méduses (Photo, fantaisie) — méduses bioluminescentes dans les abysses.
// ===========================================================================

const jellyfish = (() => {
  const W = 120
  const H = 130
  const specks = makeStars(90, W, H, 555)
  // Méduses : [x, y, taille, teinte]
  const jellies = [
    [40, 40, 15, [120, 160, 255]],
    [82, 60, 12, [255, 130, 210]],
    [58, 92, 10, [130, 255, 220]],
  ]

  const field = (x, y) => {
    // fond marin profond en dégradé vertical
    let c = gradC([[0, [8, 16, 44]], [0.5, [10, 26, 60]], [1, [6, 12, 34]]], y / H)
    // particules lumineuses
    for (const [sx, sy, sb] of specks) {
      if (Math.abs(x - sx) < 0.6 && Math.abs(y - sy) < 0.6) c = mixC(c, [180, 230, 255], sb * 0.7)
    }
    for (const [jx, jy, js, hue] of jellies) {
      // cloche (demi-ellipse) avec halo
      const dx = (x - jx) / js
      const dyTop = (y - jy) / (js * 0.8)
      const inBell = dx * dx + dyTop * dyTop < 1 && y <= jy
      const halo = Math.exp(-((x - jx) ** 2 + (y - jy) ** 2) / (2 * (js * 1.3) ** 2))
      c = mixC(c, hue, halo * 0.5)
      if (inBell) {
        const shade = 0.6 + 0.4 * (1 - (dx * dx + dyTop * dyTop))
        c = mixC(c, hue, shade)
        c = mixC(c, [255, 255, 255], (1 - dx * dx) * 0.15)
      }
      // tentacules ondulantes sous la cloche
      if (y > jy && y < jy + js * 2.6) {
        const sway = Math.sin(y * 0.4 + jx) * 2.5
        for (let k = -2; k <= 2; k++) {
          const tx = jx + k * js * 0.28 + sway
          if (Math.abs(x - tx) < 0.9) {
            const fade = clampN(1 - (y - jy) / (js * 2.6), 0, 1)
            c = mixC(c, hue, fade * 0.7)
          }
        }
      }
    }
    return c
  }

  return voronoiPhoto({ id: 'jellyfish', name: 'Méduses', difficulty: 'Photo', w: W, h: H, cols: 50, rows: 54, seed: 6, jitter: 0.9, paletteSize: 100, field })
})()

// ===========================================================================
// 16. Arc-en-ciel (Enfants) — arc-en-ciel, soleil, nuages, prairie.
// ===========================================================================

const rainbowKid = (() => {
  const W = 140
  const H = 100
  const sun = { x: 22, y: 20, r: 13 }
  const rc = { x: 70, y: 122 }
  const bands = [
    [88, [255, 74, 74]], [85, [255, 150, 40]], [82, [255, 214, 60]],
    [79, [86, 200, 96]], [76, [74, 150, 240]], [73, [128, 92, 220]],
  ]
  const clouds = [[26, 78, 11], [114, 80, 12], [86, 26, 8]]
  const isCloud = (x, y) => {
    for (const [cx, cy, r] of clouds) {
      if (d2p(x, y, cx, cy) < r * r) return true
      if (d2p(x, y, cx - r * 0.85, cy + 2) < (r * 0.7) ** 2) return true
      if (d2p(x, y, cx + r * 0.85, cy + 2) < (r * 0.72) ** 2) return true
    }
    return false
  }
  const field = (x, y) => {
    const g = 87 + 3 * Math.sin(x * 0.09)
    if (y > g) return mixC([120, 200, 96], [60, 140, 60], clampN((y - g) / 14, 0, 1)) // prairie
    if (isCloud(x, y)) return mixC([255, 255, 255], [205, 215, 235], clampN((y % 12) / 12, 0, 1) * 0.5)
    if (d2p(x, y, sun.x, sun.y) < sun.r * sun.r) {
      const t = Math.sqrt(d2p(x, y, sun.x, sun.y)) / sun.r
      return mixC([255, 236, 90], [255, 180, 40], t)
    }
    const r = Math.hypot(x - rc.x, y - rc.y)
    for (const [ro, col] of bands) {
      if (r <= ro && r > ro - 3) return mixC([255, 255, 255], col, 0.82 + 0.18 * ((ro - r) / 3))
    }
    return gradC([[0, [150, 205, 245]], [1, [206, 236, 255]]], y / g)
  }
  return voronoiPhoto({ id: 'rainbow', name: 'Arc-en-ciel', difficulty: 'Enfants', w: W, h: H, cols: 54, rows: 38, seed: 2, jitter: 0.9, paletteSize: 80, field })
})()

// ===========================================================================
// 17. Fusée (Enfants) — fusée, planètes et étoiles.
// ===========================================================================

const rocket = (() => {
  const W = 110
  const H = 150
  const stars = makeStars(80, W, H, 321)
  const planets = [[24, 32, 11, [240, 150, 90]], [88, 48, 8, [130, 205, 220]]]
  const cx = 55
  const field = (x, y) => {
    // Hublot
    if (d2p(x, y, cx, 62) < 6 * 6) {
      const hl = d2p(x, y, cx - 2, 60) < 4 ? 0.5 : 0
      return mixC(mixC([90, 170, 230], [25, 70, 130], clampN((y - 56) / 12, 0, 1)), [255, 255, 255], hl)
    }
    // Corps (ellipse)
    const bx = (x - cx) / 13
    const by = (y - 74) / 28
    if (bx * bx + by * by < 1 && y >= 50) {
      return mixC([245, 246, 252], [176, 182, 205], clampN((x - cx) / 13 * 0.5 + 0.42, 0, 1))
    }
    // Nez
    if (inTri(x, y, cx - 13, 52, cx + 13, 52, cx, 24)) {
      return mixC([232, 74, 74], [255, 200, 200], clampN((cx - x) / 26 + 0.3, 0, 1) * 0.4)
    }
    // Ailerons
    if (inTri(x, y, cx - 13, 90, cx - 24, 108, cx - 13, 104)) return [206, 58, 58]
    if (inTri(x, y, cx + 13, 90, cx + 24, 108, cx + 13, 104)) return [206, 58, 58]
    // Flammes
    if (y > 102 && y < 138) {
      const wsp = 12 * (1 - (y - 102) / 36)
      if (Math.abs(x - cx) < wsp) {
        const t = (y - 102) / 36
        return mixC([255, 216, 70], [255, 96, 42], clampN(t + fbm(x * 0.3, y * 0.3) * 0.18, 0, 1))
      }
    }
    // Espace
    let c = gradC([[0, [26, 22, 62]], [1, [8, 8, 26]]], y / H)
    for (const [px, py, pr, pc] of planets) {
      if (d2p(x, y, px, py) < pr * pr) return mixC(pc, [255, 255, 255], clampN((px - x) / pr * 0.5 + 0.4, 0, 1) * 0.5)
    }
    for (const [sx, sy, sb] of stars) {
      if (Math.abs(x - sx) < 0.6 && Math.abs(y - sy) < 0.6) c = mixC(c, [255, 255, 240], sb)
    }
    return c
  }
  return voronoiPhoto({ id: 'rocket', name: 'Fusée', difficulty: 'Enfants', w: W, h: H, cols: 46, rows: 56, seed: 5, jitter: 0.9, paletteSize: 80, field })
})()

// ===========================================================================
// 18. Dinosaure (Enfants) — brontosaure rigolo dans la jungle.
// ===========================================================================

const dino = (() => {
  const W = 150
  const H = 110
  const spots = [[54, 60], [72, 66], [64, 74], [46, 70]]
  const field = (x, y) => {
    const green = [96, 178, 78]
    // Silhouette du dinosaure (union de formes).
    const body = ((x - 66) / 32) ** 2 + ((y - 66) / 18) ** 2 < 1
    const neck = distSeg(x, y, 92, 56, 116, 30) < 8
    const head = d2p(x, y, 120, 27) < 11 * 11
    const tail = distSeg(x, y, 40, 66, 12, 52) < Math.max(2, 7 * (1 - (40 - x) / 30))
    const legs =
      (x > 46 && x < 56 && y > 72 && y < 96) ||
      (x > 62 && x < 72 && y > 74 && y < 96) ||
      (x > 78 && x < 88 && y > 74 && y < 96) ||
      (x > 34 && x < 44 && y > 70 && y < 92)
    if (body || neck || head || tail || legs) {
      // œil + sourire sur la tête
      if (d2p(x, y, 123, 24) < 2 * 2) return [30, 30, 40]
      if (Math.abs(distSeg(x, y, 116, 32, 124, 32)) < 0.8 && y > 31) return [30, 30, 40]
      // ventre plus clair
      if (body && y > 66) return mixC([200, 226, 150], [150, 200, 110], clampN((y - 66) / 18, 0, 1))
      // taches
      for (const [sx, sy] of spots) if (d2p(x, y, sx, sy) < 4 * 4) return [70, 140, 60]
      // corps avec ombrage
      return mixC([130, 200, 96], [64, 130, 56], clampN((y - 40) / 60, 0, 1))
    }
    // Décor : ciel + soleil + prairie
    const g = 92
    if (y > g) return mixC([124, 196, 92], [70, 150, 66], clampN((y - g) / 18, 0, 1))
    if (d2p(x, y, 22, 20) < 12 * 12) return mixC([255, 238, 120], [255, 196, 60], Math.sqrt(d2p(x, y, 22, 20)) / 12)
    return gradC([[0, [150, 208, 240]], [1, [206, 238, 255]]], y / g)
  }
  return voronoiPhoto({ id: 'dino', name: 'Dinosaure', difficulty: 'Enfants', w: W, h: H, cols: 58, rows: 42, seed: 8, jitter: 0.9, paletteSize: 80, field })
})()

// ===========================================================================
// 19. Licorne (Enfants) — tête de licorne avec crinière arc-en-ciel.
// ===========================================================================

const unicorn = (() => {
  const W = 120
  const H = 120
  const maneColors = [[255, 90, 140], [255, 170, 70], [255, 230, 90], [110, 210, 130], [90, 170, 240], [170, 110, 220]]
  const field = (x, y) => {
    // Crinière arc-en-ciel (derrière, à droite) : bandes ondulées.
    const maneX = 74 + 6 * Math.sin(y * 0.12)
    if (x > maneX && x < maneX + 34 && y > 26 && y < 110) {
      const idx = Math.floor(((x - maneX) / 34) * maneColors.length) % maneColors.length
      return mixC([255, 255, 255], maneColors[idx], 0.85)
    }
    // Tête (ellipse) + museau
    const head = ((x - 52) / 24) ** 2 + ((y - 66) / 30) ** 2 < 1
    if (head) {
      // œil
      if (d2p(x, y, 45, 62) < 2.3 * 2.3) return [40, 30, 50]
      // narine
      if (d2p(x, y, 39, 84) < 1.5 * 1.5) return [150, 120, 140]
      // joue rose
      if (d2p(x, y, 40, 74) < 4 * 4) return mixC([255, 255, 255], [255, 170, 200], 0.5)
      return mixC([255, 255, 255], [225, 220, 240], clampN((x - 52) / 24 * 0.5 + 0.5, 0, 1) * 0.7)
    }
    // Oreille
    if (inTri(x, y, 62, 44, 74, 42, 68, 24)) return mixC([255, 255, 255], [230, 225, 245], 0.5)
    // Corne dorée (spirale via bandes), centrée au-dessus du front
    if (inTri(x, y, 45, 40, 59, 40, 52, 6)) {
      const band = Math.floor((40 - y) / 3.2) % 2
      return band ? [255, 214, 96] : [238, 176, 58]
    }
    // Fond pastel + étincelles
    let c = gradC([[0, [255, 226, 245]], [1, [226, 226, 255]]], y / H)
    if (d2p(x, y, 90, 30) < 1.4 * 1.4 || d2p(x, y, 24, 50) < 1.2 * 1.2 || d2p(x, y, 30, 92) < 1.3 * 1.3) c = [255, 255, 255]
    return c
  }
  return voronoiPhoto({ id: 'unicorn', name: 'Licorne', difficulty: 'Enfants', w: W, h: H, cols: 48, rows: 48, seed: 3, jitter: 0.9, paletteSize: 80, field })
})()

// ===========================================================================

export const puzzles = [
  sunset,
  sunflower,
  balloon,
  fish,
  butterfly,
  fox,
  ocean,
  rosace,
  mountains,
  forest,
  lake,
  aurora,
  galaxy,
  castle,
  jellyfish,
  rainbowKid,
  rocket,
  dino,
  unicorn,
]

export const difficultyOrder = ['Facile', 'Moyen', 'Difficile', 'Expert', 'Photo', 'Enfants']
