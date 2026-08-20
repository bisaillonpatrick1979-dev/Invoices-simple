// Copie de sauvegarde : tout ce que l'app garde, dans un fichier.
//
// Les données vivent dans le navigateur, rattachées à l'adresse du site. Un
// redéploiement au même endroit n'y touche pas — mais changer d'adresse, de
// navigateur, d'appareil, ou vider les données de navigation, oui. Ce fichier
// est le filet : il se garde n'importe où et se relit n'importe quand.

import { load, save } from './store.js'

const STORES = [
  ['settings', 'is_settings', {}],
  ['clients', 'is_clients', []],
  ['items', 'is_items', []],
  ['expenses', 'is_expenses', []],
  ['docs', 'is_docs', []]
]

export const BACKUP_FORMAT = 1

export function buildBackup() {
  const out = { app: 'invoices-simple', format: BACKUP_FORMAT, exportedAt: new Date().toISOString() }
  for (const [name, key, fallback] of STORES) out[name] = load(key, fallback)
  // La clé API de l'assistant ne part pas dans un fichier qu'on va promener
  // sur une clé USB ou dans un courriel. Elle reste sur l'appareil.
  if (out.settings?.ai) out.settings = { ...out.settings, ai: { ...out.settings.ai, apiKey: '' } }
  return out
}

export const backupCounts = data => ({
  clients: (data.clients || []).length,
  items: (data.items || []).length,
  expenses: (data.expenses || []).length,
  docs: (data.docs || []).length
})

export const backupFileName = () =>
  `invoices-simple-${new Date().toISOString().slice(0, 10)}.json`

export function downloadBackup() {
  const data = buildBackup()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  // laisser le temps au téléchargement de démarrer avant de libérer
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return backupCounts(data)
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Ce fichier ne se laisse pas lire.'))
    reader.onload = () => {
      let data
      try { data = JSON.parse(String(reader.result)) } catch {
        return reject(new Error("Ce fichier n'est pas une copie de Invoices Simple."))
      }
      if (!data || data.app !== 'invoices-simple') {
        return reject(new Error("Ce fichier n'est pas une copie de Invoices Simple."))
      }
      resolve(data)
    }
    reader.readAsText(file)
  })
}

// Fusion par identifiant : ce qui est dans le fichier gagne, ce qui n'y est
// pas est gardé. Restaurer ne doit jamais effacer un travail plus récent fait
// sur l'appareil.
const mergeById = (current, incoming) => {
  const byId = new Map((current || []).map(x => [x.id, x]))
  for (const x of incoming || []) if (x?.id) byId.set(x.id, x)
  return [...byId.values()]
}

export function applyBackup(data) {
  const added = {}
  for (const [name, key, fallback] of STORES) {
    const incoming = data?.[name]
    // Absente, nulle ou du mauvais type : on passe. Une section abîmée du
    // fichier ne doit pas emporter les autres — c'est justement quand la copie
    // est imparfaite qu'on a besoin de récupérer le reste.
    if (incoming == null) continue
    try {
      if (name === 'settings') {
        if (typeof incoming !== 'object' || Array.isArray(incoming)) continue
        const current = load(key, fallback)
        // la clé API de l'appareil survit à la restauration
        save(key, { ...current, ...incoming, ai: { ...(incoming.ai || {}), apiKey: current?.ai?.apiKey || '' } })
        continue
      }
      if (!Array.isArray(incoming)) continue
      const before = load(key, fallback)
      const after = mergeById(before, incoming)
      save(key, after)
      added[name] = after.length - before.length
    } catch { /* cette section-là ne se relit pas : les autres, oui */ }
  }
  return added
}
