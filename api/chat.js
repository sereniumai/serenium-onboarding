// Vercel serverless function — proxies chat messages to Claude API
export const config = { maxDuration: 30 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const { system, messages, max_tokens = 1024 } = req.body;

    // Trim conversation to keep token usage manageable:
    // Keep first 4 messages (init, greeting, name, email response with PARTIAL_CAPTURE)
    // + last 16 messages (recent context). This preserves the core identity data.
    let trimmedMessages = messages;
    if (messages.length > 24) {
      trimmedMessages = [
        ...messages.slice(0, 4),
        { role: "user", content: "[Earlier conversation about business details, services, hours, etc. was trimmed. Continue from the most recent messages below.]" },
        { role: "assistant", content: "Got it — picking up where we left off." },
        ...messages.slice(-16),
      ];
    }

    const body = JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens,
      system,
      messages: trimmedMessages,
    });

    // Retry up to 3 times on 429 (rate limit) with exponential backoff
    let lastResponse;
    for (let attempt = 0; attempt < 3; attempt++) {
      lastResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
      });

      if (lastResponse.status !== 429) break;

      // Check retry-after header, default to exponential backoff
      const retryAfter = lastResponse.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : (attempt + 1) * 2000;
      console.warn(`Rate limited (429), retrying in ${waitMs}ms (attempt ${attempt + 1}/3)`);
      await sleep(Math.min(waitMs, 10000));
    }

    if (!lastResponse.ok) {
      const err = await lastResponse.text();
      console.error("Anthropic API error:", lastResponse.status, err);
      return res.status(lastResponse.status).json({ error: "Claude API error", detail: err });
    }

    const data = await lastResponse.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Chat handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
