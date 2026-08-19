import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, Settings as SettingsIcon, Inbox, X, Link2, Mail, MessageSquare } from 'lucide-react'
import {
  calcTotals, docStatus, fmtDate, INVOICE_STAGES, invoiceStage, lastPaymentDate,
  load, money, parseNum, save
} from './store.js'
import { agoFr, channelsOf, seenCurrent } from './share.js'

export const FAB_SIZE = 58
export const FAB_DEFAULT = { right: 18, bottom: 92 }
// au-dessus de la barre d'onglets du bas
const FAB_MIN_BOTTOM = 78
// écart entre deux bulles empilées
export const FAB_GAP = 66

export const clampFab = p => ({
  right: Math.min(Math.max(p.right, 6), Math.max(6, window.innerWidth - FAB_SIZE - 6)),
  bottom: Math.min(Math.max(p.bottom, FAB_MIN_BOTTOM), Math.max(FAB_MIN_BOTTOM, window.innerHeight - FAB_SIZE - 6))
})

// La position du « + », telle qu'elle est vraiment : celle qu'on lui a donnée,
// sinon celle par défaut.
export const plusFabPos = () => load('is_fab_pos', null)

// Deux bulles au même endroit, c'est une bulle qui avale les touches de
// l'autre. Les positions sont des écarts depuis le coin bas-droit.
export const fabsOverlap = (a, b, sizeA = FAB_SIZE, sizeB = FAB_SIZE) =>
  !!a && !!b &&
  a.right < b.right + sizeB && b.right < a.right + sizeA &&
  a.bottom < b.bottom + sizeB && b.bottom < a.bottom + sizeA

// Bulle déplaçable : un appui agit, un glissement la repositionne. La position
// est retenue d'un écran à l'autre et d'une session à l'autre.
// Partagé par la bulle « + » et la bulle de l'assistant.
// Distance sous laquelle on tient encore un appui, pas un glissement. Au doigt
// il faut de la marge : un pouce dérape de quelques pixels à chaque touche, et
// avec 6 px le bouton « + » ne répondait qu'aux touches parfaitement immobiles.
const TOUCH_SLOP = 14
const MOUSE_SLOP = 6
const slop = d => (d.touch ? TOUCH_SLOP : MOUSE_SLOP)
// Un geste bref reste un appui même s'il a dérapé plus que ça : personne ne
// déplace une bulle en un dixième de seconde.
const TAP_MS = 350
const TAP_MAX = 26

// Après un appui, le navigateur envoie encore un « click » de compatibilité.
// L'écran a déjà changé : ce click retombe sur ce qui occupe maintenant la
// place du doigt. Toucher « + » sur la liste ouvrait la facture, puis le click
// fantôme atteignait le bouton « Envoyer » de l'éditeur, au même endroit, et
// son menu s'ouvrait tout seul par-dessus la facture neuve.
const swallowNextClick = () => {
  const kill = e => { e.stopPropagation(); e.preventDefault() }
  document.addEventListener('click', kill, { capture: true, once: true })
  // s'il ne vient pas, on retire le piège plutôt que de le laisser tendu
  setTimeout(() => document.removeEventListener('click', kill, { capture: true }), 400)
}

// `resolve` permet à une bulle de corriger sa place au démarrage et après
// chaque dépôt — c'est ce qui empêche celle de l'IA de s'asseoir sur le « + ».
export function useFabDrag(key, fallback, onClick, resolve) {
  const [pos, setPos] = useState(() => (resolve ? resolve(load(key, null)) : load(key, null)))
  const drag = useRef(null)

  useEffect(() => {
    if (!pos) return
    const onResize = () => setPos(p => (p ? clampFab(p) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pos])

  useEffect(() => { if (pos) save(key, pos) }, [pos, key])

  const down = e => {
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      at: Date.now(),
      moved: false,
      touch: e.pointerType !== 'mouse',
      from: pos,                       // pour revenir en arrière si c'était un appui
      base: pos || fallback || FAB_DEFAULT
    }
    // sans capture le glissement marche quand même : ne jamais casser l'appui
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  const move = e => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < slop(d)) return
    d.moved = true
    setPos(clampFab({ right: d.base.right - dx, bottom: d.base.bottom - dy }))
  }

  const up = e => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const dist = Math.hypot((e?.clientX ?? d.x) - d.x, (e?.clientY ?? d.y) - d.y)

    // Un appui reste un appui même si le doigt a bougé : sur un téléphone il
    // bouge toujours un peu, et une bulle qui ne répond pas à la touche rend
    // le bouton d'ajout inutilisable.
    if (dist < slop(d) || (Date.now() - d.at < TAP_MS && dist < TAP_MAX)) {
      if (d.moved) setPos(d.from)      // elle avait commencé à suivre le doigt
      swallowNextClick()
      return onClick()
    }
    swallowNextClick()                 // un glissement ne doit rien déclencher non plus
    // déposée sur l'autre bulle : on l'écarte plutôt que de la laisser
    // masquer un bouton
    if (resolve) setPos(p => resolve(p))
  }

  return {
    style: pos ? { right: pos.right, bottom: pos.bottom } : undefined,
    handlers: {
      onPointerDown: down,
      onPointerMove: move,
      onPointerUp: up,
      onPointerCancel: () => { drag.current = null }
    }
  }
}

// Champ de nombre qui accepte la virgule. Avec <input type="number">, le
// navigateur jette la virgule d'un clavier français : « 4,50 » devenait 450 et
// « 12,5 » devenait 125. Un prix multiplié par cent, en silence, jusque sur la
// facture envoyée. On garde donc la frappe telle quelle et on la convertit.
export function NumField({ value, onChange, ...rest }) {
  const [text, setText] = useState(() => (value === '' || value == null ? '' : String(value)))

  // une valeur changée ailleurs (article pris au catalogue) doit s'afficher
  useEffect(() => {
    if (parseNum(text) !== parseNum(value)) setText(value === '' || value == null ? '' : String(value))
  }, [value])

  return <input
    type="text"
    inputMode="decimal"
    value={text}
    // le champ contient souvent un 0 ou un 1 de départ : taper dedans doit le
    // remplacer, pas s'insérer à côté et donner « 4,500 »
    onFocus={e => e.target.select()}
    onChange={e => {
      const raw = e.target.value
      // on laisse passer les états intermédiaires : « 4, », « -, », « » …
      if (!/^-?[\d]*[.,]?[\d]*$/.test(raw)) return
      setText(raw)
      onChange(parseNum(raw))
    }}
    {...rest}
  />
}

// Une adresse de chantier peut tenir sur plusieurs lignes ; la rangée n'en
// montre que la première.
const firstLine = v => String(v || '').split('\n')[0].trim()

export function Fab({ onClick, title = 'Ajouter' }) {
  const { style, handlers } = useFabDrag('is_fab_pos', FAB_DEFAULT, onClick)
  return <button className="fab no-print" title={title} style={style} {...handlers}>
    <Plus size={28}/>
  </button>
}

const TABS = {
  invoice: [
    { id: 'all', label: 'Toutes' },
    { id: 'unpaid', label: 'Non payées' },
    { id: 'paid', label: 'Payées' }
  ],
  estimate: [
    { id: 'all', label: 'Toutes' },
    { id: 'open', label: 'Ouverts' },
    { id: 'closed', label: 'Fermés' }
  ]
}

export function AppBar({ title, left, right, tabs, activeTab, onTab }) {
  return <header className="appbar no-print">
    <div className="appbar-row">
      <div className="appbar-side">{left}</div>
      <h1>{title}</h1>
      <div className="appbar-side right">{right}</div>
    </div>
    {tabs && <div className="appbar-tabs">
      {tabs.map(t => (
        <button key={t.id} className={activeTab === t.id ? 'active' : ''} onClick={() => onTab(t.id)}>{t.label}</button>
      ))}
    </div>}
  </header>
}

export function DocumentList({ type, docs, shares = {}, onOpen, onNew, onOpenSettings }) {
  const [filter, setFilter] = useState('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return docs
      .filter(d => d.docType === type)
      .map(d => ({ doc: d, status: docStatus(d), totals: calcTotals(d) }))
      .filter(({ doc, status }) => {
        if (filter !== 'all' && status !== filter) return false
        if (!q) return true
        // le chantier est affiché sur la rangée : il doit aussi se chercher
        return [doc.number, doc.client?.name, doc.client?.email, doc.siteAddress]
          .some(v => String(v || '').toLowerCase().includes(q))
      })
      .sort((a, b) => (b.doc.date || '').localeCompare(a.doc.date || '') || (b.doc.updatedAt || '').localeCompare(a.doc.updatedAt || ''))
  }, [docs, type, query, filter])

  // Groupes par année avec total, comme dans l'app
  const groups = useMemo(() => {
    const map = new Map()
    rows.forEach(r => {
      const year = (r.doc.date || '').slice(0, 4) || '—'
      if (!map.has(year)) map.set(year, { year, total: 0, rows: [] })
      const g = map.get(year)
      g.total += r.totals.total
      g.rows.push(r)
    })
    return [...map.values()].sort((a, b) => b.year.localeCompare(a.year))
  }, [rows])

  const title = type === 'invoice' ? 'Factures' : 'Devis'

  return <section className="screen">
    <AppBar
      title={title}
      left={<button className="icon light" onClick={onOpenSettings}><SettingsIcon size={22}/></button>}
      right={<button className="icon light" onClick={() => { setSearchOpen(o => !o); setQuery('') }}>{searchOpen ? <X size={22}/> : <Search size={22}/>}</button>}
      tabs={TABS[type]}
      activeTab={filter}
      onTab={setFilter}
    />

    {searchOpen && <div className="searchbar">
      <Search size={17}/>
      <input autoFocus placeholder="Chercher par client, numéro ou chantier..." value={query} onChange={e => setQuery(e.target.value)}/>
    </div>}

    <div className="doclist">
      {groups.length === 0 && <div className="empty">
        <Inbox size={54} strokeWidth={1.2}/>
        <p>{type === 'invoice'
          ? 'Créez votre première facture et envoyez-la à votre client par email ou texto.'
          : 'Informez les clients des coûts en établissant un devis que vous pourrez ensuite convertir en facture.'}</p>
      </div>}
      {groups.map(g => <div key={g.year}>
        <div className="year-head"><span>{g.year}</span><span>{money(g.total)}</span></div>
        {g.rows.map(({ doc, status, totals }) => (
          <button className="docrow" key={doc.id} onClick={() => onOpen(doc)}>
            <div className="docinfo">
              <b>{doc.client?.name || 'Sans client'}</b>
              <small className="docmeta">
                {doc.number}{doc.siteAddress ? ` — ${firstLine(doc.siteAddress)}` : ''}
                {doc.docType === 'invoice' &&
                  <span className={`stage ${invoiceStage(doc)}`}>{INVOICE_STAGES[invoiceStage(doc)]}</span>}
                {/* Un destinataire a ouvert son lien : c'est la seule preuve
                    qu'il a la facture sous les yeux. Une pastille par canal —
                    le courriel de l'administration et le texto du
                    contremaître ne se lisent pas au même moment. */}
                {channelsOf(shares[doc.id]).filter(c => c.last).map(c => (
                  <span key={c.channel} className={`stage view ${seenCurrent(c) ? '' : 'old'}`}>
                    {c.channel === 'mail' ? <Mail size={12}/> : c.channel === 'sms' ? <MessageSquare size={12}/> : <Link2 size={12}/>}
                    {seenCurrent(c) ? `lu ${agoFr(c.last.at)}` : 'lu avant correction'}
                  </span>
                ))}
              </small>
            </div>
            <div className="docamount">
              <b>{money(totals.total)}</b>
              {status === 'paid'
                ? <small className="paid-note">Payé le {fmtDate(lastPaymentDate(doc)) || fmtDate(doc.date)}</small>
                : status === 'closed'
                  ? <small className="paid-note">Fermé</small>
                  : <small>{fmtDate(doc.date)}</small>}
            </div>
          </button>
        ))}
      </div>)}
    </div>

    <Fab onClick={onNew} title={type === 'invoice' ? 'Nouvelle facture' : 'Nouveau devis'}/>
  </section>
}
