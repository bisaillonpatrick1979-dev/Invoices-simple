import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Send, ImagePlus, Camera, Mic, MicOff, X, Sparkles,
  FileText, Package, Mail, Settings as SettingsIcon, Headphones
} from 'lucide-react'
import {
  buildEmailBody, buildSmsBody, calcTotals, emptyClient, money, newDocument,
  readImageFile, uid, withEvent
} from './store.js'
import { askAi, buildSystemPrompt, parseAction, splitDataUrl } from './ai.js'
import { dictationSupported, speak, stopSpeaking, useDictation } from './voice.js'
import { AppBar, useFabDrag } from './lists.jsx'

// La bulle de l'assistant se pose au-dessus de la bulle « + » pour ne pas la
// couvrir au premier lancement ; ensuite chacune garde l'endroit où on la met.
const AI_FAB_DEFAULT = { right: 18, bottom: 160 }

// Bulle IA, présente sur tous les écrans : une touche ouvre l'assistant
// par-dessus ce qu'on était en train de faire, un glissement la déplace.
export function AiFab({ onClick, busy }) {
  const { style, handlers } = useFabDrag('is_aifab_pos', AI_FAB_DEFAULT, onClick)
  return <button
    className={busy ? 'fab ai-fab busy no-print' : 'fab ai-fab no-print'}
    title="Assistant IA"
    aria-label="Ouvrir l'assistant IA"
    style={style}
    {...handlers}
  ><Sparkles size={25}/></button>
}

const EXAMPLES = [
  "J'ai posé 250 pi² de panneaux à 3 $ chez Marc Tremblay, plus 4 h de main-d'œuvre",
  'Combien j\'ai fait ce mois-ci ?',
  'Combien il me reste à recevoir ?'
]

// Temps de silence après lequel une dictée mains libres part toute seule.
const SILENCE_MS = 2200
// Nombre de tours de conversation renvoyés au modèle : assez pour suivre une
// correction (« ajoute deux heures »), pas assez pour gonfler chaque appel.
const MEMORY = 8

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
  settings, docs, expenses, clients, items, open = true,
  onCreateDoc, onSaveItems, onOpenDoc, onOpenSettings, onBusy, onBack
}) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [handsFree, setHandsFree] = useState(false)
  const endRef = useRef(null)
  const configured = !!settings.ai?.apiKey?.trim()

  // Ce que la personne avait déjà tapé avant d'appuyer sur le micro : la dictée
  // s'ajoute au texte au lieu de l'effacer.
  const typedRef = useRef('')
  // La facture montée dans cette conversation : une correction la complète
  // plutôt que d'en créer une deuxième.
  const draftRef = useRef(null)
  const sendRef = useRef(() => {})
  const handsFreeRef = useRef(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  // En mains libres, l'écoute repart depuis la lecture de la réponse, donc
  // d'un rendu déjà vieux : sans ce ref, la phrase précédente reviendrait
  // coller devant la suivante.
  const inputRef = useRef(input)
  inputRef.current = input

  const dict = useDictation({
    lang: 'fr-CA',
    silenceMs: handsFree ? SILENCE_MS : 0,
    onSilence: () => sendRef.current()
  })

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  // Le champ suit la dictée en direct, phrases terminées puis mots en cours.
  useEffect(() => {
    if (!dict.listening) return
    const said = [dict.text, dict.interim].filter(Boolean).join(' ')
    setInput([typedRef.current, said].filter(Boolean).join(' '))
  }, [dict.text, dict.interim, dict.listening])

  useEffect(() => {
    if (dict.error) push({ role: 'error', text: dict.error })
  }, [dict.error])

  // La conversation survit à la fermeture du panneau — on la retrouve en
  // rouvrant la bulle. Mais le micro, lui, se tait : rien ne doit continuer à
  // écouter derrière un écran fermé.
  useEffect(() => {
    if (open) return
    stopSpeaking()
    dict.stop()
    handsFreeRef.current = false
    setHandsFree(false)
  }, [open])

  useEffect(() => () => stopSpeaking(), [])

  useEffect(() => { onBusy?.(busy) }, [busy])

  const push = msg => setMessages(list => [...list, { id: uid(), ...msg }])

  const startDictation = () => {
    typedRef.current = inputRef.current.trim()
    stopSpeaking()
    dict.start()
  }

  const toggleMic = () => (dict.listening ? dict.stop() : startDictation())

  const toggleHandsFree = () => {
    const next = !handsFree
    setHandsFree(next)
    handsFreeRef.current = next
    if (next) {
      if (!dict.listening) startDictation()
    } else {
      stopSpeaking()
      dict.stop()
    }
  }

  const addPhotos = e => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    // 1400 px : une capture d'écran doit rester lisible par le modèle
    Promise.all(files.map(f => readImageFile(f, 1400)))
      .then(srcs => setPhotos(p => [...p, ...srcs]))
      .catch(() => push({ role: 'error', text: "Cette image n'a pas pu être lue." }))
  }

  // Renvoie la phrase à dire à voix haute en mains libres.
  const runAction = data => {
    const action = data?.action
    const reply = String(data?.reply || '').trim()

    if (action === 'invoice') {
      const lines = Array.isArray(data.lines) ? data.lines.filter(l => String(l?.description || '').trim()).map(cleanLine) : []
      if (!lines.length) {
        const text = reply || "Je n'ai pas trouvé de ligne à facturer."
        push({ role: 'ai', text })
        return text
      }
      // Correction de la facture montée juste avant : on garde son numéro et
      // sa date, seules les lignes changent.
      const previous = data.update === true ? draftRef.current : null
      const client = cleanClient(data.client)
      const doc = {
        ...(previous || newDocument('invoice', settings, docs)),
        // une correction qui ne reparle pas du client garde celui d'avant
        client: client.name || !previous ? client : previous.client,
        lines,
        notes: String(data.notes || previous?.notes || settings.defaultNotes || '').slice(0, 1000)
      }
      const saved = onCreateDoc(doc)
      draftRef.current = saved
      const total = lines.reduce((s, l) => s + l.qty * l.rate, 0)
      const text = reply || (previous ? `J'ai corrigé la facture ${saved.number}.` : `J'ai préparé la facture ${saved.number}.`)
      push({
        role: 'ai',
        text,
        card: {
          kind: 'invoice',
          title: saved.number,
          detail: `${lines.length} ligne${lines.length > 1 ? 's' : ''} • sous-total ${money(total)}${saved.client.name ? ` • ${saved.client.name}` : ''}`,
          onOpen: () => onOpenDoc(saved)
        }
      })
      return text
    }

    if (action === 'items') {
      const list = Array.isArray(data.items) ? data.items.filter(i => String(i?.description || '').trim()) : []
      if (!list.length) {
        const text = reply || "Je n'ai trouvé aucun prix à enregistrer."
        push({ role: 'ai', text })
        return text
      }
      const saved = onSaveItems(list.map(i => {
        const l = cleanLine(i)
        return { id: l.id, description: l.description, unit: l.unit, rate: l.rate, taxable: l.taxable }
      }))
      const text = reply || `J'ai ajouté ${saved} prix au catalogue.`
      push({
        role: 'ai',
        text,
        card: { kind: 'items', title: `${saved} article${saved > 1 ? 's' : ''} au catalogue`, detail: 'Plus → Articles' }
      })
      return text
    }

    if (action === 'send') {
      const wanted = String(data.number || '').trim().toLowerCase()
      const doc = (wanted && docs.find(d => String(d.number).toLowerCase() === wanted)) || draftRef.current
      if (!doc) {
        const text = reply || "Je ne vois pas de quelle facture tu parles. Donne-moi son numéro."
        push({ role: 'ai', text })
        return text
      }
      const bySms = data.channel === 'sms'
      const to = bySms ? doc.client?.phone : doc.client?.email
      if (!String(to || '').trim()) {
        const text = bySms
          ? `${doc.number} n'a pas de numéro de téléphone pour ${doc.client?.name || 'ce client'}. Ajoute-le dans la facture et redemande-moi.`
          : `${doc.number} n'a pas d'adresse courriel pour ${doc.client?.name || 'ce client'}. Ajoute-la dans la facture et redemande-moi.`
        push({ role: 'ai', text })
        return text
      }
      // L'app prépare le message ; c'est une touche de l'utilisateur qui
      // l'ouvre, et une deuxième qui l'envoie depuis son app de courriel.
      // Rien ne part sur la seule parole du modèle.
      const text = reply || `${doc.number} est prête à partir à ${to}. Appuie pour ouvrir le message.`
      push({
        role: 'ai',
        text,
        card: {
          kind: 'send',
          title: bySms ? `Texto à ${to}` : `Courriel à ${to}`,
          detail: `${doc.number} • ${money(calcTotals(doc).total)} — tu appuies sur Envoyer dans ton app`,
          openLabel: 'Préparer',
          onOpen: () => openSend(doc, bySms)
        }
      })
      return text
    }

    const text = reply || "Je n'ai pas compris la demande."
    push({ role: 'ai', text })
    return text
  }

  // Ouvre l'app de courriel ou de texto avec le message déjà écrit, et note
  // l'envoi dans l'historique de la facture.
  const openSend = (doc, bySms) => {
    const totals = calcTotals(doc)
    const saved = onCreateDoc(withEvent(
      { ...doc, status: 'sent' },
      bySms ? 'Envoyée par texto (assistant)' : 'Envoyée par email (assistant)'
    ))
    const body = encodeURIComponent(bySms ? buildSmsBody(settings, saved, totals) : buildEmailBody(settings, saved, totals))
    if (bySms) {
      window.location.href = `sms:${saved.client.phone}?&body=${body}`
      return
    }
    const subject = encodeURIComponent(`${saved.number} - ${settings.business.name}`)
    window.location.href = `mailto:${saved.client.email}?subject=${subject}&body=${body}`
  }

  // Les tours passés repartent au modèle pour qu'il suive la conversation.
  // Côté assistant on renvoie sa réponse brute : c'est du JSON, la forme qu'il
  // doit garder.
  const buildHistory = () => messagesRef.current
    .filter(m => m.role === 'me' || (m.role === 'ai' && (m.raw || m.text)))
    .slice(-MEMORY)
    .map(m => ({
      role: m.role === 'me' ? 'user' : 'assistant',
      text: String(m.role === 'me' ? m.text : m.raw || m.text).slice(0, 2000)
    }))
    .filter(m => m.text.trim())

  const send = async () => {
    const text = input.trim()
    const shots = photos
    if ((!text && !shots.length) || busy) return

    const history = buildHistory()
    push({ role: 'me', text, photos: shots })
    setInput('')
    setPhotos([])
    typedRef.current = ''
    dict.reset()
    // Le micro se tait pendant la réponse : sinon il transcrirait la voix de
    // l'assistant.
    if (dict.listening) dict.stop()
    setBusy(true)

    try {
      const raw = await askAi(settings.ai, {
        system: buildSystemPrompt({ settings, docs, expenses, clients, items, draft: draftRef.current }),
        text: text || 'Regarde cette image et fais ce qu\'il faut.',
        images: shots.map(splitDataUrl).filter(Boolean),
        history
      })
      const data = parseAction(raw)
      const spoken = runAction(data)
      setMessages(list => list.map((m, i) => (i === list.length - 1 && m.role === 'ai' ? { ...m, raw } : m)))
      if (handsFreeRef.current) speak(spoken, () => { if (handsFreeRef.current) startDictation() })
    } catch (e) {
      push({ role: 'error', text: e.message || 'Appel impossible.' })
      // En mains libres, une panne doit s'entendre, et l'écoute s'arrête : une
      // clé refusée ferait sinon tourner la boucle parole → erreur sans fin.
      if (handsFreeRef.current) {
        handsFreeRef.current = false
        setHandsFree(false)
        speak("L'appel n'a pas passé. Regarde l'écran.")
      }
    } finally {
      setBusy(false)
    }
  }
  sendRef.current = send

  const micLabel = dict.listening ? 'Arrêter la dictée' : 'Dicter'

  return <section className="screen">
    <AppBar
      title="Assistant IA"
      left={<button className="icon light" onClick={onBack}><ArrowLeft size={22}/></button>}
      right={dictationSupported() && configured
        ? <button
            className={handsFree ? 'icon light on' : 'icon light'}
            title={handsFree ? 'Quitter le mode mains libres' : 'Mode mains libres'}
            onClick={toggleHandsFree}
          ><Headphones size={21}/></button>
        : null}
    />

    <div className="chat-body">
      {!configured && <div className="edit-card padded">
        <h2 className="section-title">À brancher avant d'écrire</h2>
        <p className="hint small-note">Choisis ton fournisseur d'IA et colle ta clé API dans les réglages. La clé reste sur cet appareil.</p>
        <button className="outline-btn with-icon" onClick={onOpenSettings}><SettingsIcon size={18}/> Ouvrir les réglages</button>
      </div>}

      {configured && messages.length === 0 && <div className="empty">
        <span className="empty-circle"><Sparkles size={36}/></span>
        <p><b>Parle-lui, il monte la facture</b></p>
        <p>Appuie sur le micro et raconte ta journée, ou envoie la photo d'une liste de travaux. Je remplis la facture, le catalogue, ou je te sors tes chiffres.</p>
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
          <span className="ai-card-ico">
            {m.card.kind === 'invoice' ? <FileText size={20}/> : m.card.kind === 'send' ? <Mail size={20}/> : <Package size={20}/>}
          </span>
          <div className="row-text">
            <b>{m.card.title}</b>
            <small>{m.card.detail}</small>
          </div>
          {m.card.onOpen && <button className="link-btn" onClick={m.card.onOpen}>{m.card.openLabel || 'Ouvrir'}</button>}
        </div>}
      </div>)}

      {busy && <div className="bubble ai"><p className="typing">L'assistant réfléchit…</p></div>}
      <div ref={endRef}/>
    </div>

    <div className="chat-bar no-print">
      {dict.listening && <p className="mic-live">
        <span className="mic-dot"/>
        {handsFree ? 'Je t\'écoute — ça part tout seul quand tu arrêtes de parler.' : 'Je t\'écoute… appuie sur le micro pour arrêter.'}
      </p>}

      {photos.length > 0 && <div className="chat-photos">
        {photos.map((p, i) => <div className="chat-photo" key={i}>
          <img src={p} alt=""/>
          <button className="icon danger" onClick={() => setPhotos(list => list.filter((_, x) => x !== i))}><X size={13}/></button>
        </div>)}
      </div>}

      <div className="chat-row">
        <label className="icon" title="Prendre une photo">
          <Camera size={22}/>
          {/* capture : ouvre l'appareil photo directement sur un téléphone */}
          <input type="file" accept="image/*" capture="environment" hidden onChange={addPhotos}/>
        </label>
        <label className="icon" title="Joindre une photo ou une capture d'écran">
          <ImagePlus size={22}/>
          <input type="file" accept="image/*" multiple hidden onChange={addPhotos}/>
        </label>
        <textarea
          rows={1}
          placeholder="Parle ou écris…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        {dictationSupported() && <button
          className={dict.listening ? 'icon mic on' : 'icon mic'}
          title={micLabel}
          aria-label={micLabel}
          onClick={toggleMic}
        >{dict.listening ? <MicOff size={22}/> : <Mic size={22}/>}</button>}
        <button className="primary" disabled={busy || (!input.trim() && !photos.length)} onClick={send}>
          <Send size={18}/>
        </button>
      </div>
    </div>
  </section>
}
