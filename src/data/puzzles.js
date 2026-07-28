import { buildPuzzle } from './builder.js'

// ---------------------------------------------------------------------------
// Catalogue des dessins, classés par difficulté.
//
// Difficulté = mélange de la taille (nombre de cases) et du nombre de couleurs.
//   - Facile   : petites grilles, peu de couleurs
//   - Moyen    : grilles moyennes
//   - Difficile: grandes grilles (plusieurs centaines de cases)
//   - Expert   : très grandes grilles, nombreuses couleurs
// ---------------------------------------------------------------------------

// ----- 1. Fleur (Facile) — dessin de test d'origine, 10x10 -----------------

const fleur = {
  id: 'fleur',
  name: 'Petite fleur',
  difficulty: 'Facile',
  width: 10,
  height: 10,
  colors: [
    { number: 1, hex: '#bfe6ff', name: 'Ciel' },
    { number: 2, hex: '#ff5d8f', name: 'Pétales' },
    { number: 3, hex: '#3fa34d', name: 'Tige' },
    { number: 4, hex: '#7ed957', name: 'Feuilles' },
  ],
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 2, 2, 1, 2, 2, 1, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 1, 1],
    [1, 1, 2, 2, 2, 2, 2, 1, 1, 1],
    [1, 1, 1, 2, 2, 2, 1, 1, 1, 1],
    [1, 1, 1, 1, 3, 1, 1, 1, 1, 1],
    [1, 1, 4, 1, 3, 1, 4, 1, 1, 1],
    [1, 1, 1, 4, 3, 4, 1, 1, 1, 1],
    [1, 1, 1, 1, 3, 1, 1, 1, 1, 1],
  ],
  cellCount: 100,
}

// ----- 2. Cœur (Facile) — 11x11 --------------------------------------------

const coeur = {
  id: 'coeur',
  name: 'Cœur',
  difficulty: 'Facile',
  width: 11,
  height: 11,
  colors: [
    { number: 1, hex: '#fff1f6', name: 'Fond' },
    { number: 2, hex: '#ff3b6b', name: 'Rouge' },
    { number: 3, hex: '#ffd0dd', name: 'Reflet' },
  ],
  grid: [
    [1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1],
    [1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1],
    [2, 2, 3, 3, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 3, 3, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 2, 2, 2, 2, 1, 1],
    [1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1],
    [1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  cellCount: 121,
}

// ----- 3. Arc-en-ciel (Moyen) — 18x11 --------------------------------------
// Des arcs concentriques dessinés autour d'un centre situé sous la grille,
// plus un soleil et deux nuages. Beaucoup de couleurs, taille moyenne.

const arcEnCiel = buildPuzzle({
  id: 'arc-en-ciel',
  name: 'Arc-en-ciel',
  difficulty: 'Moyen',
  width: 18,
  height: 11,
  colors: [
    { number: 1, hex: '#eaf6ff', name: 'Ciel' },
    { number: 2, hex: '#ff4d4d', name: 'Rouge' },
    { number: 3, hex: '#ff9f1c', name: 'Orange' },
    { number: 4, hex: '#ffd23f', name: 'Jaune' },
    { number: 5, hex: '#3fbf5f', name: 'Vert' },
    { number: 6, hex: '#3f8cff', name: 'Bleu' },
    { number: 7, hex: '#9b5de5', name: 'Violet' },
    { number: 8, hex: '#ffffff', name: 'Nuage' },
  ],
  draw(ctx) {
    const cx = 9
    const cy = 12 // sous la grille -> on ne voit que le haut de l'arc
    // Bandes de l'arc-en-ciel : chaque couleur sur un intervalle de rayon.
    const bands = [
      { color: 2, r: 9.5 },
      { color: 3, r: 8.5 },
      { color: 4, r: 7.5 },
      { color: 5, r: 6.5 },
      { color: 6, r: 5.5 },
      { color: 7, r: 4.5 },
    ]
    ctx.each((x, y) => {
      const d = Math.hypot(x - cx, y - cy)
      for (const b of bands) {
        if (d <= b.r && d > b.r - 1) return b.color
      }
      return null // ciel
    })
    // Soleil en haut à gauche.
    ctx.disc(2, 1.5, 2, 4)
    // Deux nuages (petits amas de disques blancs).
    ctx.disc(14, 2, 1.6, 8)
    ctx.disc(15.5, 2.4, 1.2, 8)
    ctx.disc(6, 1, 1.3, 8)
  },
})

// ----- 4. Mandala (Difficile) — 21x21 = 441 cases --------------------------
// Motif en moulinet : la couleur dépend à la fois de la distance au centre
// (anneaux) et de l'angle (secteurs). Toutes les cases sont à colorier.

const mandala = buildPuzzle({
  id: 'mandala',
  name: 'Mandala',
  difficulty: 'Difficile',
  width: 21,
  height: 21,
  colors: [
    { number: 1, hex: '#ff5d8f', name: 'Rose' },
    { number: 2, hex: '#ff9f1c', name: 'Orange' },
    { number: 3, hex: '#ffd23f', name: 'Jaune' },
    { number: 4, hex: '#2ec4b6', name: 'Turquoise' },
    { number: 5, hex: '#3f8cff', name: 'Bleu' },
    { number: 6, hex: '#9b5de5', name: 'Violet' },
    { number: 7, hex: '#22223b', name: 'Centre' },
  ],
  draw(ctx) {
    const cx = 10
    const cy = 10
    ctx.each((x, y) => {
      const dx = x - cx
      const dy = y - cy
      const r = Math.hypot(dx, dy)
      if (r < 1.2) return 7 // pastille centrale
      const ring = Math.round(r)
      const angle = Math.atan2(dy, dx) + Math.PI // 0..2π
      const sector = Math.floor((angle / (2 * Math.PI)) * 8)
      return ((ring + sector) % 6) + 1
    })
  },
})

// ----- 5. Paysage (Expert) — 30x20 = 600 cases -----------------------------
// Une scène : ciel dégradé, soleil, nuages, deux montagnes et une prairie.
// Beaucoup de cases et de couleurs.

const paysage = buildPuzzle({
  id: 'paysage',
  name: 'Paysage',
  difficulty: 'Expert',
  width: 30,
  height: 20,
  colors: [
    { number: 1, hex: '#bfe3ff', name: 'Ciel haut' },
    { number: 2, hex: '#e4f3ff', name: 'Ciel bas' },
    { number: 3, hex: '#ffd23f', name: 'Soleil' },
    { number: 4, hex: '#ffffff', name: 'Nuage' },
    { number: 5, hex: '#8d7bb0', name: 'Montagne loin' },
    { number: 6, hex: '#6b8e5a', name: 'Montagne près' },
    { number: 7, hex: '#7ec850', name: 'Prairie' },
    { number: 8, hex: '#4f9e3a', name: 'Herbe' },
    { number: 9, hex: '#8b5a2b', name: 'Tronc' },
  ],
  draw(ctx) {
    const W = 30
    const grassTop = 14 // ligne d'horizon / haut de la prairie

    // Ciel : dégradé simple en deux bandes.
    ctx.rect(0, 0, W, 6, 1)
    ctx.rect(0, 6, W, grassTop - 6, 2)

    // Soleil et nuages.
    ctx.disc(25, 4, 2.4, 3)
    ctx.disc(7, 3, 1.6, 4)
    ctx.disc(9, 3.4, 1.3, 4)
    ctx.disc(5.6, 3.4, 1.1, 4)

    // Montagne lointaine (violette), pic vers x=9.
    for (let x = 0; x < W; x++) {
      const top = 6 + Math.abs(x - 9) * 0.9
      for (let y = Math.round(top); y < grassTop; y++) ctx.set(x, y, 5)
    }
    // Montagne proche (verte), pic vers x=21.
    for (let x = 0; x < W; x++) {
      const top = 8 + Math.abs(x - 21) * 0.8
      for (let y = Math.round(top); y < grassTop; y++) ctx.set(x, y, 6)
    }

    // Prairie (deux verts en bandes pour donner du relief).
    ctx.rect(0, grassTop, W, 20 - grassTop, 7)
    ctx.rect(0, 17, W, 3, 8)

    // Un petit arbre : tronc + feuillage.
    ctx.rect(6, 12, 1, 3, 9)
    ctx.disc(6.5, 11, 2, 6)
  },
})

// ---------------------------------------------------------------------------

export const puzzles = [fleur, coeur, arcEnCiel, mandala, paysage]

export const difficultyOrder = ['Facile', 'Moyen', 'Difficile', 'Expert']
