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

PHASE TRACKING — include this at the very end of EVERY message (hidden from user flow but used for UI):
At the end of each message, on a new line, add: [PHASE:X] where X is:
0 = collecting business basics (questions 1–9)
1 = phone setup (questions 10–13)
2 = call handling (questions 14–17)
3 = call types and priorities (questions 18–24)
4 = after the call (questions 25–29)
5 = complete

INFORMATION TO COLLECT — work through ALL of these naturally:

SECTION 1 — BUSINESS BASICS (phase 0):
Q1. Business name
Q2. Website URL — ask so you can look it up for context
Q3. Industry / trade — HVAC, electrical, plumbing, landscaping, roofing, cleaning, or other
Q4. All services they offer — get a complete list, probe if vague ("anything else?")
Q5. Residential, commercial, or both
Q6. Service areas — all cities and towns they cover
Q7. Areas they specifically do NOT serve — important for the AI to know
Q8. Business hours — ask per day or weekly pattern
Q9. Any licensing or certifications worth mentioning on calls (e.g. gas-certified, Red Seal, fully licensed)

SECTION 2 — PHONE SETUP (phase 1):
Q10. New dedicated number OR divert their existing number
Q11. If diverting — who is their carrier? (Rogers, Bell, Telus, Lucky Mobile, Fido, Koodo, Shaw, other) — this determines the exact call forwarding setup steps
Q12. If diverting — how many seconds should their phone ring before Aria picks up? 0 = straight to Aria, or 30 / 60 / 120 seconds
Q13. Outside business hours — is there an emergency number callers should be given? (e.g. on-call tech number)

SECTION 3 — CALL HANDLING (phase 2):
Q14. Any words, phrases, or promises Aria should never make — e.g. never mention specific prices, never promise same-day
Q15. Free quotes or paid assessments?
Q16. Quotes over the phone or in person only?
Q17. What should Aria say when someone pushes for a price on the spot? (or leave blank and we'll write it)

SECTION 4 — CALL TYPES & PRIORITIES (phase 3):
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

Q18. What are the most common reasons people call them? Get a full list.
Q19. Which of those are urgent — need a callback the same day, drop everything?
Q20. Which calls can wait until next business day?
Q21. Are there any calls Aria should NEVER try to handle — just take a name and number and pass it on?
Q22. Are there calls where Aria should collect extra detail? (e.g. for a quote — home type, sq footage, fuel source). Get specifics.
Q23. When someone's angry or complaining — what tone should Aria take? Any specific guidance?
Q24. What should Aria say when someone asks for a price on the spot? (if they didn't already answer in Q17)

SECTION 5 — AFTER THE CALL (phase 4):
Q25. Who should receive email notifications after calls? Get all email addresses.
Q26. Should ALL calls trigger an email, or only high priority ones?
Q27. Calls under 5 seconds — hangups, wrong numbers, dead air — spreadsheet only, or skip entirely?
Q28. Is there anything specific they always want captured from every call? E.g. how they heard about the business, property type, job size.
Q29. Should Aria ask every caller how they heard about the business?

COMPLETION:
When you have collected ALL of the above, say something warm like:
"That's everything I need — great work. The Serenium team will have your AI receptionist built and ready within 24 hours. You'll get an email when it's live."

Then on a new line output exactly:
[COMPLETE]
{...json...}

Use this exact JSON structure:
{
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
"Hey — welcome to Serenium AI. I'm going to walk you through a quick setup so we can build your AI receptionist. Shouldn't take more than 10–12 minutes. Let's start simple — what's the name of your business?"

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

// Strip [PHASE:X] and [COMPLETE] markers from display text
function stripMarkers(text) {
  return text
    .replace(/\[PHASE:\d\]/g, "")
    .replace(/\[COMPLETE\]/g, "")
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
    // Find matching closing brace
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SereniumOnboarding() {
  const [messages, setMessages] = useState([]); // {role, content, displayContent}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [complete, setComplete] = useState(false);
  const [collectedData, setCollectedData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [started, setStarted] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState("prompt");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const conversationRef = useRef([]);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const initConversation = async () => {
    setLoading(true);
    setStarted(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: "__init__" }],
        }),
      });
      const data = await res.json();
      const raw = data.content[0].text;
      const display = stripMarkers(raw);
      conversationRef.current = [
        { role: "user", content: "__init__" },
        { role: "assistant", content: raw },
      ];
      setMessages([{ role: "assistant", display }]);
    } catch {
      const fallback = "Hey — welcome to Serenium AI. I'm going to walk you through a quick setup so we can build your AI receptionist. Shouldn't take more than 10–12 minutes. Let's start simple — what's the name of your business?";
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

    // Add user message to display
    setMessages((prev) => [...prev, { role: "user", display: userText }]);
    conversationRef.current.push({ role: "user", content: userText });
    setLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: conversationRef.current.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      const raw = data.content[0].text;

      // Check for completion
      const jsonData = extractComplete(raw);
      if (jsonData) {
        setCollectedData(jsonData);
        setComplete(true);
        generatePrompt(jsonData);
        const completionMsg = stripMarkers(raw.split("[COMPLETE]")[0]);
        conversationRef.current.push({ role: "assistant", content: raw });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", display: completionMsg || "That's everything we need. Your setup is complete." },
        ]);
      } else {
        // Extract phase
        const detectedPhase = extractPhase(raw);
        if (detectedPhase !== null) setPhase(detectedPhase);
        const display = stripMarkers(raw);
        conversationRef.current.push({ role: "assistant", content: raw });
        setMessages((prev) => [...prev, { role: "assistant", display }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", display: "Sorry — something went wrong. Please try again." },
      ]);
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

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(collectedData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const generatePrompt = async (jsonData) => {
    setGeneratingPrompt(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: PROMPT_GENERATION_SYSTEM,
          messages: [{
            role: "user",
            content: `REFERENCE PROMPT (the gold standard structure to follow):\n\n${HVAC_REFERENCE_PROMPT}\n\n---\n\nNEW BUSINESS ONBOARDING DATA:\n\n${JSON.stringify(jsonData, null, 2)}\n\nWrite the complete Retell agent prompt for this business now.`,
          }],
        }),
      });
      const data = await res.json();
      const prompt = data.content[0].text;
      setGeneratedPrompt(prompt);

      // Fire to n8n — write to Google Sheet
      await fetch("https://serenium.app.n8n.cloud/webhook/serenium-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...jsonData,
          generated_prompt: prompt,
        }),
      });
    } catch {
      setGeneratedPrompt("Error generating prompt — please try again or contact the Serenium team.");
    }
    setGeneratingPrompt(false);
  };

  const progressPct = complete ? 100 : Math.round((phase / 5) * 100);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070B10",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Barlow', Helvetica, Arial, sans-serif",
      color: "#E5E7EB",
    }}>

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(7,11,16,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #111827",
        padding: "0 20px",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {/* Top row */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 0 10px",
          }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "3.5px",
                textTransform: "uppercase", color: "#2563EB", marginBottom: 2,
              }}>SERENIUM AI</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#9CA3AF" }}>
                Receptionist Setup
              </div>
            </div>
            <div style={{
              background: complete ? "#052E16" : "#0F172A",
              border: `1px solid ${complete ? "#22C55E" : "#1E2733"}`,
              borderRadius: 20, padding: "5px 12px",
              fontSize: 11, fontWeight: 700, letterSpacing: "1.5px",
              color: complete ? "#22C55E" : "#6B7280",
              textTransform: "uppercase",
            }}>
              {complete ? "✓ Complete" : `${progressPct}%`}
            </div>
          </div>

          {/* Progress bar + phase labels */}
          <div style={{ paddingBottom: 14 }}>
            {/* Phase labels row */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              {PHASES.map((p, i) => (
                <div key={i} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  flex: 1,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: complete ? "#14532D" : i < phase ? "#1D4ED8" : i === phase ? "linear-gradient(135deg,#1D4ED8,#3B82F6)" : "#0D1117",
                    border: `2px solid ${complete ? "#22C55E" : i <= phase ? "#3B82F6" : "#1E2733"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13,
                    transition: "all 0.4s ease",
                    boxShadow: i === phase && !complete ? "0 0 10px rgba(59,130,246,0.4)" : "none",
                  }}>
                    {complete || i < phase
                      ? <span style={{ fontSize: 11, color: complete ? "#22C55E" : "#fff" }}>✓</span>
                      : <span style={{ fontSize: 11 }}>{p.icon}</span>}
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: complete ? "#22C55E" : i <= phase ? "#3B82F6" : "#374151",
                    transition: "color 0.3s",
                    whiteSpace: "nowrap",
                  }}>{p.label}</div>
                </div>
              ))}
            </div>

            {/* Bar track */}
            <div style={{
              height: 6, background: "#111827", borderRadius: 6,
              overflow: "hidden", position: "relative",
            }}>
              <div style={{
                height: "100%",
                width: `${progressPct}%`,
                background: complete
                  ? "linear-gradient(90deg, #16A34A, #22C55E)"
                  : "linear-gradient(90deg, #1D4ED8, #60A5FA)",
                borderRadius: 6,
                transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
                boxShadow: complete ? "0 0 8px rgba(34,197,94,0.4)" : "0 0 8px rgba(59,130,246,0.3)",
              }} />
            </div>

            {/* Percentage label */}
            <div style={{
              textAlign: "right", marginTop: 5,
              fontSize: 11, fontWeight: 700, letterSpacing: "1px",
              color: complete ? "#22C55E" : "#3B82F6",
            }}>
              {complete ? "COMPLETE" : `${progressPct}% COMPLETE`}
            </div>
          </div>
        </div>
      </header>

      {/* ── MESSAGES ── */}
      <main style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 16px 120px",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>

          {/* Intro card — shown before first message */}
          {messages.length === 0 && (
            <div style={{
              background: "#0D1117",
              border: "1px solid #1E2733",
              borderRadius: 16, padding: "28px 28px",
              marginBottom: 24, textAlign: "center",
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
                margin: "0 auto 16px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
              }}>S</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#F9FAFB", marginBottom: 8 }}>
                Welcome to Serenium AI
              </div>
              <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
                Answer a few questions and we'll have your AI receptionist built and live within 24 hours.
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 16,
              animation: "fadeSlideIn 0.25s ease forwards",
            }}>
              {m.role === "assistant" && (
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, color: "#fff",
                  marginRight: 10, flexShrink: 0, marginTop: 2,
                  letterSpacing: 0,
                }}>S</div>
              )}
              <div style={{
                maxWidth: "80%",
                background: m.role === "user"
                  ? "linear-gradient(135deg, #1D4ED8, #2563EB)"
                  : "#0D1117",
                border: m.role === "user" ? "none" : "1px solid #1E2733",
                color: "#E5E7EB",
                padding: "13px 18px",
                borderRadius: m.role === "user"
                  ? "18px 18px 4px 18px"
                  : "18px 18px 18px 4px",
                fontSize: 15,
                lineHeight: 1.6,
                fontWeight: 400,
                whiteSpace: "pre-wrap",
              }}>
                {m.display}
              </div>
              {m.role === "user" && (
                <div style={{ width: 32, marginLeft: 10, flexShrink: 0 }} />
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{
              display: "flex", justifyContent: "flex-start",
              marginBottom: 16, animation: "fadeSlideIn 0.2s ease forwards",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, #1D4ED8, #3B82F6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: "#fff",
                marginRight: 10, flexShrink: 0,
              }}>S</div>
              <div style={{
                background: "#0D1117",
                border: "1px solid #1E2733",
                padding: "14px 18px",
                borderRadius: "18px 18px 18px 4px",
                display: "flex", gap: 5, alignItems: "center",
              }}>
                {[0, 1, 2].map((j) => (
                  <div key={j} style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: "#3B82F6",
                    animation: `typingDot 1.3s ease-in-out ${j * 0.22}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* ── COMPLETION CARD ── */}
          {complete && collectedData && (
            <div style={{
              background: "#0D1117",
              border: "1px solid #166534",
              borderRadius: 16, padding: 24,
              marginTop: 8,
              animation: "fadeSlideIn 0.4s ease forwards",
            }}>
              {/* Header */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 16,
              }}>
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "#22C55E",
                    letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 4,
                  }}>Setup Complete</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#F9FAFB" }}>
                    {collectedData.business?.name || "Your Business"}
                  </div>
                </div>
                {/* Copy button — context-aware */}
                {activeTab === "json" ? (
                  <button onClick={copyJSON} style={{
                    background: copied ? "#14532D" : "#111827",
                    border: `1px solid ${copied ? "#22C55E" : "#1E2733"}`,
                    borderRadius: 8, padding: "8px 16px",
                    color: copied ? "#22C55E" : "#9CA3AF",
                    fontSize: 12, fontWeight: 700,
                    cursor: "pointer", letterSpacing: "1px",
                    textTransform: "uppercase", transition: "all 0.2s",
                  }}>
                    {copied ? "Copied ✓" : "Copy JSON"}
                  </button>
                ) : (
                  <button onClick={copyPrompt} disabled={generatingPrompt || !generatedPrompt} style={{
                    background: copiedPrompt ? "#14532D" : generatingPrompt ? "#0A1628" : "#111827",
                    border: `1px solid ${copiedPrompt ? "#22C55E" : generatingPrompt ? "#1E3A5F" : "#1E2733"}`,
                    borderRadius: 8, padding: "8px 16px",
                    color: copiedPrompt ? "#22C55E" : generatingPrompt ? "#3B82F6" : "#9CA3AF",
                    fontSize: 12, fontWeight: 700,
                    cursor: generatingPrompt || !generatedPrompt ? "default" : "pointer",
                    letterSpacing: "1px", textTransform: "uppercase", transition: "all 0.2s",
                  }}>
                    {copiedPrompt ? "Copied ✓" : generatingPrompt ? "Generating…" : "Copy Prompt"}
                  </button>
                )}
              </div>

              {/* Summary pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Industry", val: collectedData.business?.industry },
                  { label: "Areas", val: collectedData.business?.service_areas?.join(", ") },
                  { label: "Phone", val: collectedData.phone_setup?.type === "new" ? "New number" : "Divert existing" },
                  { label: "Emails", val: collectedData.after_call?.notification_emails?.join(", ") },
                ].filter((s) => s.val).map((s, i) => (
                  <div key={i} style={{
                    background: "#111827", border: "1px solid #1E2733",
                    borderRadius: 8, padding: "5px 12px", fontSize: 12,
                  }}>
                    <span style={{ color: "#6B7280", fontWeight: 600 }}>{s.label}: </span>
                    <span style={{ color: "#D1D5DB", fontWeight: 500 }}>{s.val}</span>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[
                  { id: "prompt", label: "Generated Prompt" },
                  { id: "json", label: "Raw JSON" },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    background: activeTab === tab.id ? "#1D4ED8" : "#111827",
                    border: `1px solid ${activeTab === tab.id ? "#3B82F6" : "#1E2733"}`,
                    borderRadius: 8, padding: "6px 14px",
                    color: activeTab === tab.id ? "#fff" : "#6B7280",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    letterSpacing: "0.5px", transition: "all 0.2s",
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{
                background: "#070B10", border: "1px solid #111827",
                borderRadius: 8, padding: 14,
                maxHeight: 340, overflow: "auto",
              }}>
                {activeTab === "json" ? (
                  <pre style={{
                    fontSize: 11, color: "#4B5563", margin: 0,
                    lineHeight: 1.7, fontFamily: "'Courier New', monospace",
                  }}>
                    {JSON.stringify(collectedData, null, 2)}
                  </pre>
                ) : generatingPrompt ? (
                  <div style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "40px 20px", gap: 14,
                  }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[0,1,2].map(j => (
                        <div key={j} style={{
                          width: 8, height: 8, borderRadius: "50%", background: "#3B82F6",
                          animation: `typingDot 1.3s ease-in-out ${j * 0.22}s infinite`,
                        }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600, letterSpacing: "1px" }}>
                      BUILDING YOUR PROMPT…
                    </div>
                  </div>
                ) : generatedPrompt ? (
                  <pre style={{
                    fontSize: 12, color: "#9CA3AF", margin: 0,
                    lineHeight: 1.8, fontFamily: "'Courier New', monospace",
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {generatedPrompt}
                  </pre>
                ) : (
                  <div style={{ fontSize: 12, color: "#4B5563", padding: "20px", textAlign: "center" }}>
                    Prompt generation failed. Use Copy JSON and contact the Serenium team.
                  </div>
                )}
              </div>

              {/* Footer note */}
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: "#0A1628", border: "1px solid #1E3A5F",
                borderRadius: 8, fontSize: 13, color: "#60A5FA", lineHeight: 1.5,
              }}>
                📬 The Serenium team will have your AI receptionist live within 24 hours. Check your inbox for next steps.
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── INPUT ── */}
      {!complete && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(7,11,16,0.97)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid #111827",
          padding: "12px 16px 16px",
          zIndex: 20,
        }}>
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
                disabled={loading}
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
                  opacity: loading ? 0.5 : 1,
                }}
                onFocus={(e) => e.target.style.borderColor = "#2563EB"}
                onBlur={(e) => e.target.style.borderColor = "#1E2733"}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  background: input.trim() && !loading
                    ? "linear-gradient(135deg, #1D4ED8, #2563EB)"
                    : "#0D1117",
                  border: `1px solid ${input.trim() && !loading ? "transparent" : "#1E2733"}`,
                  borderRadius: 14,
                  width: 50, height: 50,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: input.trim() && !loading ? "pointer" : "default",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke={input.trim() && !loading ? "#fff" : "#374151"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() && !loading ? "#fff" : "#374151"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div style={{
              textAlign: "center", fontSize: 11, color: "#1F2937",
              marginTop: 8, fontWeight: 500, letterSpacing: "0.5px",
            }}>
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
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1E2733; border-radius: 2px; }
        textarea::placeholder { color: #374151; }
      `}</style>
    </div>
  );
}
