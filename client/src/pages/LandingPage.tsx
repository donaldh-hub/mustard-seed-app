import { Link, useLocation } from "wouter";
import jaiHero from "@assets/ChatGPT_Image_Mar_7,_2026,_09_56_37_PM_1772938650664.png";
import jaiPodcast from "@assets/file_000000006e04620e9931a4040836810b_1771384491714.png";
import jaiArmsCrossed from "@assets/ChatGPT_Image_Mar_7,_2026,_09_01_46_PM_1772935512407.png";

const HEARTBEATS = [
  { title: "Clarity of Vision & Why", desc: "Know exactly what you're building and why it matters before you move." },
  { title: "Small Steps + Consistency", desc: "Progress compounds when small actions are repeated daily." },
  { title: "Mindset Over Method", desc: "Your thinking determines your execution more than any tactic ever will." },
  { title: "Feedback & Adaptation", desc: "Review what happened, adjust what's needed, and keep moving forward." },
  { title: "Courageous Action", desc: "Act even when it's uncomfortable, uncertain, or inconvenient." },
];

const FUNNEL_STEPS = [
  { label: "Five Heartbeats Assessment", tag: "Free" },
  { label: "3-Day Grounding Journal", tag: "Free" },
  { label: "7-Day Rebuild Program", tag: "Guided" },
  { label: "Keep Growing", tag: "Ongoing" },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const goToSignup = () => setLocation("/auth?view=register");

  return (
    <div className="w-full overflow-x-hidden bg-[#f9f6ef] text-stone-900">
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-4 bg-[#1a3a2a]">
        <span className="font-serif text-xl font-bold text-[#f9f6ef]">Mustard Seed</span>
        <button
          onClick={goToSignup}
          data-testid="button-nav-cta"
          className="rounded-full bg-[#c8a84b] px-5 py-2 text-sm font-bold text-stone-900 transition-transform hover:scale-105 active:scale-95"
        >
          Start Free Journal
        </button>
      </nav>

      {/* HERO */}
      <section
        className="px-6 py-16 md:py-24"
        style={{ background: "linear-gradient(180deg, #1a3a2a 0%, #2d5a3d 100%)" }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-md text-center md:text-left">
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#e8c76a]">
              🌱 Digital Accountability Partner
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl">
              Small steps.
              <br />
              <span className="text-[#e8c76a]">Serious growth.</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-stone-200">
              Jai walks with you one honest step at a time — no hype, no pressure, just real
              progress toward whatever you're building.
            </p>
            <button
              onClick={goToSignup}
              data-testid="button-hero-cta"
              className="mt-6 w-full rounded-full px-6 py-4 text-lg font-bold text-stone-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
              style={{ background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)" }}
            >
              Start the Free 3-Day Journal
            </button>
            <p className="mt-2 text-xs text-stone-400">
              No credit card. No pressure. Just your first honest step.
            </p>
          </div>

          <div className="relative hidden md:block">
            <img
              src={jaiHero}
              alt="Jai, your accountability partner"
              className="h-80 w-64 rounded-2xl object-cover object-top"
            />
            <div className="absolute -left-8 bottom-6 max-w-[200px] rounded-2xl bg-white px-4 py-3 text-sm font-medium text-stone-800 shadow-xl">
              "I'm not here to hype you up. I'm here to help you grow."
              <div className="mt-1 text-xs font-semibold text-stone-500">— Jai, your coach</div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-b border-stone-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-medium text-stone-600">
          <span>Goal-neutral</span>
          <span className="text-stone-300">•</span>
          <span>Free to start</span>
          <span className="text-stone-300">•</span>
          <span>Built on the Five Heartbeats</span>
          <span className="text-stone-300">•</span>
          <span>Powered by Jai</span>
        </div>
      </section>

      {/* MEET JAI */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 md:flex-row">
          <img
            src={jaiPodcast}
            alt="Jai, your AI accountability partner"
            className="w-64 rounded-2xl object-cover shadow-md"
          />
          <div className="max-w-md text-center md:text-left">
            <h2 className="text-3xl font-bold text-stone-900">
              Not a chatbot. An accountability partner.
            </h2>
            <ul className="mt-6 space-y-4 text-stone-600">
              <li>
                <span className="font-semibold text-stone-900">Memory-aware coaching</span> — Jai
                remembers your goals and your history with you.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Goal-neutral by design</span> —
                fitness, business, faith, relationships, anything you're building.
              </li>
              <li>
                <span className="font-semibold text-stone-900">Grace without excuses</span> —
                honest accountability, never shame.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* FIVE HEARTBEATS */}
      <section className="px-6 py-16" style={{ background: "#1a3a2a" }}>
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white md:text-left">
            Growth has structure.
          </h2>
          <div className="mt-10 flex flex-col items-center gap-10 md:flex-row md:items-start">
            <ol className="flex-1 space-y-5">
              {HEARTBEATS.map((h, i) => (
                <li key={h.title} className="flex gap-4">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#c8a84b] text-sm font-bold text-stone-900">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-white">{h.title}</div>
                    <div className="text-sm text-stone-300">{h.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
            <img
              src={jaiArmsCrossed}
              alt="Jai"
              className="hidden w-56 rounded-2xl object-cover md:block"
            />
          </div>
        </div>
      </section>

      {/* 3-DAY GROUNDING JOURNAL */}
      <section className="bg-[#f9f6ef] px-6 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 md:flex-row">
          <ol className="flex-1 space-y-6 border-l-2 border-[#c8a84b] pl-6">
            <li>
              <div className="font-semibold text-stone-900">Day 1 — Where You Actually Are</div>
              <div className="text-sm text-stone-600">An honest, grace-filled check-in.</div>
            </li>
            <li>
              <div className="font-semibold text-stone-900">Day 2 — What You Actually Want</div>
              <div className="text-sm text-stone-600">Name the value underneath the goal.</div>
            </li>
            <li>
              <div className="font-semibold text-stone-900">Day 3 — Your First Small Step</div>
              <div className="text-sm text-stone-600">Leave with one seed you can plant today.</div>
            </li>
          </ol>

          <div className="flex-1 rounded-2xl bg-white p-8 text-center shadow-md">
            <h3 className="text-xl font-bold text-stone-900">Ready to get grounded?</h3>
            <p className="mt-2 text-sm text-stone-600">
              Three short sessions with Jai. No pressure, just clarity.
            </p>
            <button
              onClick={goToSignup}
              data-testid="button-journal-cta"
              className="mt-5 w-full rounded-full bg-[#1a3a2a] px-6 py-3 font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Start the 3-Day Journal — Free
            </button>
            <p className="mt-3 text-xs text-stone-400">
              On the website, you choose the seed. On the phone, you water it.
            </p>
          </div>
        </div>
      </section>

      {/* FUNNEL */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {FUNNEL_STEPS.map((step, i) => (
              <div key={step.label} className="flex flex-1 flex-col items-center text-center">
                <div className="flex items-center gap-3 md:hidden">
                  {i > 0 && <div className="h-px w-6 bg-stone-300" />}
                </div>
                <div className="font-semibold text-stone-900">{step.label}</div>
                <div className="mt-1 text-xs font-medium text-[#8a6f1f]">{step.tag}</div>
                {i < FUNNEL_STEPS.length - 1 && (
                  <div className="mt-4 hidden h-px w-full bg-stone-300 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING QUOTE */}
      <section className="px-6 py-20 text-center" style={{ background: "#1a3a2a" }}>
        <p className="mx-auto max-w-2xl text-2xl font-bold leading-snug text-white sm:text-3xl">
          "You don't pay to try Mustard Seed. You pay to keep growing with it."
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm text-stone-300">
          Every free step builds toward something real. When you're ready to keep growing, we'll
          be here.
        </p>
        <button
          onClick={goToSignup}
          data-testid="button-closing-cta"
          className="mt-8 rounded-full px-8 py-4 text-lg font-bold text-stone-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(180deg, #F5D060 0%, #E8B828 100%)" }}
        >
          Start Free
        </button>
      </section>

      {/* FOOTER */}
      <footer className="bg-black px-6 py-10 text-center">
        <div className="font-serif text-lg font-bold text-white">Mustard Seed</div>
        <p className="mt-2 text-sm text-stone-400">Your digital accountability partner.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-stone-400">
          <Link href="/privacy-policy" className="hover:text-stone-200 hover:underline" data-testid="link-footer-privacy">
            Privacy Policy
          </Link>
          <span className="text-stone-600">•</span>
          <Link href="/terms-of-service" className="hover:text-stone-200 hover:underline" data-testid="link-footer-terms">
            Terms of Service
          </Link>
          <span className="text-stone-600">•</span>
          <Link href="/subscription-info" className="hover:text-stone-200 hover:underline" data-testid="link-footer-subscription">
            Subscription Info
          </Link>
        </div>
        <p className="mt-4 text-xs text-stone-500">
          © {new Date().getFullYear()} Mustard Seed. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
