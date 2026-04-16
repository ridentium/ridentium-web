import { createTransport } from 'nodemailer'

// ─── Transporter ──────────────────────────────────────────────────────────────

const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export type EmailTemplate = 'box-conferma' | 'benvenuto' | 'personalizzata'

export interface SendEmailParams {
  to: string
  nome: string
  template: EmailTemplate
  customSubject?: string
  customBody?: string
}

export interface SendEmailResult {
  success: boolean
  error?: string
}

// ─── Entry point principale ───────────────────────────────────────────────────

export async function sendEmail({
  to,
  nome,
  template,
  customSubject,
  customBody,
}: SendEmailParams): Promise<SendEmailResult> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { success: false, error: 'Credenziali email non configurate' }
  }

  try {
    const { subject, html } = buildEmail(nome, template, customBody)

    await transporter.sendMail({
      from: `RIDENTIUM <${process.env.GMAIL_USER}>`,
      to,
      subject: customSubject || subject,
      html,
    })

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return { success: false, error: message }
  }
}

// Compat backward con il vecchio codice
export async function sendConfermaIscrizione({
  nome,
  email,
}: {
  nome: string
  email: string
}): Promise<void> {
  await sendEmail({ to: email, nome, template: 'box-conferma' })
}

// ─── Router template ─────────────────────────────────────────────────────────

function buildEmail(
  nome: string,
  template: EmailTemplate,
  customBody?: string,
): { subject: string; html: string } {
  const n = nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : 'Paziente'

  switch (template) {
    case 'box-conferma':
      return {
        subject: 'La tua richiesta è stata ricevuta — RIDENTIUM Gift Box',
        html: tplBoxConferma(n),
      }
    case 'benvenuto':
      return {
        subject: 'Benvenuto in RIDENTIUM',
        html: tplBenvenuto(n),
      }
    case 'personalizzata':
      return {
        subject: 'Messaggio da RIDENTIUM',
        html: tplPersonalizzata(n, customBody ?? ''),
      }
  }
}

// ─── HTML condiviso ───────────────────────────────────────────────────────────

function wrap(nome: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 28px;">

    <!-- Testata -->
    <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #1e1e1e;margin-bottom:40px;">
      <p style="margin:0 0 6px 0;letter-spacing:.35em;text-transform:uppercase;font-size:11px;color:#c9a96e;font-family:Helvetica,Arial,sans-serif;">RIDENTIUM</p>
      <p style="margin:0;font-size:11px;color:#555;font-family:Helvetica,Arial,sans-serif;letter-spacing:.08em;">Odontoiatria premium · Aversa</p>
    </div>

    <!-- Saluto -->
    <p style="color:#f5f2ec;font-size:18px;margin:0 0 28px 0;">Caro ${nome},</p>

    ${body}

    <!-- Separatore -->
    <div style="text-align:center;margin:40px 0 32px;"><span style="display:inline-block;width:40px;height:1px;background:#c9a96e;opacity:.5;"></span></div>

    <!-- Footer -->
    <p style="color:#555;font-size:11px;text-align:center;font-family:Helvetica,Arial,sans-serif;line-height:1.7;margin:0;">
      RIDENTIUM · Via Aldo Moro 96, Aversa (CE)<br/>
      <a href="https://ridentium.it" style="color:#c9a96e;text-decoration:none;">ridentium.it</a>
    </p>

  </div>
</body>
</html>`
}

// ─── Template 1: Gift Box conferma ────────────────────────────────────────────

function tplBoxConferma(nome: string): string {
  const body = `
    <p style="color:#c0b89a;font-size:15px;line-height:1.8;margin:0 0 20px 0;">
      abbiamo ricevuto la tua richiesta per la <strong style="color:#c9a96e;">RIDENTIUM Gift Box</strong>.
    </p>
    <p style="color:#c0b89a;font-size:15px;line-height:1.8;margin:0 0 32px 0;">
      Nei prossimi <strong style="color:#f5f2ec;">24–48 ore</strong> uno dei nostri collaboratori ti contatterà per definire insieme i dettagli e concordare un appuntamento.
    </p>

    <!-- Box regalo info -->
    <div style="background:#111;border:1px solid #1e1e1e;border-left:3px solid #c9a96e;border-radius:6px;padding:24px 20px;margin-bottom:32px;">
      <p style="color:#c9a96e;font-size:11px;letter-spacing:.25em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;margin:0 0 10px 0;">Cosa include la Gift Box</p>
      <p style="color:#c0b89a;font-size:14px;line-height:1.8;margin:0;">
        Visita di controllo completa · Consulenza personalizzata · Piano di trattamento su misura
      </p>
    </div>

    <p style="color:#c0b89a;font-size:15px;line-height:1.8;margin:0 0 32px 0;">
      Per qualsiasi necessità puoi rispondere direttamente a questa email o chiamarci al numero indicato sul sito.
    </p>

    <div style="text-align:center;margin-bottom:8px;">
      <a href="https://ridentium.it" style="display:inline-block;background:#c9a96e;color:#0c0c0c;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:4px;">Scopri RIDENTIUM</a>
    </div>
  `
  return wrap(nome, body)
}

// ─── Template 2: Benvenuto ────────────────────────────────────────────────────

function tplBenvenuto(nome: string): string {
  const body = `
    <p style="color:#c0b89a;font-size:15px;line-height:1.8;margin:0 0 20px 0;">
      benvenuto in <strong style="color:#c9a96e;">RIDENTIUM</strong>.
    </p>
    <p style="color:#c0b89a;font-size:15px;line-height:1.8;margin:0 0 32px 0;">
      Siamo lieti di averti come paziente. Il nostro team è a tua disposizione per accompagnarti in un percorso di cura personalizzato, con la massima attenzione all'estetica e al comfort.
    </p>

    <div style="background:#111;border:1px solid #1e1e1e;border-left:3px solid #c9a96e;border-radius:6px;padding:24px 20px;margin-bottom:32px;">
      <p style="color:#c9a96e;font-size:11px;letter-spacing:.25em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;margin:0 0 10px 0;">Il nostro impegno</p>
      <p style="color:#c0b89a;font-size:14px;line-height:1.8;margin:0;">
        Qualità clinica misurabile · Estetica naturale · Esperienza premium in ogni fase del percorso
      </p>
    </div>

    <div style="text-align:center;margin-bottom:8px;">
      <a href="https://ridentium.it" style="display:inline-block;background:#c9a96e;color:#0c0c0c;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:4px;">Scopri RIDENTIUM</a>
    </div>
  `
  return wrap(nome, body)
}

// ─── Template 3: Personalizzata ──────────────────────────────────────────────

function tplPersonalizzata(nome: string, testo: string): string {
  const body = `
    <p style="color:#c0b89a;font-size:15px;line-height:1.8;margin:0 0 28px 0;white-space:pre-wrap;">${testo}</p>
    <div style="text-align:center;margin-bottom:8px;">
      <a href="https://ridentium.it" style="display:inline-block;background:#c9a96e;color:#0c0c0c;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:4px;">Scopri RIDENTIUM</a>
    </div>
  `
  return wrap(nome, body)
}
