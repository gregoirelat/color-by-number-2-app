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
- **Aides au coloriage** (utiles sur les grands dessins) :
  - les zones de la couleur active sont **teintées** pour se repérer ;
  - **passage automatique** à la couleur suivante quand une couleur est terminée ;
  - bouton **« Remplir la vue »** : colorie les zones visibles de la couleur active.
- **Sauvegarde automatique** de la progression, indépendante par dessin (localStorage).
- **Animation de célébration** à 100 %.

## Dessins disponibles

| Dessin            | Difficulté | Zones |
|-------------------|------------|-------|
| Coucher de soleil | Facile     | 9     |
| Tournesol         | Moyen      | 38    |
| Montgolfière      | Moyen      | 14    |
| Poisson           | Moyen      | 13    |
| Papillon          | Difficile  | 19    |
| Renard            | Difficile  | 15    |
| Océan             | Difficile  | 520   |
| Rosace            | Expert     | 62    |
| Montagnes         | Expert     | 660   |
| Forêt             | Expert     | 660   |
| Lac de montagne   | Photo      | 2240  |
| Aurore boréale    | Photo      | 2240  |
| Galaxie           | Photo      | 2496  |
| Château féerique  | Photo      | 2464  |
| Méduses           | Photo      | 2700  |
| Arc-en-ciel       | Enfants    | 2052  |
| Fusée             | Enfants    | 2576  |
| Dinosaure         | Enfants    | 2436  |
| Licorne           | Enfants    | 2304  |

La catégorie **Enfants** reprend le même rendu détaillé (cellules irrégulières,
~80 tons) sur des sujets rigolos et colorés composés par assemblage de formes.

**Océan**, **Montagnes** et **Forêt** sont générées en « low-poly » : des images
facettées de plusieurs centaines de triangles ombrés. Le **Lac de montagne** va
plus loin (`voronoiPhoto`) : au lieu d'un maillage régulier, ce sont des
**cellules de Voronoï** aux contours **irréguliers** (ni triangles ni carrés),
colorées par un champ continu dont la **palette est calculée automatiquement**
(k-means, **120 tons** pour un rendu très fidèle). Une fois remplies et fondues,
les cellules donnent une mosaïque quasi photographique. Voir `src/data/lowpoly.js`.

Au-delà de ~16 couleurs, la palette passe en **mode compact** (grille de
pastilles numérotées) pour rester utilisable.

Les dessins « photo » comptent des milliers de facettes : le coloriage met à jour
le nœud DOM concerné directement (sans re-rendre tout le SVG) et la surbrillance
de la couleur active est aussi appliquée en DOM, ce qui garde chaque tap
quasi instantané.

## Structure

```
src/
  data/
    svg.js                  # helpers de formes vectorielles (bande, disque, pétales…)
    lowpoly.js              # générateur low-poly (maillage triangulaire + champ de couleur)
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
