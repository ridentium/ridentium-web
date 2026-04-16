import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

interface ConfermaParams {
  nome: string
  email: string
}

export async function sendConfermaIscrizione({ nome, email }: ConfermaParams) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return
  const html = buildEmailHtml(nome)
  await transporter.sendMail({
    from: `RIDENTIUM <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'La tua richiesta è stata ricevuta — RIDENTIUM Gift Box',
    html,
  })
}

function buildEmailHtml(nome: string): string {
  const n = nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : 'Paziente'
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>RIDENTIUM — Conferma richiesta</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f2ec;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ec;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0c0c0c;padding:40px 48px 32px;text-align:center;border-radius:4px 4px 0 0;">
              <p style="margin:0;font-size:10px;letter-spacing:6px;color:#c9a96e;font-family:Georgia,serif;text-transform:uppercase;">Odontoiatria Premium</p>
              <h1 style="margin:10px 0 0;font-size:30px;letter-spacing:10px;color:#f5f2ec;font-family:Georgia,serif;font-weight:400;text-transform:uppercase;">RIDENTIUM</h1>
            </td>
          </tr>

          <!-- Gold line -->
          <tr><td style="background-color:#c9a96e;height:1px;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:48px 48px 40px;">

              <p style="margin:0 0 28px;font-size:11px;letter-spacing:4px;color:#c9a96e;text-transform:uppercase;font-family:Georgia,serif;">Gift Box · Conferma richiesta</p>

              <p style="margin:0 0 24px;font-size:22px;color:#0c0c0c;font-family:Georgia,serif;font-weight:400;line-height:1.4;">Gentile ${n},</p>

              <p style="margin:0 0 20px;font-size:15px;color:#3a3a3a;line-height:1.9;font-family:Georgia,serif;">
                abbiamo ricevuto la tua richiesta per la <strong style="color:#0c0c0c;">RIDENTIUM Gift Box</strong>.
                Siamo lieti che tu abbia scelto di regalare — o regalarti — un'esperienza
                di cura dentale di qualità superiore.
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#3a3a3a;line-height:1.9;font-family:Georgia,serif;">
                Uno dei nostri collaboratori ti contatterà entro <strong style="color:#0c0c0c;">24–48 ore</strong>
                per definire insieme tutti i dettagli e rispondere a qualsiasi domanda.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
                <tr>
                  <td width="40%" style="border-top:1px solid #e8e0d0;">&nbsp;</td>
                  <td width="20%" style="text-align:center;color:#c9a96e;font-size:14px;padding:0 8px;">✦</td>
                  <td width="40%" style="border-top:1px solid #e8e0d0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Chi siamo -->
              <p style="margin:0 0 10px;font-size:10px;letter-spacing:4px;color:#c9a96e;text-transform:uppercase;font-family:Georgia,serif;">Chi siamo</p>

              <p style="margin:0 0 32px;font-size:14px;color:#555;line-height:1.9;font-family:Georgia,serif;">
                RIDENTIUM è uno studio di odontoiatria premium con sede ad Aversa, fondato
                dal Dr. Mariano Di Paola — specializzato in chirurgia orale, implantologia
                e riabilitazioni estetiche full arch. Un luogo progettato per offrire cura
                autentica, tecnologia avanzata e un'esperienza che mette il paziente
                al centro di ogni scelta.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="https://ridentium-web.vercel.app"
                       style="display:inline-block;background-color:#0c0c0c;color:#f5f2ec;text-decoration:none;
                              font-size:10px;letter-spacing:4px;text-transform:uppercase;
                              padding:16px 44px;font-family:Georgia,serif;border:1px solid #0c0c0c;">
                      Scopri RIDENTIUM
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#888;line-height:1.8;font-family:Georgia,serif;">
                Per qualsiasi esigenza puoi rispondere direttamente a questa email oppure
                scriverci a
                <a href="mailto:ridentium@gmail.com" style="color:#c9a96e;text-decoration:none;">ridentium@gmail.com</a>.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0c0c0c;padding:28px 48px;text-align:center;border-radius:0 0 4px 4px;">
              <p style="margin:0 0 4px;font-size:10px;letter-spacing:5px;color:#c9a96e;text-transform:uppercase;font-family:Georgia,serif;">RIDENTIUM</p>
              <p style="margin:0 0 14px;font-size:11px;color:#555;font-family:Georgia,serif;">Odontoiatria Premium · Aversa</p>
              <p style="margin:0;font-size:10px;color:#3a3a3a;font-family:Georgia,serif;line-height:1.7;">
                Hai ricevuto questa email perché hai compilato il modulo sul sito RIDENTIUM.<br>
                <a href="mailto:ridentium@gmail.com?subject=Rimozione%20dati%20RIDENTIUM"
                   style="color:#555;text-decoration:underline;">Richiedi rimozione dati</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
