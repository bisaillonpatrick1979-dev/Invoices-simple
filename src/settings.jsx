import React, { useState } from 'react'
import { ArrowLeft, Eye } from 'lucide-react'
import { defaultWatermark, emptySettings, readImageFile, sampleDocument } from './store.js'
import { AppBar } from './lists.jsx'
import { PaperPreview, Watermark } from './paper.jsx'

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function Slider({ label, value, suffix, onChange, ...rest }) {
  return <div className="slider">
    <div className="slider-head"><span>{label}</span><b>{value}{suffix}</b></div>
    <input type="range" value={value} onChange={e => onChange(Number(e.target.value))} {...rest}/>
  </div>
}

const ACCENTS = ['#4353c9', '#2e7d32', '#0f172a', '#b45309', '#7b1fa2', '#c62828']
const WM_MODES = [{ id: 'logo', label: 'Logo' }, { id: 'text', label: 'Texte' }, { id: 'none', label: 'Aucun' }]

// Poids approximatif d'une image en data URL (base64 = 4/3 des octets)
const dataUrlWeight = src => `${Math.round((String(src).length * 0.75) / 1024)} ko`

export function SettingsScreen({ settings, setSettings, onBack }) {
  const b = settings.business
  const wm = { ...defaultWatermark, ...(settings.watermark || {}) }
  const [logoError, setLogoError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const setBiz = patch => setSettings({ ...settings, business: { ...b, ...patch } })
  const setWm = patch => setSettings({ ...settings, watermark: { ...wm, ...patch } })

  const logoChange = e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoError('')
    readImageFile(file)
      .then(logo => setSettings({ ...settings, logo }))
      .catch(() => setLogoError("Impossible de lire cette image. Essaie un fichier PNG ou JPG."))
  }

  return <section className="screen">
    <AppBar title="Réglages" left={<button className="icon light" onClick={onBack}><ArrowLeft size={22}/></button>}/>

    <div className={previewOpen ? 'editor-body no-print' : 'editor-body'}>
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
        {logoError && <p className="hint small-note">{logoError}</p>}
        {settings.logo && <>
          <div className="logo-preview">
            <img src={settings.logo}/>
            <div className="row-text">
              <small>Image réduite à 600 px ({dataUrlWeight(settings.logo)})</small>
              <button className="link-btn" onClick={() => setSettings({ ...settings, logo: '' })}>Retirer le logo</button>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={settings.logoOnPdf !== false} onChange={e => setSettings({ ...settings, logoOnPdf: e.target.checked })}/>
            Afficher le logo en haut de la facture
          </label>
        </>}
      </div>

      <div className="edit-card padded">
        <h2 className="section-title">Filigrane</h2>
        <p className="hint small-note">Le motif pâle imprimé derrière chaque facture et chaque devis.</p>

        <div className="seg-row">
          {WM_MODES.map(m => <button
            key={m.id}
            className={wm.mode === m.id ? 'active' : ''}
            onClick={() => setWm({ mode: m.id })}
          >{m.label}</button>)}
        </div>

        {wm.mode === 'logo' && !settings.logo &&
          <p className="hint small-note">Aucun logo chargé : c'est le nom de la compagnie qui sera utilisé. Ajoute un logo ci-dessus pour l'imprimer en filigrane.</p>}

        {wm.mode === 'text' &&
          <Field label="Texte du filigrane">
            <input value={wm.text} placeholder={b.name} onChange={e => setWm({ text: e.target.value })}/>
          </Field>}

        {wm.mode !== 'none' && <>
          <Slider label="Opacité" value={wm.opacity} suffix=" %" min={2} max={40} step={1} onChange={v => setWm({ opacity: v })}/>
          <Slider label="Taille" value={wm.size} suffix=" %" min={20} max={100} step={5} onChange={v => setWm({ size: v })}/>
          <Slider label="Rotation" value={wm.rotate} suffix="°" min={-90} max={90} step={3} onChange={v => setWm({ rotate: v })}/>
          <div className="wm-preview">
            <Watermark settings={settings} scale={0.38}/>
            <div className="wm-lines">
              {Array.from({ length: 6 }, (_, i) => <span key={i}/>)}
            </div>
          </div>
          <button className="link-btn" onClick={() => setWm({ ...defaultWatermark, mode: wm.mode })}>Remettre le filigrane par défaut</button>
        </>}
      </div>

      <button className="outline-btn with-icon" onClick={() => setPreviewOpen(true)}>
        <Eye size={18}/> Voir un aperçu de la facture
      </button>
      <p className="hint small-note centered">Ouvre une facture d'exemple avec tes réglages actuels.</p>

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

    {previewOpen && <PaperPreview
      settings={settings}
      doc={sampleDocument(settings)}
      title="Aperçu de la facture"
      note="Exemple fictif — aucune facture n'est créée"
      onClose={() => setPreviewOpen(false)}
    />}
  </section>
}
