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
- **Aperçu** : la facture PDF (filigrane, zébrures, couleur au choix) avec bouton plein écran / impression
- **Historique** : chaque enregistrement, envoi, paiement est journalisé
- Bouton flottant **Envoyer** : Email, Texto ou PDF

## Autres écrans

- **Clients / Articles / Dépenses** : listes avec bouton « + » flottant et formulaires en feuille du bas
- **Rapports** : facturé / payé / impayé par année, par mois, par client, par article
- **Réglages** : infos d'entreprise, logo, taxe, préfixes de numérotation, couleur du PDF, textes par défaut

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
