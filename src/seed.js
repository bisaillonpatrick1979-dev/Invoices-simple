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
  { id: 'seed-beam', description: 'Beam', rate: 2, unit: 'pi²', taxable: true },
  { id: 'seed-board-battens-new', description: 'Board and battens new cons', rate: 2, unit: 'pi²', taxable: true },
  { id: 'seed-fascia', description: 'Fascia', rate: 1.5, unit: 'pi lin.', taxable: true },
  { id: 'seed-fenetre-cladding', description: 'Fenetre cladding', rate: 50, unit: 'ea', taxable: true },
  { id: 'seed-fenetre-reno', description: 'Fenetre reno', rate: 75, unit: 'ea', taxable: true },
  { id: 'seed-lp-board-new', description: 'Lp board new cons', rate: 3, unit: 'pi²', taxable: true },
  { id: 'seed-lp-panel-reno', description: 'Lp panel reno', rate: 3, unit: 'pi²', taxable: true },
  { id: 'seed-poteau', description: 'Poteau', rate: 100, unit: 'ea', taxable: true },
  { id: 'seed-siding-vinyl-new', description: 'Siding vinyl new const', rate: 2, unit: 'pi²', taxable: true },
  { id: 'seed-soffit', description: 'Soffit', rate: 1.5, unit: 'pi²', taxable: true },
  { id: 'seed-trim-25', description: 'Trim 2.5"', rate: 1, unit: 'pi lin.', taxable: true }
]

function seedItems(current) {
  if (load(SEEDED_KEY, false)) return current
  save(SEEDED_KEY, true)
  // Un catalogue déjà rempli (restauré, synchronisé, ou monté à la main) est
  // le bon : on le laisse tranquille.
  if ((current || []).length) return current
  return STARTER_ITEMS.map(i => ({ ...i }))
}

// La liste de départ a d'abord été posée non taxable, recopiée d'une capture
// d'écran où la mention n'apparaissait pas. Tout est taxable. Poser la
// correction dans le code ne suffit pas : les appareils qui ont déjà reçu la
// liste ne la reposent jamais. On répare donc ce qui est en place, une seule
// fois, et seulement sur les articles venus de la liste de départ.
const TAX_FIX_KEY = 'is_seed_tax_fixed'

function fixSeedTax(items) {
  if (load(TAX_FIX_KEY, false)) return items
  save(TAX_FIX_KEY, true)
  let changed = false
  const next = (items || []).map(i => {
    if (!String(i.id || '').startsWith('seed-') || i.taxable !== false) return i
    changed = true
    return { ...i, taxable: true }
  })
  return changed ? next : items
}

export const prepareItems = stored => fixSeedTax(seedItems(stored))
