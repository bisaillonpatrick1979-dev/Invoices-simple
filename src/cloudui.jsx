import React, { useEffect, useRef, useState } from 'react'
import { Cloud, CloudOff, RefreshCw, LogOut } from 'lucide-react'
import { calcTotals, docStatus } from './store.js'
import { cloud, cloudError, forgetSnapshot, onAuthChange, signIn, signOut, signUp, syncAll } from './cloud.js'

const totalsOf = doc => ({ ...calcTotals(doc), status: docStatus(doc) })

// Toute la synchro passe par ici : l'écran de réglages et le déclenchement
// automatique après une modification partagent le même état.
export function useCloudSync(data, apply) {
  const [user, setUser] = useState(null)
  const [state, setState] = useState({ busy: false, at: '', error: '' })
  const dataRef = useRef(data)
  dataRef.current = data
  const runningRef = useRef(false)

  useEffect(() => {
    const db = cloud()
    if (!db) return
    db.auth.getSession().then(({ data: { session } }) => setUser(session?.user || null))
    const { data: sub } = onAuthChange(setUser) || { data: null }
    return () => sub?.subscription?.unsubscribe()
  }, [])

  const sync = async () => {
    if (runningRef.current || !user) return
    runningRef.current = true
    setState(s => ({ ...s, busy: true, error: '' }))
    try {
      const r = await syncAll(dataRef.current, totalsOf)
      apply(r)
      setState({ busy: false, at: r.at, error: '' })
    } catch (e) {
      setState(s => ({ ...s, busy: false, error: cloudError(e) }))
    } finally {
      runningRef.current = false
    }
  }

  // Une seule synchro à la connexion : le reste part du bouton ou de l'appui
  // qui suit une modification, pour ne pas courir après le réseau.
  useEffect(() => { if (user) sync() }, [user?.id])

  return { user, state, sync, setUser }
}

export function CloudSection({ user, state, sync, onSignedOut }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('in')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async () => {
    if (!email.trim() || !password) return setMsg({ err: true, text: 'Courriel et mot de passe, tous les deux.' })
    setBusy(true)
    setMsg(null)
    try {
      const { data, error } = mode === 'in' ? await signIn(email, password) : await signUp(email, password)
      if (error) throw error
      if (mode === 'up' && !data.session) {
        setMsg({ text: 'Compte créé. Confirme le courriel qu\'on vient de t\'envoyer, puis connecte-toi.' })
      } else {
        setPassword('')
      }
    } catch (e) {
      setMsg({ err: true, text: cloudError(e) })
    } finally {
      setBusy(false)
    }
  }

  const leave = async () => {
    setBusy(true)
    try {
      await signOut()
      // L'instantané décrit ce que CE compte avait synchronisé : le garder
      // ferait passer les données du prochain compte pour des suppressions.
      forgetSnapshot()
      onSignedOut?.()
    } catch (e) {
      setMsg({ err: true, text: cloudError(e) })
    } finally {
      setBusy(false)
    }
  }

  if (!user) return <>
    <p className="hint small-note">Tes factures restent sur cet appareil. Avec un compte, elles sont aussi sauvegardées dans ton projet Supabase et suivent d'un appareil à l'autre.</p>
    <div className="seg-row">
      <button className={mode === 'in' ? 'active' : ''} onClick={() => { setMode('in'); setMsg(null) }}>Se connecter</button>
      <button className={mode === 'up' ? 'active' : ''} onClick={() => { setMode('up'); setMsg(null) }}>Créer un compte</button>
    </div>
    <label className="field"><span>Courriel</span>
      <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/>
    </label>
    <label className="field"><span>Mot de passe</span>
      <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password}
             onChange={e => setPassword(e.target.value)}
             onKeyDown={e => { if (e.key === 'Enter') submit() }}/>
    </label>
    <button className="outline-btn with-icon" disabled={busy} onClick={submit}>
      <Cloud size={18}/> {busy ? 'Un instant…' : mode === 'in' ? 'Se connecter' : 'Créer le compte'}
    </button>
    {msg && <p className={msg.err ? 'hint small-note ai-test err' : 'hint small-note ai-test'}>{msg.text}</p>}
  </>

  return <>
    <p className="hint small-note">Connecté comme <b>{user.email}</b>. Les factures, clients, articles, dépenses et réglages sont copiés dans le schéma <code>invoices_simple</code> de ton projet — à part des tables de Hailite Manager.</p>
    <div className="cloud-state">
      {state.busy
        ? <><RefreshCw size={16} className="spin"/> Synchro en cours…</>
        : state.error
          ? <><CloudOff size={16}/> {state.error}</>
          : <><Cloud size={16}/> {state.at ? `À jour — ${new Date(state.at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}` : 'En attente de la première synchro'}</>}
    </div>
    <button className="outline-btn with-icon" disabled={state.busy} onClick={sync}>
      <RefreshCw size={18}/> Synchroniser maintenant
    </button>
    <button className="link-btn with-icon" disabled={busy} onClick={leave}><LogOut size={16}/> Se déconnecter</button>
    {msg && <p className="hint small-note ai-test err">{msg.text}</p>}
    <p className="hint small-note">La clé API de l'assistant ne monte jamais dans le nuage : elle reste sur cet appareil.</p>
  </>
}
