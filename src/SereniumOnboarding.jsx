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
→ If website data comes back (the next user message will include it prefixed with [WEBSITE_DATA:...]), use it to pre-fill what you can and confirm with the client: "I pulled some info from your site — [business name], looks like you offer [services]. That right? Anything to add or change?"
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

  // ── Call server-side Claude API ──
  const callClaude = async (msgs, maxTokens = 1024) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: SYSTEM_PROMPT,
        messages: msgs,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.content[0].text;
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
      const raw = await callClaude(
        conversationRef.current.map((m) => ({ role: m.role, content: m.content }))
      );

      // Check for partial capture (name + email)
      const partialData = extractPartialCapture(raw);
      if (partialData) {
        firePartialToWebhook(partialData);
      }

      // Check for website scan request
      const scanUrl = extractScanUrl(raw);

      // Check for completion
      const jsonData = extractComplete(raw);

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
        // Website scan requested — DON'T show Claude's message yet, scan first
        conversationRef.current.push({ role: "assistant", content: raw });

        // Start scanning with countdown
        setLoading(false);
        setScanning(true);
        setScanCountdown(30);
        scanTimerRef.current = setInterval(() => {
          setScanCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(scanTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        const websiteData = await scanWebsite(scanUrl);

        // Stop countdown
        clearInterval(scanTimerRef.current);
        setScanCountdown(0);

        if (websiteData) {
          // Inject website data and get Claude's response incorporating it
          const dataMsg = `[WEBSITE_DATA: ${JSON.stringify(websiteData)}]`;
          conversationRef.current.push({ role: "user", content: dataMsg });

          const followUp = await callClaude(
            conversationRef.current.map((m) => ({ role: m.role, content: m.content }))
          );
          const followUpPhase = extractPhase(followUp);
          if (followUpPhase !== null) setPhase(followUpPhase);
          const followUpDisplay = stripMarkers(followUp);
          conversationRef.current.push({ role: "assistant", content: followUp });
          setMessages((prev) => [...prev, { role: "assistant", display: followUpDisplay }]);
        } else {
          // Scan failed — show Claude's original message (which asked for the URL)
          const detectedPhase = extractPhase(raw);
          if (detectedPhase !== null) setPhase(detectedPhase);
          const display = stripMarkers(raw);
          setMessages((prev) => [...prev, { role: "assistant", display }]);
        }
        setScanning(false);
      } else {
        const detectedPhase = extractPhase(raw);
        if (detectedPhase !== null) setPhase(detectedPhase);
        const display = stripMarkers(raw);
        conversationRef.current.push({ role: "assistant", content: raw });
        setMessages((prev) => [...prev, { role: "assistant", display }]);
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", display: "Sorry — something went wrong. Please try again." },
      ]);
      setScanning(false);
      clearInterval(scanTimerRef.current);
      setScanCountdown(0);
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#070B10",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Barlow', Helvetica, Arial, sans-serif",
        color: "#E5E7EB",
      }}
    >
      {/* ── HEADER ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(7,11,16,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #111827",
          padding: "0 20px",
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {/* Top row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 0 10px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "3.5px",
                  textTransform: "uppercase",
                  color: "#2563EB",
                  marginBottom: 2,
                }}
              >
                SERENIUM AI
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#9CA3AF" }}>
                Receptionist Setup
              </div>
            </div>
            <div
              style={{
                background: complete ? "#052E16" : "#0F172A",
                border: `1px solid ${complete ? "#22C55E" : "#1E2733"}`,
                borderRadius: 20,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "1.5px",
                color: complete ? "#22C55E" : "#6B7280",
                textTransform: "uppercase",
              }}
            >
              {complete ? "✓ Complete" : `${progressPct}%`}
            </div>
          </div>

          {/* Progress bar + phase labels */}
          <div style={{ paddingBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              {PHASES.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: complete
                        ? "#14532D"
                        : i < phase
                          ? "#1D4ED8"
                          : i === phase
                            ? "linear-gradient(135deg,#1D4ED8,#3B82F6)"
                            : "#0D1117",
                      border: `2px solid ${complete ? "#22C55E" : i <= phase ? "#3B82F6" : "#1E2733"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      transition: "all 0.4s ease",
                      boxShadow:
                        i === phase && !complete ? "0 0 10px rgba(59,130,246,0.4)" : "none",
                    }}
                  >
                    {complete || i < phase ? (
                      <span style={{ fontSize: 11, color: complete ? "#22C55E" : "#fff" }}>
                        ✓
                      </span>
                    ) : (
                      <span style={{ fontSize: 11 }}>{p.icon}</span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: complete ? "#22C55E" : i <= phase ? "#3B82F6" : "#374151",
                      transition: "color 0.3s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Bar track */}
            <div
              style={{
                height: 6,
                background: "#111827",
                borderRadius: 6,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: complete
                    ? "linear-gradient(90deg, #16A34A, #22C55E)"
                    : "linear-gradient(90deg, #1D4ED8, #60A5FA)",
                  borderRadius: 6,
                  transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
                  boxShadow: complete
                    ? "0 0 8px rgba(34,197,94,0.4)"
                    : "0 0 8px rgba(59,130,246,0.3)",
                }}
              />
            </div>

            <div
              style={{
                textAlign: "right",
                marginTop: 5,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "1px",
                color: complete ? "#22C55E" : "#3B82F6",
              }}
            >
              {complete ? "COMPLETE" : `${progressPct}% COMPLETE`}
            </div>
          </div>
        </div>
      </header>

      {/* ── MESSAGES ── */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 16px 120px",
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {/* Intro card */}
          {messages.length === 0 && (
            <div
              style={{
                background: "#0D1117",
                border: "1px solid #1E2733",
                borderRadius: 16,
                padding: "28px 28px",
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
                  margin: "0 auto 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                S
              </div>
              <div
                style={{ fontSize: 18, fontWeight: 700, color: "#F9FAFB", marginBottom: 8 }}
              >
                Welcome to Serenium AI
              </div>
              <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
                Answer a few questions and we'll have your AI receptionist built and live
                within 24 hours.
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
                marginBottom: 16,
                animation: "fadeSlideIn 0.25s ease forwards",
              }}
            >
              {m.role === "assistant" && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#fff",
                    marginRight: 10,
                    flexShrink: 0,
                    marginTop: 2,
                    letterSpacing: 0,
                  }}
                >
                  S
                </div>
              )}
              <div
                style={{
                  maxWidth: "80%",
                  background:
                    m.role === "user"
                      ? "linear-gradient(135deg, #1D4ED8, #2563EB)"
                      : "#0D1117",
                  border: m.role === "user" ? "none" : "1px solid #1E2733",
                  color: "#E5E7EB",
                  padding: "13px 18px",
                  borderRadius:
                    m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  fontSize: 15,
                  lineHeight: 1.6,
                  fontWeight: 400,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.display}
              </div>
              {m.role === "user" && (
                <div style={{ width: 32, marginLeft: 10, flexShrink: 0 }} />
              )}
            </div>
          ))}

          {/* Typing / scanning indicator */}
          {(loading || scanning) && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                marginBottom: 16,
                animation: "fadeSlideIn 0.2s ease forwards",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#fff",
                  marginRight: 10,
                  flexShrink: 0,
                }}
              >
                S
              </div>
              <div
                style={{
                  background: "#0D1117",
                  border: "1px solid #1E2733",
                  padding: "14px 18px",
                  borderRadius: "18px 18px 18px 4px",
                  display: "flex",
                  gap: 5,
                  alignItems: "center",
                }}
              >
                {scanning ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: "3px solid #1E2733",
                        borderTopColor: "#3B82F6",
                        animation: "spin 1s linear infinite",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      {scanCountdown > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#3B82F6",
                            position: "absolute",
                          }}
                        >
                          {scanCountdown}
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, color: "#E5E7EB", fontWeight: 600 }}>
                        Scanning your website
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                        {scanCountdown > 20
                          ? "Fetching pages…"
                          : scanCountdown > 10
                            ? "Extracting business details…"
                            : scanCountdown > 0
                              ? "Almost done…"
                              : "Wrapping up…"}
                      </div>
                    </div>
                  </div>
                ) : (
                  [0, 1, 2].map((j) => (
                    <div
                      key={j}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#3B82F6",
                        animation: `typingDot 1.3s ease-in-out ${j * 0.22}s infinite`,
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── COMPLETION CARD ── */}
          {complete && collectedData && (
            <div
              style={{
                background: "#0D1117",
                border: "1px solid #166534",
                borderRadius: 16,
                padding: "32px 28px",
                marginTop: 8,
                textAlign: "center",
                animation: "fadeSlideIn 0.4s ease forwards",
              }}
            >
              {/* Success icon */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #14532D, #166534)",
                  border: "2px solid #22C55E",
                  margin: "0 auto 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                <span style={{ color: "#22C55E" }}>&#10003;</span>
              </div>

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#22C55E",
                  letterSpacing: "2.5px",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Setup Complete
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#F9FAFB",
                  marginBottom: 8,
                }}
              >
                {collectedData.business?.name || "Your Business"}
              </div>

              <div
                style={{
                  fontSize: 15,
                  color: "#9CA3AF",
                  lineHeight: 1.7,
                  marginBottom: 24,
                  maxWidth: 440,
                  margin: "0 auto 24px",
                }}
              >
                We've got everything we need. The Serenium team is now building your
                custom AI receptionist — you'll receive an email
                at <strong style={{ color: "#E5E7EB" }}>{collectedData.contact_email || "your email"}</strong> when
                it's live.
              </div>

              {/* What happens next */}
              <div
                style={{
                  background: "#070B10",
                  border: "1px solid #111827",
                  borderRadius: 12,
                  padding: "20px 24px",
                  textAlign: "left",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#6B7280",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    marginBottom: 16,
                  }}
                >
                  What happens next
                </div>
                {[
                  { step: "1", text: "Our team reviews your setup details" },
                  { step: "2", text: "We build and test your custom AI receptionist" },
                  { step: "3", text: "You get an email with your number and go-live instructions" },
                ].map((item) => (
                  <div
                    key={item.step}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "#1D4ED8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {item.step}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#D1D5DB",
                        lineHeight: 1.5,
                        paddingTop: 2,
                      }}
                    >
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "12px 16px",
                  background: "#0A1628",
                  border: "1px solid #1E3A5F",
                  borderRadius: 10,
                  fontSize: 13,
                  color: "#60A5FA",
                  lineHeight: 1.6,
                }}
              >
                Typical turnaround is under 24 hours. Questions? Reach us
                at <strong>contact@sereniumai.com</strong>
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
            background: "rgba(7,11,16,0.97)",
            backdropFilter: "blur(12px)",
            borderTop: "1px solid #111827",
            padding: "12px 16px 16px",
            zIndex: 20,
          }}
        >
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKey}
                placeholder="Type your answer…"
                rows={1}
                disabled={loading || scanning}
                style={{
                  flex: 1,
                  background: "#0D1117",
                  border: "1px solid #1E2733",
                  borderRadius: 14,
                  padding: "13px 18px",
                  color: "#F9FAFB",
                  fontSize: 15,
                  fontFamily: "'Barlow', Helvetica, Arial, sans-serif",
                  resize: "none",
                  outline: "none",
                  lineHeight: 1.5,
                  overflowY: "hidden",
                  transition: "border-color 0.2s",
                  opacity: loading || scanning ? 0.5 : 1,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
                onBlur={(e) => (e.target.style.borderColor = "#1E2733")}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading || scanning}
                style={{
                  background:
                    input.trim() && !loading && !scanning
                      ? "linear-gradient(135deg, #1D4ED8, #2563EB)"
                      : "#0D1117",
                  border: `1px solid ${input.trim() && !loading && !scanning ? "transparent" : "#1E2733"}`,
                  borderRadius: 14,
                  width: 50,
                  height: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor:
                    input.trim() && !loading && !scanning ? "pointer" : "default",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22 2L11 13"
                    stroke={
                      input.trim() && !loading && !scanning ? "#fff" : "#374151"
                    }
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 2L15 22L11 13L2 9L22 2Z"
                    stroke={
                      input.trim() && !loading && !scanning ? "#fff" : "#374151"
                    }
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "#1F2937",
                marginTop: 8,
                fontWeight: 500,
                letterSpacing: "0.5px",
              }}
            >
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingDot {
          0%, 100% { opacity: 0.25; transform: scale(0.75); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1E2733; border-radius: 2px; }
        textarea::placeholder { color: #374151; }
      `}</style>
    </div>
  );
}
