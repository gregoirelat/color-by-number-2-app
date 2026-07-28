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

- **Grille numérotée** : chaque case affiche son numéro tant qu'elle n'est pas remplie.
- **Palette** : chaque couleur affiche son numéro et une jauge de progression (`done/total`).
- **Sélection de couleur active** : tap sur une case du bon numéro → remplissage ;
  mauvais numéro → petit feedback (secousse).
- **Zoom & déplacement** : molette, pincement tactile, glisser, et boutons de zoom.
- **Grisage des couleurs terminées** dans la palette (avec ✓).
- **Sauvegarde automatique** de la progression (localStorage).
- **Animation de célébration** à 100 %.

## Structure

```
src/
  data/puzzle.js            # dessin de test codé en dur (fleur 10x10, 4 couleurs)
  hooks/useColorByNumber.js # logique de jeu + autosave
  components/
    Grid.jsx                # grille + zoom/déplacement
    Cell.jsx                # une case
    Palette.jsx             # palette + jauges de progression
  App.jsx                   # assemblage + célébration
  main.jsx / index.css
```

## Ajouter un dessin

Modifier `src/data/puzzle.js` : `width`, `height`, la liste `colors`
(`number` + `hex`) et la matrice `grid` de numéros.

## Technique

React + Vite, front-end uniquement (aucun back-end). CSS simple.
