import React, { useMemo, useState } from 'react'
import { calcTotals, docStatus, money } from './store.js'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

export function ReportsScreen({ docs }) {
  const invoices = useMemo(() => docs
    .filter(d => d.docType === 'invoice')
    .map(d => ({ doc: d, status: docStatus(d), totals: calcTotals(d) })), [docs])

  const years = useMemo(() => {
    const ys = new Set(invoices.map(({ doc }) => (doc.date || '').slice(0, 4)).filter(Boolean))
    ys.add(String(new Date().getFullYear()))
    return [...ys].sort().reverse()
  }, [invoices])

  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [view, setView] = useState('months')

  const inYear = invoices.filter(({ doc }) => (doc.date || '').startsWith(year))
  const billed = inYear.reduce((s, x) => s + x.totals.total, 0)
  const paid = inYear.reduce((s, x) => s + x.totals.paid, 0)
  const outstanding = inYear.filter(x => x.status === 'outstanding' || x.status === 'overdue').reduce((s, x) => s + x.totals.balance, 0)

  const byMonth = MONTHS.map((label, i) => {
    const mm = String(i + 1).padStart(2, '0')
    const rows = inYear.filter(({ doc }) => doc.date?.slice(5, 7) === mm)
    return { label, total: rows.reduce((s, x) => s + x.totals.total, 0), count: rows.length }
  })

  const byClient = Object.values(inYear.reduce((acc, x) => {
    const name = x.doc.client?.name || 'Sans client'
    acc[name] = acc[name] || { label: name, total: 0, count: 0 }
    acc[name].total += x.totals.total
    acc[name].count += 1
    return acc
  }, {})).sort((a, b) => b.total - a.total)

  const byItem = Object.values(inYear.flatMap(x => x.doc.lines).reduce((acc, l) => {
    const name = l.description?.trim() || 'Sans description'
    const total = Number(l.qty || 0) * Number(l.rate || 0)
    acc[name] = acc[name] || { label: name, total: 0, count: 0 }
    acc[name].total += total
    acc[name].count += 1
    return acc
  }, {})).sort((a, b) => b.total - a.total)

  const rows = view === 'months' ? byMonth : view === 'clients' ? byClient : byItem
  const max = Math.max(...rows.map(r => r.total), 1)

  return <section className="screen">
    <header className="screen-head">
      <div><h1>Reports</h1><p className="muted">Résumé de tes invoices pour {year}</p></div>
      <select className="year-pick" value={year} onChange={e => setYear(e.target.value)}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </header>

    <div className="stat-row">
      <div className="stat"><small>Facturé</small><b>{money(billed)}</b></div>
      <div className="stat green"><small>Payé</small><b>{money(paid)}</b></div>
      <div className="stat orange"><small>Impayé</small><b>{money(outstanding)}</b></div>
    </div>

    <div className="chips">
      <button className={view === 'months' ? 'chip active' : 'chip'} onClick={() => setView('months')}>Par mois</button>
      <button className={view === 'clients' ? 'chip active' : 'chip'} onClick={() => setView('clients')}>Par client</button>
      <button className={view === 'items' ? 'chip active' : 'chip'} onClick={() => setView('items')}>Par item</button>
    </div>

    <div className="card">
      {rows.length === 0 && <p className="muted">Aucune donnée pour cette année.</p>}
      <div className="report-rows">
        {rows.map(r => <div className="report-row" key={r.label}>
          <span className="report-label">{r.label}</span>
          <div className="bar-track"><div className="bar" style={{ width: `${Math.round((r.total / max) * 100)}%` }}/></div>
          <span className="report-count">{r.count || ''}</span>
          <b>{money(r.total)}</b>
        </div>)}
      </div>
    </div>
  </section>
}
