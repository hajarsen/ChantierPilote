# Banyra — vos chantiers, en mouvement

Une application de gestion de chantier en français, personnalisée à partir
[d’OpenConstructionERP](https://github.com/datadrivenconstruction/openconstructionerp).

## Fonctionnalités

- Tableau de bord et portefeuille de chantiers.
- Actions terrain, échéances et responsables.
- Contrôles qualité et observations sécurité avec listes de vérification.
- Journal quotidien, effectifs et engins.
- Enveloppes budgétaires et lecture des coûts du chantier.
- Commandes fournisseurs en brouillon, TVA et suivi des livraisons.
- Interface mobile, exports CSV et accès aux fonctions ERP avancées.

Cette première version utilise le nom provisoire **Banyra**. La disponibilité de
`banyra.ma` reste à vérifier. Ce dépôt contient le code source ; aucune adresse
publique de l’application n’a encore été déployée.

## Démarrer en local

Prérequis : Linux, Python 3.12+, Node.js 24 et au moins 16 Go de RAM pour la
compilation initiale du frontend (plafond Node de 12 Go).

```bash
git clone https://github.com/hajarsen/ChantierPilote.git
cd ChantierPilote
python3 -m venv .venv
source .venv/bin/activate
pip install -e './backend[server,dev]'
cd frontend
npm ci
npm run build
cd ..
python3 scripts/banyra_dev.py start --wait 180
```

Sur **la machine qui exécute ces commandes**, ouvrir `http://127.0.0.1:5173`.
Le frontend relaie les requêtes vers l’API sur le port 8000. PostgreSQL 16
embarqué démarre automatiquement. Le bouton de démonstration utilise les
comptes d’exemple fournis par le moteur ERP.

```bash
python3 scripts/banyra_dev.py status
python3 scripts/banyra_dev.py stop
```

Les journaux techniques du lanceur sont dans `.venv/banyra-logs/`. Les données
applicatives sont conservées dans `../openconstructionerp-data/` par défaut ;
`BANYRA_DATA_DIR` permet de choisir un autre emplacement. Ne pas supprimer ce
dossier lors d’une mise à jour. Les fichiers locaux, clés, sessions, données et
dépendances installées ne sont pas inclus dans ce dépôt.

## Vérifier

Depuis `frontend/` :

```bash
npm run test -- --run src/features/chantier-pilote/api.test.ts \
  src/features/boq/api.test.ts src/shared/lib/api.test.ts --maxWorkers=2
npm run build
```

Avec l’API et le frontend démarrés, le parcours navigateur crée un chantier de
validation, vérifie les contrôles, le journal, le budget, une commande et le
format mobile, puis archive ce chantier :

```bash
BANYRA_CHROMIUM=/usr/bin/chromium npx playwright test \
  --config=banyra.playwright.config.ts
```

Retirer `BANYRA_CHROMIUM` pour utiliser un Chromium géré par Playwright.
Ne pas exécuter ce test sur une base de production client.

La CI de ce dépôt exécute les tests frontend ciblés et la compilation. Les
workflows de publication automatique du projet d’origine n’ont pas été activés.

## Architecture et origine

Voir [BANYRA.md](BANYRA.md) pour le périmètre exact, les API utilisées et les
limites de cette première version. Les fonctions détaillées du moteur ERP
restent accessibles dans l’application via les outils avancés.

Base importée : OpenConstructionERP 18.9.0, commit
`b9b81e426a59b253531435f99ce4ca9c31934af5`. Le README d’origine est conservé dans
[docs/UPSTREAM_README.md](docs/UPSTREAM_README.md).

Licence [AGPL-3.0](LICENSE). Les mentions d’origine, [NOTICE](NOTICE), [AUTHORS.md](AUTHORS.md)
et les attributions du logiciel et de ses ressources sont conservées.
