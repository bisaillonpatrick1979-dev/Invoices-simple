import React, { useEffect, useRef, useState } from 'react'
import { Cloud, CloudOff, RefreshCw, LogOut } from 'lucide-react'
import { calcTotals, docStatus, load, save } from './store.js'
import { cloud, cloudError, forgetSnapshot, onAuthChange, resendConfirmation, signIn, signOut, signUp, syncAll } from './cloud.js'

const totalsOf = doc => ({ ...calcTotals(doc), status: docStatus(doc) })

// Les données locales appartiennent au dernier compte qui les a synchronisées.
// Sans cette petite étiquette, se déconnecter de A puis connecter B sur le même
// téléphone pourrait faire monter les données locales de A dans le compte B.
const OWNER_KEY = 'is_cloud_owner'
const ACCOUNT_DATA_KEYS = [
  'is_settings', 'is_clients', 'is_items', 'is_expenses', 'is_docs',
  'is_open_doc', 'is_share_state', 'is_share_seen',
  // anciennes versions : si elles restent, migrateOldData pourrait les faire
  // réapparaître après le nettoyage d'un changement de compte.
  'inv_invoices', 'inv_company', 'inv_clients'
]

function prepareAccount(userId) {
  const owner = load(OWNER_KEY, '')
  if (!owner) {
    save(OWNER_KEY, userId)
    return false
  }
  if (owner === userId) return false

  // Un autre compte arrive sur cet appareil : on repart d'une mémoire locale
  // vierge avant toute requête de synchro. Ses propres données redescendront du
  // nuage après le rechargement. Le snapshot de l'ancien compte part aussi.
  for (const key of ACCOUNT_DATA_KEYS) localStorage.removeItem(key)
  forgetSnapshot()
  save(OWNER_KEY, userId)
  return true
}

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

  // La première synchro d'une ouverture relit le nuage AU COMPLET : l'écran
  // doit montrer ce que le serveur contient, pas ce que la mémoire du
  // navigateur a retenu. Les fois suivantes, seul ce qui a bougé circule.
  const firstRef = useRef(true)
  const accountRef = useRef('')

  const sync = async () => {
    if (runningRef.current || !user) return
    runningRef.current = true
    setState(s => ({ ...s, busy: true, error: '' }))
    try {
      const full = firstRef.current
      const r = await syncAll(dataRef.current, totalsOf, { full })
      firstRef.current = false
      apply(r)
      setState({ busy: false, at: r.at, error: '', pulled: r.pulled, full })
    } catch (e) {
      setState(s => ({ ...s, busy: false, error: cloudError(e) }))
    } finally {
      runningRef.current = false
    }
  }

  // Une première synchro dès que la session Supabase revient. Si l'identité a
  // changé, on sépare d'abord les données locales des deux comptes puis on
  // recharge : aucune ligne de l'ancien compte n'a le temps de partir au nuage.
  useEffect(() => {
    const id = user?.id || ''
    if (!id) {
      accountRef.current = ''
      return
    }
    if (accountRef.current !== id) firstRef.current = true
    accountRef.current = id

    if (prepareAccount(id)) {
      window.location.reload()
      return
    }
    sync()
  }, [user?.id])

  // Si l'ouverture a eu lieu sans réseau, on ne laisse plus l'app vide jusqu'à
  // un clic manuel : le retour du signal relance la première synchro complète.
  // Même chose quand on revient dans l'app après l'avoir laissée en arrière-plan
  // — ça récupère aussi les changements faits depuis un autre appareil.
  useEffect(() => {
    if (!user) return
    const onOnline = () => sync()
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user?.id])

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
        setMsg({ text: "Compte créé. Ouvre le courriel qu'on vient de t'envoyer et touche le lien, puis reviens ici te connecter.", resend: true })
      } else {
        setPassword('')
      }
    } catch (e) {
      const text = cloudError(e)
      // un compte pas encore confirmé se débloque en renvoyant le courriel
      setMsg({ err: true, text, resend: /confirm/i.test(text) })
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setBusy(true)
    try {
      await resendConfirmation(email)
      setMsg({ text: "Courriel renvoyé. Touche le lien qu'il contient, puis reviens te connecter." })
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
      // On garde le snapshot et l'identité locale du compte : si la même
      // personne se reconnecte, on sait ce qui a changé pendant son absence.
      // Si un autre compte se connecte, prepareAccount nettoie avant la synchro.
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
    {msg?.resend && <button className="link-btn" disabled={busy} onClick={resend}>Renvoyer le courriel de confirmation</button>}
  </>

  return <>
    <p className="hint small-note">Connecté comme <b>{user.email}</b>. Factures, clients, articles, dépenses et réglages sont copiés dans le projet Supabase de l'application, et suivent d'un appareil à l'autre.</p>
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
