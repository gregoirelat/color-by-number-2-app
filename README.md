# 🎉 Quiz Party — un clone de Kahoot

Application de quiz en temps réel, façon **Kahoot**, conçue pour être jouée par **une centaine de personnes** simultanément et rejointe **par QR code**.

## Fonctionnalités

- **Éditeur de quiz** dans le navigateur (questions à choix multiples, bonne réponse, chrono par question).
- **Hébergement d'une partie** : génération d'un PIN à 6 chiffres + **QR code** de connexion affiché à l'écran.
- **Connexion des joueurs par QR code** (ou saisie du PIN) depuis leur téléphone, avec pseudo.
- **Temps réel** via Socket.IO : diffusion des questions, collecte des réponses, chrono synchronisé.
- **Score façon Kahoot** : points modulés par la rapidité + bonus de série (streak).
- **Classement intermédiaire** entre les questions et **podium final**.
- Gestion de la déconnexion, expulsion de joueurs, question passée manuellement ou clôturée quand tout le monde a répondu.

## Architecture

```
server/
  index.js   Serveur HTTP + Socket.IO + endpoint /api/qr (génération du QR code)
  game.js    Logique de jeu (parties en mémoire, scoring) — indépendante du transport
public/
  index.html + js/quiz-editor.js   Accueil + éditeur de quiz
  host.html  + js/host.js          Écran principal (animateur)
  play.html  + js/play.js          Écran joueur (mobile)
  css/style.css
```

- Les parties sont stockées **en mémoire** (Map indexée par PIN) — pas de base de données.
- Un seul serveur Node gère sans peine ~100 connexions Socket.IO simultanées.

## Démarrage

```bash
npm install
npm start
# ou en développement (rechargement auto) :
npm run dev
```

Le serveur écoute sur `http://localhost:3000` (variable d'environnement `PORT` pour changer).

### Utilisation

1. **Animateur** : ouvrir `http://localhost:3000`, cliquer sur *Animer une partie*, éditer/valider le quiz, puis *Lancer la partie*. Un PIN et un QR code s'affichent.
2. **Joueurs** : scanner le QR code (ou aller sur l'URL affichée et entrer le PIN), choisir un pseudo.
3. L'animateur démarre, fait défiler les questions, montre le classement, puis le podium.

> ⚠️ Pour que le QR code fonctionne depuis les téléphones des joueurs, le serveur doit être **accessible sur le réseau** (même Wi-Fi, ou déployé avec une URL publique). Le lien du QR code est construit à partir de l'hôte de la requête et respecte les en-têtes `X-Forwarded-*` d'un reverse proxy.

## Déploiement

Application Node standard. Derrière un reverse proxy, transmettre les en-têtes `X-Forwarded-Proto` / `X-Forwarded-Host` pour que l'URL du QR code soit correcte, et activer le WebSocket (Socket.IO). Pour monter au-delà de quelques centaines de joueurs ou plusieurs instances, ajouter un adaptateur Socket.IO (ex. Redis).
