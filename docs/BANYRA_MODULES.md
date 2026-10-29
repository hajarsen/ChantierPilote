# Les six espaces métier de Banyra

Le menu Banyra et le tableau de la vue d’ensemble ouvrent les outils dans
`/pilot/<espace>/<chantier>`. Sans chantier sélectionné, aucun module métier
n’est monté. Le chantier dans l’adresse reste la référence après rechargement.

| Espace | Adresse | Modules réutilisés |
| --- | --- | --- |
| Plans et documents | `/pilot/plans/:projectId` | Plan Room, fichiers et révisions |
| Réserves et photos | `/pilot/reserves/:projectId` | Punch List, photos et résolution |
| Planning et avancement | `/pilot/planning/:projectId` | Schedule, activités et progression |
| Devis et métrés | `/pilot/estimates/:projectId` | BOQ et éditeur des postes |
| Maquette 3D | `/pilot/model/:projectId/:modelId?` | BIM, import et visualisation |
| Coordination 4D/5D | `/pilot/coordination/:projectId` | Liens BIM, planning et coûts |

`chantier-pilote/workspaces.ts` décrit les entrées. `ErpWorkspace.tsx` constitue
la frontière de réutilisation : chargement à la demande, contexte de chantier,
couleurs Banyra et onglets de coordination. Le mode intégré BIM conserve la
visionneuse dans cet espace. Les pages utilisent les API, permissions et
validations serveur existantes, sans iframe.

`useWorkspaceNavigate` conserve les parcours principaux dans Banyra, notamment
l’édition d’un devis, la sélection d’un modèle et la gestion documentaire.
Les routes originales restent utilisables pendant le développement. Des outils
avancés secondaires peuvent encore ouvrir ces routes originales.

Les montants restent dans la devise du chantier. Les nouveaux chantiers Banyra
proposent MAD ; les chantiers existants ne sont pas convertis. Les libellés sont
en français ; les textes saisis et les fichiers importés restent ceux des utilisateurs.

## Retrait final du reste de l’ERP

Le code ERP est conservé pour permettre l’intégration d’autres fonctions.
Les six espaces réutilisent encore ses composants et services : ils ne sont
pas encore un produit autonome séparé du moteur.

Avant le retrait, extraire les composants et leurs dépendances partagées :
authentification, projets, fichiers, imports/conversion, visionneuse, devis,
planning et coûts, puis les modules serveur et migrations nécessaires.
Intégrer ou retirer explicitement les routes avancées secondaires, puis vérifier
l’application avant de supprimer les autres modules. Ce retrait n’est pas
effectué par cette intégration.

## Validation

Compiler avec `npm --prefix frontend run build`. Les tests de navigation sont
dans `src/shared/hooks/useWorkspaceNavigate.test.ts`. Les régressions ciblées
couvrent les devis, les plans, le planning et les réserves.

Depuis `frontend/`, exécuter
`BANYRA_CHROMIUM=/usr/bin/chromium npx playwright test --config=banyra.playwright.config.ts`.
Les parcours vérifient les six espaces, le chantier sélectionné, les documents,
l’éditeur de devis et l’ajout réel d’une réserve avec photo. Ils créent puis
suppriment leurs données de validation.
