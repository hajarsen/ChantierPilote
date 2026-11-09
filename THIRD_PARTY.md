# Bibliothèques générales

Banyra utilise des bibliothèques de programmation générales ; leurs licences
continuent de s’appliquer à ces dépendances.

| Bibliothèque | Usage | Licence |
| --- | --- | --- |
| React et React DOM | Interface | MIT |
| Vite | Compilation | MIT |
| TypeScript | Typage | Apache-2.0 |
| Lucide | Icônes | ISC |
| FastAPI, Starlette, Pydantic, Uvicorn | Serveur HTTP et validation | MIT / BSD-3-Clause |
| Python | Exécution | PSF |
| SQLite | Stockage | Domaine public |
| Caddy | HTTPS (déploiement facultatif) | Apache-2.0 |
| Playwright, Pytest, HTTPX | Tests | Apache-2.0 / MIT / BSD-3-Clause |
| Prettier | Formatage du code | MIT |
| Plus Jakarta Sans | Typographie locale | SIL OFL-1.1 |
| Three.js | Rendu 3D | MIT |
| Web-IFC | Lecture des fichiers IFC et géométrie WebAssembly | MPL-2.0 |

Les notices complètes de ces packages sont fournies dans leurs distributions.
Les licences des bibliothèques de l’interface sont également copiées dans
`frontend/public/third-party.txt`, servi avec l’application à `/third-party.txt`.
Les dépendances JavaScript exactes sont verrouillées dans `frontend/package-lock.json`.
L’environnement Python validé est verrouillé dans `backend/requirements.lock`.
Leurs ressources graphiques ne proviennent pas d’un logiciel métier tiers.

La licence de la police figure dans `frontend/public/plus-jakarta-sans-license.txt`.
La photographie d’illustration du chantier (`frontend/public/brand/terrain.png`)
a été générée par IA pour Banyra. Le logo est dessiné localement en CSS/SVG.

Three.js et Web-IFC sont des bibliothèques générales utilisées sans modification,
chargées localement et seulement dans l’espace BIM. Leurs notices et les liens
vers les sources de Web-IFC sont dans `frontend/public/bim-libraries.txt`, servi
à `/bim-libraries.txt`. Aucun service de traitement externe n’est utilisé.


## Maquette IFC de démonstration

`backend/assets/Ifc2x3_Duplex_Architecture.ifc` is the IFC2x3 duplex sample supplied from [youshengCode/IfcSampleFiles](https://github.com/youshengCode/IfcSampleFiles/blob/main/Ifc2x3_Duplex_Architecture.ifc). The source repository describes its files as software-test samples but does not declare a license. The IFC file is retained as a demonstration fixture with its original metadata and source attribution. Confirm redistribution rights before making this repository public.
