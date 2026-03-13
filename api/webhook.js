// Vercel serverless function — fires onboarding data to n8n webhook
// and sends email notification on completion

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://serenium.app.n8n.cloud/webhook/serenium-onboarding";

const N8N_EMAIL_WEBHOOK_URL =
  process.env.N8N_EMAIL_WEBHOOK_URL ||
  "https://serenium.app.n8n.cloud/webhook/serenium-onboarding-email";

const NOTIFICATION_EMAIL =
  process.env.NOTIFICATION_EMAIL || "contact@sereniumai.com";

const GOOGLE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1UKr_CUldJXJJlqSj5i6D13uBNpKsr1OGHYCdB-5zTgs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body;

    // Fire to n8n → Google Sheet
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("n8n webhook error:", response.status, err);
      return res.status(502).json({ error: "Webhook delivery failed" });
    }

    // Send email notification on full completion (not partial)
    if (payload.partial === false) {
      try {
        await sendCompletionEmail(payload);
      } catch (emailErr) {
        // Log but don't fail the request — sheet write already succeeded
        console.error("Email notification failed:", emailErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function sendCompletionEmail(payload) {
  const businessName = payload.business?.name || "Unknown Business";
  const contactName = payload.contact_name || "Unknown";
  const contactEmail = payload.contact_email || "Not provided";
  const industry = payload.business?.industry || "Not specified";
  const serviceAreas = payload.business?.service_areas?.join(", ") || "Not specified";
  const services = payload.business?.services?.join(", ") || "Not specified";
  const phoneType =
    payload.phone_setup?.type === "new" ? "New number" : "Divert existing";
  const notificationEmails =
    payload.after_call?.notification_emails?.join(", ") || "None";

  const emailPayload = {
    to: NOTIFICATION_EMAIL,
    subject: `New Onboarding Complete — ${businessName}`,
    body:
      `A new client has completed the Serenium AI onboarding.\n\n` +
      `CONTACT\n` +
      `Name: ${contactName}\n` +
      `Email: ${contactEmail}\n\n` +
      `BUSINESS\n` +
      `Business: ${businessName}\n` +
      `Industry: ${industry}\n` +
      `Services: ${services}\n` +
      `Service Areas: ${serviceAreas}\n` +
      `Phone Setup: ${phoneType}\n` +
      `Notification Emails: ${notificationEmails}\n\n` +
      `The generated Retell prompt and full data are in the Google Sheet.\n` +
      GOOGLE_SHEET_URL,
  };

  const emailRes = await fetch(N8N_EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(emailPayload),
  });

  if (!emailRes.ok) {
    throw new Error(`Email webhook returned ${emailRes.status}`);
  }
}
