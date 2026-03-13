// Vercel serverless function — scans a website URL and extracts business info via Claude
// Allow up to 60s for thorough website scanning + Claude extraction
export const maxDuration = 60;

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

    // Fetch the website content (30s timeout for thorough scan)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let html;
    try {
      const siteRes = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

    // Strip scripts, styles, nav, footer, and HTML tags to get text content
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16000); // More text for comprehensive extraction

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
        max_tokens: 2048,
        system:
          "You are an expert at extracting comprehensive business information from website text. Return ONLY valid JSON with no markdown fences. Be thorough — extract every service, every area, every detail you can find. Leave fields as empty string or empty array only if truly not found.",
        messages: [
          {
            role: "user",
            content: `Thoroughly extract ALL business info from this website text. Be comprehensive — list every service mentioned, every city/town, all hours, all certifications. Return JSON with these fields:
{
  "name": "business name",
  "industry": "HVAC|electrical|plumbing|landscaping|roofing|cleaning|other",
  "services": ["every service offered - be thorough, include sub-services"],
  "service_areas": ["every city, town, and region mentioned"],
  "hours": "business hours - include per-day if available",
  "licensing": "all licensing, certifications, insurance, memberships mentioned",
  "phone": "main phone number if found",
  "email": "business email if found",
  "description": "1-2 sentence summary of the business"
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
