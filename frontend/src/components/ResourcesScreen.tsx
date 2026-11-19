"use client";

import { useState } from "react";
import AccountMenu from "./AccountMenu";

interface ResourcesScreenProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
  onSelectTopic?: (topic: string) => void;
  loggedIn?: boolean;
  userEmail?: string;
  onLogout?: () => void;
}

interface StepBreakdown {
  step: string;
  name: string;
  timing: string;
  verbalStarter: string;
  purpose: string;
  description: string;
}

interface ScriptComparison {
  badTitle: string;
  badScript: string;
  badCritique: string;
  goodTitle: string;
  goodScript: string;
  goodCritique: string;
}

export interface ResourceArticle {
  id: string;
  category: "impromptu" | "presentation" | "frameworks" | "vocal" | "diagnostics";
  categoryLabel: string;
  title: string;
  subtitle: string;
  readTime: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  idealLength: string;
  icon: string;
  summary: string;
  theCoreConcept: string;
  whyItWorks: string;
  steps: StepBreakdown[];
  comparison: ScriptComparison;
  pitfalls: string[];
  practiceDrill: {
    title: string;
    prompt: string;
    instructions: string;
  };
}

const MASTER_RESOURCES: ResourceArticle[] = [
  {
    id: "prep-method",
    category: "impromptu",
    categoryLabel: "Impromptu Technique",
    title: "The PREP Method for Spontaneous Speaking",
    subtitle: "Point • Reason • Example • Point — The Executive Answering Framework",
    readTime: "5 min read",
    difficulty: "Beginner",
    idealLength: "60 – 90 seconds",
    icon: "💬",
    summary:
      "When hit with an unexpected question in a meeting or board review, human brains default to rambling while searching for thoughts. The PREP framework locks your delivery into a bulletproof 4-stage structure that sounds structured, decisive, and authoritative.",
    theCoreConcept:
      "The human working memory can only hold 3–4 chunks of novel information simultaneously. When you answer without a framework, you overload your listeners. PREP delivers the punchline first, backs it with evidence, and closes cleanly before you lose audience attention.",
    whyItWorks:
      "Executive listeners evaluate answers on cognitive clarity. By stating your Point in the first 5 seconds, you alleviate cognitive tension in the room and establish immediate credibility.",
    steps: [
      {
        step: "1",
        name: "Point (The Bottom Line)",
        timing: "0:00 – 0:10 (10 sec)",
        verbalStarter: '"My direct recommendation is..." / "The core issue we are solving is..."',
        purpose: "Anchor the audience with a single, clear thesis statement immediately.",
        description:
          "Do not give background or context yet. State your main assertion or conclusion in 1–2 sharp sentences.",
      },
      {
        step: "2",
        name: "Reason (The Strategic Why)",
        timing: "0:10 – 0:30 (20 sec)",
        verbalStarter: '"The primary reason for this is..." / "This matters because our data shows..."',
        purpose: "Justify your position with rational, logical backing.",
        description:
          "Explain the root cause, business logic, or psychological reasoning behind your opening Point. Focus on the single strongest reason.",
      },
      {
        step: "3",
        name: "Example (Concrete Evidence / Metric)",
        timing: "0:30 – 0:65 (35 sec)",
        verbalStarter: '"For instance, during Q3 when we..." / "A clear example is how team X..."',
        purpose: "Transform abstract theory into undeniable reality.",
        description:
          "Provide a brief real-world story, customer scenario, or quantitative metric that proves your reason in action.",
      },
      {
        step: "4",
        name: "Point (The Closing Call-to-Action)",
        timing: "0:65 – 0:80 (15 sec)",
        verbalStarter: '"So in summary, to achieve X we must..." / "That is why moving forward with Y is critical."',
        purpose: "Reiterate your thesis with confidence and cleanly pass the microphone.",
        description:
          "Restate your opening thesis in fresh words and conclude with a decisive call to action. Stop speaking immediately after this step.",
      },
    ],
    comparison: {
      badTitle: "❌ Unstructured Rambling (The Default Answer)",
      badScript:
        '"Uh, yeah, so regarding whether we should launch the product in Europe... well, you know, Europe is tricky, and last year we talked to some consultants, and Sarah had some thoughts about GDPR, and I was thinking maybe we wait, but then again our competitors are there, so yeah, it’s complicated, but maybe next quarter?"',
      badCritique:
        "Rambles for 45 seconds without ever giving a clear answer. Projects hesitation, lack of conviction, and wastes stakeholder time.",
      goodTitle: "✅ PREP Execution (Executive Confidence)",
      goodScript:
        '"(Point) We should accelerate our European expansion to Q2. (Reason) The primary reason is that regulatory changes in Germany have created a 90-day window where local enterprise demand is unserved. (Example) For instance, last month three tier-1 prospects in Berlin inbound requested our API solution directly. (Point) In summary, launching in Q2 lets us capture market share ahead of incumbents, and I recommend allocating budget today."',
      goodCritique:
        "Delivered in 40 seconds. Clear point, factual justification, tangible example, and decisive close. Instills immediate stakeholder confidence.",
    },
    pitfalls: [
      "Spending 80% of your time on the Example and forgetting to deliver the closing Point.",
      "Starting with filler phrases like 'That's a really great question, let me see...'",
      "Adding a second or third Reason, which dilutes the memorability of your core message.",
    ],
    practiceDrill: {
      title: "Executive Impromptu Drill",
      prompt: "Should our company mandate a full return-to-office policy, or remain remote-first? Deliver your answer using PREP.",
      instructions: "Aim for a 75-second delivery. Hit Point (10s), Reason (20s), Example (30s), and closing Point (15s).",
    },
  },
  {
    id: "what-so-what-now-what",
    category: "frameworks",
    categoryLabel: "Executive Pitching",
    title: "What? So What? Now What? (The Decision Engine)",
    subtitle: "How to update leadership, pitch initiatives, and drive fast consensus",
    readTime: "6 min read",
    difficulty: "Intermediate",
    idealLength: "90 – 120 seconds",
    icon: "🎯",
    summary:
      "Created by business communication pioneers, this 3-tier framework is the gold standard for project status updates, crisis debriefs, and strategic proposals. It prevents information dumps by focusing purely on relevance and action.",
    theCoreConcept:
      "Executives do not want data dumps; they want decision clarity. 'What' provides the factual event. 'So What' explains the business consequence. 'Now What' provides the executable roadmap.",
    whyItWorks:
      "It mirrors the natural executive cognitive hierarchy: Comprehend the situation → Assess the risk/reward → Authorize the action.",
    steps: [
      {
        step: "1",
        name: "WHAT (The Factual Situation)",
        timing: "0:00 – 0:25 (25 sec)",
        verbalStarter: '"Here is what occurred: over the past 48 hours..."',
        purpose: "Ground the room in objective, unambiguous reality.",
        description: "State the raw facts without emotional inflection or speculation. Keep it tightly focused on what changed.",
      },
      {
        step: "2",
        name: "SO WHAT (The Strategic Consequence)",
        timing: "0:25 – 0:65 (40 sec)",
        verbalStarter: '"Why this matters to our business is two-fold..."',
        purpose: "Translate technical data into financial, timeline, or customer impact.",
        description: "Explain the stakes. What happens if we act? What happens if we ignore it? Connect directly to revenue or team velocity.",
      },
      {
        step: "3",
        name: "NOW WHAT (The Actionable Recommendation)",
        timing: "0:65 – 0:100 (35 sec)",
        verbalStarter: '"Here are the 3 actions my team is executing..."',
        purpose: "Present a concrete decision or next steps for approval.",
        description: "Specify owners, deadlines, and required approvals. End with a clear ask.",
      },
    ],
    comparison: {
      badTitle: "❌ The Exhaustive Data Dump",
      badScript:
        '"So on Tuesday server 4 had a spike in CPU usage to 94%, and then we looked at logs in Datadog and saw database deadlocks from the migration script that was committed last Friday, which caused some timeouts in our checkout microservice..."',
      badCritique: "Forces executives to mentally parse technical jargon to figure out whether revenue was impacted.",
      goodTitle: "✅ What? So What? Now What? Delivery",
      goodScript:
        '"(What) Yesterday afternoon, our payment gateway experienced intermittent latency for 22 minutes. (So What) This impacted 140 checkout transactions, resulting in approximately $12,000 in delayed orders, though zero credit card data was compromised. (Now What) We have rolled back the database update, added automated failover monitoring, and will deliver a full post-mortem with preventative guards by Thursday."',
      goodCritique: "Immediate clarity. Leadership knows the event, the exact dollar impact, and the preventive plan without panic.",
    },
    pitfalls: [
      "Spending all your time explaining technical 'What' details and leaving no time for 'Now What'.",
      "Assuming the audience understands why an event matters without explicitly stating the 'So What'.",
    ],
    practiceDrill: {
      title: "Crisis Update Drill",
      prompt: "A key product release has been delayed by two weeks due to unexpected security findings. Brief executive stakeholders.",
      instructions: "State the release delay (What), explain the security and customer impact (So What), and outline the mitigation timeline (Now What).",
    },
  },
  {
    id: "hook-story-offer",
    category: "presentation",
    categoryLabel: "Presentation Engine",
    title: "The Hook, Story, Offer Presentation Architecture",
    subtitle: "Captivate any audience in 30 seconds and sustain engagement through keynotes",
    readTime: "7 min read",
    difficulty: "Advanced",
    idealLength: "3 – 5 minutes",
    icon: "⚡",
    summary:
      "Most presentations lose 60% of audience attention within the first 60 seconds because speakers begin with pleasantries or agenda slides. The Hook-Story-Offer architecture jolts attention instantly and drives high conversion.",
    theCoreConcept:
      "Attention is a scarce currency. A compelling presentation does not inform; it transforms the listener's mental model through narrative tension before introducing the solution.",
    whyItWorks:
      "Stories trigger dopamine and cortisol release in the human brain, synchronizing neural activity between speaker and listener (neural coupling).",
    steps: [
      {
        step: "1",
        name: "THE HOOK (The Pattern Interrupt)",
        timing: "0:00 – 0:45 (45 sec)",
        verbalStarter: '"84% of corporate presentations are forgotten within 24 hours. Here is why..."',
        purpose: "Break audience autopilot and create a curiosity gap.",
        description: "Use a counter-intuitive statistic, a provocative question, or a bold future projection. Never start with 'Thank you for having me'.",
      },
      {
        step: "2",
        name: "THE STORY (The Emotional Journey & Conflict)",
        timing: "0:45 – 2:30 (105 sec)",
        verbalStarter: '"Two years ago, a team at company X made a single calculation error that..."',
        purpose: "Build emotional resonance and demonstrate the cost of inaction.",
        description: "Introduce a relatable protagonist, an escalating obstacle, and the turning point realization that led to your discovery.",
      },
      {
        step: "3",
        name: "THE OFFER / VISION (The Transformation)",
        timing: "2:30 – 3:30 (60 sec)",
        verbalStarter: '"Imagine if every member of your organization could speak with the clarity of..."',
        purpose: "Paint the vivid future state and issue an irresistible call to action.",
        description: "Present your framework, product, or strategic vision as the bridge between current pain and future success.",
      },
    ],
    comparison: {
      badTitle: "❌ The Traditional Boring Slide Opener",
      badScript:
        '"Hello everyone, my name is John and today I am excited to show you slide 1 of our 32-slide presentation on enterprise communication optimization. Here is our agenda for the next hour..."',
      badCritique: "Audience immediately checks their phones. Low energy, zero curiosity gap, formulaic.",
      goodTitle: "✅ The High-Voltage Hook & Narrative",
      goodScript:
        '"(Hook) Every year, Fortune 500 companies lose $1.2 trillion to a single silent problem: ambiguous internal meetings. (Story) In 2023, our engineering leadership spent 400 hours redesigning a feature because three directors interpreted the word \'scalable\' in three opposite ways. (Offer) Today, we are introducing a unified communication protocol that cuts meeting duration in half and eliminates misalignment."',
      goodCritique: "Grabs total focus within 15 seconds. High stakes, relatable pain, and an inspiring value proposition.",
    },
    pitfalls: [
      "Spending time on biographical introductions before earning the audience's interest.",
      "Making the story overly abstract rather than sensory and specific.",
    ],
    practiceDrill: {
      title: "Keynote Pitch Drill",
      prompt: "Deliver a 3-minute pitch for an AI product that automates performance coaching for enterprise sales teams.",
      instructions: "Open with a shocking statistic (Hook), tell a customer failure story (Story), and unveil your solution vision (Offer).",
    },
  },
  {
    id: "strategic-pacing",
    category: "diagnostics",
    categoryLabel: "Vocal Diagnostics",
    title: "Mastering the 140 WPM Cadence & Tactical Pauses",
    subtitle: "How to use speed variation and intentional silence to command absolute authority",
    readTime: "5 min read",
    difficulty: "Intermediate",
    idealLength: "Continuous Practice",
    icon: "⏱️",
    summary:
      "Nervous speakers rush at 180+ WPM to get their words over with. Master communicators deliberate at 135–150 WPM, weaponizing 1.5-second pauses to make their core points feel monumental.",
    theCoreConcept:
      "Silence in speech is not dead air; it is the space where the audience digests your ideas. A well-placed pause signals total self-possession and deep cognitive confidence.",
    whyItWorks:
      "Brain scanning studies show that listener comprehension drops significantly above 165 WPM. Pauses reset listener attention and trigger dopamine spikes of anticipation.",
    steps: [
      {
        step: "1",
        name: "The Pacing Baseline (135–150 WPM)",
        timing: "General Delivery",
        verbalStarter: '"Speak at a cadence that feels 15% slower than your internal thought speed."',
        purpose: "Establish calm, grounded executive gravitas.",
        description: "Enunciate consonants clearly and avoid trailing off at sentence endings.",
      },
      {
        step: "2",
        name: "The Pre-Punchline Pause (1.5 Seconds)",
        timing: "Before Key Insights",
        verbalStarter: '"And the single most important number is... [PAUSE 1.5s] ... 48%."',
        purpose: "Build room-wide tension and signal that a critical takeaway is coming.",
        description: "Stop speaking completely. Keep gaze contact steady. Let the silence hang for a full heartbeat.",
      },
      {
        step: "3",
        name: "The Post-Punchline Pause (2 Seconds)",
        timing: "After Bold Statements",
        verbalStarter: '"[Deliver big assertion] ... [PAUSE 2s to allow room to absorb]"',
        purpose: "Give the room time to process the weight of your words.",
        description: "Resist the urge to immediately explain or dilute what you just said with filler words.",
      },
    ],
    comparison: {
      badTitle: "❌ The Rapid Machine-Gun Delivery (190 WPM)",
      badScript:
        '"SobasicallywhatwefoundisthatourcustomersarecancellingbecauseourinterfaceiswaytoocomplicatedandifwedontfixitinQ3weregoingtolosemillionsofdollarssoIthinkweneedtohurryupandshipthis."',
      badCritique: "Sounds anxious, rushed, and panicked. Key insights get blurred and listener retention drops to near zero.",
      goodTitle: "✅ The Deliberate 140 WPM Cadence with Pauses",
      goodScript:
        '"Our data revealed a single, critical finding. [1s pause] Customers are not leaving because of price. [1.5s pause] They are leaving because our interface takes 4 clicks too many. [2s pause] If we eliminate that friction in Q3... our retention jumps by 30%."',
      goodCritique: "Every sentence hits with massive weight. The silence emphasizes the magnitude of the insight.",
    },
    pitfalls: [
      "Filling pauses with 'um', 'so yeah', or nervous chuckles.",
      "Looking away or down during pauses, which turns confident silence into awkward hesitation.",
    ],
    practiceDrill: {
      title: "Strategic Silence Drill",
      prompt: "Deliver a 60-second status report on a major breakthrough your team achieved. Include at least three 2-second deliberate pauses.",
      instructions: "Check your live WPM meter in the studio. Keep pacing between 130 and 150 WPM.",
    },
  },
  {
    id: "feynman-technique",
    category: "frameworks",
    categoryLabel: "Concept Simplicity",
    title: "The Feynman Technique for Technical Communication",
    subtitle: "How to explain complex algorithms, architecture, and jargon with childlike clarity",
    readTime: "5 min read",
    difficulty: "Intermediate",
    idealLength: "90 – 120 seconds",
    icon: "🧠",
    summary:
      "Named after Nobel laureate Richard Feynman, this method forces speakers to strip away acronyms and domain jargon, using intuitive physical analogies so any board member or client can instantly grasp deep tech.",
    theCoreConcept:
      "If you cannot explain an idea using 8th-grade vocabulary, you do not fully own the architecture. Jargon is often a crutch for incomplete mental models.",
    whyItWorks:
      "Analogies link unfamiliar concepts to pre-existing neural pathways in the listener's brain, resulting in instantaneous 'Aha!' comprehension.",
    steps: [
      {
        step: "1",
        name: "Name the Concept without Jargon",
        timing: "0:00 – 0:15 (15 sec)",
        verbalStarter: '"At its core, [Complex System] does one simple job..."',
        purpose: "De-mystify the buzzword immediately.",
        description: "State what the system accomplishes in plain human language without acronyms.",
      },
      {
        step: "2",
        name: "The Real-World Physical Analogy",
        timing: "0:15 – 0:60 (45 sec)",
        verbalStarter: '"Think of it like a postal sorting facility where..."',
        purpose: "Give the listener a familiar visual picture.",
        description: "Compare the system to something tangible: a library, traffic light, kitchen recipe, or airport terminal.",
      },
      {
        step: "3",
        name: "Connect Back to Business Value",
        timing: "0:60 – 0:90 (30 sec)",
        verbalStarter: '"For our customers, this means they never have to..."',
        purpose: "Ground the technical feat in commercial impact.",
        description: "Explain why this simplified architecture saves money, speeds up delivery, or secures user data.",
      },
    ],
    comparison: {
      badTitle: "❌ Jargon Soup (Cognitive Overload)",
      badScript:
        '"Our distributed Kubernetes cluster implements an asynchronous event-driven Kafka stream utilizing raft consensus for idempotent multi-region sharded state replication."',
      badCritique: "Completely alienates non-technical executives, investors, and clients.",
      goodTitle: "✅ The Feynman Analogy",
      goodScript:
        '"(Core) Our new database system ensures customer data is never lost, even if an entire data center loses power. (Analogy) Think of it like keeping three duplicate copies of a financial ledger in three different bank vaults across the country. Whenever you make a deposit, all three vaults update simultaneously. (Value) For our banking clients, this means 99.999% uptime with zero risk of transaction loss."',
      goodCritique: "Crystal clear to any CEO, investor, or customer while maintaining full technical accuracy.",
    },
    pitfalls: [
      "Using an analogy that is more complicated than the original technical concept.",
      "Believing that simplifying language makes you sound less intelligent (in reality, it signals mastery).",
    ],
    practiceDrill: {
      title: "Feynman Simplicity Drill",
      prompt: "Explain how Large Language Models (LLMs) or Neural Networks work to a 10-year-old child in 90 seconds.",
      instructions: "Use zero technical jargon (no 'embeddings', 'weights', or 'parameters'). Use a creative real-world analogy.",
    },
  },
  {
    id: "vocal-resonance",
    category: "vocal",
    categoryLabel: "Vocal Health",
    title: "3-Minute Diaphragm & Vocal Resonance Routine",
    subtitle: "Lower pitch jitter, eliminate throat strain, and project an authoritative vocal register",
    readTime: "4 min routine",
    difficulty: "Beginner",
    idealLength: "3 minutes pre-session",
    icon: "🫁",
    summary:
      "When adrenaline surges before speaking, vocal cords tighten, causing your voice to sound thin, pitchy, and breathless. This 3-step physical protocol grounds your voice in the chest cavity.",
    theCoreConcept:
      "Your voice is an acoustic wind instrument. Chest resonance produces lower acoustic frequencies (85–180 Hz) which human evolutionary psychology associates with calm authority and trustworthiness.",
    whyItWorks:
      "Vagus nerve stimulation through slow diaphragmatic exhalations drops resting heart rate by 8–12 BPM in under 2 minutes.",
    steps: [
      {
        step: "1",
        name: "Box Breathing for Heart Rate Regulation",
        timing: "0:00 – 1:00 (60 sec)",
        verbalStarter: '"Inhale for 4s • Hold for 4s • Exhale for 4s • Hold for 4s"',
        purpose: "Down-regulate the sympathetic nervous system.",
        description: "Place your hand on your belly. Ensure your stomach expands outward on the inhale, rather than chest rising.",
      },
      {
        step: "2",
        name: "Chest Hum for Vocal Chord Relaxation",
        timing: "1:00 – 2:00 (60 sec)",
        verbalStarter: '"Gently hum \'Mmmmmm\' on a comfortable low pitch"',
        purpose: "Shift resonance from the tight throat to the open chest cavity.",
        description: "Place your palm flat against your sternum. Hum until you feel physical vibration in your chest bone.",
      },
      {
        step: "3",
        name: "Lip Trills and Sirens",
        timing: "2:00 – 3:00 (60 sec)",
        verbalStarter: '"Blow air through loose lips (\'Brrrrrr\') sliding pitch up and down"',
        purpose: "Warm up the full vocal range without tension or strain.",
        description: "Glide smoothly from low chest register to high head register and back down.",
      },
    ],
    comparison: {
      badTitle: "❌ Throat-Constricted Delivery",
      badScript:
        '"High-pitched, shallow breathing where the speaker runs out of air mid-sentence, causing vocal fry and trailing off words."',
      badCritique: "Conveys physical nervousness, lack of preparation, and fatigue.",
      goodTitle: "✅ Diaphragm-Resonant Delivery",
      goodScript:
        '"Rich, warm acoustic tone anchored in the chest. Full sentences delivered on supported breath with crisp consonant articulation."',
      goodCritique: "Projects commanding presence, calm authority, and natural vocal endurance.",
    },
    pitfalls: [
      "Breathing shallowly from the upper shoulders and chest.",
      "Clearing the throat violently with a cough (sip warm water instead).",
    ],
    practiceDrill: {
      title: "Vocal Grounding Drill",
      prompt: "Deliver a 60-second formal keynote introduction immediately after completing the 3-minute chest hum warmup.",
      instructions: "Focus on maintaining deep diaphragmatic breath support and ending every sentence on a downward inflection.",
    },
  },
];

export default function ResourcesScreen({ onBack, onNavigate, onSelectTopic, loggedIn, userEmail, onLogout }: ResourcesScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeArticle, setActiveArticle] = useState<ResourceArticle | null>(null);

  const filtered = MASTER_RESOURCES.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#17181C] flex flex-col justify-between overflow-x-hidden animate-fade-in selection:bg-[#7A2D3B]/20">
      {/* ── FLOATING NAVBAR ───────────────────────────────── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <nav
          className="rounded-full px-6 py-2.5 flex items-center justify-between gap-6 w-full max-w-4xl border border-[#17181C]/[0.06] bg-white/80"
          style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 8px 30px rgba(23,24,28,0.06)" }}
        >
          {/* Logo */}
          <button onClick={onBack} className="flex items-center gap-2 cursor-pointer shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#17181C] flex items-center justify-center text-white font-black text-xs">
              V
            </div>
            <span className="font-semibold text-sm text-[#17181C] tracking-tight">
              VakSutra <span className="text-[#7A2D3B]">AI</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#7A2D3B]/10 text-[#7A2D3B] border border-[#7A2D3B]/20 leading-none">
              Beta
            </span>
          </button>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-1 text-sm font-medium text-[#6B6D76]">
            <button
              onClick={() => onNavigate("landing")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/8 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => onNavigate("modules")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/8 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Modules
            </button>
            <button
              onClick={() => {
                setActiveArticle(null);
                onNavigate("resources");
              }}
              className="px-3 py-1.5 rounded-full bg-[#17181C] text-white transition-all cursor-pointer"
            >
              Resources
            </button>
            {/*<button
              onClick={() => onNavigate("pricing")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/8 hover:text-[#17181C] transition-all cursor-pointer"
            >
              Pricing
            </button>*/}
            <button
              onClick={() => onNavigate("about")}
              className="px-3 py-1.5 rounded-full hover:bg-[#17181C]/8 hover:text-[#17181C] transition-all cursor-pointer"
            >
              About
            </button>
          </div>

          {/* Right Auth */}
          <div className="flex items-center gap-2 shrink-0">
            {loggedIn ? (
              <AccountMenu userEmail={userEmail} onNavigate={onNavigate} onLogout={onLogout} />
            ) : (
              <>
                <button
                  onClick={() => onNavigate("auth")}
                  className="text-xs text-[#6B6D76] hover:text-[#17181C] font-medium px-3 py-1.5 rounded-full hover:bg-[#17181C]/5 transition-all cursor-pointer"
                >
                  Log in
                </button>
                <button
                  onClick={() => onNavigate("auth")}
                  className="bg-[#17181C] hover:bg-[#2b2c31] transition-colors text-white text-xs px-4 py-1.5 rounded-full font-semibold cursor-pointer shadow-xs"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </nav>
      </div>

      {/* ── CONDITIONAL: FULL ARTICLE DEEP-DIVE VIEW VS CATALOG HUB ───────── */}
      {activeArticle ? (
        /* ══════════════════════════════════════════════════════════════════ */
        /* FULL MASTERCLASS DEEP-DIVE ARTICLE PAGE                             */
        /* ══════════════════════════════════════════════════════════════════ */
        <main className="max-w-4xl w-full mx-auto px-6 pt-32 pb-24 space-y-10 animate-fade-in">
          {/* Top Breadcrumb / Back Action */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveArticle(null)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B6D76] hover:text-[#17181C] bg-white border border-[#17181C]/10 px-4 py-2 rounded-full shadow-xs hover:bg-[#17181C]/5 transition-all cursor-pointer"
            >
              <span>← Back to Knowledge Hub</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="bg-[#7A2D3B]/15 text-[#7A2D3B] font-bold px-3 py-1 rounded-full border border-[#7A2D3B]/25 uppercase">
                {activeArticle.categoryLabel}
              </span>
              <span className="text-[#8B8C93]">• {activeArticle.readTime}</span>
            </div>
          </div>

          {/* Article Header Banner */}
          <div className="bg-[#17181C] text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-white/10 relative overflow-hidden">
            <div className="max-w-2xl space-y-4 relative z-10">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-[#7A2D3B] font-bold uppercase tracking-wider">
                <span>{activeArticle.icon}</span>
                <span>{activeArticle.difficulty} Masterclass // {activeArticle.idealLength}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#FFFFFF] leading-tight">
                {activeArticle.title}
              </h1>
              <p className="text-sm sm:text-base text-[#8B8C93] leading-relaxed">
                {activeArticle.subtitle}
              </p>
            </div>
          </div>

          {/* Core Concept & Cognitive Science */}
          <section className="bg-white rounded-3xl p-8 border border-[#17181C]/8 shadow-sm space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#17181C] mb-3">
                The Core Foundation
              </h2>
              <p className="text-xs sm:text-sm text-[#6B6D76] leading-relaxed mb-4">
                {activeArticle.summary}
              </p>
              <p className="text-xs sm:text-sm text-[#6B6D76] leading-relaxed">
                {activeArticle.theCoreConcept}
              </p>
            </div>

            <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#17181C]/8 space-y-2">
              <h3 className="text-sm font-bold text-[#17181C] flex items-center gap-2">
                <span className="text-[#7A2D3B]">🧠</span>
                <span>Why This Works on Executive Listeners:</span>
              </h3>
              <p className="text-xs text-[#6B6D76] leading-relaxed">
                {activeArticle.whyItWorks}
              </p>
            </div>
          </section>

          {/* Step-by-Step Tactical Timeline */}
          <section className="space-y-6">
            <div className="text-center max-w-xl mx-auto">
              <h2 className="text-3xl font-bold text-[#17181C]">
                Step-by-Step Execution Protocol
              </h2>
              <p className="text-xs text-[#8B8C93] mt-1">
                Follow this exact timing and copyable sentence starters during your live delivery.
              </p>
            </div>

            <div className="space-y-4">
              {activeArticle.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 border border-[#17181C]/8 shadow-sm flex flex-col sm:flex-row gap-5 items-start"
                >
                  <div className="w-10 h-10 rounded-2xl bg-[#17181C] text-white flex items-center justify-center font-mono font-bold text-sm shrink-0 shadow-sm">
                    0{step.step}
                  </div>
                  <div className="flex-1 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h3 className="text-lg font-bold text-[#17181C]">
                        {step.name}
                      </h3>
                      <span className="text-[11px] font-mono text-[#7A2D3B] font-bold bg-[#7A2D3B]/10 px-2.5 py-0.5 rounded-full self-start">
                        ⏱️ {step.timing}
                      </span>
                    </div>

                    <p className="text-xs text-[#6B6D76] leading-relaxed">
                      {step.description}
                    </p>

                    {/* Copyable verbal starter */}
                    <div className="bg-[#FFFFFF] p-3 rounded-xl border border-[#17181C]/8 text-xs font-mono text-[#17181C] flex items-center justify-between gap-3">
                      <span className="text-[#7A2D3B] font-bold">Verbal Formula:</span>
                      <span className="flex-1 italic text-slate-800 text-[11px]">
                        {step.verbalStarter}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Side-by-Side Good vs Bad Script Comparison */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-[#17181C] text-center">
              Real-World Script Comparison
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bad Example */}
              <div className="bg-rose-50/50 rounded-3xl p-6 border border-rose-200/70 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-rose-800 uppercase tracking-wider">
                    {activeArticle.comparison.badTitle}
                  </h3>
                  <div className="bg-white p-4 rounded-2xl border border-rose-200/60 text-xs text-rose-950 italic leading-relaxed">
                    {activeArticle.comparison.badScript}
                  </div>
                </div>
                <div className="text-[11px] text-rose-800/90 leading-relaxed font-sans bg-rose-100/60 p-3 rounded-xl border border-rose-200/50">
                  <strong>Diagnostic Critique:</strong> {activeArticle.comparison.badCritique}
                </div>
              </div>

              {/* Good Example */}
              <div className="bg-emerald-50/50 rounded-3xl p-6 border border-emerald-200/70 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-emerald-800 uppercase tracking-wider">
                    {activeArticle.comparison.goodTitle}
                  </h3>
                  <div className="bg-white p-4 rounded-2xl border border-emerald-200/60 text-xs text-emerald-950 italic leading-relaxed">
                    {activeArticle.comparison.goodScript}
                  </div>
                </div>
                <div className="text-[11px] text-emerald-800/90 leading-relaxed font-sans bg-emerald-100/60 p-3 rounded-xl border border-emerald-200/50">
                  <strong>Diagnostic Critique:</strong> {activeArticle.comparison.goodCritique}
                </div>
              </div>
            </div>
          </section>

          {/* Common Pitfalls */}
          <section className="bg-white rounded-3xl p-8 border border-[#17181C]/8 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-[#17181C]">
              Common Pitfalls to Avoid:
            </h3>
            <div className="space-y-2.5">
              {activeArticle.pitfalls.map((pitfall, i) => (
                <div key={i} className="flex items-start gap-3 text-xs text-[#6B6D76]">
                  <span className="text-rose-500 font-bold text-sm">✕</span>
                  <span>{pitfall}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Live Studio Drill Practice Action Card */}
          <div className="bg-[#17181C] text-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-[#7A2D3B]/30 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-[10px] font-mono text-[#7A2D3B] font-bold uppercase tracking-wider">
                🔥 Interactive AI Studio Drill
              </span>
              <h3 className="text-2xl font-bold text-[#FFFFFF]">
                {activeArticle.practiceDrill.title}
              </h3>
              <p className="text-xs text-[#8B8C93] max-w-lg leading-relaxed">
                &ldquo;{activeArticle.practiceDrill.prompt}&rdquo;
              </p>
              <p className="text-[11px] text-[#7A2D3B] font-mono">
                {activeArticle.practiceDrill.instructions}
              </p>
            </div>

            {onSelectTopic && (
              <button
                onClick={() => onSelectTopic(activeArticle.practiceDrill.prompt)}
                className="bg-[#17181C] hover:bg-[#2b2c31] transition-colors text-white px-8 py-4 rounded-full text-xs font-bold shrink-0 cursor-pointer shadow-lg hover:scale-105 transition-transform"
              >
                Launch Studio with this Prompt →
              </button>
            )}
          </div>
        </main>
      ) : (
        /* ══════════════════════════════════════════════════════════════════ */
        /* CATALOG / BROWSE HUB VIEW                                          */
        /* ══════════════════════════════════════════════════════════════════ */
        <main className="max-w-6xl w-full mx-auto px-6 pt-32 pb-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-[#7A2D3B] text-xs font-semibold uppercase tracking-[0.2em] mb-3">
              Executive Communication Knowledge Hub
            </p>
            <h1 className="text-4xl sm:text-6xl font-bold text-[#17181C] leading-tight mb-4">
              Speaking <span className="italic text-[#7A2D3B]">Mastery</span> Library
            </h1>
            <p className="text-[#6B6D76] text-base leading-relaxed">
              Real guides for the moments that actually trip people up — impromptu answers, tough questions, presentations you didn&apos;t have enough time to prepare for.
            </p>

            {/* Search bar */}
            <div className="mt-8 relative max-w-md mx-auto">
              <input
                type="text"
                placeholder="Search PREP, Feynman, What-So-What, Pacing..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#17181C]/10 rounded-full px-5 py-3 text-xs sm:text-sm pl-11 shadow-xs focus:outline-none focus:border-[#7A2D3B] transition-colors"
              />
              <svg
                className="w-4 h-4 text-[#8B8C93] absolute left-4 top-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              {[
                { id: "all", label: "All Masterclasses" },
                { id: "impromptu", label: "💬 Impromptu Speaking" },
                { id: "frameworks", label: "🎯 Decision Frameworks" },
                { id: "presentation", label: "⚡ Presentations" },
                { id: "diagnostics", label: "⏱️ Pacing & Cadence" },
                { id: "vocal", label: "🫁 Vocal Resonance" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-[#17181C] text-white shadow-xs"
                      : "bg-white text-[#6B6D76] border border-[#17181C]/8 hover:bg-[#17181C]/5"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── RESOURCE MASTERCLASS CARDS ───────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveArticle(item)}
                className="bg-white rounded-3xl p-7 border border-[#17181C]/8 shadow-sm hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{item.icon}</span>
                    <span className="text-[10px] font-mono font-bold bg-[#7A2D3B]/12 text-[#7A2D3B] px-2.5 py-0.5 rounded-full border border-[#7A2D3B]/20 uppercase">
                      {item.categoryLabel}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-[#17181C] mb-2 leading-snug group-hover:text-[#7A2D3B] transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-[#6B6D76] leading-relaxed mb-6">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#17181C]/6 flex items-center justify-between text-xs font-mono">
                  <span className="text-[#8B8C93] text-[11px]">
                    {item.readTime} • {item.difficulty}
                  </span>
                  <span className="text-[#7A2D3B] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Explore Masterclass →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-[#111114] py-8 px-6 border-t border-white/5 text-center">
        <span className="text-[#6B6D76] text-xs font-mono">
          © 2025 VakSutra AI. All rights reserved. • Empowering confident communication
        </span>
      </footer>
    </div>
  );
}