# Invoices Simple

Application de facturation avec une interface calquée sur les captures d'écran de l'app mobile de référence : thème bleu, barre d'onglets en bas, listes groupées par année et éditeur en rangées de cartes.

## Navigation (barre du bas)

- **Factures** — onglets Toutes / Non payées / Payées, groupées par année avec total annuel, mention verte « Payé le ... »
- **Devis** — onglets Toutes / Ouverts / Fermés, conversion en facture en un clic
- **Comptabilité** — onglets Aperçu / Transactions / Rapports : Revenue, Expenses, Net Profit, graphique Profit & Loss par mois, liste des paiements reçus et dépenses, rapport Profit and Loss
- **Paiements** — écran de configuration des paiements (instructions de paiement sur la facture)
- **Plus** — feuille du bas avec Clients, Articles, Dépenses, Rapports et Réglages

## Éditeur de facture / devis

Onglets **Modifier / Aperçu / Historique** comme l'app de référence :

- **Modifier** : numéro, date, rangée « À Client » (avec clients en mémoire), articles (qté × prix, taxable par ligne, catalogue d'articles), Sous-total, Remise ($ ou %), Gst 5 % (nom et taux modifiables), Total, Paiements, **Solde dû**, Planification des paiements (paiements partiels), Ajouter une photo, Info sur le paiement, Remarques, Signature tactile, bouton « Marquer comme payée »
- **Aperçu** : la facture PDF (logo, filigrane, zébrures, couleur au choix) avec bouton plein écran / impression
- **Historique** : chaque enregistrement, envoi, paiement est journalisé
- Bouton flottant **Envoyer** : Email, Texto ou PDF

## Autres écrans

- **Clients / Articles / Dépenses** : listes avec bouton « + » flottant, recherche et formulaires en feuille du bas
- **Rapports** : facturé / payé / impayé par année, par mois, par client, par article
- **Réglages** : infos d'entreprise, logo, filigrane, taxe, préfixes de numérotation, couleur du PDF, textes par défaut

## Personnalisation : logo et filigrane

Dans **Plus → Réglages** :

- **Logo compagnie** : n'importe quelle image (PNG, JPG, SVG). Elle est automatiquement réduite à 600 px avant d'être enregistrée, pour ne pas remplir la mémoire du navigateur. Case à cocher pour l'afficher ou non en haut de la facture.
- **Filigrane** : le motif pâle imprimé derrière chaque facture et chaque devis.
  - **Logo** — le logo de la compagnie en filigrane (si aucun logo n'est chargé, le nom de la compagnie est utilisé)
  - **Texte** — le nom de la compagnie ou un texte libre (« PAYÉ », « BROUILLON », …)
  - **Aucun** — aucun filigrane
  - Curseurs **Opacité**, **Taille** et **Rotation**, avec aperçu en direct

Le filigrane est répété sur chaque page à l'impression.

### Aperçu du rendu

Le bouton **Voir un aperçu de la facture**, au bas des réglages, ouvre une **facture d'exemple** (client et articles fictifs) montée avec tes réglages du moment : logo, filigrane, couleur, taxe, remarques. Ça permet de juger le rendu final sans créer de vraie facture — rien n'est enregistré. Le bouton d'impression de cette fenêtre ne sort que la facture, pas l'écran des réglages.

Dans l'éditeur, le bouton **Envoyer** propose **Aperçu PDF** en premier : de quoi vérifier la facture telle qu'elle sortira avant de l'envoyer par email ou texto.

## Catalogue d'articles (liste de prix)

**Tout ce qui est facturé est mémorisé automatiquement.** Dès qu'une facture est enregistrée, chaque ligne (description, prix, unité, taxable) entre au catalogue. Rien à toucher.

Ensuite, en tapant les premières lettres d'une description sur une facture, un menu déroulant propose ce qui a déjà été facturé, avec son prix :

```
pos
┌──────────────────────────────────────────┐
│ Poser des panneaux        3,00 $ / pi²   │
│ Poser du déclin de vinyle 4,50 $ / pi²   │
└──────────────────────────────────────────┘
```

Une touche sur la suggestion remplit la description, le prix, l'unité et le caractère taxable ; il ne reste que la quantité à entrer.

Une description déjà connue est mise à jour plutôt que dupliquée (la casse n'a pas d'importance), et une description de moins de 3 lettres n'est pas retenue, pour ne pas mémoriser un mot à moitié tapé.

**Plus → Articles** montre toute la liste : recherche, tri alphabétique, modification du prix, suppression de ce qui ne sert pas. Le bouton « + » permet aussi d'ajouter un prix à la main, sans passer par une facture.

Le champ **unité** est libre, avec des suggestions courantes (ea, h, pi², pi lin., verge², jour, lot, km), et sort dans la colonne « Unité » du PDF.

## Assistant IA

**Plus → Assistant IA.** Tu racontes ce que tu as fait — à voix haute ou au clavier — et il monte la facture. Tu lui envoies la photo d'une liste de travaux, il la lit et remplit la facture ou le catalogue. Tu lui demandes tes chiffres, il répond.

### Lui parler

- **Micro** (à droite du champ) : appuie, parle, appuie de nouveau pour arrêter. Le texte se met dans le champ, tu le relis, tu envoies. Ce que tu avais déjà tapé est gardé, la dictée s'ajoute à la suite.
- **Mains libres** (l'icône casque, en haut à droite) : le micro reste ouvert. Tu parles, et **deux secondes de silence suffisent pour que ça parte tout seul**. La réponse est lue à voix haute, puis l'écoute repart. De quoi facturer les mains pleines, sans toucher au téléphone.

La transcription se fait **dans le navigateur** : ton micro n'est jamais envoyé au fournisseur d'IA, seul le texte transcrit part. Ça demande Chrome, Edge ou Safari — sur un navigateur qui ne sait pas transcrire (Firefox), le bouton micro n'apparaît pas et le clavier prend le relais.

La dictée sur un chantier est ce qu'elle est : l'assistant sait que « deux cent cinquante pieds carrés » veut dire 250 pi², que « piasses » parle d'argent, et qu'un nom de client mal transcrit ressemble sûrement à un client déjà enregistré.

### Il suit la conversation

Les derniers échanges repartent au modèle à chaque message : tu peux corriger sans tout redire.

> — J'ai posé 250 pi² de panneaux à 3 $ chez Marc Tremblay
> — *facture INVOICE0012 préparée, 750 $*
> — Ajoute 4 heures de main-d'œuvre
> — *même facture, 2 lignes, 1 090 $*

Une correction **complète la facture montée juste avant** au lieu d'en créer une deuxième. Le numéro, la date et le client sont gardés ; seules les lignes changent.

### La photo

Deux boutons à gauche du champ : l'**appareil photo** (ouvre la caméra directement sur un téléphone) et l'**image** (photo, capture d'écran, plusieurs à la fois). L'image est réduite à 1400 px avant l'envoi, assez pour rester lisible par le modèle.

Il lit chaque ligne de travail, sa quantité et son prix. Un prix illisible est repris du catalogue ; si rien ne correspond, la ligne sort à 0 $ et il te le dit, plutôt que d'inventer un montant.

### Brancher un fournisseur

Dans **Réglages → Assistant IA** : choisis le fournisseur, colle ta clé API, ajuste le nom du modèle au besoin, puis **Teste la connexion**.

| Fournisseur | Où prendre la clé | Modèle par défaut |
|---|---|---|
| Anthropic (Claude) | console.anthropic.com | `claude-opus-5` |
| OpenAI (GPT) | platform.openai.com | `gpt-4o` |
| Google (Gemini) | aistudio.google.com | `gemini-2.5-flash` |
| Autre (DeepSeek, Qwen, Groq, OpenRouter, serveur local) | selon le fournisseur | `deepseek-chat` |

Le dernier choix accepte n'importe quelle API au format OpenAI : il suffit d'entrer son adresse.

### Où va la clé

**L'app n'a aucun serveur.** La clé est enregistrée sur l'appareil et le navigateur appelle directement le fournisseur. Personne d'autre ne la voit — mais quiconque a l'appareil déverrouillé peut la lire. N'y mets pas une clé d'entreprise partagée. Le bouton *Retirer la clé de cet appareil* l'efface.

### Les chiffres ne sont jamais calculés par l'IA

Revenus, encaissements, soldes dus et dépenses sont calculés en JavaScript, puis transmis au modèle déjà faits. Le modèle les met en phrase, il ne les additionne pas — un modèle qui compte des montants se trompe.

### Ce qu'il ne fait pas tout seul

Il **prépare** la facture et l'ouvre pour révision ; il ne l'envoie pas au client. Envoyer une facture est irréversible et se fait en une touche depuis l'éditeur, une fois que tu as vérifié.

## Bulle « + » déplaçable

Le bouton rond « + » peut être glissé où on veut à l'écran : un appui ajoute, un glissement déplace. La position est retenue d'un écran à l'autre et d'une session à l'autre, et la bulle ne peut pas sortir de l'écran.

## Commandes

```bash
npm install
npm run dev
```

Build production :

```bash
npm run build
```

## Notes

Le bouton PDF utilise l'impression du navigateur : choisir « Save as PDF / Enregistrer en PDF ».

Les boutons Email et Texto ouvrent l'application email/SMS de l'appareil avec un message préparé. Pour joindre le PDF automatiquement ou accepter des paiements en ligne, il faudra brancher plus tard un backend ou un fournisseur de paiement.

Toutes les données restent dans le navigateur (localStorage). Les données des anciennes versions de l'app sont migrées automatiquement au premier lancement.
