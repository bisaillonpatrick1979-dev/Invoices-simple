// Confirmation de paiement, postée par le serveur.
//
// L'app du téléphone ne peut pas envoyer un courriel toute seule : elle ouvre
// Gmail ou Messages, et il faut un doigt. Pour que la confirmation parte
// vraiment toute seule quand une facture passe à « payée », il faut un
// serveur qui poste à sa place. C'est ici.
//
// Le reçu en PDF est fabriqué par l'app (même rendu que celui qu'on
// télécharge) et transmis déjà prêt : le serveur n'a qu'à le joindre.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
}

const reponse = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, "Content-Type": "application/json" } })

const estCourriel = (v: unknown) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || "").trim())

// La copie arrive en texte ou en liste ; on garde les adresses valables, sans
// doublon, et jamais le destinataire lui-même — personne n'a besoin de se
// recevoir deux fois le même message.
const adresses = (v: unknown, sauf: string[] = []) => {
  const brut = Array.isArray(v) ? v : String(v || "").split(/[,;]/)
  const exclus = sauf.map(x => x.toLowerCase())
  const gardees: string[] = []
  for (const a of brut) {
    const propre = String(a || "").trim()
    if (!estCourriel(propre)) continue
    const bas = propre.toLowerCase()
    if (exclus.includes(bas) || gardees.some(g => g.toLowerCase() === bas)) continue
    gardees.push(propre)
  }
  return gardees
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return reponse({ error: "Méthode non permise" }, 405)

  // Qui demande ? Le jeton fait foi : la fonction n'envoie rien pour un
  // inconnu, sinon elle deviendrait une machine à pourriel.
  const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "")
  if (!jeton) return reponse({ error: "Connexion requise" }, 401)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
  const { data: { user }, error: authErr } = await admin.auth.getUser(jeton)
  if (authErr || !user) return reponse({ error: "Jeton invalide" }, 401)

  const cle = Deno.env.get("RESEND_API_KEY")
  if (!cle) {
    return reponse({
      error: "envoi_non_configure",
      message: "Le service d'envoi n'est pas branché : ajoute la clé RESEND_API_KEY dans Supabase (Edge Functions → Secrets)."
    }, 503)
  }

  let corps: Record<string, unknown>
  try { corps = await req.json() } catch { return reponse({ error: "Requête illisible" }, 400) }

  const { to, subject, text, pdfBase64, filename, from, replyTo, cc, bcc } = corps as Record<string, string>
  if (!estCourriel(to)) return reponse({ error: "Adresse du destinataire manquante ou invalide" }, 400)
  if (!estCourriel(from)) {
    return reponse({
      error: "expediteur_manquant",
      message: "Aucune adresse d'expédition vérifiée. Règle-la dans l'app (Réglages → Confirmation automatique)."
    }, 400)
  }
  if (!subject || !text) return reponse({ error: "Message vide" }, 400)

  const destinataire = String(to).trim()
  const copies = adresses(cc, [destinataire])
  const copiesCachees = adresses(bcc, [destinataire, ...copies])

  const envoi: Record<string, unknown> = {
    from,
    to: [destinataire],
    subject,
    text
  }
  // La copie à l'entrepreneur part sur le même message : il reçoit mot pour
  // mot ce que son client a reçu, reçu compris. Une adresse invalide ne fait
  // pas échouer l'envoi — elle est simplement écartée plus haut.
  if (copies.length) envoi.cc = copies
  if (copiesCachees.length) envoi.bcc = copiesCachees
  if (estCourriel(replyTo)) envoi.reply_to = replyTo
  if (pdfBase64) {
    envoi.attachments = [{ filename: filename || "recu.pdf", content: pdfBase64 }]
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify(envoi)
  })
  const resultat = await res.json().catch(() => ({}))

  if (!res.ok) {
    // Le cas le plus fréquent, et celui qu'il faut expliquer sans jargon :
    // le domaine de l'expéditeur n'est pas vérifié chez le service d'envoi.
    const brut = String(resultat?.message || resultat?.error || `Erreur ${res.status}`)
    const domaine = /domain|verify|not verified|testing emails/i.test(brut)
    return reponse({
      error: domaine ? "expediteur_non_verifie" : "envoi_refuse",
      message: domaine
        ? `L'adresse d'expédition n'est pas encore vérifiée chez le service d'envoi : ${brut}`
        : brut
    }, 502)
  }

  return reponse({ ok: true, id: resultat?.id || null, cc: copies })
})
