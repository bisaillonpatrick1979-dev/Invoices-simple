// Liste de prix de départ.
//
// Recopiée depuis le catalogue de l'appareil, pour qu'une nouvelle adresse ou
// un nouveau téléphone ne reparte pas d'une liste vide. Elle ne se pose qu'une
// fois, et seulement si le catalogue est vide : elle ne vient jamais écraser
// un prix modifié, ni ressusciter un article supprimé.

import { load, save } from './store.js'

const SEEDED_KEY = 'is_seeded'

// Les identifiants sont fixes : deux appareils qui posent la liste de départ
// créent les mêmes articles, et la synchro les reconnaît au lieu de les
// dédoubler.
export const STARTER_ITEMS = [
  { id: 'seed-beam', description: 'Beam', rate: 2, unit: 'pi²', taxable: false },
  { id: 'seed-board-battens-new', description: 'Board and battens new cons', rate: 2, unit: 'pi²', taxable: false },
  { id: 'seed-fascia', description: 'Fascia', rate: 1.5, unit: 'pi lin.', taxable: false },
  { id: 'seed-fenetre-cladding', description: 'Fenetre cladding', rate: 50, unit: 'ea', taxable: false },
  { id: 'seed-fenetre-reno', description: 'Fenetre reno', rate: 75, unit: 'ea', taxable: false },
  { id: 'seed-lp-board-new', description: 'Lp board new cons', rate: 3, unit: 'pi²', taxable: false },
  { id: 'seed-lp-panel-reno', description: 'Lp panel reno', rate: 3, unit: 'pi²', taxable: false },
  { id: 'seed-poteau', description: 'Poteau', rate: 100, unit: 'ea', taxable: false },
  { id: 'seed-siding-vinyl-new', description: 'Siding vinyl new const', rate: 2, unit: 'pi²', taxable: false },
  { id: 'seed-soffit', description: 'Soffit', rate: 1.5, unit: 'pi²', taxable: false },
  { id: 'seed-trim-25', description: 'Trim 2.5"', rate: 1, unit: 'pi lin.', taxable: true }
]

export function seedItems(current) {
  if (load(SEEDED_KEY, false)) return current
  save(SEEDED_KEY, true)
  // Un catalogue déjà rempli (restauré, synchronisé, ou monté à la main) est
  // le bon : on le laisse tranquille.
  if ((current || []).length) return current
  return STARTER_ITEMS.map(i => ({ ...i }))
}
