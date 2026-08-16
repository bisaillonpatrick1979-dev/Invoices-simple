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
    setText('')
    setInterim('')

    const rec = new Recognition()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = e => {
      let done = '', pending = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) done += r[0].transcript
        else pending += r[0].transcript
      }
      if (done.trim()) setText(t => (t ? `${t} ${done.trim()}` : done.trim()))
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
