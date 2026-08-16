// Assistant IA multi-fournisseurs.
//
// L'app n'a pas de serveur : la clé API de l'utilisateur est gardée sur son
// appareil et le navigateur parle directement au fournisseur choisi. Chaque
// fournisseur a sa propre forme de requête, d'où les adaptateurs ci-dessous.
// Le contrat est le même partout : on envoie un texte + des images, on reçoit
// du texte, qu'on interprète comme une action JSON.

import { calcTotals, docStatus, money } from './store.js'

export const AI_PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    model: 'claude-opus-5',
    keyHint: 'console.anthropic.com → API keys',
    modelHint: 'ex. : claude-opus-5, claude-sonnet-5'
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT)',
    model: 'gpt-4o',
    keyHint: 'platform.openai.com → API keys',
    modelHint: 'ex. : gpt-4o'
  },
  {
    id: 'gemini',
    label: 'Google (Gemini)',
    model: 'gemini-2.5-flash',
    keyHint: 'aistudio.google.com → Get API key',
    modelHint: 'ex. : gemini-2.5-flash'
  },
  {
    id: 'compatible',
    label: 'Autre (DeepSeek, Qwen, Groq…)',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    keyHint: 'la clé du fournisseur choisi',
    modelHint: 'ex. : deepseek-chat, qwen-plus'
  }
]

export const defaultAi = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-opus-5',
  baseUrl: ''
}

export const aiProvider = id => AI_PROVIDERS.find(p => p.id === id) || AI_PROVIDERS[0]

// data:image/png;base64,XXXX  ->  { mediaType, data, url }
export const splitDataUrl = src => {
  const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(String(src || ''))
  return m ? { mediaType: m[1], data: m[2], url: String(src) } : null
}

async function readResponse(res) {
  const body = await res.text()
  let json = null
  try { json = JSON.parse(body) } catch { /* réponse non JSON */ }
  if (!res.ok) {
    const msg = json?.error?.message || json?.error?.[0]?.message || json?.message || body.slice(0, 300)
    throw new Error(`${res.status} — ${msg || 'appel refusé par le fournisseur'}`)
  }
  return json || {}
}

const trimBase = (url, fallback) => String(url || fallback).replace(/\/+$/, '')

async function callAnthropic(cfg, { system, text, images, history }) {
  const content = [
    ...images.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
    { type: 'text', text }
  ]
  const res = await fetch(`${trimBase(cfg.baseUrl, 'https://api.anthropic.com')}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      // sans cet entête, l'API refuse les appels venant d'un navigateur
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 8192,
      system,
      messages: [
        ...history.map(h => ({ role: h.role, content: h.text })),
        { role: 'user', content }
      ]
    })
  })
  const json = await readResponse(res)
  return (json.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
}

// OpenAI et tous les fournisseurs qui copient son format (DeepSeek, Qwen, Groq,
// OpenRouter, serveurs locaux…). max_tokens est volontairement omis : les
// modèles récents ont renommé ce champ et le laisser casserait l'appel.
async function callOpenAiCompatible(cfg, { system, text, images, history }, fallbackBase) {
  const content = [
    { type: 'text', text },
    ...images.map(i => ({ type: 'image_url', image_url: { url: i.url } }))
  ]
  const res = await fetch(`${trimBase(cfg.baseUrl, fallbackBase)}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: system },
        ...history.map(h => ({ role: h.role, content: h.text })),
        { role: 'user', content: images.length ? content : text }
      ]
    })
  })
  const json = await readResponse(res)
  return json.choices?.[0]?.message?.content || ''
}

async function callGemini(cfg, { system, text, images, history }) {
  const parts = [
    { text },
    ...images.map(i => ({ inline_data: { mime_type: i.mediaType, data: i.data } }))
  ]
  const base = trimBase(cfg.baseUrl, 'https://generativelanguage.googleapis.com/v1beta')
  const res = await fetch(`${base}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        // Gemini appelle « model » ce que les autres appellent « assistant »
        ...history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] })),
        { role: 'user', parts }
      ]
    })
  })
  const json = await readResponse(res)
  return (json.candidates?.[0]?.content?.parts || []).map(p => p.text).filter(Boolean).join('\n')
}

export function askAi(cfg, payload) {
  if (!cfg?.apiKey?.trim()) return Promise.reject(new Error("Aucune clé API n'est enregistrée (Réglages → Assistant IA)."))
  if (!cfg?.model?.trim()) return Promise.reject(new Error('Aucun modèle choisi (Réglages → Assistant IA).'))
  const input = {
    system: payload.system,
    text: payload.text,
    images: payload.images || [],
    history: payload.history || []
  }
  if (cfg.provider === 'anthropic') return callAnthropic(cfg, input)
  if (cfg.provider === 'gemini') return callGemini(cfg, input)
  if (cfg.provider === 'openai') return callOpenAiCompatible(cfg, input, 'https://api.openai.com/v1')
  return callOpenAiCompatible(cfg, input, 'https://api.deepseek.com/v1')
}

// ===== Chiffres de l'entreprise =====
// Calculés ici, en JavaScript, jamais par l'IA : un modèle qui additionne des
// montants se trompe. L'IA reçoit les totaux déjà faits et se contente de les
// expliquer.
export function businessFacts(docs, expenses) {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const zero = () => ({ facture: 0, encaisse: 0, du: 0, nb: 0 })
  const all = zero(), thisYear = zero(), thisMonth = zero()

  for (const d of docs) {
    if (d.docType !== 'invoice') continue
    const t = calcTotals(d)
    for (const b of [all, String(d.date).startsWith(year) ? thisYear : null, String(d.date).startsWith(month) ? thisMonth : null]) {
      if (!b) continue
      b.facture += t.total
      b.encaisse += t.paid
      b.du += Math.max(t.balance, 0)
      b.nb += 1
    }
  }

  const spend = list => list.reduce((s, e) => s + Number(e.amount || 0), 0)
  const expYear = spend(expenses.filter(e => String(e.date).startsWith(year)))
  const expMonth = spend(expenses.filter(e => String(e.date).startsWith(month)))
  const unpaid = docs.filter(d => d.docType === 'invoice' && docStatus(d) === 'unpaid').length

  return { year, month, all, thisYear, thisMonth, expYear, expMonth, unpaid }
}

const factsBlock = f => `Chiffres réels (déjà calculés, à reprendre tels quels — ne recalcule rien) :
- Mois en cours (${f.month}) : ${f.thisMonth.nb} facture(s), facturé ${money(f.thisMonth.facture)}, encaissé ${money(f.thisMonth.encaisse)}, reste dû ${money(f.thisMonth.du)}, dépenses ${money(f.expMonth)}, net ${money(f.thisMonth.encaisse - f.expMonth)}
- Année ${f.year} : ${f.thisYear.nb} facture(s), facturé ${money(f.thisYear.facture)}, encaissé ${money(f.thisYear.encaisse)}, reste dû ${money(f.thisYear.du)}, dépenses ${money(f.expYear)}, net ${money(f.thisYear.encaisse - f.expYear)}
- Depuis le début : ${f.all.nb} facture(s), facturé ${money(f.all.facture)}, encaissé ${money(f.all.encaisse)}, reste dû ${money(f.all.du)}
- Factures non payées en ce moment : ${f.unpaid}`

// La facture en cours dans la conversation : sans ça, « ajoute deux heures »
// ferait une deuxième facture au lieu de compléter la première.
const draftBlock = draft => {
  if (!draft) return "Aucune facture n'a encore été montée dans cette conversation."
  const lines = draft.lines
    .map(l => `- ${l.description} | ${l.qty} ${l.unit || 'ea'} × ${Number(l.rate || 0)} $${l.taxable === false ? ' | non taxable' : ''}`)
    .join('\n')
  return `Facture montée à l'instant dans cette conversation : ${draft.number}${draft.client?.name ? ` pour ${draft.client.name}` : ''}${draft.siteAddress ? ` — chantier : ${draft.siteAddress}` : ''}
${lines || '(aucune ligne)'}
Si la personne corrige ou complète CETTE facture-là, renvoie "action":"invoice" avec "update":true et la liste COMPLÈTE des lignes (celles d'avant plus les nouvelles, ou corrigées). Sans "update":true, une deuxième facture serait créée.`
}

// Les derniers documents, pour qu'« envoie la facture de Marc » désigne
// quelque chose de précis plutôt qu'un numéro inventé.
const docsBlock = docs => {
  const recent = [...docs]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 15)
    .map(d => {
      const t = calcTotals(d)
      const who = d.client?.name || 'sans client'
      const joignable = [d.client?.email ? 'courriel' : '', d.client?.phone ? 'texto' : ''].filter(Boolean).join(' et ')
      return `- ${d.number} | ${d.docType === 'invoice' ? 'facture' : 'devis'} | ${d.date} | ${who} | ${money(t.total)} | ${docStatus(d) === 'paid' ? 'payée' : `dû ${money(t.balance)}`} | ${joignable || 'aucune coordonnée'}`
    })
    .join('\n')
  return recent || '(aucun document)'
}

export function buildSystemPrompt({ settings, docs, expenses, clients, items, draft }) {
  const b = settings.business
  const facts = businessFacts(docs, expenses)
  const catalog = items.slice(0, 60)
    .map(i => `- ${i.description} | ${Number(i.rate || 0)} $ / ${i.unit || 'ea'}${i.taxable === false ? ' | non taxable' : ''}`)
    .join('\n')
  const clientList = clients.slice(0, 40).map(c => `- ${c.name}${c.city ? ` (${c.city})` : ''}`).join('\n')

  return `Tu es l'assistant de facturation de ${b.name || 'cette entreprise'}, une entreprise de construction au Québec/Alberta. Tu réponds toujours en français, brièvement et sans détour.

Entreprise : ${b.name || '—'}${b.owner ? ` — ${b.owner}` : ''}
Taxe : ${settings.taxLabel} à ${settings.taxRate} %${settings.taxDefault ? ' (appliquée par défaut)' : ''}

${factsBlock(facts)}

Prix déjà connus au catalogue :
${catalog || '(catalogue vide)'}

Clients enregistrés :
${clientList || '(aucun client enregistré)'}

Derniers documents (numéro | type | date | client | total | solde | par où le client est joignable) :
${docsBlock(docs)}

${draftBlock(draft)}

Tu réponds UNIQUEMENT avec un objet JSON, sans texte autour et sans bloc de code. Formes possibles :

1) Créer une facture (l'utilisateur décrit un travail fait, ou envoie une photo/capture d'une liste de travaux) :
{"action":"invoice","reply":"phrase courte pour l'utilisateur","client":{"name":"","address":"","city":"","phone":"","email":""},"siteAddress":"adresse du chantier","lines":[{"description":"","qty":1,"unit":"ea","rate":0,"taxable":true}],"notes":"","update":false}
- "siteAddress" est l'adresse où les travaux ont été faits (« j'ai fait le 123 rue Principale »). C'est une facture par chantier, et elle est imprimée sur la facture. Ce n'est pas forcément l'adresse du client : laisse vide si elle n'est pas dite.

2) Ajouter des prix au catalogue (l'utilisateur envoie une liste de prix) :
{"action":"items","reply":"phrase courte","items":[{"description":"","unit":"pi²","rate":0,"taxable":true}]}

3) Répondre à une question (chiffres, état de compte, conseil) :
{"action":"answer","reply":"ta réponse"}

4) Envoyer une facture ou un devis au client (« envoie-la à Marc », « envoie la facture par texto ») :
{"action":"send","reply":"phrase courte","number":"le numéro exact du document","channel":"email"}
- "channel" vaut "email" ou "sms".
- Sans numéro donné, c'est le document monté dans cette conversation.
- L'application prépare le message et l'ouvre dans l'app de courriel ou de texto : c'est l'utilisateur qui appuie sur Envoyer. Dis-le dans "reply".

Règles :
- Reprends les prix du catalogue quand la description correspond, au lieu d'en inventer.
- Unités courantes : ea, h, pi², pi lin., verge², jour, lot, km.
- Le message arrive souvent d'une dictée vocale, sur un chantier : la ponctuation manque, les nombres sont écrits en toutes lettres (« deux cent cinquante pieds carrés » = qty 250, unit pi²), « piasses » et « dollars » veulent dire le prix, et un nom de client peut être mal transcrit — reprends celui de la liste des clients quand ça se ressemble. Ne réclame pas une reformulation pour une faute de transcription : garde le sens.
- Les photos et captures d'écran sont à lire au complet : chaque ligne de travail, sa quantité et son prix s'il y est. Un prix illisible ou absent se prend au catalogue ; si rien ne correspond, mets rate 0 et dis-le dans "reply" au lieu d'inventer un montant.
- Ne calcule jamais un sous-total, une taxe ou un total : l'application s'en charge. Mets seulement qty, unit et rate par ligne.
- Pour les questions d'argent, reprends exactement les chiffres réels ci-dessus. Si un chiffre demandé n'y est pas, dis-le au lieu de l'estimer.
- Si la demande est ambiguë, utilise "answer" pour poser ta question au lieu de deviner.
- "reply" peut être lu à voix haute (mains libres) : une ou deux phrases parlées, sans puces, sans tableau et sans symboles à épeler.`
}

// Le modèle glisse souvent son JSON dans un bloc de code ou l'entoure de texte.
export function parseAction(raw) {
  const text = String(raw || '').trim()
  if (!text) return { action: 'answer', reply: "Le modèle n'a rien répondu." }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1))
      if (parsed && typeof parsed === 'object') return parsed
    } catch { /* pas du JSON : on affiche le texte tel quel */ }
  }
  return { action: 'answer', reply: text }
}
