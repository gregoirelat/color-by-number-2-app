# 🎉 Quiz Party — un clone de Kahoot

Application de quiz en temps réel, façon **Kahoot**, conçue pour être jouée par **une centaine de personnes** simultanément et rejointe **par QR code**.

## Fonctionnalités

- **Éditeur de quiz** dans le navigateur :
  - questions **QCM** (4 réponses) ou **Vrai / Faux** ;
  - **image** optionnelle par question (URL) ;
  - bonne réponse et **chrono** réglables ;
  - **bibliothèque locale** : enregistrer, recharger et supprimer ses quiz (stockés dans le navigateur).
- **Hébergement d'une partie** : PIN à 6 chiffres + **QR code** de connexion affiché à l'écran.
- **Connexion des joueurs par QR code** (ou saisie du PIN) depuis leur téléphone, avec pseudo.
- **Temps réel** via Socket.IO : diffusion des questions, collecte des réponses, chrono synchronisé serveur.
- **Score façon Kahoot** : points modulés par la rapidité + bonus de série (streak).
- **Reconnexion automatique** : si un joueur (ou l'hôte) perd le réseau, il se reconnecte tout seul et **retrouve son score** grâce à un jeton de session (période de grâce de 60 s).
- **Classement intermédiaire** entre les questions et **podium final**.
- Expulsion de joueurs, question passée manuellement ou clôturée dès que tout le monde a répondu.

## Architecture

```
server/
  index.js   Serveur HTTP + Socket.IO + endpoint /api/qr (génération du QR code)
  game.js    Logique de jeu (parties en mémoire, scoring, reconnexion) — indépendante du transport
public/
  index.html + js/quiz-editor.js   Accueil + éditeur de quiz + bibliothèque
  host.html  + js/host.js          Écran principal (animateur)
  play.html  + js/play.js          Écran joueur (mobile)
  css/style.css
```

- Les parties sont stockées **en mémoire** (Map indexée par PIN) — pas de base de données.
- Les joueurs sont identifiés par un **jeton stable** (et non l'ID de socket), ce qui permet la reconnexion sans perte de score.
- Un seul serveur Node gère sans peine ~100 connexions Socket.IO simultanées (testé : 100 joueurs connectés en ~0,4 s, 100/100 réponses collectées).

## Démarrage local

```bash
npm install
npm start          # http://localhost:3000
# ou en développement (rechargement auto) :
npm run dev
```

Variable d'environnement `PORT` pour changer le port.

### Utilisation

1. **Animateur** : ouvrir la page d'accueil, cliquer sur *Animer une partie*, éditer/valider le quiz, puis *Lancer la partie*. Un PIN et un QR code s'affichent.
2. **Joueurs** : scanner le QR code (ou aller sur l'URL affichée et entrer le PIN), choisir un pseudo.
3. L'animateur démarre, fait défiler les questions, montre le classement, puis le podium.

## Rendre le QR code utilisable par les joueurs

Le lien encodé dans le QR est construit à partir de l'hôte de la requête (et respecte les en-têtes `X-Forwarded-*` d'un reverse proxy). Pour que les téléphones puissent se connecter, le serveur doit être **joignable depuis leur réseau**. Trois options :

### 1. Même réseau Wi-Fi (le plus simple pour une salle)

Lance le serveur, puis remplace, dans l'URL du QR, `localhost` par l'**IP locale** de ta machine (les joueurs doivent être sur le même Wi-Fi). Pour trouver ton IP : `hostname -I` (Linux) ou *Réglages réseau* (macOS/Windows). Exemple : `http://192.168.1.42:3000`.

### 2. Déploiement public (URL HTTPS accessible partout)

**Render** (config incluse, `render.yaml`) :
1. Pousser le dépôt sur GitHub.
2. Sur [render.com](https://render.com) : *New → Blueprint*, sélectionner le dépôt. Render lit `render.yaml`, build et fournit une URL HTTPS publique (WebSockets et `X-Forwarded-*` gérés d'office).

**Railway / Heroku / Fly.io** : le `Procfile` (`web: node server/index.js`) est reconnu automatiquement. Ces plateformes injectent `PORT` et terminent le TLS en amont.

### 3. Docker

```bash
docker build -t quiz-party .
docker run -p 3000:3000 quiz-party
```

Derrière un reverse proxy (nginx, Traefik…), transmettre `X-Forwarded-Proto` / `X-Forwarded-Host` et activer l'upgrade WebSocket pour Socket.IO.

## Montée en charge au-delà d'une centaine

L'app est prévue pour ~100–300 joueurs sur une seule instance. Pour aller plus loin ou lancer plusieurs instances derrière un load balancer, ajouter un **adaptateur Socket.IO** (par ex. `@socket.io/redis-adapter`) afin de partager les événements entre instances, et externaliser l'état des parties (Redis) — actuellement conservé en mémoire.
