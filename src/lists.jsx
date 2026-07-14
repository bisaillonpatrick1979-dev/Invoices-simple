import React, { useMemo, useState } from 'react'
import { Plus, Search, Settings as SettingsIcon, Inbox, X } from 'lucide-react'
import { calcTotals, docStatus, fmtDate, lastPaymentDate, money } from './store.js'

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

export function DocumentList({ type, docs, onOpen, onNew, onOpenSettings }) {
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
        return [doc.number, doc.client?.name, doc.client?.email].some(v => String(v || '').toLowerCase().includes(q))
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
      <input autoFocus placeholder="Chercher par client ou numéro..." value={query} onChange={e => setQuery(e.target.value)}/>
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
              <small>{doc.number}</small>
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

    <button className="fab no-print" onClick={onNew}><Plus size={28}/></button>
  </section>
}
