import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send, ImagePlus, X, Sparkles, FileText, Package, Settings as SettingsIcon } from 'lucide-react'
import { emptyClient, money, newDocument, readImageFile, uid } from './store.js'
import { askAi, buildSystemPrompt, parseAction, splitDataUrl } from './ai.js'
import { AppBar } from './lists.jsx'

const EXAMPLES = [
  "J'ai posé 250 pi² de panneaux à 3 $ chez Marc Tremblay, plus 4 h de main-d'œuvre",
  'Combien j\'ai fait ce mois-ci ?',
  'Combien il me reste à recevoir ?'
]

// Une ligne renvoyée par l'IA n'est jamais utilisée telle quelle : on force les
// types et on borne les valeurs avant qu'elles touchent une facture.
const cleanLine = l => ({
  id: uid(),
  description: String(l?.description || '').slice(0, 200),
  qty: Number(l?.qty) > 0 ? Number(l.qty) : 1,
  unit: String(l?.unit || 'ea').slice(0, 12),
  rate: Number.isFinite(Number(l?.rate)) ? Math.max(Number(l.rate), 0) : 0,
  taxable: l?.taxable !== false
})

const cleanClient = c => ({
  ...emptyClient,
  name: String(c?.name || '').slice(0, 120),
  address: String(c?.address || '').slice(0, 200),
  city: String(c?.city || '').slice(0, 120),
  phone: String(c?.phone || '').slice(0, 40),
  email: String(c?.email || '').slice(0, 120)
})

export function AssistantScreen({
  settings, docs, expenses, clients, items,
  onCreateDoc, onSaveItems, onOpenDoc, onOpenSettings, onBack
}) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  const configured = !!settings.ai?.apiKey?.trim()

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  const push = msg => setMessages(list => [...list, { id: uid(), ...msg }])

  const addPhotos = e => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    // 1400 px : une capture d'écran doit rester lisible par le modèle
    Promise.all(files.map(f => readImageFile(f, 1400)))
      .then(srcs => setPhotos(p => [...p, ...srcs]))
      .catch(() => push({ role: 'error', text: "Cette image n'a pas pu être lue." }))
  }

  const runAction = data => {
    const action = data?.action
    const reply = String(data?.reply || '').trim()

    if (action === 'invoice') {
      const lines = Array.isArray(data.lines) ? data.lines.filter(l => String(l?.description || '').trim()).map(cleanLine) : []
      if (!lines.length) return push({ role: 'ai', text: reply || "Je n'ai pas trouvé de ligne à facturer." })
      const doc = {
        ...newDocument('invoice', settings, docs),
        client: cleanClient(data.client),
        lines,
        notes: String(data.notes || settings.defaultNotes || '').slice(0, 1000)
      }
      const saved = onCreateDoc(doc)
      const total = lines.reduce((s, l) => s + l.qty * l.rate, 0)
      return push({
        role: 'ai',
        text: reply || `J'ai préparé la facture ${saved.number}.`,
        card: {
          kind: 'invoice',
          title: saved.number,
          detail: `${lines.length} ligne${lines.length > 1 ? 's' : ''} • sous-total ${money(total)}${saved.client.name ? ` • ${saved.client.name}` : ''}`,
          onOpen: () => onOpenDoc(saved)
        }
      })
    }

    if (action === 'items') {
      const list = Array.isArray(data.items) ? data.items.filter(i => String(i?.description || '').trim()) : []
      if (!list.length) return push({ role: 'ai', text: reply || "Je n'ai trouvé aucun prix à enregistrer." })
      const saved = onSaveItems(list.map(i => {
        const l = cleanLine(i)
        return { id: l.id, description: l.description, unit: l.unit, rate: l.rate, taxable: l.taxable }
      }))
      return push({
        role: 'ai',
        text: reply || `J'ai ajouté ${saved} prix au catalogue.`,
        card: { kind: 'items', title: `${saved} article${saved > 1 ? 's' : ''} au catalogue`, detail: 'Plus → Articles' }
      })
    }

    push({ role: 'ai', text: reply || "Je n'ai pas compris la demande." })
  }

  const send = async () => {
    const text = input.trim()
    if ((!text && !photos.length) || busy) return
    push({ role: 'me', text, photos })
    setInput('')
    setPhotos([])
    setBusy(true)
    try {
      const raw = await askAi(settings.ai, {
        system: buildSystemPrompt({ settings, docs, expenses, clients, items }),
        text: text || 'Regarde cette image et fais ce qu\'il faut.',
        images: photos.map(splitDataUrl).filter(Boolean)
      })
      runAction(parseAction(raw))
    } catch (e) {
      push({ role: 'error', text: e.message || 'Appel impossible.' })
    } finally {
      setBusy(false)
    }
  }

  return <section className="screen">
    <AppBar title="Assistant IA" left={<button className="icon light" onClick={onBack}><ArrowLeft size={22}/></button>}/>

    <div className="chat-body">
      {!configured && <div className="edit-card padded">
        <h2 className="section-title">À brancher avant d'écrire</h2>
        <p className="hint small-note">Choisis ton fournisseur d'IA et colle ta clé API dans les réglages. La clé reste sur cet appareil.</p>
        <button className="outline-btn with-icon" onClick={onOpenSettings}><SettingsIcon size={18}/> Ouvrir les réglages</button>
      </div>}

      {configured && messages.length === 0 && <div className="empty">
        <span className="empty-circle"><Sparkles size={36}/></span>
        <p><b>Raconte ce que tu as fait</b></p>
        <p>Je monte la facture, je remplis ton catalogue, ou je te sors tes chiffres. Tu peux aussi m'envoyer la photo d'une liste de travaux.</p>
        <div className="examples">
          {EXAMPLES.map(ex => <button key={ex} className="example" onClick={() => setInput(ex)}>{ex}</button>)}
        </div>
      </div>}

      {messages.map(m => <div key={m.id} className={`bubble ${m.role}`}>
        {m.photos?.length > 0 && <div className="bubble-photos">
          {m.photos.map((p, i) => <img key={i} src={p} alt=""/>)}
        </div>}
        {m.text && <p>{m.text}</p>}
        {m.card && <div className="ai-card">
          <span className="ai-card-ico">{m.card.kind === 'invoice' ? <FileText size={20}/> : <Package size={20}/>}</span>
          <div className="row-text">
            <b>{m.card.title}</b>
            <small>{m.card.detail}</small>
          </div>
          {m.card.onOpen && <button className="link-btn" onClick={m.card.onOpen}>Ouvrir</button>}
        </div>}
      </div>)}

      {busy && <div className="bubble ai"><p className="typing">L'assistant réfléchit…</p></div>}
      <div ref={endRef}/>
    </div>

    <div className="chat-bar no-print">
      {photos.length > 0 && <div className="chat-photos">
        {photos.map((p, i) => <div className="chat-photo" key={i}>
          <img src={p} alt=""/>
          <button className="icon danger" onClick={() => setPhotos(list => list.filter((_, x) => x !== i))}><X size={13}/></button>
        </div>)}
      </div>}
      <div className="chat-row">
        <label className="icon" title="Joindre une photo">
          <ImagePlus size={22}/>
          <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
        </label>
        <textarea
          rows={1}
          placeholder="Ce que tu as fait, ou ta question…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <button className="primary" disabled={busy || (!input.trim() && !photos.length)} onClick={send}>
          <Send size={18}/>
        </button>
      </div>
    </div>
  </section>
}
