# Banyra

Une application française de suivi de chantier, développée sur une base indépendante :
son interface, ses modèles métier, son serveur et sa base de données sont dans ce dépôt.
Elle ne nécessite aucun autre logiciel de gestion de chantier et ne contient aucun
écran ou moteur repris d’un ERP. Les bibliothèques générales utilisées sont React,
Vite, Lucide, FastAPI et SQLite.

## Essayer sur votre ordinateur

Prérequis : Python 3.11+ et Node.js 22+. Depuis la racine de cette branche :

```bash
python3 setup.py
python3 run.py
```

Ouvrez **http://localhost:8010** et créez votre compte. Gardez le terminal ouvert.
À la première ouverture d’un compte vide, trois chantiers de démonstration sont
automatiquement enregistrés dans la base : Résidence Al Manar à Rabat, Groupe
scolaire Les Oliviers à Casablanca et Hôtel Jardin de l’Atlas à Marrakech. Vous
voyez immédiatement budgets et dépenses en MAD, tâches, contrôles, journaux,
situations, commandes et intervenants marocains fictifs. Le bandeau
« Démonstration » identifie ces exemples ; ils restent après une reconnexion
et ne sont pas recréés à chaque actualisation. Les comptes disposant de vrais
chantiers et les destinataires d’une invitation conservent leur parcours.
Les comptes utilisant l’ancien exemple unique gardent également leurs données.
Dans « Mes chantiers », le bouton « Exemples marocains » permet de charger le
portefeuille si aucun nouvel exemple n’est présent. Créez vos propres chantiers
avec « Nouveau chantier » : leurs formulaires restent vides et vos données sont
séparées des exemples. Les contacts fictifs du projet ne sont pas des comptes
connectables et n’obtiennent aucun accès à votre espace.

La base persistante est `data/banyra.sqlite3` ; elle est créée et mise à jour
automatiquement au démarrage. Aucun serveur de base de données supplémentaire
n’est à installer.
Ce port est volontairement différent des anciennes versions de l’application.

Après une mise à jour : `python3 run.py --build`.
Arrêter le serveur : `Ctrl+C`. La base et les pièces jointes restent dans `data/`.
Cette version utilise sa propre base ; elle ne lit ni ne supprime les anciennes données.

## Fonctions disponibles

- Comptes personnels, connexion et déconnexion par session HTTP sécurisée.
- Dossier chantier privé : marché, adresse, ville/province, type, surface, dates,
  client, architecte, BET, entreprise, responsable et enveloppe en MAD.
- Invitations à usage unique, liées à un e-mail, valables sept jours.
  Le responsable partage le lien lui-même ; aucun service d’e-mail n’est nécessaire.
- Rôles responsable, collaborateur et consultation ; contrôle des droits côté serveur.
- Actions, réserves, affectation, corps d’état, échéances, priorités et photos.
- Contrôles qualité et sécurité avec clôture conditionnée aux points vérifiés.
- Journal quotidien complet : météo, effectifs par corps d’état, zones, travaux,
  engins, livraisons, qualité, sécurité, incidents, visites, décisions, blocages,
  programme du lendemain, tâches liées et photos ; un journal par date et chantier.
- Dépenses et budget HT, calculés en arithmétique décimale, en dirhams marocains.
- Marchés et situations mensuelles : plafonnement du cumul, retenue contractuelle,
  validation par le responsable, puis enregistrement du règlement.
- Commandes avec quantité, prix, livraison et réception.
- Réunions et comptes rendus partagés.
- Plans PDF et photos avec révision explicite, consultation et stockage privé.
- Rapport du chantier imprimable et enregistrable en PDF par le navigateur.
- Journal des contributions et protection contre l’écrasement concurrent des actions et documents.

Tous les boutons correspondent à des opérations enregistrées dans la base.
Les données d’un compte ne sont pas montrées à un autre sans invitation.
Les montants financiers sont **hors taxes** ; aucune règle légale ou taux fiscal
marocain n’est supposé automatiquement.

## Limites de ce premier MVP

La visualisation IFC/3D, les annotations et mesures de plans, les liaisons 4D/5D,
le BPU détaillé, les signatures, les notifications par e-mail et la synchronisation
hors connexion ne sont pas implémentés. Ils ne sont pas proposés comme des fonctions
disponibles dans l’interface. Le PDF est un rapport de suivi, pas un document fiscal.
Les invitations et les exports sont à partager par le responsable.
Pas encore de récupération automatique de mot de passe ; conservez vos identifiants.

Le mode déployé est prévu pour un seul serveur d’application avec un volume SQLite
persistant. Pour un déploiement multi-serveurs, prévoir une migration PostgreSQL et
un stockage d’objets. Effectuez des sauvegardes avant d’utiliser des données réelles.
Une revue de sécurité et une recette métier par votre équipe restent nécessaires
avant un lancement public à grande échelle.

## Votre domaine et le déploiement

Sur un serveur Linux disposant de Docker Compose :

1. Achetez votre domaine et faites pointer son enregistrement DNS A vers le serveur.
2. Créez `.env` d’après `.env.example`, puis renseignez `BANYRA_DOMAIN`.
3. Autorisez les ports 80 et 443 et lancez `docker compose up -d --build`.
4. Caddy obtient le certificat HTTPS et le renouvelle automatiquement.
5. Créez votre compte puis vos chantiers ; partagez des invitations avec vos collègues.

Le navigateur et l’API utilisent le même domaine. Les cookies de session sont
HttpOnly, SameSite et Secure en déploiement. Le fichier `.env`, les sessions et les
pièces jointes ne doivent jamais être publiés dans Git.
Le domaine, le serveur et l’envoi de mails ne sont pas achetés/configurés par ce dépôt.

### Sauvegarde cohérente

Avant une maintenance, arrêtez l’application, sauvegardez **tout** le volume
`banyra-data`, puis redémarrez-la. Cela conserve ensemble la base et les pièces jointes.
Testez la restauration sur une instance de test avant un usage professionnel.
Ne copiez pas uniquement le fichier SQLite pendant que des écritures sont en cours.

## Développement et tests

```bash
.venv/bin/pytest backend/test_app.py -q
npm --prefix frontend run build
```

Pour le développement avec rechargement :

```bash
# Terminal 1
.venv/bin/uvicorn backend.app:app --host 127.0.0.1 --port 8010
# Terminal 2
cd frontend
npm run dev
# Interface de développement : http://localhost:5174
```

Les tests navigateur utilisent une base temporaire séparée et un serveur propre.
Voir `frontend/playwright.config.ts`. Aucun compte partagé de démonstration n’est utilisé.

## Origine du code

Cette branche démarre avec un nouvel historique, une nouvelle arborescence et une
nouvelle implémentation écrite pour Banyra avec assistance IA. Aucun ancien code métier,
écran, fichier de migration, donnée d’exemple ou ressource graphique d’un ERP n’a été
copié. Les anciennes branches du dépôt restent disponibles pour comparaison et récupération.
Les dépendances générales conservent leurs propres licences ; voir `THIRD_PARTY.md`.
