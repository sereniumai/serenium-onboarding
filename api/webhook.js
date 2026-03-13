// Vercel serverless function — fires onboarding data to n8n webhook
const N8N_WEBHOOK_URL = "https://serenium.app.n8n.cloud/webhook/serenium-onboarding";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body;

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

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
