import { createTransport } from 'nodemailer'

// âââ Transporter ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// âââ Tipi âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type EmailTemplate = 'box-conferma' | 'benvenuto' | 'personalizzata' | 'ricorda-appuntamento'

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

// âââ Entry point principale âââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// âââ Router template âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function buildEmail(
  nome: string,
  template: EmailTemplate,
  customBody?: string,
): { subject: string; html: string } {
  const n = nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : 'Paziente'

  switch (template) {
    case 'box-conferma':
      return {
        subject: 'La tua richiesta Ã¨ stata ricevuta â RIDENTIUM Gift Box',
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
    case 'ricorda-appuntamento':
      return {
        subject: 'Il tuo appuntamento · RIDENTIUM',
        html: tplAppuntamento(n, customBody ?? ''),
      }
  }
}

// âââ HTML condiviso âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
      <p style="margin:0;font-size:11px;color:#555;font-family:Helvetica,Arial,sans-serif;letter-spacing:.08em;">Odontoiatria premium Â· Aversa</p>
    </div>

    <!-- Saluto -->
    <p style="color:#f5f2ec;font-size:18px;margin:0 0 28px 0;">Caro ${nome},</p>

    ${body}

    <!-- Separatore -->
    <div style="text-align:center;margin:40px 0 32px;"><span style="display:inline-block;width:40px;height:1px;background:#c9a96e;opacity:.5;"></span></div>

    <!-- Footer -->
    <p style="color:#555;font-size:11px;text-align:center;font-family:Helvetica,Arial,sans-serif;line-height:1.7;margin:0;">
      RIDENTIUM Â· Via Aldo Moro 96, Aversa (CE)<br/>
      <a href="https://ridentium.it" style="color:#c9a96e;text-decoration:none;">ridentium.it</a>
    </p>

  </div>
</body>
</html>`
}

// âââ Template 1: Gift Box conferma ââââââââââââââââââââââââââââââââââââââââââââ

function tplBoxConferma(nome: string): string {
  const body = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td style="padding:52px 40px 20px;">
        <p style="font-family:Georgia,serif;font-size:11px;color:#B8974A;letter-spacing:.22em;text-transform:uppercase;margin:0 0 36px;font-weight:normal;">Gift Box &middot; RIDENTIUM</p>
        <h2 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#1A1A1A;font-weight:normal;margin:0 0 32px;line-height:1.25;">La tua richiesta<br>è stata ricevuta.</h2>
        <p style="font-family:Georgia,serif;font-size:16px;color:#3A3A3A;line-height:1.85;margin:0 0 24px;">Grazie per esserti registrato alla <strong style="font-weight:normal;color:#1A1A1A;">Gift Box RIDENTIUM</strong>. La tua richiesta è stata registrata con cura.</p>
        <p style="font-family:Georgia,serif;font-size:16px;color:#3A3A3A;line-height:1.85;margin:0 0 40px;">Non appena RIDENTIUM aprirà le porte ad Aversa, potrai venire a ritirarla direttamente presso la nostra sede. Ti avviseremo non appena sarà il momento.</p>
        <div style="border-left:2px solid #B8974A;padding:22px 26px;margin:0 0 40px;background:rgba(184,151,74,.04);">
          <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#B8974A;letter-spacing:.18em;text-transform:uppercase;margin:0 0 12px;font-weight:normal;">La nostra sede</p>
          <p style="font-family:Georgia,serif;font-size:18px;color:#1A1A1A;margin:0 0 4px;line-height:1.3;font-weight:normal;">Via Paolo Riverso 99</p>
          <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#7A6F63;margin:0;letter-spacing:.04em;">Aversa&nbsp;&nbsp;&middot;&nbsp;&nbsp;Caserta</p>
        </div>
        <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#B8974A;letter-spacing:.18em;text-transform:uppercase;margin:0 0 10px;font-weight:normal;">Incluso nella Gift Box</p>
        <p style="font-family:Georgia,serif;font-size:13px;color:#6A6059;line-height:1.8;margin:0 0 44px;">Visita di controllo completa &nbsp;&middot;&nbsp; Consulenza personalizzata &nbsp;&middot;&nbsp; Piano di trattamento su misura</p>
        <div style="border-top:1px solid #E4DDD3;padding-top:28px;">
          <p style="font-family:Georgia,serif;font-size:13px;color:#7A6F63;line-height:1.75;margin:0;">Per qualsiasi necessità, rispondi direttamente a questa email.<br>Saremo felici di accoglierti.</p>
        </div>
      </td></tr>
    </table>
  `
  return wrap(nome, body)
}

// âââ Template 2: Benvenuto ââââââââââââââââââââââââââââââââââââââââââââââââââââ

function tplBenvenuto(nome: string): string {
  const body = `
    <p style="color:#c0b89a;font-size:15px;line-height:1.8;margin:0 0 20px 0;">
      benvenuto in <strong style="color:#c9a96e;">RIDENTIUM</strong>.
    </p>
    <p style="color:#c0b89a;font-size:15px;line-height:1.8;margin:0 0 32px 0;">
      Siamo lieti di averti come paziente. Il nostro team Ã¨ a tua disposizione per accompagnarti in un percorso di cura personalizzato, con la massima attenzione all'estetica e al comfort.
    </p>

    <div style="background:#111;border:1px solid #1e1e1e;border-left:3px solid #c9a96e;border-radius:6px;padding:24px 20px;margin-bottom:32px;">
      <p style="color:#c9a96e;font-size:11px;letter-spacing:.25em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;margin:0 0 10px 0;">Il nostro impegno</p>
      <p style="color:#c0b89a;font-size:14px;line-height:1.8;margin:0;">
        QualitÃ  clinica misurabile Â· Estetica naturale Â· Esperienza premium in ogni fase del percorso
      </p>
    </div>

    <div style="text-align:center;margin-bottom:8px;">
      <a href="https://ridentium.it" style="display:inline-block;background:#c9a96e;color:#0c0c0c;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:4px;">Scopri RIDENTIUM</a>
    </div>
  `
  return wrap(nome, body)
}

// âââ Template 3: Personalizzata ââââââââââââââââââââââââââââââââââââââââââââââ

function tplPersonalizzata(nome: string, testo: string): string {
  const body = `
    <p style="color:#c0b89a;font-size:15px;line-height:1.8;margin:0 0 28px 0;white-space:pre-wrap;">${testo}</p>
    <div style="text-align:center;margin-bottom:8px;">
      <a href="https://ridentium.it" style="display:inline-block;background:#c9a96e;color:#0c0c0c;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:4px;">Scopri RIDENTIUM</a>
    </div>
  `
  return wrap(nome, body)
}


// ─── Template 4: Ricorda appuntamento ──────────────────────────────────────────

function tplAppuntamento(nome: string, testo: string): string {
  const det = testo || 'Ti aspettiamo presso il nostro studio. Il team è pronto ad accoglierti.'
  const body = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td style="padding:40px 40px 36px;">
        <p style="font-family:Georgia,serif;font-size:11px;color:#B8974A;letter-spacing:.2em;text-transform:uppercase;margin:0 0 36px;font-weight:normal;">Promemoria Appuntamento</p>
        <p style="font-family:Georgia,serif;font-size:16px;color:#3A3A3A;line-height:1.85;margin:0 0 28px;">desideriamo ricordarti il tuo prossimo appuntamento presso <strong style="font-weight:normal;color:#1A1A1A;">RIDENTIUM</strong>.</p>
        <div style="border-left:2px solid #B8974A;padding:20px 24px;margin:0 0 32px;background:rgba(184,151,74,.04);">
          <p style="font-family:Georgia,serif;font-size:15px;color:#1A1A1A;line-height:1.85;margin:0;white-space:pre-line;">${det}</p>
        </div>
        <p style="font-family:Georgia,serif;font-size:14px;color:#5A5A5A;line-height:1.8;margin:0 0 40px;">Per confermare o modificare il tuo appuntamento, rispondi a questa email. Siamo a tua disposizione.</p>
        <div style="border-top:1px solid #E4DDD3;padding-top:24px;">
          <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#9A8E82;letter-spacing:.14em;text-transform:uppercase;margin:0;">RIDENTIUM · Studio Odontoiatrico · Aversa</p>
        </div>
      </td></tr>
    </table>
  `
  return wrap(nome, body)
}
