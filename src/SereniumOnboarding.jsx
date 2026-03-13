import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — The brain of the onboarding conversation
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Serenium AI onboarding assistant. Your job is to collect everything needed to build a custom AI voice receptionist for a trades or home services business. You are warm, sharp, and efficient. You make this feel like a conversation with a knowledgeable person, not a form.

CORE RULES — NEVER BREAK THESE:
- Ask EXACTLY ONE question per message. Never two.
- Keep messages to 1–3 sentences max.
- Once you have a piece of information, never ask for it again.
- Confirm important answers naturally and briefly before moving on. E.g. "Got it — so you cover Calgary and Cochrane but not Canmore."
- Use the business name naturally once you have it.
- Never number your questions out loud.
- Be warm but efficient. This should take 10–12 minutes.

PROBING RULES — ENFORCE THESE STRICTLY:
- If an answer is vague, thin, or one-word where detail is needed — ALWAYS probe deeper before moving on. Do not accept a vague answer and just move on.
- Examples of probing:
  - If they say "we do HVAC" → ask "What specific services? Installs, repairs, maintenance, duct cleaning — give me the full list."
  - If they say "Calgary area" → ask "Which specific towns and cities? We need the exact list so the AI knows the boundaries."
  - If they say "normal business hours" → ask "What exactly are your hours? Monday to Friday 8-5? Open Saturdays?"
  - If they say "yeah we do quotes" → ask "Free quotes or paid assessments? And do you quote over the phone or in-person only?"
  - If they list 2 services but their industry typically has more → ask "Anything else? Most [industry] businesses also offer [examples]. Want me to include any of those?"
- Never accept "I don't know" for critical fields like service areas or business hours. Gently push: "Even a rough answer helps — we can always adjust later."
- For call priorities: if they don't naturally distinguish urgency levels, suggest examples from their industry and ask them to confirm or adjust.

PHASE TRACKING — include this at the very end of EVERY message (hidden from user flow but used for UI):
At the end of each message, on a new line, add: [PHASE:X] where X is:
0 = collecting contact info and business basics (questions 1–11)
1 = phone setup (questions 12–15)
2 = call handling (questions 16–19)
3 = call types and priorities (questions 20–26)
4 = after the call (questions 27–31)
5 = complete

INFORMATION TO COLLECT — work through ALL of these naturally:

SECTION 0 — CONTACT & BUSINESS BASICS (phase 0):
Q1. Contact name — "What's your name?" (first name is fine)
Q2. Email address — "And what's the best email to reach you at?" — IMPORTANT: validate it looks like a real email. If it doesn't have an @ sign, ask again.
→ After collecting name + email, output on a new line: [PARTIAL_CAPTURE]{"contact_name":"...","contact_email":"..."}
Q3. Business name
Q4. Website URL — ask so the AI can learn about their business. Say something like "Got a website? If you share the link I can pull some info automatically and save us some time."
→ After they provide a URL, output on a new line: [SCAN_URL:the-url-here]
→ If they say no website, skip and continue.
→ If website data comes back (the next user message will include it prefixed with [WEBSITE_DATA:...]), use it to pre-fill what you can and confirm with the client. Give a warm, excited summary of what you found — mention the business name, the services you spotted, service areas if found, and any other details. Then ask something like "Does that sound about right?" or "That match up with what you do?" to confirm it's accurate. Make them feel like the scan was worth it. If anything looks thin or missing, note what you still need to ask about.
Q5. Industry / trade — HVAC, electrical, plumbing, landscaping, roofing, cleaning, or other
Q6. All services they offer — get a COMPLETE list, probe if vague ("anything else? most [trade] businesses also offer [examples]")
Q7. Residential, commercial, or both
Q8. Service areas — ALL cities and towns they cover. Do not accept "local area" — get specifics.
Q9. Areas they specifically do NOT serve — important for the AI to know
Q10. Business hours — ask per day or weekly pattern. Do not accept "normal hours" — get specifics.
Q11. Any licensing or certifications worth mentioning on calls (e.g. gas-certified, Red Seal, fully licensed)

SECTION 1 — PHONE SETUP (phase 1):
Q12. New dedicated number OR divert their existing number
Q13. If diverting — who is their carrier? (Rogers, Bell, Telus, Lucky Mobile, Fido, Koodo, Shaw, other) — this determines the exact call forwarding setup steps
Q14. If diverting — how many seconds should their phone ring before Aria picks up? 0 = straight to Aria, or 30 / 60 / 120 seconds
Q15. Outside business hours — is there an emergency number callers should be given? (e.g. on-call tech number)

SECTION 2 — CALL HANDLING (phase 2):
Q16. Any words, phrases, or promises Aria should never make — e.g. never mention specific prices, never promise same-day
Q17. Free quotes or paid assessments?
Q18. Quotes over the phone or in person only?
Q19. What should Aria say when someone pushes for a price on the spot? (or leave blank and we'll write it)

SECTION 3 — CALL TYPES & PRIORITIES (phase 3):
This is the most important section. Adapt your questions based on their industry.

For HVAC businesses:
- Emergency (highest urgency): no heat, system failure, gas smell, boiler out
- High priority: missed appointment, complaint about recent work, warranty claim
- Medium priority: system not performing, new system quote
- Low priority: annual maintenance, general enquiry

For Electrical businesses:
- Emergency: power out, sparks, burning smell, tripped breaker won't reset
- High priority: missed appointment, safety hazard, complaint
- Medium priority: panel upgrade quote, fault finding, EV charger install
- Low priority: general enquiry, minor additions

For Plumbing businesses:
- Emergency: burst pipe, flooding, sewage backup, no water
- High priority: no hot water, missed appointment, warranty claim
- Medium priority: leak repair quote, bathroom renovation
- Low priority: general maintenance, general enquiry

For Landscaping businesses:
- High priority: missed appointment, complaint
- Medium priority: new project quote, seasonal cleanup
- Low priority: general enquiry, pricing question

For Roofing businesses:
- Emergency: active leak, storm damage
- High priority: missed appointment, insurance claim support, warranty
- Medium priority: inspection quote, new roof quote
- Low priority: general enquiry

For other trades: ask them directly what their urgent vs normal calls look like.

Q20. What are the most common reasons people call them? Get a FULL list — probe if they only give 2-3.
Q21. Which of those are urgent — need a callback the same day, drop everything?
Q22. Which calls can wait until next business day?
Q23. Are there any calls Aria should NEVER try to handle — just take a name and number and pass it on?
Q24. Are there calls where Aria should collect extra detail? (e.g. for a quote — home type, sq footage, fuel source). Get specifics.
Q25. When someone's angry or complaining — what tone should Aria take? Any specific guidance?
Q26. What should Aria say when someone asks for a price on the spot? (if they didn't already answer in Q19)

SECTION 4 — AFTER THE CALL (phase 4):
Q27. Who should receive email notifications after calls? Get ALL email addresses.
Q28. Should ALL calls trigger an email, or only high priority ones?
Q29. Calls under 5 seconds — hangups, wrong numbers, dead air — spreadsheet only, or skip entirely?
Q30. Is there anything specific they always want captured from every call? E.g. how they heard about the business, property type, job size.
Q31. Should Aria ask every caller how they heard about the business?

COMPLETION:
When you have collected ALL of the above, say something warm like:
"That's everything I need — great work. The Serenium team will have your AI receptionist built and ready within 24 hours. You'll get an email when it's live."

Then on a new line output exactly:
[COMPLETE]
{...json...}

Use this exact JSON structure:
{
  "contact_name": "",
  "contact_email": "",
  "business": {
    "name": "",
    "website": "",
    "industry": "",
    "services": [],
    "serves": "residential|commercial|both",
    "service_areas": [],
    "excluded_areas": [],
    "hours": {
      "monday": "", "tuesday": "", "wednesday": "", "thursday": "",
      "friday": "", "saturday": "", "sunday": ""
    },
    "licensing": ""
  },
  "phone_setup": {
    "type": "new|divert",
    "carrier": "",
    "ring_before_pickup_seconds": 0,
    "after_hours_emergency_number": ""
  },
  "call_handling": {
    "never_say": [],
    "quote_type": "free|paid",
    "quote_method": "phone|in_person",
    "price_objection_script": "",
    "angry_caller_guidance": ""
  },
  "call_types": {
    "common_calls": [],
    "emergency_triggers": [],
    "high_priority": [],
    "medium_priority": [],
    "low_priority": [],
    "never_handle_just_message": [],
    "extra_detail_per_type": {}
  },
  "after_call": {
    "notification_emails": [],
    "email_trigger": "all|high_only",
    "short_call_handling": "spreadsheet|skip",
    "always_capture": [],
    "track_referral_source": false
  }
}

START the conversation with:
"Hey — welcome to Serenium AI. I'm going to walk you through a quick setup so we can build your AI receptionist. Shouldn't take more than 10–12 minutes. Let's start with you — what's your name?"

Do not add [PHASE:0] to the very first message since it won't have been rendered yet. Start [PHASE:X] tracking from the second message onwards.`;

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT GENERATION — System prompt used to generate the Retell agent prompt
// ─────────────────────────────────────────────────────────────────────────────
const PROMPT_GENERATION_SYSTEM = `You are an expert AI voice agent prompt writer for Serenium AI. Your job is to take a business's onboarding data and write a complete, production-ready Retell AI agent prompt for their custom AI receptionist.

You will be given:
1. A reference prompt (the Serenium HVAC example — the gold standard)
2. The new business's onboarding JSON data

Your job is to write a NEW prompt that:
- Follows the exact same structure and quality as the reference prompt
- Replaces all HVAC-specific content with the new business's industry, services, call types, and priorities
- Generates NATURAL, INTELLIGENT call paths based on their common call types and priority levels
- Writes smart gathering questions appropriate for their industry (not copy-pasted from HVAC)
- Uses their exact business name, service areas, hours, and licensing where needed
- Applies their never_say rules, quote policy, and angry caller guidance
- Keeps the Retell runtime variables EXACTLY as written: [[user_number]] — never change these
- Keeps inline references to ADDRESS RULE and CALLBACK RULE blocks
- Names the agent "Aria" unless a different name was specified
- Sounds natural, sharp, and industry-aware — not generic

CALL PATH RULES:
- Generate one path per distinct call type they described
- Label paths alphabetically: PATH A, PATH B, PATH C etc.
- Put emergency/highest urgency first (PATH A), then high priority, then medium, then low
- If they have no emergency call type, start with their highest priority
- Step 2 routing block must list all trigger phrases for each path
- Each path must have: an opening line, a list of things to gather (in order), and a close line
- Gathering questions must be SPECIFIC to their industry — not generic placeholders

PRIORITY MAPPING (for Step 2 routing):
- emergency_triggers → PATH A (if exists)
- high_priority → next paths
- medium_priority → next paths
- low_priority → last paths

OUTPUT:
Return ONLY the complete prompt text. No preamble. No explanation. No markdown fences. Start directly with "Identity" and end with the last objection handling line.`;

const HVAC_REFERENCE_PROMPT = `Identity
You are Aria, the AI receptionist for {{company_name}}. {{company_name}} serves {{service_areas}}. You answer every call so no lead or customer is ever missed.
You are not a script-reader. You are a sharp, warm receptionist who understands the trade. You are an AI. If anyone asks, confirm it openly and warmly.

Style Guardrails
Be concise: Keep every response to 1-2 sentences unless explaining something important.
Be conversational: Use contractions. Use natural language. Sound like a real person who genuinely wants to help.
Be calm: No matter how stressed or angry a caller is, your tone stays steady, warm, and grounded.
Be one-question-at-a-time: Never ask two questions in a single response. One question. Listen. Then the next.
Use the caller's name naturally: Once you have their name, use it occasionally — not on every sentence, just where it feels natural. Never overdo it.
Speak numbers correctly: Speak phone numbers as individual digits with a natural pause.
Caller's number: The caller is calling from [[user_number]]. If they say "this one" or "the one I'm calling from", confirm [[user_number]] digit by digit and record it as their callback number.
Speak times correctly: Say "eight AM" not "8:00 AM". Handle hold: If a caller says "hold on" or "just a minute", reply exactly: NO_RESPONSE_NEEDED

CALLBACK RULE — use this every time you ask for a callback number:
Ask: "Is this the best number to reach you on?" If yes, confirm [[user_number]] digit by digit. If no, collect the new number and read it back digit by digit to confirm.

ADDRESS RULE — use this every time you collect an address:
Always collect the full address including street number, street name, AND city or town. If the caller gives a street address without a city or town, always ask: "And which city or town is that in?" Do not assume. Do not skip this step.

Response Guidelines
Never give prices. Ever. Not a range, not a ballpark, not "it depends." The team gives accurate quotes after seeing the job — no charge for the quote.
Never promise arrival times or specific callback times. You can promise the team will get back to them — never give a time window.
Never say "Great question." Never say "Absolutely!" as a filler. Say something real instead.
If a caller is outside the service area, tell them honestly and warmly.
Always confirm the callback number out loud digit by digit before ending the call.
Always close every call with a clear next step — the team will call them back.

Task
Your job on every call is to identify what the caller needs and collect the right information for the team to act without asking anything twice.

Step 1. Greet the caller.
Say: "Thanks for calling [Company]! I'm Aria, an AI assistant — just so you know this call is being recorded. Who am I speaking with today?" Wait for their name, then say: "Hey [name], how can I help you today?"

Step 2. Identify the call type and move into the right path.
[Call type routing goes here]

Step 3. Follow the correct path below.
[Call paths go here]

Step 4. Close every single call with these four things in order.
First — confirm the callback number digit by digit.
Second — ask: "Is there anything else you'd like me to pass on to the team?" Acknowledge if they add something.
Third — tell them the team will be in touch.
Fourth — end with a genuine, warm goodbye that fits the call. Not a script. Something real.

Objection Handling
If asked if you are an AI: "Yes — I'm an AI assistant with [Company]. Everything I take down goes straight to the team and someone will call you back personally."
If they insist on speaking to a human: "The team isn't available to take calls right now — they're out on jobs. But someone will call you back directly."
If the caller is angry: Lower your pace. Acknowledge the specific situation. Collect the details and get the team involved. Never argue. Never defend.
If the caller won't give details: "Completely understand — even just a first name and a number is enough for the team to reach you."
If the line is bad: "I'm really sorry — I'm having trouble hearing you clearly. Could you say that one more time?"
If the caller says hold on or one second: Reply exactly: NO_RESPONSE_NEEDED`;

// ─────────────────────────────────────────────────────────────────────────────
// PHASE CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const PHASES = [
  { label: "Business", icon: "🏢" },
  { label: "Phone", icon: "📞" },
  { label: "Handling", icon: "🗣️" },
  { label: "Call Types", icon: "📋" },
  { label: "Reporting", icon: "📊" },
];

// Strip [PHASE:X], [COMPLETE], [PARTIAL_CAPTURE], and [SCAN_URL] markers from display text
function stripMarkers(text) {
  return text
    .replace(/\[PHASE:\d\]/g, "")
    .replace(/\[COMPLETE\]/g, "")
    .replace(/\[PARTIAL_CAPTURE\]\{[^}]*\}/g, "")
    .replace(/\[SCAN_URL:[^\]]*\]/g, "")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

function extractPhase(text) {
  const match = text.match(/\[PHASE:(\d)\]/);
  return match ? parseInt(match[1]) : null;
}

function extractComplete(text) {
  if (!text.includes("[COMPLETE]")) return null;
  const jsonStart = text.indexOf("{", text.indexOf("[COMPLETE]"));
  if (jsonStart === -1) return null;
  try {
    let depth = 0;
    let end = jsonStart;
    for (let i = jsonStart; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") depth--;
      if (depth === 0) { end = i; break; }
    }
    return JSON.parse(text.slice(jsonStart, end + 1));
  } catch {
    return null;
  }
}

function extractPartialCapture(text) {
  const match = text.match(/\[PARTIAL_CAPTURE\](\{[^}]*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractScanUrl(text) {
  const match = text.match(/\[SCAN_URL:([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

// Detect if user's message is a website URL (client-side, avoids a round-trip to Claude)
function looksLikeUrl(text) {
  const trimmed = text.trim();
  return /^(https?:\/\/)?[\w.-]+\.\w{2,}(\/\S*)?$/i.test(trimmed);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SereniumOnboarding() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [complete, setComplete] = useState(false);
  const [collectedData, setCollectedData] = useState(null);
  const [started, setStarted] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanCountdown, setScanCountdown] = useState(0);
  const [scanStep, setScanStep] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const conversationRef = useRef([]);
  const partialFiredRef = useRef(false);
  const scanTimerRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Call server-side Claude API (with 25s timeout) ──
  const callClaude = async (msgs, maxTokens = 1024) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: msgs,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      if (!data.content || !data.content[0] || !data.content[0].text) {
        console.error("Unexpected Claude response:", JSON.stringify(data));
        throw new Error("Invalid response from Claude");
      }
      return data.content[0].text;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  // ── Fire partial data to n8n (name + email only) ──
  const firePartialToWebhook = async (partialData) => {
    if (partialFiredRef.current) return;
    partialFiredRef.current = true;
    try {
      await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partial: true,
          contact_name: partialData.contact_name || "",
          contact_email: partialData.contact_email || "",
        }),
      });
    } catch (err) {
      console.error("Failed to fire partial webhook:", err);
    }
  };

  // ── Scan website URL (pure data — caller manages scanning state) ──
  const scanWebsite = async (url) => {
    try {
      let normalizedUrl = url;
      if (!normalizedUrl.startsWith("http")) {
        normalizedUrl = "https://" + normalizedUrl;
      }

      const res = await fetch("/api/scan-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const result = await res.json();

      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch {
      return null;
    }
  };

  const initConversation = async () => {
    setLoading(true);
    setStarted(true);
    try {
      const raw = await callClaude([{ role: "user", content: "__init__" }]);
      const display = stripMarkers(raw);
      conversationRef.current = [
        { role: "user", content: "__init__" },
        { role: "assistant", content: raw },
      ];
      setMessages([{ role: "assistant", display }]);
    } catch (err) {
      console.error("initConversation error:", err);
      const fallback =
        "Hey — welcome to Serenium AI. I'm going to walk you through a quick setup so we can build your AI receptionist. Shouldn't take more than 10–12 minutes. Let's start with you — what's your name?";
      conversationRef.current = [
        { role: "user", content: "__init__" },
        { role: "assistant", content: fallback },
      ];
      setMessages([{ role: "assistant", display: fallback }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || complete) return;
    const userText = input.trim();
    setInput("");

    setMessages((prev) => [...prev, { role: "user", display: userText }]);
    conversationRef.current.push({ role: "user", content: userText });
    setLoading(true);

    try {
      // ── Fast path: if user sent a URL, skip the Claude round-trip and scan directly ──
      const clientDetectedUrl = looksLikeUrl(userText);

      let raw = null;
      let scanUrl = null;

      if (clientDetectedUrl) {
        // We know it's a URL — go straight to scanning
        scanUrl = userText.trim();
        if (!scanUrl.startsWith("http")) scanUrl = "https://" + scanUrl;
      } else {
        raw = await callClaude(
          conversationRef.current.map((m) => ({ role: m.role, content: m.content }))
        );

        // Check for partial capture (name + email)
        const partialData = extractPartialCapture(raw);
        if (partialData) {
          firePartialToWebhook(partialData);
        }

        // Check for website scan request from Claude
        scanUrl = extractScanUrl(raw);
      }

      // Check for completion
      const jsonData = raw ? extractComplete(raw) : null;

      if (jsonData) {
        setCollectedData(jsonData);
        setComplete(true);
        generateAndSubmit(jsonData);
        const completionMsg = stripMarkers(raw.split("[COMPLETE]")[0]);
        conversationRef.current.push({ role: "assistant", content: raw });
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            display: completionMsg || "That's everything we need. Your setup is complete.",
          },
        ]);
      } else if (scanUrl) {
        // Show pre-scan message FIRST, then start scanning
        if (raw) {
          // Claude provided a response — use it
          const detectedPhase = extractPhase(raw);
          if (detectedPhase !== null) setPhase(detectedPhase);
          const display = stripMarkers(raw);
          conversationRef.current.push({ role: "assistant", content: raw });
          setMessages((prev) => [...prev, { role: "assistant", display }]);
        } else {
          // Client-detected URL — show our own pre-scan message
          const preScanMsg = "Great — let me scan your website and pull what I can.";
          conversationRef.current.push({ role: "assistant", content: preScanMsg + "\n[SCAN_URL:" + scanUrl + "]\n[PHASE:0]" });
          setMessages((prev) => [...prev, { role: "assistant", display: preScanMsg }]);
        }

        // Start scanning with exciting 20s countdown
        setLoading(false);
        setScanning(true);
        setScanCountdown(20);
        setScanStep(0);

        let count = 20;
        scanTimerRef.current = setInterval(() => {
          count--;
          setScanCountdown(count);
          if (count <= 17 && count > 13) setScanStep(1);
          else if (count <= 13 && count > 8) setScanStep(2);
          else if (count <= 8 && count > 3) setScanStep(3);
          else if (count <= 3) setScanStep(4);
          if (count <= 0) {
            clearInterval(scanTimerRef.current);
          }
        }, 1000);

        // Scan website in parallel with countdown
        let websiteData = null;
        try {
          websiteData = await scanWebsite(scanUrl);
        } catch (err) {
          console.error("Scan failed:", err);
        }

        // Wait for countdown to finish if scan returned early
        if (count > 0) {
          await new Promise((resolve) => {
            const check = setInterval(() => {
              if (count <= 0) { clearInterval(check); resolve(); }
            }, 500);
            setTimeout(() => { clearInterval(check); resolve(); }, 25000);
          });
        }

        // Clear scanning state
        clearInterval(scanTimerRef.current);
        setScanCountdown(0);
        setScanStep(0);
        setScanning(false);
        setLoading(true);

        if (websiteData) {
          const dataMsg = `[WEBSITE_DATA: ${JSON.stringify(websiteData)}]`;
          conversationRef.current.push({ role: "user", content: dataMsg });

          try {
            const followUp = await callClaude(
              conversationRef.current.map((m) => ({ role: m.role, content: m.content }))
            );
            const followUpPhase = extractPhase(followUp);
            if (followUpPhase !== null) setPhase(followUpPhase);
            const followUpDisplay = stripMarkers(followUp);
            conversationRef.current.push({ role: "assistant", content: followUp });
            setMessages((prev) => [...prev, { role: "assistant", display: followUpDisplay }]);
          } catch (err) {
            console.error("Follow-up Claude call failed:", err);
            const fallback = "I checked out your website but had trouble loading the details. No worries — I'll just ask you directly. What industry or trade is your business in?";
            conversationRef.current.push({ role: "assistant", content: fallback + "\n[PHASE:0]" });
            setMessages((prev) => [...prev, { role: "assistant", display: fallback }]);
          }
        } else {
          // Scan failed — continue gracefully
          const failMsg = `[WEBSITE_DATA: SCAN_FAILED - could not retrieve data from ${scanUrl}. Continue collecting info by asking the user directly.]`;
          conversationRef.current.push({ role: "user", content: failMsg });

          try {
            const followUp = await callClaude(
              conversationRef.current.map((m) => ({ role: m.role, content: m.content }))
            );
            const followUpPhase = extractPhase(followUp);
            if (followUpPhase !== null) setPhase(followUpPhase);
            const followUpDisplay = stripMarkers(followUp);
            conversationRef.current.push({ role: "assistant", content: followUp });
            setMessages((prev) => [...prev, { role: "assistant", display: followUpDisplay }]);
          } catch {
            const fallback = "I wasn't able to pull info from your website, but that's okay — we'll get everything we need right here. What industry or trade is your business in?";
            conversationRef.current.push({ role: "assistant", content: fallback + "\n[PHASE:0]" });
            setMessages((prev) => [...prev, { role: "assistant", display: fallback }]);
          }
        }
      } else {
        const detectedPhase = extractPhase(raw);
        if (detectedPhase !== null) setPhase(detectedPhase);
        const display = stripMarkers(raw);
        conversationRef.current.push({ role: "assistant", content: raw });
        setMessages((prev) => [...prev, { role: "assistant", display }]);
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      // Remove the orphaned user message from conversation history to prevent
      // consecutive user messages which would break the Claude API
      if (
        conversationRef.current.length > 0 &&
        conversationRef.current[conversationRef.current.length - 1].role === "user"
      ) {
        conversationRef.current.pop();
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", display: "Sorry — something went wrong. Please try again." },
      ]);
      setScanning(false);
      clearInterval(scanTimerRef.current);
      setScanCountdown(0);
      setScanStep(0);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Generate prompt server-side and fire everything to n8n + Google Sheet
  // Client never sees the prompt — it's internal for the Serenium team
  const generateAndSubmit = async (jsonData) => {
    try {
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: PROMPT_GENERATION_SYSTEM,
          referencePrompt: HVAC_REFERENCE_PROMPT,
          onboardingData: jsonData,
        }),
      });

      let prompt = "";
      if (res.ok) {
        const data = await res.json();
        prompt = data.content[0].text;
      }

      // Fire full data + generated prompt to n8n → Google Sheet + email
      await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partial: false,
          contact_name: jsonData.contact_name || "",
          contact_email: jsonData.contact_email || "",
          business: jsonData.business,
          phone_setup: jsonData.phone_setup,
          call_handling: jsonData.call_handling,
          call_types: jsonData.call_types,
          after_call: jsonData.after_call,
          generated_prompt: prompt,
        }),
      });
    } catch (err) {
      console.error("Submit failed:", err);
    }
  };

  const progressPct = complete ? 100 : Math.round((phase / 5) * 100);

  // ── Theme system ──
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("serenium-theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("serenium-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const t = darkMode
    ? {
        bg: "#06080C",
        bgSurface: "#0C1017",
        bgElevated: "#111620",
        bgInput: "#0C1017",
        border: "rgba(255,255,255,0.06)",
        borderFocus: "#3B82F6",
        text: "#F1F5F9",
        textSecondary: "#94A3B8",
        textMuted: "#475569",
        accent: "#3B82F6",
        accentGlow: "rgba(59,130,246,0.15)",
        accentGradient: "linear-gradient(135deg, #2563EB, #3B82F6)",
        userBubble: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
        userBubbleBorder: "rgba(59,130,246,0.3)",
        aiBubble: "rgba(255,255,255,0.03)",
        aiBubbleBorder: "rgba(255,255,255,0.06)",
        headerBg: "rgba(6,8,12,0.92)",
        inputBarBg: "rgba(6,8,12,0.95)",
        success: "#22C55E",
        successBg: "rgba(34,197,94,0.08)",
        successBorder: "rgba(34,197,94,0.2)",
        scrollThumb: "rgba(255,255,255,0.08)",
        placeholder: "#334155",
        shadow: "0 -1px 24px rgba(0,0,0,0.5)",
      }
    : {
        bg: "#F8FAFC",
        bgSurface: "#FFFFFF",
        bgElevated: "#F1F5F9",
        bgInput: "#FFFFFF",
        border: "rgba(0,0,0,0.08)",
        borderFocus: "#2563EB",
        text: "#0F172A",
        textSecondary: "#475569",
        textMuted: "#94A3B8",
        accent: "#2563EB",
        accentGlow: "rgba(37,99,235,0.08)",
        accentGradient: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
        userBubble: "linear-gradient(135deg, #2563EB, #3B82F6)",
        userBubbleBorder: "rgba(37,99,235,0.2)",
        aiBubble: "#FFFFFF",
        aiBubbleBorder: "rgba(0,0,0,0.08)",
        headerBg: "rgba(248,250,252,0.92)",
        inputBarBg: "rgba(248,250,252,0.95)",
        success: "#16A34A",
        successBg: "rgba(22,163,74,0.06)",
        successBorder: "rgba(22,163,74,0.15)",
        scrollThumb: "rgba(0,0,0,0.1)",
        placeholder: "#94A3B8",
        shadow: "0 -1px 24px rgba(0,0,0,0.06)",
      };

  const canSend = input.trim() && !loading && !scanning;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: t.text,
        transition: "background 0.3s ease, color 0.3s ease",
      }}
    >
      {/* ── HEADER ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: t.headerBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${t.border}`,
          padding: "0 20px",
          transition: "background 0.3s ease, border-color 0.3s ease",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {/* Top row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 0 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Logo mark */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: t.accentGradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 2px 8px ${t.accentGlow}`,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="rgba(255,255,255,0.9)" />
                  <path d="M2 17L12 22L22 17" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: t.text,
                    letterSpacing: "-0.3px",
                    lineHeight: 1.2,
                  }}
                >
                  Serenium AI
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, marginTop: 1 }}>
                  Receptionist Setup
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Theme toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                aria-label="Toggle theme"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: t.bgElevated,
                  border: `1px solid ${t.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  color: t.textSecondary,
                  fontSize: 16,
                  padding: 0,
                }}
              >
                {darkMode ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              {/* Progress pill */}
              <div
                style={{
                  background: complete ? t.successBg : t.accentGlow,
                  border: `1px solid ${complete ? t.successBorder : "rgba(59,130,246,0.15)"}`,
                  borderRadius: 20,
                  padding: "5px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: complete ? t.success : t.accent,
                  letterSpacing: "-0.2px",
                  transition: "all 0.3s ease",
                }}
              >
                {complete ? "Complete" : `${progressPct}%`}
              </div>
            </div>
          </div>

          {/* Progress stepper */}
          <div style={{ paddingBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
              {PHASES.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: complete
                          ? t.success
                          : i < phase
                            ? t.accent
                            : i === phase
                              ? t.accentGradient
                              : t.bgElevated,
                        border: `2px solid ${
                          complete ? t.success : i <= phase ? t.accent : t.border
                        }`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.4s ease",
                        boxShadow:
                          i === phase && !complete
                            ? `0 0 0 4px ${t.accentGlow}`
                            : "none",
                      }}
                    >
                      {complete || i < phase ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={complete ? "#fff" : "#fff"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 600, color: i === phase ? "#fff" : t.textMuted }}>
                          {i + 1}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: complete ? t.success : i <= phase ? t.accent : t.textMuted,
                        marginTop: 4,
                        whiteSpace: "nowrap",
                        transition: "color 0.3s ease",
                        letterSpacing: "-0.2px",
                      }}
                    >
                      {p.label}
                    </div>
                  </div>
                  {/* Connector line */}
                  {i < PHASES.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        marginBottom: 18,
                        marginLeft: 4,
                        marginRight: 4,
                        borderRadius: 1,
                        background:
                          complete || i < phase
                            ? complete ? t.success : t.accent
                            : t.border,
                        transition: "background 0.4s ease",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Bar track */}
            <div
              style={{
                height: 3,
                background: t.bgElevated,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: complete ? t.success : t.accentGradient,
                  borderRadius: 3,
                  transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ── MESSAGES ── */}
      <main style={{ flex: 1, overflowY: "auto", padding: "28px 16px 140px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {/* Intro card */}
          {messages.length === 0 && (
            <div
              style={{
                background: t.bgSurface,
                border: `1px solid ${t.border}`,
                borderRadius: 20,
                padding: "40px 32px",
                marginBottom: 28,
                textAlign: "center",
                transition: "all 0.3s ease",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: t.accentGradient,
                  margin: "0 auto 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 4px 16px ${t.accentGlow}`,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="rgba(255,255,255,0.9)" />
                  <path d="M2 17L12 22L22 17" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
                  <path d="M2 12L12 17L22 12" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.text, marginBottom: 8, letterSpacing: "-0.5px" }}>
                Welcome to Serenium AI
              </div>
              <div style={{ fontSize: 15, color: t.textSecondary, lineHeight: 1.7, maxWidth: 380, margin: "0 auto" }}>
                Answer a few questions and we'll have your AI receptionist built and live within 24 hours.
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 20,
                animation: "fadeSlideIn 0.3s ease forwards",
                opacity: 0,
              }}
            >
              {m.role === "assistant" && (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: t.accentGradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                    flexShrink: 0,
                    marginTop: 2,
                    boxShadow: `0 2px 8px ${t.accentGlow}`,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="rgba(255,255,255,0.9)" />
                    <path d="M2 12L12 17L22 12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              <div
                style={{
                  maxWidth: "78%",
                  background: m.role === "user" ? t.userBubble : t.aiBubble,
                  border: m.role === "user" ? `1px solid ${t.userBubbleBorder}` : `1px solid ${t.aiBubbleBorder}`,
                  color: m.role === "user" ? "#FFFFFF" : t.text,
                  padding: "14px 20px",
                  borderRadius: m.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                  fontSize: 15,
                  lineHeight: 1.65,
                  fontWeight: 400,
                  whiteSpace: "pre-wrap",
                  letterSpacing: "-0.1px",
                  boxShadow: m.role === "user"
                    ? `0 2px 12px rgba(37,99,235,0.15)`
                    : darkMode ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
                  transition: "background 0.3s ease, border-color 0.3s ease",
                }}
              >
                {m.display}
              </div>
              {m.role === "user" && <div style={{ width: 34, marginLeft: 12, flexShrink: 0 }} />}
            </div>
          ))}

          {/* Typing indicator (non-scanning) */}
          {loading && !scanning && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                marginBottom: 20,
                animation: "fadeSlideIn 0.2s ease forwards",
                opacity: 0,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: t.accentGradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                  flexShrink: 0,
                  boxShadow: `0 2px 8px ${t.accentGlow}`,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="rgba(255,255,255,0.9)" />
                  <path d="M2 12L12 17L22 12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div
                style={{
                  background: t.aiBubble,
                  border: `1px solid ${t.aiBubbleBorder}`,
                  padding: "16px 20px",
                  borderRadius: "20px 20px 20px 4px",
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {[0, 1, 2].map((j) => (
                  <div
                    key={j}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: t.accent,
                      animation: `typingDot 1.3s ease-in-out ${j * 0.22}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Scanning UI — exciting countdown experience */}
          {scanning && (
            <div
              style={{
                animation: "fadeSlideIn 0.3s ease forwards",
                opacity: 0,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background: t.bgSurface,
                  border: `1px solid ${t.aiBubbleBorder}`,
                  borderRadius: 20,
                  padding: "28px 24px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Animated background pulse */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `radial-gradient(circle at 50% 50%, ${t.accentGlow} 0%, transparent 70%)`,
                    animation: "scanPulse 2s ease-in-out infinite",
                  }}
                />

                {/* Countdown number */}
                <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: 56,
                      fontWeight: 800,
                      background: t.accentGradient,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      lineHeight: 1,
                      marginBottom: 6,
                      fontVariantNumeric: "tabular-nums",
                      animation: scanCountdown <= 5 ? "countdownUrgent 0.5s ease-in-out infinite" : "none",
                    }}
                  >
                    {scanCountdown}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      color: t.accent,
                      marginBottom: 20,
                    }}
                  >
                    Scanning your website
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      height: 4,
                      background: t.border,
                      borderRadius: 4,
                      overflow: "hidden",
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${((20 - scanCountdown) / 20) * 100}%`,
                        background: t.accentGradient,
                        borderRadius: 4,
                        transition: "width 1s linear",
                        boxShadow: `0 0 12px ${t.accentGlow}`,
                      }}
                    />
                  </div>

                  {/* Step checklist */}
                  <div style={{ textAlign: "left", maxWidth: 280, margin: "0 auto" }}>
                    {[
                      { label: "Connecting to site", step: 0 },
                      { label: "Reading pages", step: 1 },
                      { label: "Extracting business info", step: 2 },
                      { label: "Analyzing services", step: 3 },
                      { label: "Building your profile", step: 4 },
                    ].map((item) => {
                      const isDone = scanStep > item.step;
                      const isActive = scanStep === item.step;
                      return (
                        <div
                          key={item.step}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 10,
                            opacity: isDone ? 1 : isActive ? 1 : 0.3,
                            transition: "opacity 0.4s ease",
                          }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: isDone
                                ? t.successBg
                                : isActive
                                  ? t.accent
                                  : t.bgElevated,
                              border: `2px solid ${isDone ? t.success : isActive ? t.accent : t.border}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              flexShrink: 0,
                              transition: "all 0.3s ease",
                              boxShadow: isActive ? `0 0 8px ${t.accentGlow}` : "none",
                            }}
                          >
                            {isDone ? (
                              <span style={{ color: t.success, fontSize: 10 }}>✓</span>
                            ) : isActive ? (
                              <div
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: "#fff",
                                  animation: "typingDot 1s ease-in-out infinite",
                                }}
                              />
                            ) : null}
                          </div>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: isDone ? 600 : isActive ? 600 : 400,
                              color: isDone ? t.success : isActive ? t.text : t.textMuted,
                              transition: "color 0.3s ease",
                            }}
                          >
                            {item.label}
                            {isActive && (
                              <span style={{ color: t.accent, marginLeft: 4 }}>…</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── COMPLETION CARD ── */}
          {complete && collectedData && (
            <div
              style={{
                background: t.bgSurface,
                border: `1px solid ${t.successBorder}`,
                borderRadius: 20,
                padding: "40px 32px",
                marginTop: 8,
                textAlign: "center",
                animation: "fadeSlideIn 0.5s ease forwards",
                opacity: 0,
                transition: "all 0.3s ease",
              }}
            >
              {/* Success icon */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: t.successBg,
                  border: `2px solid ${t.successBorder}`,
                  margin: "0 auto 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards",
                  opacity: 0,
                  transform: "scale(0.5)",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: t.success,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Setup Complete
              </div>

              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: t.text,
                  marginBottom: 12,
                  letterSpacing: "-0.5px",
                }}
              >
                {collectedData.business?.name || "Your Business"}
              </div>

              <div
                style={{
                  fontSize: 15,
                  color: t.textSecondary,
                  lineHeight: 1.7,
                  maxWidth: 420,
                  margin: "0 auto 28px",
                }}
              >
                We've got everything we need. The Serenium team is now building your
                custom AI receptionist — you'll receive an email
                at <strong style={{ color: t.text }}>{collectedData.contact_email || "your email"}</strong> when
                it's live.
              </div>

              {/* What happens next */}
              <div
                style={{
                  background: t.bgElevated,
                  border: `1px solid ${t.border}`,
                  borderRadius: 16,
                  padding: "24px 28px",
                  textAlign: "left",
                  marginBottom: 20,
                  transition: "all 0.3s ease",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.textMuted,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    marginBottom: 20,
                  }}
                >
                  What happens next
                </div>
                {[
                  { step: "1", text: "Our team reviews your setup details" },
                  { step: "2", text: "We build and test your custom AI receptionist" },
                  { step: "3", text: "You get an email with your number and go-live instructions" },
                ].map((item, idx) => (
                  <div
                    key={item.step}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 16,
                      marginBottom: idx < 2 ? 18 : 0,
                      animation: `fadeSlideIn 0.4s ease ${0.3 + idx * 0.15}s forwards`,
                      opacity: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: t.accentGradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {item.step}
                    </div>
                    <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6, paddingTop: 4 }}>
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "14px 20px",
                  background: t.accentGlow,
                  border: `1px solid rgba(59,130,246,0.1)`,
                  borderRadius: 12,
                  fontSize: 13,
                  color: t.accent,
                  lineHeight: 1.6,
                  fontWeight: 500,
                  transition: "all 0.3s ease",
                }}
              >
                Typical turnaround is under 24 hours. Questions? Reach us at{" "}
                <strong>contact@sereniumai.com</strong>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── INPUT ── */}
      {!complete && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: t.inputBarBg,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: `1px solid ${t.border}`,
            padding: "14px 16px 20px",
            zIndex: 20,
            boxShadow: t.shadow,
            transition: "all 0.3s ease",
          }}
        >
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-end",
                background: t.bgInput,
                border: `1px solid ${t.border}`,
                borderRadius: 16,
                padding: "6px 6px 6px 18px",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
              className="input-container"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKey}
                placeholder="Type your answer..."
                rows={1}
                disabled={loading || scanning}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  padding: "10px 0",
                  color: t.text,
                  fontSize: 15,
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                  resize: "none",
                  outline: "none",
                  lineHeight: 1.5,
                  overflowY: "hidden",
                  opacity: loading || scanning ? 0.4 : 1,
                  transition: "opacity 0.2s ease",
                  letterSpacing: "-0.1px",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!canSend}
                style={{
                  background: canSend ? t.accentGradient : t.bgElevated,
                  border: "none",
                  borderRadius: 12,
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: canSend ? "pointer" : "default",
                  transition: "all 0.2s ease",
                  flexShrink: 0,
                  boxShadow: canSend ? `0 2px 8px ${t.accentGlow}` : "none",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12L3 21L21 12L3 3L5 12ZM5 12H13" stroke={canSend ? "#fff" : t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                color: t.textMuted,
                marginTop: 10,
                fontWeight: 400,
                letterSpacing: "0.2px",
                opacity: 0.6,
              }}
            >
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes typingDot {
          0%, 100% { opacity: 0.2; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes scanPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes countdownUrgent {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .input-container:focus-within {
          border-color: ${t.borderFocus} !important;
          box-shadow: 0 0 0 3px ${t.accentGlow} !important;
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }
        textarea::placeholder { color: ${t.placeholder}; }
        @media (max-width: 640px) {
          .input-container { border-radius: 14px !important; }
        }
      `}</style>
    </div>
  );
}
