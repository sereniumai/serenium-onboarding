// Vercel serverless function — scans a website URL and extracts business info via Claude
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Fetch the website content
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let html;
    try {
      const siteRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SereniumBot/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      html = await siteRes.text();
    } catch (fetchErr) {
      clearTimeout(timeout);
      return res.status(200).json({
        success: false,
        error: "Could not reach the website. We'll gather the info from you directly.",
      });
    }

    // Strip scripts, styles, and HTML tags to get text content
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000); // Limit to avoid token overflow

    // Ask Claude to extract business info
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system:
          "You extract business information from website text. Return ONLY valid JSON with no markdown fences. Extract what you can find — leave fields as empty string or empty array if not found.",
        messages: [
          {
            role: "user",
            content: `Extract business info from this website text. Return JSON with these fields:
{
  "name": "business name",
  "industry": "HVAC|electrical|plumbing|landscaping|roofing|cleaning|other",
  "services": ["list of services offered"],
  "service_areas": ["cities/towns served"],
  "hours": "business hours if found",
  "licensing": "any licensing or certifications mentioned"
}

Website text:
${textContent}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return res.status(200).json({
        success: false,
        error: "Could not analyze the website.",
      });
    }

    const data = await response.json();
    const rawText = data.content[0].text;

    // Parse the JSON response
    try {
      const extracted = JSON.parse(rawText);
      return res.status(200).json({ success: true, data: extracted });
    } catch {
      return res.status(200).json({
        success: false,
        error: "Could not parse website data.",
      });
    }
  } catch (err) {
    console.error("Scan website error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
