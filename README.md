# Banyra

**Application web de suivi de chantier, conçue pour centraliser les informations du terrain et visualiser le phasage des travaux.**

Banyra rassemble dans un espace par chantier les tâches, les réserves, les contrôles, les documents et les données de suivi. Les équipes peuvent également relier les tâches du planning aux éléments d’une maquette 3D pour visualiser la séquence prévue des travaux.

**État du projet** · Première version fonctionnelle en cours de développement. L’application est en français et les montants sont exprimés en dirhams marocains (MAD), hors taxes.

## Ce que vous pouvez faire

| Espace | Fonctions disponibles |
| --- | --- |
| **Suivi des travaux** | Tenir un journal quotidien, consigner les travaux réalisés, les effectifs, les livraisons et les blocages. Affecter des actions et des réserves avec une échéance, une priorité et des photos. |
| **Qualité et sécurité** | Enregistrer les contrôles et suivre les points à vérifier avant leur clôture. |
| **Documents et coordination** | Consulter les plans PDF et leurs révisions, partager des comptes rendus et générer un rapport imprimable depuis le navigateur. |
| **Suivi financier** | Consulter le budget et les dépenses, gérer les commandes et leurs réceptions, suivre les marchés, les situations mensuelles et les règlements. |
| **Maquette BIM et planning** | Consulter une maquette IFC ou GLB, inspecter ses propriétés, organiser les tâches dans un Gantt et simuler leur déroulement sur la maquette. |
| **Accès au chantier** | Inviter des utilisateurs et leur attribuer un rôle de responsable, de collaborateur ou de consultation. |

## Essayer Banyra

Prérequis : Python 3.11+ et Node.js 22+. Depuis la racine du projet :

```bash
python3 setup.py
python3 run.py
```

Ouvrez [http://localhost:8010](http://localhost:8010), puis créez un compte. Pour découvrir l’application, ouvrez l’un des chantiers fictifs proposés à la première connexion d’un compte vide. Les exemples couvrent des projets à Rabat, Casablanca et Marrakech. Vous pouvez aussi créer un dossier à partir de **Mes chantiers → Nouveau chantier**.

Après une mise à jour, lancez `python3 run.py --build`. La base SQLite et les pièces jointes sont conservées dans `data/`.

## Découvrir la simulation 4D

1. Ouvrez **Maquette BIM · 3D** pour consulter une maquette exemple ou importer un fichier IFC ou GLB (jusqu’à 50 Mo).
2. Dans **Planning · 4D**, associez des éléments de la maquette à une tâche et renseignez les dates, le responsable et les dépendances.
3. Activez **Simulation 4D du planning** et parcourez les dates pour visualiser la séquence prévue.

Les couleurs de la simulation reflètent les dates planifiées. L’avancement réel est renseigné séparément dans le planning. Le visualiseur nécessite un navigateur récent compatible WebGL.

## Périmètre de cette version

La simulation 4D sert à visualiser le phasage prévu. Le calcul automatique du chemin critique, la détection d’interférences et le transfert automatique des liaisons entre révisions de maquette restent hors du périmètre actuel.

## Repères techniques

- **Interface** · React et Vite
- **API** · FastAPI
- **Données** · SQLite
- **Déploiement** · Docker Compose et Caddy

Pour déployer sur un serveur, créez un fichier `.env` à partir de `.env.example`, renseignez `BANYRA_DOMAIN`, puis exécutez `docker compose up -d --build`. Prévoyez un volume persistant et sauvegardez ensemble la base et les pièces jointes.

Les licences des dépendances sont documentées dans [THIRD_PARTY.md](THIRD_PARTY.md).
