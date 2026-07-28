# Coloriage par numéros (Color by Number)

Application web de coloriage par numéros. Chaque dessin est **vectoriel** : un
ensemble de **régions** (formes courbes délimitées par un contour), chacune
portant un numéro de couleur. L'utilisateur choisit une couleur, puis tape les
régions correspondantes pour reconstituer une illustration soignée, avec du
relief donné par les dégradés de tons.

## Lancer le projet

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build de production
npm run preview  # prévisualiser le build
```

## Fonctionnalités

- **Écran de sélection** : dessins classés par difficulté (Facile → Expert),
  avec aperçu, nombre de zones et progression enregistrée.
- **Régions à colorier** : tant qu'une zone n'est pas remplie, elle affiche son
  contour et un petit numéro ; une fois coloriée, elle prend sa couleur.
- **Palette** : chaque couleur affiche son numéro et une jauge de progression
  (`fait/total`) ; une couleur terminée est grisée avec un ✓.
- **Sélection de couleur active** : taper une zone du bon numéro la remplit ;
  mauvais numéro → petit feedback (clignotement du contour).
- **Zoom & déplacement** : molette, **pincement tactile à deux doigts**, glisser.
  Le dessin est **ajusté automatiquement** à l'écran (fit-to-view).
- **Sauvegarde automatique** de la progression, indépendante par dessin (localStorage).
- **Animation de célébration** à 100 %.

## Dessins disponibles

| Dessin            | Difficulté | Zones |
|-------------------|------------|-------|
| Coucher de soleil | Facile     | 9     |
| Tournesol         | Moyen      | 38    |
| Montgolfière      | Moyen      | 14    |
| Papillon          | Difficile  | 19    |
| Rosace            | Expert     | 62    |

## Structure

```
src/
  data/
    svg.js                  # helpers de formes vectorielles (bande, disque, pétales…)
    puzzles.js              # catalogue des dessins (régions SVG)
  hooks/useColorByNumber.js # logique de jeu + autosave
  components/
    PuzzleSelect.jsx        # écran d'accueil / choix du dessin
    Game.jsx                # une partie (canevas + palette + célébration)
    RegionCanvas.jsx        # rendu SVG + zoom/pincement/déplacement + fit-to-view
    Palette.jsx             # palette + jauges de progression
  App.jsx                   # navigation sélection <-> partie
  main.jsx / index.css
```

## Ajouter un dessin

Dans `src/data/puzzles.js`, ajouter un objet au tableau `puzzles` :

```js
{
  id, name, difficulty,
  viewBox: { w, h },
  colors: [{ number, hex, name }],
  regions: [{ number, d, label: { x, y } }],  // d = chemin SVG, label = position du numéro
}
```

Les helpers de `svg.js` (`band`, `disc`, `ellipse`, `polygon`, `smoothClosed`)
et les fabriques de `puzzles.js` (`petalRing`, `centroid`) facilitent la
génération de formes lisses et de couronnes de pétales.

## Technique

React + Vite, front-end uniquement (aucun back-end). Dessins vectoriels en SVG.
