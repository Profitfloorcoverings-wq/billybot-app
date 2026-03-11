import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/utils/supabase/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEED_DATA = [
  // PAIN POINTS
  {
    category: "pain_point",
    title: "Quote backlog",
    content: "Owner had 13 quotes waiting, said he won't get through them all. Common across domestic flooring. Delayed quotes = lost jobs to faster competitors. Current workaround: generic quote app, manual and slow. BillyBot: AI-assisted quote generation from natural conversation, drastically cuts time per quote.",
    tags: ["quoting", "time", "revenue"],
    priority: 9,
  },
  {
    category: "pain_point",
    title: "RAMS avoidance / losing work",
    content: "Owner has turned away jobs requiring RAMS because he doesn't do them and wouldn't know where to start. Common for domestic flooring businesses — literally turning away paying work. BillyBot: auto-generated RAMS from job details, zero effort, professional output.",
    tags: ["rams", "revenue", "compliance"],
    priority: 8,
  },
  {
    category: "pain_point",
    title: "Hand-drawn floor plans are slow",
    content: "Owner gives fitters hand-drawn floor plans alongside job sheets. Must take ages to draw carefully. Medium severity — time drain but they're used to it. BillyBot: AI floor plan analysis and generation from photos/measurements.",
    tags: ["floor-plans", "time", "fitters"],
    priority: 6,
  },
  {
    category: "pain_point",
    title: "Fear of being left behind",
    content: "Owner explicitly said 'the young boys will come in and take over' if he doesn't keep up. Knows AI is coming but doesn't understand how to use it. Existential anxiety about business survival. BillyBot: approachable AI built specifically for flooring, no tech skills needed.",
    tags: ["ai", "competition", "age", "fear"],
    priority: 9,
  },
  {
    category: "pain_point",
    title: "MTD compliance panic",
    content: "Making Tax Digital for Income Tax starts April 2026 (>£50k). Requires quarterly digital submissions + digital record-keeping. Paper receipts no longer acceptable. Points-based penalty system — miss a quarterly update, get a point. 4 points = £200 fine. Most flooring business owners either don't know about it yet or know it's coming but haven't acted. BillyBot: quotes + invoices already flow digitally, add receipt capture to close the full income/expense loop.",
    tags: ["mtd", "hmrc", "compliance", "receipts", "urgency"],
    priority: 10,
  },
  {
    category: "pain_point",
    title: "Shoebox of receipts / lost expense records",
    content: "Universal tradesperson problem. Paper receipts fade, get lost, pile up. Expenses never make it into the books accurately. Accountants charge more to sort through the mess. Lost tax deductions, MTD non-compliance. BillyBot: snap a photo → AI extracts supplier, amount, VAT, date, category → links to job → pushes to accounting software. One action, fully digital.",
    tags: ["receipts", "expenses", "accounting", "mtd"],
    priority: 8,
  },
  {
    category: "pain_point",
    title: "Stuck with outdated tools through inertia",
    content: "Uses a quote app he 'stumbled across when he first started out and just used ever since.' Uses Sage but doesn't quote in it. Cobbled-together stack of disconnected tools. BillyBot: all-in-one platform purpose-built for flooring.",
    tags: ["tools", "switching", "inertia"],
    priority: 5,
  },

  // MESSAGING ANGLES
  {
    category: "messaging_angle",
    title: "Built by a flooring business, for flooring businesses",
    content: "Founder credibility angle. 'I run a flooring business too.' Owner explicitly responded to the fact that the founder knows flooring inside out. Trust signal is massive — they're buying from one of their own, not a tech company. PROVEN: first meeting converted from FB ad → in-person demo. Founder credibility was the closer.",
    tags: ["founder", "credibility", "trust", "proven"],
    priority: 10,
  },
  {
    category: "messaging_angle",
    title: "13 quotes sitting there. Sound familiar?",
    content: "Quote backlog pain point — everyone has it. Universal problem. Both the prospect AND our business have it. Instant recognition. Works as FB ad hook or email subject line.",
    tags: ["quoting", "pain", "recognition"],
    priority: 8,
  },
  {
    category: "messaging_angle",
    title: "Stop turning away RAMS jobs",
    content: "'Last year, how many jobs did you turn down because they needed RAMS?' Turns a hidden cost (lost revenue from avoidance) into a visible one. Domestic fitters know they do this but don't quantify it.",
    tags: ["rams", "revenue", "hidden-cost"],
    priority: 8,
  },
  {
    category: "messaging_angle",
    title: "HMRC is going digital. Is your shoebox ready?",
    content: "Fear + urgency. MTD is coming, paper receipts won't fly. Regulatory deadline creates real urgency. Every tradesperson knows the shoebox problem. Combines fear of fines with relatable daily frustration.",
    tags: ["mtd", "urgency", "fear", "receipts"],
    priority: 9,
  },
  {
    category: "messaging_angle",
    title: "Snap a receipt. BillyBot does the rest.",
    content: "Simplicity angle on receipt capture. One action, massive payoff. No behaviour change beyond 'take a photo.' Relatable to anyone who's ever lost a receipt.",
    tags: ["simplicity", "receipts", "one-action"],
    priority: 7,
  },
  {
    category: "messaging_angle",
    title: "Every penny in and out — digital, linked to jobs, MTD-ready",
    content: "Completeness angle — income AND expenses covered. Positions BillyBot as the full loop, not just quoting software. Accounting software gets fed automatically from both sides.",
    tags: ["completeness", "mtd", "accounting"],
    priority: 7,
  },
  {
    category: "messaging_angle",
    title: "Less than your marketing guy",
    content: "'You're paying £500/mo for ads. For £249/mo, BillyBot does your quotes, RAMS, job sheets, and more.' Reframes price against something they already pay for. Makes BillyBot feel like a bargain.",
    tags: ["price", "value", "comparison"],
    priority: 7,
  },

  // OBJECTIONS
  {
    category: "objection",
    title: "Will it replace my staff?",
    content: "Fear/trust objection. Estimator asked directly. Counter: it can replace repetitive tasks, OR it can free your team up to do higher-level work. 'Your estimator stops doing data entry and starts doing more site visits and closing deals.' Frame as elevation, not replacement.",
    tags: ["staff", "fear", "estimator"],
    priority: 8,
  },
  {
    category: "objection",
    title: "My customers won't use AI",
    content: "Trust/misunderstanding objection. Counter: they don't need to. BillyBot is for YOU, not your customers. Customer relationship stays personal. AI stays behind the scenes. Demo the workflow — customer never sees AI directly.",
    tags: ["customers", "trust", "behind-scenes"],
    priority: 7,
  },
  {
    category: "objection",
    title: "I already use Sage / Xero / QuickBooks",
    content: "Switching cost/misunderstanding. Counter: we don't replace your accounting software — we feed it. BillyBot creates quotes, invoices, captures receipts, then pushes everything into Sage/Xero/QB. Less manual data entry, not more software.",
    tags: ["accounting", "integration", "sage", "xero"],
    priority: 7,
  },
  {
    category: "objection",
    title: "I'm too busy right now",
    content: "Timing objection. #1 field objection. Counter: 'That's exactly why you need it — you're too busy doing admin instead of fitting.' Reframe: busy = pain, BillyBot = painkiller. 'What if those 13 quotes were done by the time you got home tonight?'",
    tags: ["timing", "busy", "reframe"],
    priority: 9,
  },

  // DESIRES
  {
    category: "desire",
    title: "Make business better AND life easier",
    content: "Owner wants both — not one at the expense of the other. Less time on admin, more quotes out the door, not working evenings/weekends on paperwork. BillyBot handles the grunt work so the owner gets time back while output quality goes up.",
    tags: ["lifestyle", "efficiency", "time"],
    priority: 8,
  },
  {
    category: "desire",
    title: "Keep up with the times / not get left behind",
    content: "Fear that younger competitors will overtake them. Knows AI is coming but doesn't know how to adopt. Wants to feel modern, competitive. BillyBot: purpose-built AI for flooring, no tech skills required.",
    tags: ["ai", "competition", "modernisation"],
    priority: 8,
  },
  {
    category: "desire",
    title: "MTD compliance without thinking about it",
    content: "Don't want to learn new systems, quarterly admin, or get fines. Want accountant to stop chasing them. BillyBot: all income and expenses flow digitally into accounting software. MTD compliance is a byproduct of normal workflow.",
    tags: ["mtd", "compliance", "effortless"],
    priority: 8,
  },

  // BRAND VOICE
  {
    category: "brand_voice",
    title: "BillyBot brand voice",
    content: "Direct, knowledgeable, no-BS. Speaks like a fellow tradesperson, not a tech company. Uses trade terminology naturally. Never patronising. Confident but not arrogant. Understands the daily reality of running a flooring business. Short sentences. Practical examples over abstract promises.",
    tags: ["tone", "brand"],
    priority: 10,
  },
  {
    category: "brand_voice",
    title: "Founder personal voice",
    content: "Authentic, behind-the-scenes, opinionated about AI in trades. Mix of technical builder and experienced flooring contractor. Willing to share failures and lessons. Build-in-public transparency. Not corporate — real person building a real product. Uses 'I' not 'we' for personal posts.",
    tags: ["tone", "personal", "founder"],
    priority: 10,
  },

  // PRODUCT FEATURES (for demo content)
  {
    category: "product_feature",
    title: "AI Quote Generation",
    content: "Describe the job in natural language → BillyBot generates a professional quote with correct pricing, materials, and labour. Handles carpet, LVT, laminate, vinyl, tiles, wood, engineered wood. Includes waste calculations, VAT, and breakpoint pricing.",
    tags: ["quoting", "ai", "core"],
    priority: 9,
  },
  {
    category: "product_feature",
    title: "RAMS Generation",
    content: "Auto-generated Risk Assessment and Method Statements from job details. Professional PDF output. Means domestic fitters can say YES to commercial/council jobs they previously turned away.",
    tags: ["rams", "compliance", "revenue"],
    priority: 8,
  },
  {
    category: "product_feature",
    title: "Receipt Capture + Accounting Sync",
    content: "Snap a photo of any receipt. AI extracts supplier, amount, VAT, date, category. Links to the job. Pushes to Sage, Xero, or QuickBooks automatically. Every expense digitally recorded and MTD-ready.",
    tags: ["receipts", "mtd", "accounting"],
    priority: 9,
  },
  {
    category: "product_feature",
    title: "Email Inbox + Job Linking",
    content: "Connect Gmail or Outlook. BillyBot auto-threads emails to jobs. Draft replies generated by AI. Never lose track of a customer conversation again.",
    tags: ["email", "jobs", "conversations"],
    priority: 7,
  },
  {
    category: "product_feature",
    title: "Diary / Calendar with Team",
    content: "Schedule fitters to jobs. Team members see their diary. Drag-and-drop calendar view. Everyone knows where they need to be.",
    tags: ["diary", "team", "scheduling"],
    priority: 6,
  },

  // FOUNDER STORY
  {
    category: "founder_story",
    title: "Origin story",
    content: "Founder ran a flooring business himself. Experienced every pain point first-hand — quote backlogs, paper receipts, turning away RAMS jobs. Built BillyBot to solve his own problems. This isn't a tech company guessing what tradespeople need — it's built by someone who lived it.",
    tags: ["origin", "credibility", "trust"],
    priority: 10,
  },

  // STATS
  {
    category: "stat",
    title: "MTD penalties",
    content: "Missing a quarterly MTD submission = 1 penalty point. 4 points = £200 fine. Then £200 for every additional miss. Starts April 2026 for businesses earning >£50k.",
    tags: ["mtd", "penalties", "urgency"],
    priority: 8,
  },
  {
    category: "stat",
    title: "Quote backlog universal",
    content: "Prospect had 13 quotes waiting. Our business has the same problem. Every flooring business owner will recognise this number.",
    tags: ["quoting", "universal"],
    priority: 7,
  },

  // INSIGHTS
  {
    category: "insight",
    title: "FB ads work for discovery",
    content: "First prospect found BillyBot through Facebook ads, did his own research, came in already interested. FB ads → in-person demo → conversion. The demo/meeting is where conversion happens.",
    tags: ["facebook", "ads", "funnel"],
    priority: 7,
  },
  {
    category: "insight",
    title: "Too busy is the #1 objection",
    content: "Craig Knight: 'Once things have calmed down I will have more time.' Classic delay — genuinely impressed but won't commit while slammed. Irony: BillyBot exists to solve the 'too busy' problem. Asking for costings = still warm.",
    tags: ["objection", "follow-up", "timing"],
    priority: 8,
  },
];

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if already seeded
  const { count } = await supabaseAdmin
    .from("marketing_context")
    .select("id", { count: "exact", head: true })
    .eq("client_id", user.id);

  if (count && count > 0) {
    return NextResponse.json({ error: "Already seeded", count }, { status: 409 });
  }

  const rows = SEED_DATA.map((item) => ({ ...item, client_id: user.id }));

  const { data, error } = await supabaseAdmin
    .from("marketing_context")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ seeded: data?.length ?? 0 }, { status: 201 });
}
