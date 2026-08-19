// Lien de facture, et suivi des ouvertures.
//
// Un PDF attaché à un texto ne dit jamais rien : une fois chez le client, le
// fichier ne parle plus. Un lien, lui, passe par une page — et une page qui
// s'ouvre, ça se sait. C'est comme ça que l'app peut afficher « vue le 19 août
// à 14 h 32 » plutôt que de deviner.
//
// Un lien par destinataire : la même facture part souvent au courriel de
// l'administration et au texto du contremaître. Deux liens, donc deux
// réponses — « courriel lu », « texto pas encore ouvert ». Avec un lien
// unique, une ouverture ne dirait pas lequel des deux a lu.
//
// Chaque lien, lui, est gardé d'une version à l'autre : celui que le client a
// déjà reçu montre toujours la version à jour. Une facture corrigée remplace
// donc vraiment la précédente, sans rien avoir à reprendre.

import { cloud } from './cloud.js'
import { load, revisionInfo, save } from './store.js'

const STATE_KEY = 'is_share_state'
const SEEN_KEY = 'is_share_seen'

// 22 caractères tirés au hasard : deviner un lien est hors de portée, et il
// reste assez court pour tenir dans un texto.
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newToken(len = 22) {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

export const shareUrl = token => `${location.origin}/f/${token}`

// Les trois façons dont un lien part. Le canal est ce qui permet de dire
// « c'est le courriel qui a été lu, pas le texto ».
export const CHANNELS = {
  mail: { label: 'Courriel', short: 'le courriel' },
  sms: { label: 'Texto', short: 'le texto' },
  lien: { label: 'Lien copié', short: 'le lien' }
}
export const channelLabel = c => CHANNELS[c]?.label || 'Lien'

// Ce que la page publique a besoin de connaître de l'entreprise pour dessiner
// la facture — et rien de plus. Surtout pas la clé de l'IA ni les réglages
// internes : cette ligne-là part sur un serveur que n'importe qui peut lire
// avec le bon lien.
export const brandForShare = settings => ({
  business: { ...(settings.business || {}) },
  logo: settings.logo || '',
  logoOnPdf: settings.logoOnPdf !== false,
  watermark: { ...(settings.watermark || {}) },
  accent: settings.accent,
  taxLabel: settings.taxLabel,
  taxRate: settings.taxRate
})

// La facture telle que le client la verra. Les photos de chantier et la
// signature restent dans l'app : c'est du poids inutile sur la page, et les
// photos ne regardent pas toujours le client.
export const docForShare = doc => {
  const { photos, history, ...rest } = doc
  // la page dessine la même facture que l'aperçu : le tableau de photos doit
  // exister, même vide, sinon le rendu casse chez le client
  return { ...rest, photos: [] }
}

const requireUser = async db => {
  const { data: { user } = {} } = await db.auth.getUser()
  if (!user) throw new Error('Connecte-toi à la sauvegarde infonuagique (Réglages) pour créer un lien de facture.')
  return user
}

// Publie (ou met à jour) le lien d'une facture et retourne son adresse.
// Rappelée à chaque envoi : le lien ne change pas, son contenu suit.
export async function publishShare(doc, settings, channel = 'lien', label = '') {
  const db = cloud()
  if (!db) throw new Error("La sauvegarde infonuagique n'est pas configurée.")
  const user = await requireUser(db)

  // le jeton déjà attribué à ce canal a la priorité, d'où qu'il vienne : un
  // lien envoyé au client ne doit jamais cesser de fonctionner
  const { data: existing } = await db.from('shares')
    .select('token').eq('doc_id', doc.id).eq('channel', channel).maybeSingle()
  const token = existing?.token || doc.shareTokens?.[channel] ||
    // liens créés avant qu'il y ait des canaux : ils deviennent le lien copié
    (channel === 'lien' ? doc.shareToken : '') || newToken()

  const { error } = await db.from('shares').upsert({
    token,
    user_id: user.id,
    doc_id: doc.id,
    channel,
    label,
    doc: docForShare(doc),
    business: brandForShare(settings),
    // La révision qui part vraiment : si la facture a été retouchée après un
    // envoi, le lien montre déjà la version corrigée, et c'est ce numéro-là
    // qui dit au client — et à l'app — qu'il ne regarde plus la première.
    revision: revisionInfo(doc)?.n || Number(doc.revision || 1),
    revoked: false,
    updated_at: new Date().toISOString()
  }, { onConflict: 'token' })
  if (error) throw error

  return { token, channel, url: shareUrl(token) }
}

// Couper le lien : la page ne montre plus rien, même à qui a l'adresse.
export async function revokeShare(token) {
  const db = cloud()
  if (!db) throw new Error("La sauvegarde infonuagique n'est pas configurée.")
  await requireUser(db)
  const { error } = await db.from('shares').update({ revoked: true, updated_at: new Date().toISOString() }).eq('token', token)
  if (error) throw error
}

export async function restoreShare(token) {
  const db = cloud()
  if (!db) throw new Error("La sauvegarde infonuagique n'est pas configurée.")
  await requireUser(db)
  const { error } = await db.from('shares').update({ revoked: false, updated_at: new Date().toISOString() }).eq('token', token)
  if (error) throw error
}

// Ce que l'app garde en mémoire pour chaque facture partagée, canal par canal :
// { [docId]: { mail: {token, label, revoked, revision, views, last}, sms: {…} } }
export const shareState = () => load(STATE_KEY, {})
export const saveShareState = s => save(STATE_KEY, s)

// Dernière ouverture déjà signalée à l'utilisateur : ce qui vient après est
// une nouvelle, et mérite l'avis à l'écran.
export const lastSeenView = () => Number(load(SEEN_KEY, 0)) || 0
export const markViewsSeen = id => save(SEEN_KEY, Number(id) || 0)

// Va chercher les liens et leurs ouvertures. Une seule requête chacune : le
// recoupement se fait ici, pas dans la base.
export async function pullShareActivity() {
  const db = cloud()
  if (!db) return null
  const { data: { user } = {} } = await db.auth.getUser()
  if (!user) return null

  const [{ data: shares, error: e1 }, { data: views, error: e2 }] = await Promise.all([
    db.from('shares').select('token, doc_id, channel, label, revision, revoked, updated_at'),
    db.from('share_views').select('id, token, revision, kind, viewed_at').order('id', { ascending: false }).limit(400)
  ])
  if (e1) throw e1
  if (e2) throw e2

  const byToken = new Map()
  const state = {}
  for (const s of shares || []) {
    const channel = s.channel || 'lien'
    byToken.set(s.token, { docId: s.doc_id, channel })
    state[s.doc_id] = state[s.doc_id] || {}
    state[s.doc_id][channel] = {
      token: s.token,
      label: s.label || '',
      revoked: !!s.revoked,
      revision: Number(s.revision || 1),
      views: 0,
      last: null
    }
  }
  // les ouvertures arrivent de la plus récente à la plus ancienne
  for (const v of views || []) {
    const at = byToken.get(v.token)
    const st = at && state[at.docId]?.[at.channel]
    if (!st) continue
    st.views += 1
    if (!st.last) st.last = { id: v.id, at: v.viewed_at, revision: Number(v.revision || 1), kind: v.kind }
  }
  saveShareState(state)
  return state
}

// Les canaux d'une facture, dans l'ordre où on veut les lire.
const ORDER = ['mail', 'sms', 'lien']
export const channelsOf = entry =>
  ORDER.filter(c => entry?.[c]).map(c => ({ channel: c, ...entry[c] }))

// La dernière ouverture, tous canaux confondus.
export const latestView = entry =>
  channelsOf(entry).filter(c => c.last).sort((a, b) => Number(b.last.id) - Number(a.last.id))[0] || null

// Une facture partagée dont la version envoyée n'a pas encore été ouverte :
// c'est ce qui distingue « vue » de « vue avant la correction ».
export const seenCurrent = entry =>
  !!entry?.last && Number(entry.last.revision || 1) >= Number(entry.revision || 1)

// Les ouvertures survenues depuis le dernier coup d'œil de l'utilisateur. Le
// canal fait partie de la nouvelle : « le courriel a été ouvert » ne dit pas
// la même chose que « le texto a été ouvert ».
export function newViews(state, docs, seenId) {
  const out = []
  for (const doc of docs || []) {
    for (const c of channelsOf(state?.[doc.id])) {
      if (!c.last || Number(c.last.id) <= Number(seenId || 0)) continue
      out.push({
        docId: doc.id,
        number: doc.number,
        client: doc.client?.name || '',
        channel: c.channel,
        label: c.label,
        ...c.last
      })
    }
  }
  return out.sort((a, b) => Number(b.id) - Number(a.id))
}

// Lecture de la page publique. `log: false` quand c'est le propriétaire qui
// vérifie son propre lien depuis l'app : sa visite ne doit pas se compter
// comme une ouverture du client.
export async function fetchShare(token, { log = true } = {}) {
  const db = cloud()
  if (!db) throw new Error('Configuration manquante.')
  const { data, error } = await db.rpc('get_share', {
    p_token: token,
    p_log: log,
    p_agent: (navigator.userAgent || '').slice(0, 200)
  })
  if (error) throw error
  return data
}

export async function logShareView(token, kind = 'pdf') {
  const db = cloud()
  if (!db) return
  try {
    await db.rpc('log_share_view', { p_token: token, p_kind: kind, p_agent: (navigator.userAgent || '').slice(0, 200) })
  } catch { /* le suivi ne doit jamais empêcher le client d'avoir sa facture */ }
}

// « il y a 5 min », « hier 14 h 32 » — une date brute ne dit rien d'utile sur
// un chantier.
export function agoFr(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const min = Math.round((Date.now() - t) / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.round(h / 24)
  if (j <= 6) return `il y a ${j} jour${j > 1 ? 's' : ''}`
  return new Date(t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })
}

export const fmtViewedAt = iso => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })
}
