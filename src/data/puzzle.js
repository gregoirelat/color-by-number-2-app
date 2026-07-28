// ---------------------------------------------------------------------------
// Dessin de test codé en dur.
//
// Un "puzzle" décrit :
//   - width / height : dimensions de la grille en cases
//   - colors : la palette. Chaque couleur a un `number` (celui affiché dans
//     les cases et la palette) et une valeur hex `hex`.
//   - grid : un tableau de `height` lignes, chacune contenant `width` numéros.
//     Le numéro d'une case indique la couleur qu'elle doit recevoir.
//
// Ici : une petite fleur sur fond de ciel, en 10x10 avec 4 couleurs.
// C'est volontairement simple pour valider tout le fonctionnement avant
// d'ajouter des dessins plus ambitieux.
// ---------------------------------------------------------------------------

export const puzzle = {
  id: 'flower-10x10',
  name: 'Petite fleur',
  width: 10,
  height: 10,
  colors: [
    { number: 1, hex: '#bfe6ff', name: 'Ciel' },
    { number: 2, hex: '#ff5d8f', name: 'Pétales' },
    { number: 3, hex: '#3fa34d', name: 'Tige' },
    { number: 4, hex: '#7ed957', name: 'Feuilles' },
  ],
  // 10 lignes de 10 numéros.
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
}
