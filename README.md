# Banyra

**Banyra est un prototype d’application web destiné au suivi de projets de construction.** Il aide à organiser les informations du chantier, à suivre les tâches et les contrôles, et à relier le planning à une maquette 3D.

Le projet explore l’application du numérique au génie civil, notamment la coordination entre les activités de chantier, les documents techniques, le planning et la maquette BIM.

> **Statut** : première version fonctionnelle en cours de développement. Les données d’exemple sont fictives. Les montants sont exprimés en dirhams marocains (MAD), hors taxes.

La maquette BIM proposée en démonstration est un duplex résidentiel au format IFC2x3. Le fichier source et sa provenance sont documentés dans [THIRD_PARTY.md](THIRD_PARTY.md).

## Usages pour le suivi de chantier

Banyra regroupe les principales informations nécessaires au suivi d’un projet de construction :

- **Journal de chantier** : consigner les travaux réalisés, les effectifs, la météo, les livraisons, les observations et les blocages.
- **Tâches et réserves** : affecter une action à un responsable, préciser son échéance et sa priorité, puis suivre son avancement.
- **Qualité et sécurité** : enregistrer des contrôles et suivre les points à vérifier avant leur clôture.
- **Documents techniques** : consulter les plans PDF et leurs révisions, joindre des photos et partager des comptes rendus.
- **Suivi des dépenses et des commandes** : consulter le budget et les dépenses, suivre les commandes et leur réception.
- **Marchés et situations** : enregistrer les marchés, les situations mensuelles et les règlements.
- **Coordination de l’équipe** : inviter des utilisateurs et leur attribuer un rôle de responsable, collaborateur ou consultation.

## Maquette BIM et planning 4D

Le module BIM permet de consulter une maquette au format IFC ou GLB, d’inspecter les propriétés des éléments et de filtrer leur affichage.

Dans le planning, les tâches peuvent être reliées aux éléments de la maquette. La simulation 4D permet ensuite de parcourir les dates prévues et de visualiser le phasage des travaux.

1. Ouvrez **Maquette BIM · 3D** pour consulter la maquette exemple ou importer un fichier IFC ou GLB.
2. Ouvrez **Planning · 4D**, créez ou sélectionnez une tâche, puis associez-lui un ou plusieurs éléments de la maquette.
3. Renseignez les dates, le responsable, l’avancement et les dépendances entre tâches.
4. Activez **Simulation 4D du planning** et parcourez les dates.

Les couleurs de la simulation représentent les dates planifiées. L’avancement réel est saisi séparément dans le planning. Le visualiseur nécessite un navigateur récent compatible WebGL. Les fichiers importés peuvent peser jusqu’à 50 Mo.

## Lancer Banyra en local

Prérequis : Python 3.11 ou plus récent et Node.js 22 ou plus récent.

Depuis la racine du projet, exécutez :

```bash
python3 setup.py
python3 run.py
```

Ouvrez ensuite [http://localhost:8010](http://localhost:8010) et créez un compte. À la première ouverture d’un compte vide, des chantiers de démonstration sont proposés avec des données fictives pour Rabat, Casablanca et Marrakech. Vous pouvez aussi créer votre propre chantier depuis **Mes chantiers → Nouveau chantier**.

Après une mise à jour, reconstruisez l’interface avec :

```bash
python3 run.py --build
```

La base SQLite et les pièces jointes sont conservées dans le dossier `data/`.

## Périmètre actuel

La simulation 4D visualise le phasage planifié. Cette version ne calcule pas automatiquement le chemin critique et ne détecte pas les interférences entre éléments de maquette. Le transfert automatique des liens entre les révisions d’une maquette n’est pas disponible.

Les métrés détaillés, les coûts 5D, les annotations de plans, les signatures, les notifications par e-mail et la synchronisation hors connexion ne sont pas inclus dans cette version.

## Technologies

- **Interface** : React et Vite
- **API** : FastAPI
- **Base de données** : SQLite
- **Déploiement** : Docker Compose et Caddy

Pour un déploiement sur serveur Linux, créez un fichier `.env` à partir de `.env.example`, renseignez `BANYRA_DOMAIN`, puis lancez :

```bash
docker compose up -d --build
```

Prévoyez un volume persistant et sauvegardez ensemble la base de données et les pièces jointes.

Les licences des dépendances sont répertoriées dans [THIRD_PARTY.md](THIRD_PARTY.md).
