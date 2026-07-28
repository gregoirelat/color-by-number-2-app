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
