# Validation du MVP indépendant

Les contrôles suivants ont été exécutés sur cette nouvelle base :

- 19 tests API : comptes et sessions, protection CSRF et origine, isolation des
  chantiers, invitations liées à un e-mail, lecture seule et révocation,
  contrôles qualité, conflits d’édition, journal quotidien complet et ses photos,
  portefeuille marocain persistant sans doublons, respect des vrais chantiers,
  intervenants fictifs, décimales,
  plafonds des situations, commandes et pièces jointes privées.
- 6 parcours Chromium réels sur l’interface compilée et une base temporaire :
  réserve avec photo et contrôle, journal et chaîne financière, invitation d’un
  second compte, navigation mobile et changement de compte avec réponse réseau
  retardée ; chargement automatique des trois projets, budgets en MAD, nouvelle
  identité Banyra, image locale, typographie et affichage mobile avec données.
  Aucun serveur métier externe n’est utilisé par ces parcours.
- Compilation TypeScript et production, formatage Prettier.
- Lors de la validation du socle initial : construction de l’image Docker locale.
- Démarrage du conteneur avec `--network none`, consultation de l’interface,
  création d’un compte et d’un chantier, puis vérification du chantier après
  redémarrage. Le conteneur de contrôle a ensuite été arrêté et supprimé.
- Validation de `compose.yaml` et de la configuration Caddy pour HTTPS.

Cela valide le périmètre du MVP décrit dans le README. Aucun domaine public ni
hébergement n’a été acheté ou déployé. Ces contrôles ne remplacent pas une recette
métier sur vos cas réels, une revue de sécurité avant ouverture publique et des
tests réguliers de restauration des sauvegardes.
