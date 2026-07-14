import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { emptySettings } from './store.js'
import { AppBar } from './lists.jsx'

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

const ACCENTS = ['#4353c9', '#2e7d32', '#0f172a', '#b45309', '#7b1fa2', '#c62828']

export function SettingsScreen({ settings, setSettings, onBack }) {
  const b = settings.business
  const setBiz = patch => setSettings({ ...settings, business: { ...b, ...patch } })

  const logoChange = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setSettings({ ...settings, logo: reader.result })
    reader.readAsDataURL(file)
  }

  return <section className="screen">
    <AppBar title="Réglages" left={<button className="icon light" onClick={onBack}><ArrowLeft size={22}/></button>}/>

    <div className="editor-body">
      <div className="edit-card padded">
        <h2 className="section-title">Informations relatives à l'entreprise</h2>
        <p className="hint small-note">Ces infos sortent automatiquement sur chaque PDF.</p>
        <div className="pair">
          <Field label="Nom compagnie"><input value={b.name} onChange={e => setBiz({ name: e.target.value })}/></Field>
          <Field label="Ton nom (optionnel)"><input value={b.owner} onChange={e => setBiz({ owner: e.target.value })}/></Field>
          <Field label="Téléphone"><input value={b.phone} onChange={e => setBiz({ phone: e.target.value })}/></Field>
          <Field label="Email"><input value={b.email} onChange={e => setBiz({ email: e.target.value })}/></Field>
          <Field label="GST #"><input value={b.gst} onChange={e => setBiz({ gst: e.target.value })}/></Field>
          <Field label="Ville / province"><input value={b.city} onChange={e => setBiz({ city: e.target.value })}/></Field>
        </div>
        <Field label="Site web"><input value={b.website} onChange={e => setBiz({ website: e.target.value })}/></Field>
        <Field label="Adresse compagnie"><textarea rows={2} value={b.address} onChange={e => setBiz({ address: e.target.value })}/></Field>
        <Field label="Logo compagnie"><input type="file" accept="image/*" onChange={logoChange}/></Field>
        {settings.logo && <div className="logo-preview">
          <img src={settings.logo}/>
          <button className="link-btn" onClick={() => setSettings({ ...settings, logo: '' })}>Retirer logo</button>
        </div>}
      </div>

      <div className="edit-card padded">
        <h2 className="section-title">Taxe & documents</h2>
        <div className="pair">
          <Field label="Nom de la taxe"><input value={settings.taxLabel} onChange={e => setSettings({ ...settings, taxLabel: e.target.value })}/></Field>
          <Field label="Taux %"><input type="number" value={settings.taxRate} onChange={e => setSettings({ ...settings, taxRate: Number(e.target.value) })}/></Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.taxDefault} onChange={e => setSettings({ ...settings, taxDefault: e.target.checked })}/>
          Charger la taxe par défaut sur les nouvelles factures
        </label>
        <div className="pair">
          <Field label="Préfixe factures"><input value={settings.invoicePrefix} onChange={e => setSettings({ ...settings, invoicePrefix: e.target.value })}/></Field>
          <Field label="Préfixe devis"><input value={settings.estimatePrefix} onChange={e => setSettings({ ...settings, estimatePrefix: e.target.value })}/></Field>
        </div>
      </div>

      <div className="edit-card padded">
        <h2 className="section-title">Couleur du PDF</h2>
        <div className="accent-row">
          {ACCENTS.map(c => <button
            key={c}
            className={settings.accent === c ? 'accent active' : 'accent'}
            style={{ background: c }}
            onClick={() => setSettings({ ...settings, accent: c })}
          />)}
        </div>
      </div>

      <div className="edit-card padded">
        <h2 className="section-title">Textes par défaut</h2>
        <Field label="Remarques par défaut"><textarea rows={2} value={settings.defaultNotes} onChange={e => setSettings({ ...settings, defaultNotes: e.target.value })}/></Field>
        <Field label="Info sur le paiement (sur le PDF)"><textarea rows={2} value={settings.paymentInstructions} onChange={e => setSettings({ ...settings, paymentInstructions: e.target.value })} placeholder="Virement Interac à..., chèque à l'ordre de..."/></Field>
      </div>

      <button className="outline-btn danger" onClick={() => { if (confirm('Remettre les réglages par défaut ? (les factures et clients restent)')) setSettings(emptySettings) }}>Réinitialiser les réglages</button>
    </div>
  </section>
}
