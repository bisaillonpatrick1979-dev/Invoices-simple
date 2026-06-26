# Invoices Simple

Application professionnelle de création et gestion d'invoices.

## Fonctions incluses

- Informations de compagnie dans les settings
- Logo de compagnie optionnel
- Mémoire des clients sauvegardée localement
- Création d'invoice avec numéro, date, due date et titre
- Lignes de description avec quantité, unité, prix et total
- Effet zébré dans les lignes de description du PDF
- Filigrane léger avec le nom de la compagnie
- Option GST 5% Alberta activable/désactivable
- Remise en pourcentage ou en montant fixe
- Signature tactile au bas de l'invoice
- Preview PDF avant l'envoi
- Bulle flottante dans le preview pour PDF, Email ou Texto
- Historique des invoices sauvegardées
- Interface mobile-first
- Données sauvegardées dans le navigateur avec localStorage

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

Le bouton PDF utilise l'impression du navigateur. Pour créer un fichier PDF, choisir "Save as PDF" ou "Enregistrer en PDF" dans la fenêtre d'impression.

Les boutons Email et Texto ouvrent l'application email/SMS de l'appareil avec un message préparé. Pour joindre le PDF automatiquement, il faudra ajouter plus tard un backend ou une intégration email/SMS réelle.
