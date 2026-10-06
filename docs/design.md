# Electro Care — Charte visuelle

Validée le 6 octobre 2026. Référence visuelle : https://claude.ai/artifact/UwRPCMp8kxwNMyEqaqLsAt
(accueil, page du lieu, fiche appareil, accueil sombre, planche d'identité).
Ce chantier ne change que l'apparence : aucune logique, aucune donnée, aucune migration.

## Principes

- Fraîche et moderne. Thème clair par défaut ; dans Paramètres, « Affichage » propose « Clair » (par défaut),
  « Sombre » et « Selon le téléphone » (prefers-color-scheme).
- Statuts adoucis : pastilles pâles avec texte foncé. Seule la jauge de l'accueil est en couleurs pleines.
- Une idée par ligne : un titre (nom de l'appareil) et une ligne de détail. Jamais de libellés en capitales
  (« OBLIGATIONS » devient « Obligations »), jamais de chaînes « A — B » ni « A · B ».
- Les obligations à jour se replient en une seule ligne (« 5 obligations à jour, prochaine échéance en octobre 2026 »).
- Une icône par type d'appareil, dans un carré arrondi teinté selon le statut.
- Accessibilité : cibles tactiles d'au moins 44 px, contraste du texte d'au moins 4,5:1, focus clavier visible,
  statuts lisibles par le texte et la clarté, pas seulement la couleur.

## Choix du thème

- Retenu dans un cookie propriétaire sur l'appareil (par exemple ec-theme = light | dark | system), sans date
  d'expiration courte, sans aucune autre donnée.
- Lu côté serveur pour poser data-theme sur <html> dès la construction de la page : jamais de clignotement du
  mauvais thème. Valeur « system » : les variables sombres s'appliquent via @media (prefers-color-scheme: dark).
- Pages non connectées : même cookie ; sans cookie, thème clair.
- Dans Paramètres : section « Affichage », trois choix exclusifs, appliqués immédiatement.

## Couleurs (variables CSS, sur :root, redéfinies en thème sombre)

| Variable | Clair | Sombre | Usage |
|---|---|---|---|
| --bg | #F3F6F9 | #0E151C | fond de page |
| --surface | #FFFFFF | #17212B | cartes, lignes |
| --surface-2 | #F3F6F9 | #1D2A36 | blocs internes, boutons neutres |
| --text | #15202B | #E8EEF3 | texte principal |
| --text-2 | #5B6B78 | #9AABB8 | texte secondaire |
| --line | #E8EDF2 | #263544 | séparateurs |
| --line-strong | #C9D3DC | #34465A | bordures en pointillé (ajouter) |
| --accent | #3D4FE0 | #8C98FF | marque, liens, icônes |
| --accent-soft | #EBEDFC | #222A52 | fond d'icône, pastille « Rendez-vous pris » |
| --ok-text / --ok-soft | #1F7A4D / #E3F3EA | #73D6A0 / #12301F | « À jour », bouton « C'est fait » |
| --warn-text / --warn-soft | #9A5B00 / #FFF1DC | #F5B85E / #33240C | « À confirmer », « Mettre à jour » |
| --warn-border | #F3C98A | #6B4A14 | bouton « Reporter » (contour) |
| --late-text / --late-soft | #B3261E / #FCE8E6 | #FF9B92 / #3A1714 | « En retard » |
| --bar-ok / --bar-warn / --bar-late | #3BA36B / #F0A23B / #E05A4F | #46B57A / #E9A23F / #E8675C | jauge segmentée |
| --neutral-text / --neutral-soft | #3A4956 / #F3F6F9 | #C3CFD8 / #1D2A36 | « Non concerné », « Professionnel » |

## Typographie

- Bricolage Grotesque (600, 700) : titres de page et de section, grands chiffres.
- Figtree (400, 500, 600) : tout le reste.
- Chargées avec next/font/google : les fichiers sont hébergés par l'app, aucune requête vers Google depuis le
  navigateur des visiteurs. Repli : system-ui, sans-serif.
- Échelle : titre de page 28-30 px (Bricolage 700, interlettrage -0,5 px) ; grand chiffre de la jauge 44 px ;
  titre de section 19 px (Bricolage 600) ; nom d'élément 16 px (Figtree 600) ; détail 14 px (--text-2) ;
  libellé de groupe 13 px (600, --text-2).

## Formes et espacements

- Arrondis selon la hiérarchie : carte principale 24 px ; carte de lieu 20 px ; carte d'obligation 16-18 px ;
  ligne 16 px ; carré d'icône 14 px (44 px de côté) ou 20 px (64 px, en tête de fiche) ; bouton 12 px ;
  pastille 999 px.
- Pas d'ombres : les surfaces se détachent du fond par la couleur.
- Page : marge de 20 px, 24 px entre sections, 10 à 12 px entre lignes, 14 px de padding dans une ligne.

## Composants

- **Jauge de conformité** (accueil) : « 8 sur 12 » en grand, « obligations à jour » à côté ; barre segmentée de
  12 px (en retard, à confirmer, à jour, proportionnelles, 4 px d'écart) ; légende en dessous ; puis une ligne
  « 3 gestes d'entretien ce mois-ci, environ 25 min ». Mini-jauge de 6-8 px sur chaque carte de lieu.
- **Ligne d'élément** : carré d'icône teinté selon le statut, nom (16 px, 600), détail (14 px), action à droite
  ou en dessous.
- **Pastille de statut** : En retard, À confirmer, À jour, Rendez-vous pris (accent), Non concerné (neutre).
- **Boutons** (44 px de haut) : « C'est fait » (ok-soft / ok-text), « Mettre à jour » (warn-soft / warn-text),
  « Reporter » (contour warn-border, texte warn-text), principal (accent, texte blanc), neutre (surface-2).
  Les deux boutons orange ne sont jamais côte à côte (règle existante).
- **Ajouter** (lieu, appareil) : bouton à bordure en pointillé --line-strong, texte accent, icône +.
- **Interrupteur** (Paramètres) : le rond reste entièrement dans la piste, centré verticalement, même marge des
  deux côtés, dans les deux positions.

## Icônes (traits, 24×24, stroke 1,75, stroke-linecap et stroke-linejoin round, fill none)

- Chaudière, chauffage : `<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M12 8.5c1.6 1.7 2.2 2.9 2.2 4.1a2.2 2.2 0 0 1-4.4 0c0-1.2.6-2.4 2.2-4.1z"/><path d="M8.5 18h7"/>`
- Cheminée, poêle, bois : `<path d="M12 3c3 3.4 5 6.1 5 9.4a5 5 0 0 1-10 0c0-1.9 1-3.5 2.5-4.9.3 1.4 1 2.2 2 2.5C11 7.9 11.2 5.4 12 3z"/>`
- Climatisation, pompe à chaleur, froid : `<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M10 4.5l2 1.5 2-1.5M10 19.5l2-1.5 2 1.5"/>`
- Détecteurs, sécurité : `<path d="M4 7h16"/><path d="M6.5 7a5.5 5.5 0 0 0 11 0"/><circle cx="12" cy="9.5" r="1"/><path d="M8 17c1.1 1.3 2.5 2 4 2s2.9-.7 4-2"/>`
- Eau, eau chaude, assainissement, piscine : `<path d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3z"/>`
- Lavage (lave-linge, sèche-linge, lave-vaisselle) : `<rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="12" cy="13" r="4.2"/><path d="M7.5 6.5h2"/>`
- Froid alimentaire (réfrigérateur, congélateur) : `<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M6 10h12M9 6v2M9 13v3"/>`
- Véhicule : `<path d="M5 16v-5l2-5h10l2 5v5"/><path d="M3 16h18"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>`
- Logement (lieu) : `<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>`
- Rendez-vous : `<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>`
- Temps : `<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>` ; validé : `<path d="M5 12.5l4.5 4.5L19 7.5"/>` ;
  retour : `<path d="M15 6l-6 6 6 6"/>` ; suite : `<path d="M9 6l6 6-6 6"/>` ; ajouter : `<path d="M12 5v14M5 12h14"/>`
- Correspondance : chaque catégorie du référentiel reçoit l'icône la plus proche ci-dessus ; les autres
  (cuisine, petit électroménager, extérieur…) reçoivent une icône simple dans le même style, tracée au besoin.
