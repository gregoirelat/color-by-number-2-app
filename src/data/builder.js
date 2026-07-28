// ---------------------------------------------------------------------------
// Petit moteur pour construire des dessins ("puzzles") facilement.
//
// Plutôt que de saisir à la main d'immenses matrices de numéros (impossible
// pour des dessins de plusieurs centaines de cases), on décrit un dessin avec
// quelques primitives graphiques : remplir, rectangle, disque, anneau, ou une
// fonction par case. Chaque primitive « peint » un numéro de couleur.
//
// buildPuzzle renvoie l'objet puzzle attendu par le reste de l'application :
//   { id, name, difficulty, width, height, colors, grid, cellCount }
// ---------------------------------------------------------------------------

export function buildPuzzle(def) {
  const { id, name, difficulty, width, height, colors, background, draw } = def

  // Numéro de couleur par défaut des cases (fond).
  const bg = background ?? colors[0].number
  const grid = Array.from({ length: height }, () => Array(width).fill(bg))

  const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height

  const ctx = {
    width,
    height,

    // Peint une case (coordonnées arrondies, ignorées si hors grille).
    set(x, y, n) {
      x = Math.round(x)
      y = Math.round(y)
      if (inBounds(x, y)) grid[y][x] = n
    },

    // Remplit toute la grille.
    fillAll(n) {
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) grid[y][x] = n
    },

    // Rectangle plein de coin (x, y), largeur w, hauteur h.
    rect(x, y, w, h, n) {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) this.set(x + i, y + j, n)
    },

    // Disque plein centré en (cx, cy) de rayon r.
    disc(cx, cy, r, n) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const dx = x - cx
          const dy = y - cy
          if (dx * dx + dy * dy <= r * r) this.set(x, y, n)
        }
    },

    // Anneau centré en (cx, cy) entre les rayons rIn et rOut.
    ring(cx, cy, rOut, rIn, n) {
      for (let y = Math.floor(cy - rOut); y <= cy + rOut; y++)
        for (let x = Math.floor(cx - rOut); x <= cx + rOut; x++) {
          const dx = x - cx
          const dy = y - cy
          const d2 = dx * dx + dy * dy
          if (d2 <= rOut * rOut && d2 >= rIn * rIn) this.set(x, y, n)
        }
    },

    // Applique une fonction à chaque case : fn(x, y) -> numéro (ou null pour
    // laisser la case inchangée).
    each(fn) {
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const n = fn(x, y)
          if (n != null) grid[y][x] = n
        }
    },
  }

  draw(ctx)

  return {
    id,
    name,
    difficulty,
    width,
    height,
    colors,
    grid,
    cellCount: width * height,
  }
}
