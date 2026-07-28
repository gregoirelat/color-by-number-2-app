import { polygon } from './svg.js'

// ---------------------------------------------------------------------------
// Générateur « low-poly ».
//
// On pose une grille de sommets légèrement décalés (jitter), puis on découpe
// chaque cellule en deux triangles. Chaque triangle reçoit un numéro de couleur
// donné par une fonction `field(x, y)` qui décrit la scène (ciel, montagnes…).
// Résultat : une image facettée de plusieurs centaines de zones, avec du relief.
// ---------------------------------------------------------------------------

// Générateur pseudo-aléatoire déterministe (même dessin à chaque chargement).
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function lowPoly({ id, name, difficulty, w, h, cols, rows, seed = 7, jitter = 0.6, colors, field }) {
  const rnd = mulberry32(seed)
  const gx = w / cols
  const gy = h / rows

  // Sommets : les bords restent alignés, l'intérieur est décalé.
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

  const regions = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = V[j][i]
      const b = V[j][i + 1]
      const c = V[j + 1][i + 1]
      const d = V[j + 1][i]
      // On alterne le sens de la diagonale pour un maillage plus naturel.
      const tris = (i + j) & 1 ? [[a, b, d], [b, c, d]] : [[a, b, c], [a, c, d]]
      for (const t of tris) {
        const cx = (t[0].x + t[1].x + t[2].x) / 3
        const cy = (t[0].y + t[1].y + t[2].y) / 3
        regions.push({
          number: field(cx, cy),
          d: polygon(t.map((p) => [p.x, p.y])),
          label: { x: cx, y: cy },
        })
      }
    }
  }

  return { id, name, difficulty, viewBox: { w, h }, colors, regions, regionCount: regions.length }
}
