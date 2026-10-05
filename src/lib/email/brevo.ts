// Transactional email via Brevo, a French provider (spec's "Reminder Emails",
// "Sending"). Plain fetch to its REST API — no SDK dependency for one call.
export async function sendTransactionalEmail(input: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    throw new Error("Brevo: BREVO_API_KEY/BREVO_SENDER_EMAIL manquants");
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME || "Electro Care" },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo: envoi impossible (${res.status}) ${body}`);
  }
}
