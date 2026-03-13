// Vercel serverless function — scans a website URL and extracts business info via Claude
export const config = { maxDuration: 60 };

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

async function fetchWithRetry(url, timeoutMs = 8000) {
  for (const ua of USER_AGENTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "identity",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const html = await res.text();
        if (html.length > 500) return html; // got real content
      }
    } catch {
      clearTimeout(timeout);
    }
  }
  return null;
}

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

    // Try fetching the main page
    let html = await fetchWithRetry(url);

    // If main page failed, try common subpages for more content
    if (!html) {
      const base = url.replace(/\/$/, "");
      for (const path of ["/about", "/services", "/about-us"]) {
        html = await fetchWithRetry(base + path);
        if (html) break;
      }
    }

    if (!html) {
      return res.status(200).json({
        success: false,
        error: "Could not reach the website.",
      });
    }

    // Strip scripts, styles, nav, footer, and HTML tags to get text content
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#\d+;/gi, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);

    if (textContent.length < 50) {
      return res.status(200).json({
        success: false,
        error: "Website didn't return enough content to analyze.",
      });
    }

    // Ask Claude to extract business info (using Haiku for speed)
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:
          "Extract business info from website text. Return ONLY valid JSON, no markdown fences.",
        messages: [
          {
            role: "user",
            content: `Extract business info from this website. Return JSON:
{
  "name": "business name",
  "industry": "HVAC|electrical|plumbing|landscaping|roofing|cleaning|other",
  "services": ["all services offered"],
  "service_areas": ["cities and towns mentioned"],
  "hours": "business hours if found",
  "licensing": "licenses, certifications mentioned",
  "phone": "phone number",
  "email": "email",
  "description": "1-2 sentence summary"
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

    try {
      let jsonStr = rawText;
      const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1];
      const extracted = JSON.parse(jsonStr.trim());
      return res.status(200).json({ success: true, data: extracted });
    } catch {
      return res.status(200).json({
        success: false,
        error: "Could not parse website data.",
      });
    }
  } catch (err) {
    console.error("Scan website error:", err);
    return res.status(200).json({
      success: false,
      error: "Something went wrong during the scan.",
    });
  }
}
