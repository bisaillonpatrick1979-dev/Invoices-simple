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

- **Modifier** : numéro, date, rangée « À Client » (avec clients en mémoire), **Chantier** (adresse des travaux), articles (qté × prix, taxable par ligne, catalogue d'articles), Sous-total, Remise ($ ou %), Gst 5 % (nom et taux modifiables), Total, Paiements, **Solde dû**, Planification des paiements (paiements partiels), Ajouter une photo, Info sur le paiement, Remarques, Signature tactile, bouton « Marquer comme payée »
- **Aperçu** : la facture PDF (logo, filigrane, zébrures, couleur au choix) avec bouton plein écran / impression
- **Historique** : chaque enregistrement, envoi, paiement est journalisé
- Bouton flottant **Envoyer** : Email, Texto ou PDF

## Envoyer la facture avec le PDF attaché

Bouton **Envoyer** dans l'éditeur :

| Entrée | Ce qui part |
|---|---|
| **Envoyer le PDF** | Le partage du téléphone s'ouvre : **Messages, Gmail, WhatsApp… au choix, avec le PDF en pièce jointe**. Rien n'empêche de l'envoyer par texto *et* par courriel — on repasse par le bouton une deuxième fois. |
| **Courriel** | Ouvre l'app de courriel avec le détail écrit dans le message (texte seulement) |
| **Texto** | Ouvre l'app de messages avec le résumé, le chantier et le numéro de la compagnie |
| **Enregistrer le PDF** | Le fichier dans les téléchargements, à joindre à la main |
| **Aperçu PDF** / **Imprimer** | Voir avant d'envoyer, ou imprimer |

Le PDF est un **vrai fichier** produit par l'app (`INVOICE0012.pdf`), pas une impression du navigateur : logo, filigrane, adresse des travaux, tableau des lignes, remise, taxe, paiements et solde dû, remarques, info de paiement, signature, et le nom + téléphone de la compagnie en pied de page. Il se recompose sur plusieurs pages quand la facture est longue.

Un lien `mailto:` ou `sms:` **ne peut pas transporter de fichier** — c'est une limite des navigateurs, pas un oubli. D'où le partage natif, qui est le seul chemin qui attache vraiment le PDF. Sur un ordinateur, où ce partage n'existe pas, l'entrée disparaît et **Enregistrer le PDF** prend le relais.

Le générateur de PDF n'est téléchargé qu'au premier PDF demandé : il pèse plus que toute l'app, et on ouvre l'app bien plus souvent qu'on ne sort un PDF.

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

## Adresse du chantier

Une facture par chantier : la rangée **Chantier**, sous le client, porte l'adresse des travaux. Elle sort sur le PDF dans un encadré entre le client et les lignes, pour que le payeur voie du premier coup d'œil **quel chantier il paie** — utile quand le client a plusieurs adresses, ou quand celui qui paie (gestionnaire, assureur, propriétaire absent) n'habite pas là où le travail a été fait.

Un bouton **Reprendre l'adresse du client** évite de la retaper quand c'est la même. L'adresse part aussi dans le courriel envoyé au client, et l'assistant IA la remplit si tu la dis (« j'ai fait le 789 rue des Pins »).

## Où en est chaque facture

Sur la liste, chaque rangée porte le **chantier** à côté du numéro et une **pastille d'état** :

| Pastille | Ce que ça veut dire |
|---|---|
| **En cours** | pas encore envoyée au client |
| **En attente de paiement** | envoyée, l'argent n'est pas rentré |
| **Modifiée — à renvoyer** | envoyée, puis corrigée : le client a encore l'ancienne version |
| **Payée** | soldée |
| **Ouvert** / **Fermé** | pour les devis |

La recherche trouve aussi par chantier, pas seulement par client ou numéro.

« Payée » l'emporte sur « En attente de paiement » : une facture réglée a forcément été envoyée, et c'est le paiement qu'on veut lire.

L'état se met à jour tout seul quand tu envoies depuis l'app. Quand la facture part autrement — remise en main propre, envoyée depuis un autre appareil —, le bouton **Marquer comme envoyée** au bas de l'éditeur le dit à l'app. Il se défait aussi : **Remettre « en cours »** si tu t'es trompé. Chaque changement est noté dans l'historique de la facture.

## Savoir quand le client a ouvert la facture

Un PDF attaché à un texto ne dit jamais rien : une fois le fichier chez le client, il ne parle plus. Un **lien**, lui, passe par une page — et une page qui s'ouvre, ça se sait.

Dans le menu **Envoyer** :

| Choix | Suivi |
|---|---|
| **Texto avec le lien** / **Courriel avec le lien** | oui — l'app dit quand le client ouvre |
| **Copier le lien** | oui, mais la facture n'est pas marquée envoyée (copier n'est pas envoyer) |
| **Envoyer le PDF** (fichier attaché) | aucun |
| **Courriel** / **Texto** (texte seul) | aucun |

Le destinataire reçoit une adresse du genre `invoices-simple.vercel.app/f/wkLA8tdPctk…` : il touche, la facture s'ouvre dans son navigateur, avec un bouton **Télécharger le PDF**. Pas de compte, pas d'application à installer.

**Un lien par destinataire.** Le courriel part à l'administration, le texto au contremaître : ce sont deux liens différents pour la même facture. C'est ce qui permet à l'app de dire **lequel des deux a lu** — « courriel lu il y a 3 min, texto pas encore ouvert » — plutôt qu'un vague « quelqu'un a ouvert ». Chaque lien porte l'adresse ou le numéro auquel il est parti, et se coupe séparément.

Ce que l'app affiche ensuite :

- une pastille par canal sur la rangée de la facture — ✉ **lu il y a 3 min**, 💬 **lu il y a 1 min** — à côté de l'état ;
- un **avis sous la barre du haut** au moment où l'ouverture est découverte — « Chantier Nord inc. a ouvert le courriel — INVOICE0012 », avec l'adresse en dessous — qui s'efface tout seul après quelques secondes ; une touche ouvre la facture ;
- une carte **Liens de facture** dans l'éditeur : une ligne par destinataire, avec le nombre d'ouvertures, la date de la dernière, et les boutons **Copier**, **Voir la page**, **Couper**.

Trois précisions qui comptent :

- **« Pas encore ouverte »** est une information, pas une panne : c'est ce qui te dit qui relancer, et ça enlève l'argument « je ne l'ai jamais reçue ».
- Après une correction, une ouverture d'avant compte pour ce qu'elle vaut : la pastille devient **Vue avant correction**, et la carte précise que le client n'a pas encore vu la nouvelle révision.
- Chaque lien est **gardé d'une version à l'autre** : celui que le destinataire a déjà reçu montre toujours la version à jour — c'est ce qui fait qu'une facture corrigée remplace vraiment la précédente. **Couper** un lien ferme sa page pour de bon ; **Réactiver** la rouvre. Couper le courriel ne coupe pas le texto.

Les ouvertures se rafraîchissent à chaque synchronisation et chaque fois que tu reviens dans l'app. Il faut donc être connecté à la sauvegarde infonuagique (Réglages) pour créer un lien.

### Ce qui est stocké, et ce qui ne l'est pas

Les liens vivent dans le projet Supabase de l'app, dans deux tables : `shares` (une ligne par destinataire — la facture figée telle qu'il la voit, plus le nom, le logo et le filigrane de l'entreprise) et `share_views` (une ligne par ouverture). Les photos de chantier, la clé de l'IA et les réglages internes **ne partent pas**.

Personne ne peut lister les factures partagées : la page publique passe par une fonction qui ne répond qu'au jeton exact — 22 caractères tirés au hasard —, jamais par la table. Le tableau de bord Supabase signale ces deux fonctions comme « exécutables sans compte » : c'est voulu, c'est exactement ce qui permet à un client de voir sa facture sans avoir à se créer un compte.

## Corriger une facture déjà envoyée

Une fois le PDF ou le courriel chez le client, **rien ne peut le reprendre** : le fichier est sur son téléphone. Ce qui se fait en facturation, c'est de **remplacer** — la nouvelle version annule la précédente, et le document le dit lui-même.

L'app compare ce qui est parti chez le client (montants, lignes, chantier, client, remarques) avec ce que la facture contient maintenant :

- dès que tu touches à une facture déjà envoyée, la pastille passe à **Modifiée — à renvoyer** et un bandeau rouge s'ouvre en haut de l'éditeur : le client a encore l'ancien montant ;
- le bouton d'envoi devient **Renvoyer**, et le bouton du bas **Marquer comme renvoyée** si le renvoi s'est fait hors de l'app ;
- le PDF et l'aperçu portent alors, en rouge sous le numéro : **RÉVISION 2 — remplace et annule la version du 19/08/26 22 h 04** ;
- le courriel et le texte préparés disent la même chose, pour que le client sache laquelle des deux factures compte ;
- l'historique garde la trace de chaque version partie.

Le numéro de facture ne change pas — c'est la même facture, à sa deuxième version. Un troisième envoi donne la révision 3, et ainsi de suite. Tant que le renvoi n'est pas fait, la pastille rouge reste : impossible d'oublier qu'un client se promène avec le mauvais montant.

## Rien ne se perd

**Une facture en cours s'enregistre toute seule**, sans bouton à toucher :

- Tu changes d'onglet, tu ouvres les réglages, tu retournes en arrière — tout est gardé.
- Tu fermes l'application ou le téléphone tue l'onglet en plein milieu — c'est écrit quand même : l'app enregistre au moment où l'écran se cache, sans attendre.
- **Tu rouvres l'app, tu retombes sur la facture que tu étais en train de faire**, exactement où tu l'avais laissée. Une fois que tu en sors par la flèche, l'app s'ouvre normalement sur la liste.

Deux garde-fous : une facture **encore vide** n'est pas gardée (elle encombrerait la liste et brûlerait un numéro pour rien), et l'enregistrement automatique **ne touche pas au catalogue de prix** — une description à moitié tapée n'a rien à faire dans ta liste de prix. Le catalogue n'apprend que sur un vrai enregistrement.

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

Les prix et les quantités acceptent la **virgule** comme le point : sur un clavier québécois, la touche décimale écrit une virgule, et « 4,50 » vaut 4,50 $ — pas 450 $.

Le champ **unité** est libre, avec des suggestions courantes (ea, h, pi², pi lin., verge², jour, lot, km), et sort dans la colonne « Unité » du PDF.

## Assistant IA

**La bulle mauve, en bas à droite de n'importe quel écran.** Tu racontes ce que tu as fait — à voix haute ou au clavier — et il monte la facture.

### La bulle, partout

L'assistant est à une touche depuis **tous les onglets** (Factures, Devis, Comptabilité, Paiements), depuis les écrans du menu Plus, et jusque **dans l'éditeur de facture**. Un appui l'ouvre par-dessus l'écran en cours ; la flèche te ramène exactement où tu étais, sans rien perdre de ce que tu remplissais.

- **Un glissement la déplace** — comme la bulle « + ». Elle retient sa place d'un écran à l'autre et d'une session à l'autre, et ne peut pas sortir de l'écran.
- **La conversation reste.** Ferme le panneau pour aller vérifier une facture, rouvre : tout est encore là. Une réponse déjà partie continue d'arriver, et la bulle respire pendant que ça travaille.
- **Le micro se tait** dès que le panneau se ferme. Rien n'écoute derrière un écran fermé.

(**Plus → Assistant IA** ouvre le même panneau.) Tu lui envoies la photo d'une liste de travaux, il la lit et remplit la facture ou le catalogue. Tu lui demandes tes chiffres, il répond.

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

### Les photos et les fichiers

Deux boutons à gauche du champ :

- l'**appareil photo** — ouvre la caméra directement sur un téléphone
- le **trombone image** — photos, captures d'écran **et PDF**, plusieurs à la fois

Les images sont réduites à 1400 px avant l'envoi, assez pour rester lisibles par le modèle. Les PDF partent tels quels, jusqu'à 12 Mo.

Il lit chaque ligne de travail, sa quantité et son prix. Un prix illisible est repris du catalogue ; si rien ne correspond, la ligne sort à 0 $ et il te le dit, plutôt que d'inventer un montant.

**Un PDF joint** — devis de fournisseur, bon de travail, soumission, facture reçue — sert à monter la facture : il en reprend les quantités et les descriptions, mais applique **tes** prix du catalogue quand la description correspond. Les prix du fournisseur sont les siens, pas les tiens. Si le PDF n'est pas une liste de travaux, il dit ce que c'est et demande quoi en faire.

La lecture des PDF demande **Anthropic (Claude)** ou **Google (Gemini)** : le format de chat d'OpenAI ne transporte pas de fichier. Avec un autre fournisseur, l'assistant le dit au lieu de laisser partir un appel qui échouerait.

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

### Envoyer la facture au client

« Envoie la facture de Marc par courriel », « envoie-la par texto ». L'assistant retrouve le document (par son numéro, ou celui monté dans la conversation), écrit le message avec le détail des lignes et les totaux, et propose une carte **Préparer**.

La touche sur *Préparer* ouvre ton app de courriel ou de texto avec tout écrit dedans — **c'est toi qui appuies sur Envoyer**. Rien ne part sur la seule parole du modèle : tant que tu n'as pas touché la carte, la facture n'est même pas marquée comme envoyée. Une fois ouverte, l'envoi est noté dans l'historique de la facture.

S'il manque l'adresse courriel ou le numéro de téléphone du client, il le dit au lieu d'essayer.

### Ce qu'il ne fait pas tout seul

Il **prépare** la facture et l'ouvre pour révision ; il ne l'envoie jamais sans que tu appuies. Envoyer une facture est irréversible, alors la dernière touche reste la tienne.

## Copie de sauvegarde (fichier)

**Réglages → Copie de sauvegarde.** Un bouton écrit un fichier `invoices-simple-AAAA-MM-JJ.json` avec tout : clients, articles, factures, devis, dépenses, réglages. Un autre le relit.

**Un redéploiement de l'app n'efface rien.** Les données vivent dans le navigateur, pas dans le code ; publier une nouvelle version ne les touche pas. Ce qui les fait disparaître :

- **changer d'adresse de site** — c'est le vrai piège. Le navigateur range les données par adresse, et Vercel donne une **adresse différente à chaque déploiement** (`invoices-simple-ooem6t4ld-…`). Un site ouvert sur une de ces adresses-là repart à zéro à la publication suivante. Il faut travailler sur l'**adresse stable** : `invoices-simple.vercel.app`.
- changer d'appareil ou de navigateur, ou passer en navigation privée
- vider les données de navigation

La restauration **ajoute, elle n'efface pas** : ce qui est déjà dans l'app est gardé, ce qui est dans le fichier vient s'ajouter ou mettre à jour, par identifiant. Restaurer par erreur ne détruit donc rien.

La clé API de l'assistant **ne part pas** dans le fichier : elle resterait en clair dans une copie qu'on promène. Elle reste sur l'appareil, et une restauration ne l'écrase pas.

## Sauvegarde infonuagique (Supabase)

**Réglages → Sauvegarde infonuagique.** Sans compte, l'app marche exactement comme avant : tout reste dans le navigateur. Avec un compte, les mêmes données sont aussi copiées dans le nuage et suivent d'un appareil à l'autre — et d'une adresse de site à l'autre.

### Son propre projet

Invoices Simple a **son projet Supabase à elle**, `invoices-simple` (région ca-central-1), séparé de celui de Hailite Manager. Rien ne se croise : ni les tables, ni les comptes.

| Table | Contenu |
|---|---|
| `documents` | factures et devis (le document complet en `jsonb`, plus numéro/date/client/total/solde/chantier en colonnes pour chercher en SQL) |
| `clients` | clients |
| `items` | catalogue de prix |
| `expenses` | dépenses |
| `settings` | réglages de l'entreprise |

Les tables sont dans le schéma `public`, celui que l'API expose d'office : **rien à configurer dans le tableau de bord**. On crée son compte et ça marche.

### Le compte

Courriel + mot de passe (Supabase Auth). Les politiques RLS ne laissent voir à un compte que ses propres lignes, et le rôle non connecté n'a aucun droit sur aucune table : la clé publique dans le code de l'app **ne donne rien** à quelqu'un qui n'est pas connecté. C'est pour ça qu'elle peut être dans le code.

La **clé API de l'assistant IA ne monte jamais** dans le nuage. Elle a été saisie sur cet appareil, elle y reste.

### Comment la synchro se comporte

- **Local d'abord.** Tout est écrit dans le navigateur en premier. Sans réseau sur un chantier, rien ne bloque ; la synchro repart au signal suivant.
- **Trois secondes après ta dernière modification**, ce qui a bougé monte. Pas à chaque frappe.
- **Ce qui a changé seulement.** L'app garde l'empreinte de la dernière synchro : une ligne qui n'a bougé nulle part ne génère aucun trafic, et une facture n'est redescendue avec ses photos que si elle a vraiment changé ailleurs.
- **Les suppressions voyagent.** Une facture effacée sur le téléphone est marquée supprimée dans la base, pour que le portable l'enlève aussi — au lieu de la faire réapparaître.
- **Si la même ligne a changé des deux bords**, c'est l'appareil que tu as en main qui gagne. Et une ligne supprimée ailleurs mais retouchée ici revit plutôt que de perdre ton travail.

## Bulles déplaçables

Deux boutons ronds flottent au-dessus de l'app : le **« + » bleu** (ajouter) et la **bulle mauve de l'assistant**. Chacune se glisse où on veut — un appui agit, un glissement déplace — garde sa place d'une session à l'autre, et ne peut pas sortir de l'écran.

**Un appui reste un appui.** Au doigt, le pouce dérape toujours de quelques pixels : la bulle tolère 14 px avant de se croire glissée, et un geste bref compte comme une touche même s'il a bougé davantage. Sinon le bouton « + » ne répond qu'aux touches parfaitement immobiles — et on ne peut plus rien ajouter.

**Elles ne peuvent pas se cacher l'une l'autre.** La bulle de l'assistant s'écarte du « + » au démarrage et après chaque glissement, et le « + » passe devant de toute façon. Sans ça, une bulle posée sur l'autre avale la touche et le bouton d'ajout devient mort — plus moyen d'ajouter un article ni un client.

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
