import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FileText, ClipboardList, Users, Package, BarChart3, Settings as SettingsIcon, Plus } from 'lucide-react'
import { load, save, emptySettings, migrateOldData, newDocument, uid } from './store.js'
import { DocumentList } from './lists.jsx'
import { DocumentEditor } from './editor.jsx'
import { ClientsScreen, ItemsScreen } from './catalog.jsx'
import { ReportsScreen } from './reports.jsx'
import { SettingsScreen } from './settings.jsx'
import './styles.css'

const NAV = [
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'estimates', label: 'Estimates', icon: ClipboardList },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'items', label: 'Items', icon: Package },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon }
]

function App() {
  const [migrated] = useState(() => migrateOldData())
  const [tab, setTab] = useState('invoices')
  const [settings, setSettings] = useState(() => migrated?.settings || load('is_settings', emptySettings))
  const [clients, setClients] = useState(() => migrated?.clients || load('is_clients', []))
  const [items, setItems] = useState(() => load('is_items', []))
  const [docs, setDocs] = useState(() => migrated?.docs || load('is_docs', []))
  const [editing, setEditing] = useState(null) // document en cours d'édition

  useEffect(() => save('is_settings', settings), [settings])
  useEffect(() => save('is_clients', clients), [clients])
  useEffect(() => save('is_items', items), [items])
  useEffect(() => save('is_docs', docs), [docs])

  const upsertDoc = doc => {
    const stamped = { ...doc, updatedAt: new Date().toISOString() }
    setDocs(list => list.some(d => d.id === stamped.id)
      ? list.map(d => d.id === stamped.id ? stamped : d)
      : [stamped, ...list])
    return stamped
  }

  const deleteDoc = id => {
    setDocs(list => list.filter(d => d.id !== id))
    if (editing?.id === id) setEditing(null)
  }

  const createDoc = type => {
    setTab(type === 'invoice' ? 'invoices' : 'estimates')
    setEditing(newDocument(type, settings, docs))
  }

  const upsertClient = client => {
    setClients(list => list.some(c => c.id === client.id)
      ? list.map(c => c.id === client.id ? client : c)
      : [...list, client])
  }

  const upsertItem = item => {
    setItems(list => list.some(i => i.id === item.id)
      ? list.map(i => i.id === item.id ? item : i)
      : [...list, item])
  }

  const editorType = editing?.docType
  const screen = editing
    ? <DocumentEditor
        key={editing.id}
        doc={editing}
        settings={settings}
        clients={clients}
        items={items}
        onSaveClient={upsertClient}
        onSaveItem={upsertItem}
        onChange={setEditing}
        onSave={doc => upsertDoc(doc)}
        onDelete={() => deleteDoc(editing.id)}
        onConvert={doc => {
          const inv = { ...doc, id: uid(), docType: 'invoice', status: 'draft', payments: [] }
          inv.number = inv.number.replace(settings.estimatePrefix, settings.invoicePrefix)
          const stored = upsertDoc(inv)
          setTab('invoices')
          setEditing(stored)
        }}
        onClose={() => setEditing(null)}
      />
    : <>
        {tab === 'invoices' && <DocumentList type="invoice" docs={docs} onOpen={d => setEditing(d)} onNew={() => createDoc('invoice')} onDelete={deleteDoc}/>}
        {tab === 'estimates' && <DocumentList type="estimate" docs={docs} onOpen={d => setEditing(d)} onNew={() => createDoc('estimate')} onDelete={deleteDoc}/>}
        {tab === 'clients' && <ClientsScreen clients={clients} setClients={setClients}/>}
        {tab === 'items' && <ItemsScreen items={items} setItems={setItems}/>}
        {tab === 'reports' && <ReportsScreen docs={docs}/>}
        {tab === 'settings' && <SettingsScreen settings={settings} setSettings={setSettings}/>}
      </>

  return (
    <div className="app">
      <aside className="sidebar no-print">
        <div className="brand-mark">
          <span className="brand-icon"><FileText size={20}/></span>
          <span className="brand-name">Invoices <b>Simple</b></span>
        </div>
        <nav>
          {NAV.map(n => (
            <button
              key={n.id}
              className={tab === n.id && !editing ? 'active' : (editing && ((n.id === 'invoices' && editorType === 'invoice') || (n.id === 'estimates' && editorType === 'estimate')) ? 'active' : '')}
              onClick={() => { setEditing(null); setTab(n.id) }}
            >
              <n.icon size={20}/><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <button className="sidebar-new" onClick={() => createDoc(tab === 'estimates' ? 'estimate' : 'invoice')}>
          <Plus size={18}/> {tab === 'estimates' ? 'New Estimate' : 'New Invoice'}
        </button>
      </aside>

      <main className="content">{screen}</main>

      <nav className="bottombar no-print">
        {NAV.map(n => (
          <button
            key={n.id}
            className={tab === n.id && !editing ? 'active' : ''}
            onClick={() => { setEditing(null); setTab(n.id) }}
          >
            <n.icon size={21}/><span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
