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

Les notices complètes de ces packages sont fournies dans leurs distributions.
Les licences des bibliothèques de l’interface sont également copiées dans
`frontend/public/third-party.txt`, servi avec l’application à `/third-party.txt`.
Les dépendances JavaScript exactes sont verrouillées dans `frontend/package-lock.json`.
L’environnement Python validé est verrouillé dans `backend/requirements.lock`.
Leurs ressources graphiques ne proviennent pas d’un logiciel métier tiers.
