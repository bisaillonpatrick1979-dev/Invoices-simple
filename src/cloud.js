// Sauvegarde et synchronisation dans Supabase.
//
// L'app reste locale d'abord : tout est écrit dans le navigateur, et le nuage
// n'est qu'une copie. Sur un chantier sans réseau, rien ne bloque ; la synchro
// repart quand le signal revient.
//
// L'app a son propre projet Supabase, séparé de celui de Hailite Manager :
// aucune donnée des deux applications ne se croise, ni dans les tables ni dans
// les comptes. Les tables vivent donc dans `public`, le schéma que l'API
// expose d'office — rien à configurer dans le tableau de bord.

import { createClient } from '@supabase/supabase-js'
import { load, save } from './store.js'

const SCHEMA = 'public'
const CFG_KEY = 'is_cloud_cfg'
const SNAP_KEY = 'is_cloud_snap'

// Projet « invoices-simple ». L'URL et la clé publiable sont faites pour être
// dans le code d'une app web : elles n'ouvrent rien toutes seules, ce sont les
// politiques RLS qui décident, et elles n'accordent rien à qui n'est pas
// connecté.
const DEFAULT_CFG = {
  url: 'https://ksdrljqigvgxzelhtpgj.supabase.co',
  key: 'sb_publishable_NZOb2ltakl346tScfC9KMg_E1SoKsGU'
}

export const cloudConfig = () => {
  const env = {
    url: import.meta.env?.VITE_SUPABASE_URL,
    key: import.meta.env?.VITE_SUPABASE_ANON_KEY
  }
  if (env.url && env.key) return env
  const stored = load(CFG_KEY, null)
  if (stored?.url && stored?.key) return stored
  return DEFAULT_CFG
}

export const saveCloudConfig = cfg => save(CFG_KEY, cfg)

let client = null
let clientFor = ''
export function cloud() {
  const { url, key } = cloudConfig()
  if (!url || !key) return null
  if (client && clientFor === url + key) return client
  clientFor = url + key
  client = createClient(url, key, {
    db: { schema: SCHEMA },
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'is_auth' }
  })
  return client
}

// Ne devrait plus arriver avec un projet dédié — `public` est exposé d'office.
// Le message reste pour le cas d'une configuration personnalisée.
const SCHEMA_HINT = `Le schéma « ${SCHEMA} » n'est pas exposé par ce projet Supabase (Project Settings → API → Exposed schemas).`

export const cloudError = e => {
  const msg = String(e?.message || e || 'Erreur inconnue')
  if (/schema must be one of|does not exist|PGRST106/i.test(msg)) return SCHEMA_HINT
  if (/Invalid login credentials/i.test(msg)) return 'Courriel ou mot de passe refusé.'
  if (/Email not confirmed/i.test(msg)) return "Le compte existe mais le courriel n'est pas confirmé. Regarde ta boîte de réception."
  if (/User already registered/i.test(msg)) return 'Ce courriel a déjà un compte — connecte-toi au lieu de le créer.'
  if (/Password should be/i.test(msg)) return 'Mot de passe trop court (6 caractères minimum).'
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return "Pas de réseau. Les données restent sur l'appareil et repartiront à la prochaine synchro."
  return msg
}

// ===== Auth =====
export const signIn = (email, password) => cloud().auth.signInWithPassword({ email: email.trim(), password })

// emailRedirectTo : sans ça, le lien de confirmation renvoie vers l'adresse
// par défaut du projet Supabase — localhost:3000 — et le téléphone tombe sur
// « connexion refusée ». On lui donne l'adresse d'où part la demande.
export const signUp = (email, password) => cloud().auth.signUp({
  email: email.trim(),
  password,
  options: { emailRedirectTo: window.location.origin }
})

export const resendConfirmation = email => cloud().auth.resend({
  type: 'signup',
  email: email.trim(),
  options: { emailRedirectTo: window.location.origin }
})
export const signOut = () => cloud().auth.signOut()
export const getSession = () => cloud()?.auth.getSession() || Promise.resolve({ data: { session: null } })
export const onAuthChange = fn => cloud()?.auth.onAuthStateChange((_e, session) => fn(session?.user || null))

// ===== Correspondance entre l'objet de l'app et la ligne de la table =====
const num = n => Number(n || 0)
const nul = s => (String(s || '').trim() ? String(s) : null)

// La clé API du modèle d'IA ne monte jamais : elle a été saisie sur cet
// appareil et elle y reste (voir README).
const settingsForCloud = s => ({ ...s, ai: { ...(s.ai || {}), apiKey: '' } })

const COLLECTIONS = {
  clients: {
    table: 'clients',
    toRow: c => ({ id: c.id, name: nul(c.name), phone: nul(c.phone), email: nul(c.email), address: nul(c.address), city: nul(c.city), notes: nul(c.notes) }),
    fromRow: r => ({ id: r.id, name: r.name || '', phone: r.phone || '', email: r.email || '', address: r.address || '', city: r.city || '', notes: r.notes || '' })
  },
  items: {
    table: 'items',
    toRow: i => ({ id: i.id, description: nul(i.description), unit: nul(i.unit), rate: num(i.rate), taxable: i.taxable !== false }),
    fromRow: r => ({ id: r.id, description: r.description || '', unit: r.unit || 'ea', rate: num(r.rate), taxable: r.taxable !== false })
  },
  expenses: {
    table: 'expenses',
    toRow: e => ({ id: e.id, date: nul(e.date), description: nul(e.description), category: nul(e.category), amount: num(e.amount) }),
    fromRow: r => ({ id: r.id, date: r.date || '', description: r.description || '', category: r.category || 'Autre', amount: num(r.amount) })
  },
  docs: {
    table: 'documents',
    // Le document complet part en jsonb : c'est l'objet que l'app manipule
    // déjà, la synchro ne peut pas le déformer. Les colonnes à côté servent à
    // chercher et totaliser en SQL sans ouvrir le jsonb.
    toRow: (d, totals = { total: 0, balance: 0, status: null }) => ({
      id: d.id,
      doc_type: d.docType,
      number: nul(d.number),
      date: nul(d.date),
      client_name: nul(d.client?.name),
      total: num(totals.total),
      balance: num(totals.balance),
      status: totals.status,
      data: d
    }),
    fromRow: r => r.data
  }
}

// ===== Instantané de la dernière synchro =====
// Il sert à trois questions : cette ligne a-t-elle changé ici ? a-t-elle
// changé là-bas ? a-t-elle été supprimée ici ?
const emptySnap = () => ({ clients: {}, items: {}, expenses: {}, docs: {}, settings: {} })
const loadSnap = () => ({ ...emptySnap(), ...(load(SNAP_KEY, null) || {}) })
const saveSnap = snap => save(SNAP_KEY, snap)
export const forgetSnapshot = () => save(SNAP_KEY, emptySnap())

const stamp = row => JSON.stringify(row)

// PostgREST met les identifiants demandés dans l'URL, et une facture porte ses
// photos : on découpe. Sur un appareil neuf, tout le catalogue et toutes les
// factures descendent d'un coup — c'est là que la requête devient énorme.
const CHUNK = 60
const chunks = list => {
  const out = []
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK))
  return out
}
const ts = v => (v ? new Date(v).getTime() : 0)

// Réconcilie une collection. Le contenu fait foi : une ligne dont le texte a
// changé depuis la dernière synchro est une modification locale, sans avoir à
// poser un champ « modifié le » sur chaque écran de l'app.
//
// Ne reçoit que l'état des lignes distantes (id, dates), jamais leur contenu :
// une facture pèse ses photos, et les rapatrier toutes à chaque synchro
// coûterait le forfait de données pour rien. `pull` dit lesquelles valent la
// peine d'être redescendues.
export function reconcile(localList, remoteRows, snap) {
  const remote = new Map(remoteRows.map(r => [r.id, r]))
  const locals = new Map(localList.map(x => [x.id, x]))
  const merged = []
  const upsert = []
  const remove = []
  const pull = []
  const nextSnap = {}

  for (const item of localList) {
    const r = remote.get(item.id)
    const before = snap[item.id]
    const changedHere = !before || before.json !== stamp(item)

    if (r?.deleted_at) {
      // Supprimé ailleurs. S'il a été retouché ici depuis, c'est la retouche
      // qui gagne : on le fait revivre au lieu de perdre le travail.
      if (!changedHere) continue
      merged.push(item)
      upsert.push(item)
      continue
    }
    if (!r) { merged.push(item); upsert.push(item); continue }

    const changedThere = ts(r.updated_at) > ts(before?.at)
    if (changedHere || !changedThere) {
      merged.push(item)
      if (changedHere) upsert.push(item)
      else nextSnap[item.id] = before
    } else {
      pull.push(r.id)                                     // la version du nuage gagne
      nextSnap[r.id] = { at: r.updated_at }
    }
  }

  for (const r of remoteRows) {
    if (locals.has(r.id)) continue
    if (r.deleted_at) continue
    // Connu à la dernière synchro mais disparu d'ici : supprimé sur cet appareil.
    if (snap[r.id]) { remove.push(r.id); continue }
    pull.push(r.id)                                       // arrivé d'un autre appareil
    nextSnap[r.id] = { at: r.updated_at }
  }

  return { merged, upsert, remove, pull, nextSnap }
}

async function syncCollection(name, localList, userId, snap, totalsOf) {
  const spec = COLLECTIONS[name]
  const db = cloud()
  // Premier passage : rien que l'état des lignes, pas leur contenu.
  const { data, error } = await db.from(spec.table).select('id, updated_at, deleted_at').eq('user_id', userId)
  if (error) throw error

  const plan = reconcile(localList, data || [], snap[name] || {})
  const merged = [...plan.merged]
  const now = new Date().toISOString()

  // Deuxième passage : le contenu des seules lignes à redescendre.
  for (const part of chunks(plan.pull)) {
    const { data: full, error: pullErr } = await db.from(spec.table)
      .select('*').eq('user_id', userId).in('id', part)
    if (pullErr) throw pullErr
    for (const r of full || []) {
      const parsed = spec.fromRow(r)
      if (parsed) merged.push({ ...parsed, id: r.id })
    }
  }

  for (const part of chunks(plan.upsert)) {
    const rows = part.map(x => ({
      ...spec.toRow(x, totalsOf?.(x)),
      user_id: userId,
      updated_at: now,
      deleted_at: null
    }))
    const { error: upErr } = await db.from(spec.table).upsert(rows, { onConflict: 'user_id,id' })
    if (upErr) throw upErr
  }

  // On marque au lieu d'effacer : l'autre appareil doit apprendre la
  // suppression à sa prochaine synchro.
  for (const part of chunks(plan.remove)) {
    const { error: delErr } = await db.from(spec.table)
      .update({ deleted_at: now, updated_at: now })
      .eq('user_id', userId)
      .in('id', part)
    if (delErr) throw delErr
  }

  const nextSnap = {}
  for (const x of merged) nextSnap[x.id] = { json: stamp(x), at: plan.nextSnap[x.id]?.at || now }
  return { merged, snap: nextSnap, pushed: plan.upsert.length, removed: plan.remove.length }
}

async function syncSettings(localSettings, userId, snap) {
  const db = cloud()
  const wanted = settingsForCloud(localSettings)
  const { data, error } = await db.from('settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error

  const before = snap.settings?.row
  const changedHere = !before || before !== stamp(wanted)
  const changedThere = data && ts(data.updated_at) > ts(snap.settings?.at)
  const now = new Date().toISOString()

  if (!data || changedHere) {
    const { error: upErr } = await db.from('settings')
      .upsert({ user_id: userId, data: wanted, updated_at: now }, { onConflict: 'user_id' })
    if (upErr) throw upErr
    return { settings: null, snap: { row: stamp(wanted), at: now } }
  }
  if (changedThere) {
    // La clé API restée locale ne doit pas être écrasée par le vide du nuage
    const fresh = { ...data.data, ai: { ...(data.data.ai || {}), apiKey: localSettings.ai?.apiKey || '' } }
    return { settings: fresh, snap: { row: stamp(settingsForCloud(fresh)), at: data.updated_at } }
  }
  return { settings: null, snap: snap.settings }
}

// Synchro complète. Renvoie ce que l'app doit adopter — les listes fusionnées,
// et `settings` seulement si le nuage avait du neuf.
export async function syncAll({ settings, clients, items, expenses, docs }, totalsOf) {
  const db = cloud()
  if (!db) throw new Error("Le nuage n'est pas configuré.")
  const { data: { session } } = await db.auth.getSession()
  const userId = session?.user?.id
  if (!userId) throw new Error('Connecte-toi avant de synchroniser.')

  const snap = loadSnap()
  const out = {}
  let pushed = 0
  let removed = 0

  for (const [name, list] of [['clients', clients], ['items', items], ['expenses', expenses], ['docs', docs]]) {
    const r = await syncCollection(name, list, userId, snap, name === 'docs' ? totalsOf : null)
    out[name] = r.merged
    snap[name] = r.snap
    pushed += r.pushed
    removed += r.removed
  }

  const s = await syncSettings(settings, userId, snap)
  snap.settings = s.snap
  out.settings = s.settings

  saveSnap(snap)
  return { ...out, pushed, removed, at: new Date().toISOString() }
}
