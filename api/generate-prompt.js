// Vercel serverless function — generates Retell agent prompt from onboarding data
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const { system, referencePrompt, onboardingData } = req.body;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system,
        messages: [
          {
            role: "user",
            content: `REFERENCE PROMPT (the gold standard structure to follow):\n\n${referencePrompt}\n\n---\n\nNEW BUSINESS ONBOARDING DATA:\n\n${JSON.stringify(onboardingData, null, 2)}\n\nWrite the complete Retell agent prompt for this business now.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", response.status, err);
      return res.status(response.status).json({ error: "Claude API error" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Generate prompt error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
