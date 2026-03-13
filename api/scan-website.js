// Vercel serverless function — scans a website URL and extracts business info via Claude
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

    // Fetch the website content (10s timeout — fail fast)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let html;
    try {
      const siteRes = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!siteRes.ok) {
        console.error("Website fetch failed:", siteRes.status, url);
        return res.status(200).json({
          success: false,
          error: `Website returned ${siteRes.status}. We'll gather the info from you directly.`,
        });
      }

      html = await siteRes.text();
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error("Website fetch error:", fetchErr.name, fetchErr.message, url);
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
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);

    // If content is too short, it's probably a bot challenge page or empty shell
    if (textContent.length < 50) {
      console.warn("Website content too short after stripping:", textContent.length, url);
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
      const errText = await response.text();
      console.error("Claude API error during scan:", response.status, errText);
      return res.status(200).json({
        success: false,
        error: "Could not analyze the website.",
      });
    }

    const data = await response.json();
    const rawText = data.content[0].text;

    // Parse the JSON response — try to extract JSON even if wrapped in markdown
    try {
      let jsonStr = rawText;
      const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1];
      const extracted = JSON.parse(jsonStr.trim());
      return res.status(200).json({ success: true, data: extracted });
    } catch {
      console.error("Failed to parse Claude extraction:", rawText.slice(0, 200));
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
