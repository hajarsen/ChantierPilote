# Captures et démonstration Banyra

Les trois vues retenues pour le README sont la vue d’ensemble, la maquette BIM 3D
et le planning 4D. Elles présentent les fonctions principales sans répéter tous
les écrans. La vidéo montre aussi les actions terrain, le journal et les dépenses.

- `vue-ensemble.png` : tableau de bord et chantiers marocains.
- `maquette-3d.png` : duplex IFC et inspection des propriétés.
- `planning-4d.png` : Gantt au-dessus de la maquette et phasage prévu.
- `demo-apercu.gif` : extrait animé cliquable dans le README GitHub.
- `banyra-demo.mp4` : enregistrement d’écran fourni par l’autrice, d’environ
  3 min 15 s, converti en MP4 sans audio.

Les trois captures sont produites sur la version du dépôt avec une base SQLite
temporaire, des données fictives et un compte « Équipe Banyra ». La vidéo actuelle
provient d’un enregistrement manuel fourni pour le README ; l’aperçu GIF est
extrait de cet enregistrement. Le duplex conserve la provenance décrite dans
[THIRD_PARTY.md](../../THIRD_PARTY.md).

Le README utilise des images et un lien relatif vers le MP4, afin de rester
consultable sur GitHub sans hébergement vidéo supplémentaire. L’aperçu GIF est
animé ; le lien MP4 permet de consulter ou télécharger la vidéo complète selon
le lecteur disponible.

## Remplacer la vidéo

Depuis la racine du dépôt, exporter un enregistrement sans piste audio :

```bash
ffmpeg -i "enregistrement.webm" -map 0:v:0 -an -vf fps=30 -fps_mode cfr -c:v libx264 -crf 23 -preset fast -pix_fmt yuv420p -movflags +faststart docs/media/banyra-demo.mp4
```

Mettre ensuite à jour l’extrait `demo-apercu.gif` et la durée affichée dans le
README. Les liens conservent les mêmes chemins.

## Générer une démonstration automatisée

Après installation et compilation de Banyra, sur Linux avec Chromium et FFmpeg :

```bash
node frontend/scripts/capture-readme.mjs
```

Ce script remplace les captures, la vidéo et l’aperçu par une nouvelle
démonstration automatisée. Il ne reproduit pas l’enregistrement manuel actuel.
Il démarre un serveur temporaire sur `127.0.0.1:8012`, utilise les données
de démonstration du dépôt, enregistre les interactions avec Playwright, puis
encode le MP4 et son aperçu avec FFmpeg. Il ne modifie pas la base `data/` de
l’application. Le serveur est arrêté à la fin de la capture.
