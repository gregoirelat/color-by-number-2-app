# Coloriage par numéros (Color by Number)

Application web de coloriage par numéros. L'utilisateur sélectionne une couleur
dans la palette, puis tape sur les cases portant le numéro correspondant pour les
remplir et reconstituer le dessin.

## Lancer le projet

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build de production
npm run preview  # prévisualiser le build
```

## Fonctionnalités

- **Écran de sélection** : plusieurs dessins classés par difficulté (Facile →
  Expert), avec aperçu, taille et progression enregistrée.
- **Grille numérotée** : chaque case affiche son numéro tant qu'elle n'est pas remplie.
- **Palette** : chaque couleur affiche son numéro et une jauge de progression (`done/total`).
- **Sélection de couleur active** : tap sur une case du bon numéro → remplissage ;
  mauvais numéro → petit feedback (secousse).
- **Zoom & déplacement** : molette, **pincement tactile à deux doigts**, glisser,
  boutons de zoom. Les grands dessins sont **ajustés automatiquement** à l'écran.
- **Grisage des couleurs terminées** dans la palette (avec ✓).
- **Sauvegarde automatique** de la progression, indépendante par dessin (localStorage).
- **Animation de célébration** à 100 %.

## Dessins disponibles

| Dessin       | Difficulté | Taille | Cases |
|--------------|------------|--------|-------|
| Petite fleur | Facile     | 10×10  | 100   |
| Cœur         | Facile     | 11×11  | 121   |
| Arc-en-ciel  | Moyen      | 18×11  | 198   |
| Mandala      | Difficile  | 21×21  | 441   |
| Paysage      | Expert     | 30×20  | 600   |

## Structure

```
src/
  data/
    builder.js              # moteur de génération de dessins (primitives graphiques)
    puzzles.js              # catalogue des dessins par difficulté
  hooks/useColorByNumber.js # logique de jeu + autosave
  components/
    PuzzleSelect.jsx        # écran d'accueil / choix du dessin
    Game.jsx                # une partie (grille + palette + célébration)
    Grid.jsx                # grille + zoom/pincement/déplacement + fit-to-view
    Cell.jsx                # une case
    Palette.jsx             # palette + jauges de progression
  App.jsx                   # navigation sélection <-> partie
  main.jsx / index.css
```

## Ajouter un dessin

Dans `src/data/puzzles.js`, ajouter un objet au tableau `puzzles`. Deux options :

- **Petit dessin** : fournir directement `grid` (matrice de numéros), comme
  `fleur` ou `coeur`.
- **Grand dessin** : utiliser `buildPuzzle({ ... , draw(ctx) })` et dessiner avec
  les primitives `ctx.fillAll`, `ctx.rect`, `ctx.disc`, `ctx.ring`, `ctx.set`,
  `ctx.each`, comme `mandala` ou `paysage`.

## Technique

React + Vite, front-end uniquement (aucun back-end). CSS simple.
