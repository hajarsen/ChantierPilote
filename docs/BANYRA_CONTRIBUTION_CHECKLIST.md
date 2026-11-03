# Checklist de contribution Banyra

Ce guide complète `README.md` et `CONTRIBUTING.md` pour les adaptations propres à ChantierPilote/Banyra. Il ne remplace pas les exigences du projet d'origine.

## Avant une modification

- Décrire le besoin et son impact dans une issue.
- Créer une branche dédiée depuis `main`.
- Identifier les modules touchés et les éventuels impacts sur les données de chantier.
- Ne pas inclure de secrets, d'identifiants, de données personnelles ou de données client dans les commits.

## Vérification du frontend

Depuis `frontend/`, après installation des dépendances :

```bash
npm run test -- --run src/features/chantier-pilote/api.test.ts src/features/boq/api.test.ts src/shared/lib/api.test.ts --maxWorkers=2
npm run build
```

Ces commandes sont documentées dans le README principal. Pour les autres composants, consulter les vérifications spécifiques dans `CONTRIBUTING.md` et `DEVELOPING.md`.

## Tests navigateur et sécurité

- Utiliser une base de démonstration ou de test, jamais une base de production client.
- Le parcours Playwright documenté dans le README crée et archive un chantier de validation.
- Vérifier les permissions et les informations affichées selon les rôles utilisateurs.
- Vérifier le rendu mobile pour toute modification de l'interface.

## Pull request

- Résumer le problème et la solution.
- Indiquer les fichiers concernés, les tests exécutés et leurs résultats réels.
- Signaler les limites connues et les vérifications non effectuées.
- Demander une revue avant fusion pour les changements fonctionnels, de sécurité ou de données.
- Préserver les mentions de licence et les attributions OpenConstructionERP.
