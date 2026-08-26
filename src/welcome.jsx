// Première ouverture d'une app neuve.
//
// Trois questions, dans l'ordre où elles comptent : où tu factures (ça pose
// les taxes), qui tu es (ça remplit l'entête des factures), et sous quel
// compte tes données t'appartiennent. Rien n'est prérempli, rien n'est
// supposé : l'app n'a pas de pays natal.
//
// Tout est sautable. Quelqu'un qui veut essayer avant de créer un compte doit
// pouvoir monter une facture tout de suite ; il pourra se nommer plus tard
// dans les réglages.

import React, { useState } from 'react'
import { ArrowRight, Building2, Check, Cloud, MapPin } from 'lucide-react'
import { applyRegion, REGIONS } from './store.js'
import { signIn, signUp } from './cloud.js'

// L'app est-elle encore vierge ? Une région choisie ou un nom d'entreprise
// suffisent à dire que quelqu'un s'est installé.
export const needsWelcome = (settings, docs, clients) =>
  !settings?.region &&
  !String(settings?.business?.name || '').trim() &&
  !(docs || []).length &&
  !(clients || []).length

export function Welcome({ settings, onSettings, onDone }) {
  const [step, setStep] = useState(0)
  const [region, setRegion] = useState('')
  const [biz, setBiz] = useState({ name: '', owner: '', phone: '', email: '', city: '' })
  const [mode, setMode] = useState('up')          // créer un compte / se connecter
  const [account, setAccount] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const r = REGIONS.find(x => x.id === region)

  const saveRegion = id => {
    setRegion(id)
    onSettings(applyRegion(settings, id))
  }

  const saveBiz = () => {
    onSettings({ ...settings, business: { ...settings.business, ...biz } })
    setStep(2)
  }

  const submitAccount = async () => {
    if (!account.email.trim() || !account.password) {
      return setMsg({ err: true, text: 'Courriel et mot de passe, tous les deux.' })
    }
    if (mode === 'up' && account.password.length < 8) {
      return setMsg({ err: true, text: 'Choisis un mot de passe d’au moins 8 caractères.' })
    }
    setBusy(true)
    setMsg(null)
    try {
      const { data, error } = mode === 'up'
        ? await signUp(account.email.trim(), account.password)
        : await signIn(account.email.trim(), account.password)
      if (error) throw error
      // Selon le réglage du projet, la création demande parfois une
      // confirmation par courriel avant d'ouvrir la session.
      if (mode === 'up' && !data?.session) {
        setMsg({ text: 'Compte créé. Confirme ton courriel, puis reviens te connecter — tes factures t’attendront.' })
        setBusy(false)
        return
      }
      onDone()
    } catch (e) {
      setMsg({ err: true, text: String(e?.message || e) })
      setBusy(false)
    }
  }

  return <section className="screen welcome">
    <div className="welcome-body">
      <header className="welcome-head">
        <h1>Bienvenue</h1>
        <p>Trois minutes, et l’app est à toi.</p>
        <div className="welcome-dots">
          {[0, 1, 2].map(i => <span key={i} className={i <= step ? 'on' : ''}/>)}
        </div>
      </header>

      {step === 0 && <div className="welcome-card">
        <h2><MapPin size={18}/> Où factures-tu ?</h2>
        <p className="hint">Ça pose les taxes de la bonne façon. Tu pourras les corriger dans les réglages — les taux changent avec les budgets.</p>
        <div className="region-list">
          {REGIONS.map(x => <button
            key={x.id}
            className={region === x.id ? 'region on' : 'region'}
            onClick={() => saveRegion(x.id)}
          >
            <span>{x.label}</span>
            <small>{x.taxRate ? `${x.taxLabel} ${x.taxRate} %` : 'aucune taxe'}{x.taxRate2 ? ` + ${x.taxLabel2} ${x.taxRate2} %` : ''}</small>
            {region === x.id && <Check size={17}/>}
          </button>)}
        </div>
        <button className="primary wide" disabled={!region} onClick={() => setStep(1)}>
          Continuer <ArrowRight size={17}/>
        </button>
        <button className="link-btn centered" onClick={() => setStep(1)}>Passer</button>
      </div>}

      {step === 1 && <div className="welcome-card">
        <h2><Building2 size={18}/> Ton entreprise</h2>
        <p className="hint">C’est ce qui apparaît en haut de tes factures. {r ? `Taxes réglées pour ${r.label}.` : ''}</p>
        <input placeholder="Nom de l’entreprise" value={biz.name} onChange={e => setBiz({ ...biz, name: e.target.value })}/>
        <input placeholder="Ton nom (facultatif)" value={biz.owner} onChange={e => setBiz({ ...biz, owner: e.target.value })}/>
        <div className="pair">
          <input placeholder="Téléphone" value={biz.phone} onChange={e => setBiz({ ...biz, phone: e.target.value })}/>
          <input placeholder="Courriel" value={biz.email} onChange={e => setBiz({ ...biz, email: e.target.value })}/>
        </div>
        <input placeholder="Ville, province / pays" value={biz.city} onChange={e => setBiz({ ...biz, city: e.target.value })}/>
        <button className="primary wide" onClick={saveBiz}>Continuer <ArrowRight size={17}/></button>
        <button className="link-btn centered" onClick={() => setStep(2)}>Passer</button>
      </div>}

      {step === 2 && <div className="welcome-card">
        <h2><Cloud size={18}/> Ton compte</h2>
        <p className="hint">
          Il garde tes factures en sûreté et les retrouve sur ton autre téléphone ou ta tablette.
          Le mot de passe est le tien : personne d’autre ne voit tes données.
        </p>
        <div className="seg">
          <button className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setMsg(null) }}>Créer mon compte</button>
          <button className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setMsg(null) }}>J’en ai déjà un</button>
        </div>
        <input
          type="email"
          autoComplete="email"
          placeholder="Courriel"
          value={account.email}
          onChange={e => setAccount({ ...account, email: e.target.value })}
        />
        <input
          type="password"
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          placeholder={mode === 'up' ? 'Mot de passe (8 caractères ou plus)' : 'Mot de passe'}
          value={account.password}
          onChange={e => setAccount({ ...account, password: e.target.value })}
        />
        {msg && <p className={msg.err ? 'hint small-note err' : 'hint small-note'}>{msg.text}</p>}
        <button className="primary wide" disabled={busy} onClick={submitAccount}>
          {busy ? 'Un instant…' : mode === 'up' ? 'Créer mon compte' : 'Se connecter'}
        </button>
        <button className="link-btn centered" onClick={onDone}>
          Plus tard — commencer sans compte
        </button>
      </div>}
    </div>
  </section>
}
