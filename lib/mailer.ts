import { createTransport } from 'nodemailer'

// ─── Transporter ────────────────────────────────────────────────────────────

const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// ─── Tipi ───────────────────────────────────────────────────────────────────

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

// ─── Entry point principale ──────────────────────────────────────────────────

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
    const { subject, html } = customSubject
      ? { subject: customSubject, html: customBody ?? '' }
      : buildEmail(nome, template, customBody)

    await transporter.sendMail({
      from: `"RIDENTIUM" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
      },
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
        subject: 'La tua richiesta \u00e8 stata ricevuta \u2014 RIDENTIUM Gift Box',
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
        subject: 'Il tuo appuntamento \u00b7 RIDENTIUM',
        html: tplAppuntamento(n, customBody ?? ''),
      }
  }
}

// ─── Template 1: Gift Box conferma ──────────────────────────────────────────

function tplBoxConferma(nome: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>RIDENTIUM Gift Box</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#FAF8F5" style="background:#FAF8F5;">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:6px;">

  <!-- HEADER -->
  <tr><td align="center" style="padding:36px 32px 28px;border-bottom:1px solid #EDE8E0;">
    <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.4em;text-transform:uppercase;color:#B8974A;font-weight:normal;">RIDENTIUM</p>
    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.12em;color:#AAA;font-weight:normal;text-transform:uppercase;">Odontoiatria premium &middot; Aversa</p>
  </td></tr>

  <!-- BOX IMAGE -->
  <tr><td style="padding:0;line-height:0;font-size:0;">
    <img src="https://ridentium-web.vercel.app/email-box.jpg"
         alt="RIDENTIUM Gift Box"
         width="560"
         style="display:block;width:100%;max-width:560px;height:auto;"
    />
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:40px 40px 36px;">

    <p style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#B8974A;margin:0 0 20px;font-weight:normal;">Gift Box &middot; RIDENTIUM</p>

    <h2 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#1A1A1A;font-weight:normal;margin:0 0 20px;line-height:1.35;">Caro ${nome},<br>la tua richiesta<br>&egrave; stata ricevuta.</h2>

    <p style="font-family:Georgia,serif;font-size:15px;color:#4A4A4A;line-height:1.85;margin:0 0 32px;">Ti contatteremo non appena RIDENTIUM aprir&agrave; le porte ad Aversa.<br>La Gift Box verr&agrave; consegnata al tuo primo appuntamento.</p>

    <!-- SEPARATOR -->
    <div style="height:1px;background:#EDE8E0;margin:0 0 28px;"></div>

    <p style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#B8974A;margin:0 0 10px;font-weight:normal;">Incluso nella Gift Box</p>
    <p style="font-family:Georgia,serif;font-size:14px;color:#5A5A5A;line-height:2;margin:0 0 36px;">
      Visita di controllo completa &nbsp;&middot;&nbsp; Consulenza personalizzata &nbsp;&middot;&nbsp; Piano di trattamento su misura
    </p>

    <!-- SEPARATOR -->
    <div style="height:1px;background:#EDE8E0;margin:0 0 28px;"></div>

    <p style="font-family:Georgia,serif;font-size:13px;color:#7A6F63;line-height:1.85;margin:0;">Per qualsiasi necessit&agrave;, rispondi direttamente a questa email.<br>Saremo felici di accoglierti.</p>

  </td></tr>

  <!-- FOOTER -->
  <tr><td align="center" style="padding:20px 40px 36px;border-top:1px solid #EDE8E0;">
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#BBB;letter-spacing:.08em;margin:0;line-height:2;">
      RIDENTIUM &middot; Via Aldo Moro 96, Aversa (CE)<br>
      <a href="https://ridentium.it" style="color:#B8974A;text-decoration:none;">ridentium.it</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ─── Template 2: Benvenuto ───────────────────────────────────────────────────

function tplBenvenuto(nome: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Benvenuto in RIDENTIUM</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#FAF8F5">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:6px;">
  <tr><td align="center" style="padding:36px 40px 28px;border-bottom:1px solid #EDE8E0;">
    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.4em;text-transform:uppercase;color:#B8974A;font-weight:normal;">RIDENTIUM</p>
  </td></tr>
  <tr><td style="padding:40px 40px 36px;">
    <p style="color:#3A3A3A;font-size:16px;line-height:1.8;margin:0 0 20px;font-family:Georgia,serif;">Caro ${nome}, benvenuto in <strong style="color:#B8974A;">RIDENTIUM</strong>.</p>
    <p style="color:#4A4A4A;font-size:14px;line-height:1.9;margin:0 0 32px;font-family:Georgia,serif;">Siamo lieti di averti come paziente. Il nostro team &egrave; a tua disposizione per accompagnarti in un percorso di cura personalizzato, con la massima attenzione all&rsquo;estetica e al comfort.</p>
    <div style="border:1px solid #EDE8E0;border-left:3px solid #B8974A;border-radius:4px;padding:20px 24px;margin-bottom:32px;">
      <p style="color:#B8974A;font-size:10px;letter-spacing:.25em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;margin:0 0 10px;font-weight:normal;">Il nostro impegno</p>
      <p style="color:#4A4A4A;font-size:14px;line-height:1.9;margin:0;font-family:Georgia,serif;">Qualit&agrave; clinica misurabile &middot; Estetica naturale &middot; Esperienza premium in ogni fase del percorso</p>
    </div>
    <div style="text-align:center;">
      <a href="https://ridentium.it" style="display:inline-block;background:#B8974A;color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;padding:14px 36px;border-radius:3px;">Scopri RIDENTIUM</a>
    </div>
  </td></tr>
  <tr><td align="center" style="padding:20px 40px 36px;border-top:1px solid #EDE8E0;">
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#BBB;letter-spacing:.08em;margin:0;line-height:2;">RIDENTIUM &middot; Via Aldo Moro 96, Aversa (CE)<br><a href="https://ridentium.it" style="color:#B8974A;text-decoration:none;">ridentium.it</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

// ─── Template 3: Personalizzata ─────────────────────────────────────────────

function tplPersonalizzata(nome: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Messaggio da RIDENTIUM</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#FAF8F5">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:6px;">
  <tr><td align="center" style="padding:36px 40px 28px;border-bottom:1px solid #EDE8E0;">
    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.4em;text-transform:uppercase;color:#B8974A;font-weight:normal;">RIDENTIUM</p>
  </td></tr>
  <tr><td style="padding:40px 40px 36px;">
    <p style="color:#3A3A3A;font-size:16px;line-height:1.8;margin:0 0 24px;font-family:Georgia,serif;">Caro ${nome},</p>
    <div style="color:#4A4A4A;font-size:15px;line-height:1.9;font-family:Georgia,serif;">${body}</div>
  </td></tr>
  <tr><td align="center" style="padding:20px 40px 36px;border-top:1px solid #EDE8E0;">
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#BBB;letter-spacing:.08em;margin:0;line-height:2;">RIDENTIUM &middot; Via Aldo Moro 96, Aversa (CE)<br><a href="https://ridentium.it" style="color:#B8974A;text-decoration:none;">ridentium.it</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

// ─── Template 4: Ricorda appuntamento ────────────────────────────────────────

function tplAppuntamento(nome: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Il tuo appuntamento RIDENTIUM</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#FAF8F5">
<tr><td align="center" style="padding:40px 16px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:6px;">
  <tr><td align="center" style="padding:36px 40px 28px;border-bottom:1px solid #EDE8E0;">
    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.4em;text-transform:uppercase;color:#B8974A;font-weight:normal;">RIDENTIUM</p>
  </td></tr>
  <tr><td style="padding:40px 40px 36px;">
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#B8974A;margin:0 0 16px;font-weight:normal;">Promemoria appuntamento</p>
    <p style="color:#3A3A3A;font-size:16px;line-height:1.8;margin:0 0 24px;font-family:Georgia,serif;">Caro ${nome},</p>
    <div style="color:#4A4A4A;font-size:15px;line-height:1.9;font-family:Georgia,serif;">${body}</div>
  </td></tr>
  <tr><td align="center" style="padding:20px 40px 36px;border-top:1px solid #EDE8E0;">
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#BBB;letter-spacing:.08em;margin:0;line-height:2;">RIDENTIUM &middot; Via Aldo Moro 96, Aversa (CE)<br><a href="https://ridentium.it" style="color:#B8974A;text-decoration:none;">ridentium.it</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
