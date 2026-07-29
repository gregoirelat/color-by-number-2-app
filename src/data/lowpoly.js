import { polygon } from './svg.js'

// ---------------------------------------------------------------------------
// Générateur « low-poly ».
//
// On pose une grille de sommets légèrement décalés (jitter), puis on découpe
// chaque cellule en deux triangles.
//
// Deux modes :
//   - lowPoly()     : `field(x,y)` renvoie directement un NUMÉRO de couleur
//                     (scènes simples, palette imposée).
//   - lowPolyPhoto(): `field(x,y)` renvoie une COULEUR [r,g,b] continue ; la
//                     palette est ensuite calculée automatiquement (k-means)
//                     à partir de toutes les facettes. Combiné à un maillage
//                     fin, on obtient des dégradés doux, quasi photographiques.
// ---------------------------------------------------------------------------

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Construit le maillage triangulaire (sommets décalés, cellules coupées en 2).
function buildMesh(w, h, cols, rows, rnd, jitter) {
  const gx = w / cols
  const gy = h / rows
  const V = []
  for (let j = 0; j <= rows; j++) {
    V[j] = []
    for (let i = 0; i <= cols; i++) {
      let x = i * gx
      let y = j * gy
      const edge = i === 0 || j === 0 || i === cols || j === rows
      if (!edge) {
        x += (rnd() - 0.5) * gx * jitter
        y += (rnd() - 0.5) * gy * jitter
      }
      V[j][i] = { x, y }
    }
  }
  const tris = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = V[j][i]
      const b = V[j][i + 1]
      const c = V[j + 1][i + 1]
      const d = V[j + 1][i]
      const pair = (i + j) & 1 ? [[a, b, d], [b, c, d]] : [[a, b, c], [a, c, d]]
      for (const t of pair) tris.push(t)
    }
  }
  return tris
}

function triCentroid(t) {
  return [
    (t[0].x + t[1].x + t[2].x) / 3,
    (t[0].y + t[1].y + t[2].y) / 3,
  ]
}

// --- Mode « numéro direct » ------------------------------------------------

export function lowPoly({ id, name, difficulty, w, h, cols, rows, seed = 7, jitter = 0.6, colors, field }) {
  const rnd = mulberry32(seed)
  const tris = buildMesh(w, h, cols, rows, rnd, jitter)
  const regions = tris.map((t) => {
    const [cx, cy] = triCentroid(t)
    return { number: field(cx, cy), d: polygon(t.map((p) => [p.x, p.y])), label: { x: cx, y: cy } }
  })
  return {
    id, name, difficulty, viewBox: { w, h }, colors, regions,
    regionCount: regions.length,
    numberSize: Math.min(w / cols, h / rows) * 0.5, // numéro adapté à la facette
    faint: true, // facettes : trait discret une fois rempli
  }
}

// --- Mode « photo » : couleur continue + palette auto (k-means) -------------

export function lowPolyPhoto({
  id,
  name,
  difficulty,
  w,
  h,
  cols,
  rows,
  seed = 7,
  jitter = 0.55,
  paletteSize = 28,
  field,
}) {
  const rnd = mulberry32(seed)
  const tris = buildMesh(w, h, cols, rows, rnd, jitter)

  // Couleur continue de chaque facette (échantillon = barycentre).
  const centroids = tris.map(triCentroid)
  const samples = centroids.map(([x, y]) => field(x, y))

  // Palette calculée par k-means sur les couleurs des facettes.
  const { centers, assign } = kmeans(samples, paletteSize, rnd, 12)

  // On ordonne la palette du plus foncé au plus clair, puis on renumérote.
  const order = centers.map((c, i) => i).sort((a, b) => lum(centers[a]) - lum(centers[b]))
  const newNumber = new Array(centers.length)
  const colors = order.map((oldIdx, pos) => {
    newNumber[oldIdx] = pos + 1
    return { number: pos + 1, hex: rgbToHex(centers[oldIdx]), name: `Ton ${pos + 1}` }
  })

  const regions = tris.map((t, i) => ({
    number: newNumber[assign[i]],
    d: polygon(t.map((p) => [p.x, p.y])),
    label: { x: centroids[i][0], y: centroids[i][1] },
  }))

  return {
    id, name, difficulty, viewBox: { w, h }, colors, regions,
    regionCount: regions.length,
    smooth: true,
    numberSize: Math.min(w / cols, h / rows) * 0.5,
  }
}

// --- Mode « photo » à cellules de Voronoï (formes irrégulières) -------------
//
// Au lieu d'un maillage de triangles, on répartit des germes (points) et chaque
// cellule regroupe la zone la plus proche de son germe : on obtient des formes
// polygonales IRRÉGULIÈRES (ni triangles, ni carrés). La cellule est calculée
// exactement par intersection de demi-plans (bissectrices) avec les germes
// voisins. La couleur vient d'un champ continu ; la palette est calculée par
// k-means, comme pour lowPolyPhoto.

export function voronoiPhoto({ id, name, difficulty, w, h, cols, rows, seed = 7, jitter = 0.85, paletteSize = 28, field }) {
  const rnd = mulberry32(seed)
  const gx = w / cols
  const gy = h / rows

  const grid = []
  const seeds = []
  for (let j = 0; j < rows; j++) {
    grid[j] = []
    for (let i = 0; i < cols; i++) {
      const x = clampNum((i + 0.5) * gx + (rnd() - 0.5) * gx * jitter, 0, w)
      const y = clampNum((j + 0.5) * gy + (rnd() - 0.5) * gy * jitter, 0, h)
      const s = { x, y, i, j }
      grid[j][i] = s
      seeds.push(s)
    }
  }

  const rect = [[0, 0], [w, 0], [w, h], [0, h]]
  const cells = []
  for (const s of seeds) {
    let poly = rect
    for (let dj = -2; dj <= 2 && poly.length >= 3; dj++) {
      for (let di = -2; di <= 2; di++) {
        if (di === 0 && dj === 0) continue
        const nj = s.j + dj
        const ni = s.i + di
        if (nj < 0 || nj >= rows || ni < 0 || ni >= cols) continue
        poly = clipHalf(poly, s, grid[nj][ni])
        if (poly.length < 3) break
      }
    }
    if (poly.length >= 3) cells.push(poly)
  }

  const cents = cells.map(polyCentroid)
  const samples = cents.map(([x, y]) => field(x, y))
  const { centers, assign } = kmeans(samples, paletteSize, rnd, 12)
  const order = centers.map((c, i) => i).sort((a, b) => lum(centers[a]) - lum(centers[b]))
  const newNumber = new Array(centers.length)
  const colors = order.map((oldIdx, pos) => {
    newNumber[oldIdx] = pos + 1
    return { number: pos + 1, hex: rgbToHex(centers[oldIdx]), name: `Ton ${pos + 1}` }
  })

  const regions = cells.map((poly, i) => ({
    number: newNumber[assign[i]],
    d: polygon(poly),
    label: { x: cents[i][0], y: cents[i][1] },
  }))

  return {
    id, name, difficulty, viewBox: { w, h }, colors, regions,
    regionCount: regions.length,
    smooth: true,
    numberSize: Math.min(gx, gy) * 0.42,
  }
}

const clampNum = (v, a, b) => Math.min(b, Math.max(a, v))

// Coupe un polygone par la bissectrice entre s et t (on garde le côté de s).
function clipHalf(poly, s, t) {
  const nx = t.x - s.x
  const ny = t.y - s.y
  const c = (t.x * t.x + t.y * t.y - s.x * s.x - s.y * s.y) / 2
  const f = (p) => p[0] * nx + p[1] * ny - c // on garde f <= 0 (plus près de s)
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i]
    const B = poly[(i + 1) % poly.length]
    const fa = f(A)
    const fb = f(B)
    if (fa <= 0) out.push(A)
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const k = fa / (fa - fb)
      out.push([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k])
    }
  }
  return out
}

function polyCentroid(poly) {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    const cr = x0 * y1 - x1 * y0
    a += cr
    cx += (x0 + x1) * cr
    cy += (y0 + y1) * cr
  }
  a *= 0.5
  if (Math.abs(a) < 1e-6) {
    const n = poly.length
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (6 * a), cy / (6 * a)]
}

// --- k-means simple en espace RGB ------------------------------------------

function d2(a, b) {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

function kmeans(samples, k, rnd, iters) {
  // Initialisation : k échantillons distincts tirés au hasard (déterministe).
  const centers = []
  const used = new Set()
  let guard = 0
  while (centers.length < k && guard++ < k * 50) {
    const i = Math.floor(rnd() * samples.length)
    const key = samples[i].map((v) => Math.round(v)).join(',')
    if (!used.has(key)) {
      used.add(key)
      centers.push(samples[i].slice())
    }
  }
  const assign = new Array(samples.length).fill(0)
  for (let it = 0; it < iters; it++) {
    for (let s = 0; s < samples.length; s++) {
      let best = 0
      let bd = Infinity
      for (let c = 0; c < centers.length; c++) {
        const d = d2(samples[s], centers[c])
        if (d < bd) {
          bd = d
          best = c
        }
      }
      assign[s] = best
    }
    const sum = centers.map(() => [0, 0, 0, 0])
    for (let s = 0; s < samples.length; s++) {
      const a = assign[s]
      sum[a][0] += samples[s][0]
      sum[a][1] += samples[s][1]
      sum[a][2] += samples[s][2]
      sum[a][3]++
    }
    for (let c = 0; c < centers.length; c++) {
      if (sum[c][3] > 0) {
        centers[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]]
      }
    }
  }
  return { centers, assign }
}

function lum([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function rgbToHex([r, g, b]) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return '#' + h(r) + h(g) + h(b)
}
