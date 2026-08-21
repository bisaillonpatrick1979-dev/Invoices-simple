// Parler à l'assistant : dictée (voix -> texte) et lecture de la réponse.
//
// Tout se passe dans le navigateur avec la Web Speech API : l'audio ne quitte
// jamais l'appareil, seul le texte transcrit part chez le fournisseur d'IA.
// Chrome, Edge et Safari savent le faire ; Firefox non, d'où les gardes
// partout et le repli sur le clavier.

import { useCallback, useEffect, useRef, useState } from 'react'

const Recognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

export const dictationSupported = () => !!Recognition
export const speechSupported = () => typeof window !== 'undefined' && !!window.speechSynthesis

const ERRORS = {
  'not-allowed': 'Le micro est bloqué. Autorise le microphone pour ce site, puis réessaie.',
  'service-not-allowed': 'Le micro est bloqué. Autorise le microphone pour ce site, puis réessaie.',
  'audio-capture': "Aucun micro n'a été trouvé sur cet appareil.",
  network: "La transcription passe par Internet et la connexion a lâché."
}

// Recolle deux morceaux de transcription sans répéter ce qui est déjà là.
// Android renvoie souvent toute la phrase depuis le début à chaque événement,
// et redonne parfois la dernière phrase au redémarrage de la reconnaissance :
// sans ce garde-fou, « donne-moi le total » devient « donne-moi le total
// donne-moi le total donne-moi le total… ».
// Écrase un morceau redit deux fois de suite : « donne-moi le total donne-moi
// le total » redevient « donne-moi le total ». Cinq mots minimum — un bloc
// plus court peut très bien être dit deux fois pour de vrai (« cent vingt
// pieds carrés, cent vingt pieds carrés de soffite »), alors qu'un bégaiement
// de machine reprend des phrases entières.
export function collapseRepeats(text) {
  const out = String(text || '').trim().split(/\s+/).filter(Boolean)
  // une dictée n'est jamais longue à ce point : au-delà, c'est du bégaiement
  if (out.length > 400) out.splice(0, out.length - 400)
  for (let again = true; again;) {
    again = false
    for (let i = 0; i < out.length && !again; i++) {
      for (let n = Math.floor((out.length - i) / 2); n >= 5; n--) {
        const bloc = out.slice(i, i + n).join(' ').toLowerCase()
        const suivant = out.slice(i + n, i + 2 * n).join(' ').toLowerCase()
        if (bloc === suivant) {
          out.splice(i + n, n)
          again = true
          break
        }
      }
    }
  }
  return out.join(' ')
}

export const joinSpeech = (a, b) => {
  const left = String(a || '').trim()
  const right = String(b || '').trim()
  if (!right) return left
  if (!left) return collapseRepeats(right)
  const l = left.toLowerCase()
  const r = right.toLowerCase()
  if (l.endsWith(r)) return left        // on nous redonne ce qu'on a déjà
  if (r.startsWith(l)) return collapseRepeats(right)  // tout depuis le début
  return collapseRepeats(`${left} ${right}`)
}

// Dictée continue. `text` s'accumule au fil des phrases terminées, `interim`
// est ce que le navigateur est en train d'entendre.
//
// silenceMs > 0 : appelle onSilence quand la personne arrête de parler pendant
// ce temps-là — c'est ce qui permet le mode mains libres (on parle, ça part
// tout seul, sans toucher au téléphone).
export function useDictation({ lang = 'fr-CA', silenceMs = 0, onSilence } = {}) {
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')

  const recRef = useRef(null)
  const wantedRef = useRef(false)     // la personne veut-elle toujours dicter
  // Ce qui est acquis des sessions précédentes, et ce que la session en cours
  // a donné. La session en cours est TOUJOURS relue en entier : c'est ce qui
  // rend la dictée insensible aux navigateurs qui renvoient tout à chaque fois.
  const baseRef = useRef('')
  const sessionRef = useRef('')
  const timerRef = useRef(null)
  const silenceRef = useRef(silenceMs)
  const cbRef = useRef(onSilence)

  // Lus par des callbacks créés une seule fois : ils doivent voir la valeur
  // du moment, pas celle du rendu où la reconnaissance a démarré.
  useEffect(() => { silenceRef.current = silenceMs }, [silenceMs])
  useEffect(() => { cbRef.current = onSilence }, [onSilence])

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const armSilence = useCallback(() => {
    clearTimer()
    if (!silenceRef.current) return
    timerRef.current = setTimeout(() => cbRef.current?.(), silenceRef.current)
  }, [])

  const stop = useCallback(() => {
    wantedRef.current = false
    clearTimer()
    try { recRef.current?.stop() } catch { /* déjà arrêtée */ }
    setListening(false)
    setInterim('')
  }, [])

  const reset = useCallback(() => {
    baseRef.current = ''
    sessionRef.current = ''
    setText('')
    setInterim('')
    clearTimer()
  }, [])

  const start = useCallback(() => {
    if (!Recognition) {
      setError("Ce navigateur ne sait pas transcrire la voix. Essaie Chrome ou Safari, ou écris ton message.")
      return
    }
    if (wantedRef.current) return
    setError('')
    baseRef.current = ''
    sessionRef.current = ''
    setText('')
    setInterim('')

    const rec = new Recognition()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = e => {
      // On relit la session au complet plutôt que d'ajouter le morceau reçu.
      // Ajouter suppose que le navigateur n'envoie que du nouveau — ce que
      // Chrome sur Android ne fait pas : il renvoie toute la phrase à chaque
      // événement, et le texte se répétait une fois par mot prononcé.
      let done = '', pending = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        const said = r[0]?.transcript || ''
        if (r.isFinal) done += `${said} `
        else pending += `${said} `
      }
      sessionRef.current = done.trim()
      setText(joinSpeech(baseRef.current, sessionRef.current))
      setInterim(pending.trim())
      armSilence()
    }

    rec.onerror = e => {
      // 'no-speech' et 'aborted' arrivent normalement (un silence, un stop) :
      // ce ne sont pas des pannes à afficher.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      setError(ERRORS[e.error] || "La dictée s'est arrêtée.")
      wantedRef.current = false
      clearTimer()
      setListening(false)
    }

    rec.onend = () => {
      // Le navigateur coupe de lui-même après quelques secondes de silence :
      // tant qu'on n'a pas appuyé sur stop, on relance.
      if (wantedRef.current) {
        // La prochaine session repart d'une liste vide côté navigateur : on
        // fige ce qu'elle vient de donner avant de relancer.
        baseRef.current = joinSpeech(baseRef.current, sessionRef.current)
        sessionRef.current = ''
        try { rec.start() } catch { /* déjà repartie */ }
        return
      }
      setListening(false)
      setInterim('')
    }

    recRef.current = rec
    wantedRef.current = true
    try {
      rec.start()
      setListening(true)
    } catch {
      wantedRef.current = false
    }
  }, [lang, armSilence])

  useEffect(() => () => {
    wantedRef.current = false
    clearTimer()
    try { recRef.current?.abort() } catch { /* rien à annuler */ }
  }, [])

  return { supported: !!Recognition, listening, text, interim, error, start, stop, reset }
}

// Lecture à voix haute de la réponse (mode mains libres). `onDone` est appelé
// dans tous les cas, même si la voix n'est pas disponible : c'est lui qui
// relance l'écoute, il ne doit jamais rester en plan.
export function speak(text, onDone) {
  const say = String(text || '').trim().slice(0, 600)
  let called = false
  const done = () => {
    if (called) return
    called = true
    if (typeof onDone === 'function') onDone()
  }
  if (!speechSupported() || !say) return done()
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(say)
    u.lang = 'fr-CA'
    const voice = window.speechSynthesis.getVoices().find(v => /^fr/i.test(v.lang))
    if (voice) u.voice = voice
    u.onend = done
    u.onerror = done
    // Filet de sécurité : un appareil sans voix installée ne signale parfois
    // ni la fin ni l'erreur. Sans ça, le mode mains libres resterait muet et
    // n'écouterait plus. ~14 caractères par seconde, avec une marge.
    setTimeout(done, 1500 + say.length * 75)
    window.speechSynthesis.speak(u)
  } catch {
    done()
  }
}

export function stopSpeaking() {
  if (speechSupported()) {
    try { window.speechSynthesis.cancel() } catch { /* rien à couper */ }
  }
}
