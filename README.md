# Invoices Simple

Application de création et gestion d'invoices, avec une interface calquée sur **Invoice Simple** : barre latérale navy (bureau), navigation en bas d'écran (mobile), boutons verts, badges de statut et aperçu PDF professionnel.

## Écrans

- **Invoices** — liste avec recherche, filtres (Toutes / Impayées / Payées), solde impayé total, badges de statut (Brouillon, Impayée, En retard, Payée)
- **Estimates** — soumissions avec conversion en invoice en un clic
- **Clients** — carnet de clients sauvegardé localement (ajout, modification, recherche)
- **Items** — catalogue de produits/services réutilisables (prix, unité, taxable)
- **Reports** — facturé / payé / impayé par année, détail par mois, par client et par item
- **Settings** — infos de compagnie, logo, taxe (nom + taux, GST 5 % Alberta par défaut), préfixes de numérotation, couleur du PDF, notes et instructions de paiement par défaut

## Éditeur d'invoice

- Numéro, date, termes (sur réception / net 7-14-30 / date personnalisée) avec due date automatique
- Section Bill To avec clients en mémoire
- Lignes d'items : description, quantité, unité, prix, taxable par ligne, insertion depuis le catalogue, sauvegarde d'une ligne comme item
- Taxe activable, taux modifiable, remise en % ou en $
- Paiements et bouton « Marquer payée » (balance due calculée)
- Photos jointes (apparaissent sur le PDF)
- Notes et signature tactile
- Bascule Edit / Preview comme dans Invoice Simple

## Aperçu PDF

- En-tête avec logo et couleur d'accent choisie dans les settings
- Effet zébré dans les lignes, filigrane léger avec le nom de la compagnie
- Totaux avec taxe, remise, payé et balance due
- Bulle flottante PDF / Email / Texto

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

Les boutons Email et Texto ouvrent l'application email/SMS de l'appareil avec un message préparé. Pour joindre le PDF automatiquement, il faudra ajouter plus tard un backend ou une intégration email/SMS réelle.

Toutes les données restent dans le navigateur (localStorage). Les données de l'ancienne version de l'app sont migrées automatiquement au premier lancement.
