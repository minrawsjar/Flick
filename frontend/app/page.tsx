import { ArrowDown, ArrowUpRight, ScanLine } from "lucide-react";
import Link from "next/link";
import { Phone } from "@/components/phone";
import { Reveal, Section } from "@/components/ui";
import { Agents } from "./_landing/agents";
import { Autopilot, WeekScreen } from "./_landing/autopilot";
import { owed, week } from "./_landing/data";
import { HeroLens, Snap } from "./_landing/lens";
import { Nudge, NudgeScreen } from "./_landing/nudge";
import { Split } from "./_landing/split";
import { Studio } from "./_landing/studio";

// Flick's one-pager, in the Air Agents style: the hero's phones show the app, and each section
// below is a demo you can play with.

const repo = "https://github.com/minrawsjar/Flick";

const links = [
  ["#agents", "Agents"],
  ["#snap", "Lens"],
  ["#autopilot", "Autopilot"],
  ["#split", "Split"],
  ["#nudge", "Nudge"],
  ["#studio", "Studio"],
] as const;

function Logo() {
  return (
    <span className="flex size-6 items-center justify-center rounded-[7px] bg-ink text-white">
      <ScanLine size={14} strokeWidth={2.25} />
    </span>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-2xl backdrop-saturate-150">
      <nav className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2 text-[15px]">
          <Logo />
          Flick
        </a>
        <div className="flex items-center gap-6 text-[13px] text-ink/70">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="hidden transition-colors hover:text-ink md:block">
              {label}
            </a>
          ))}
          <Link href="/dashboard" className="pressable rounded-full bg-ink px-3 py-1 text-white">
            Money Studio
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="tone-white overflow-hidden px-4 pt-16 text-center sm:px-6 sm:pt-24">
      <Reveal>
        <h1 className="mx-auto max-w-4xl text-[52px] leading-[1.04] tracking-[-0.03em] text-balance sm:text-[96px]">Snap it. Flick pays.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-[21px] leading-[1.4] text-secondary text-pretty sm:text-[24px]">
          Point your camera at a bill, a receipt or something you want. Flick pays it with PayPal, learns it, and runs your week on autopilot.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#snap" className="pressable flex h-12 items-center gap-1.5 rounded-full bg-ink px-6 text-[17px] text-white">
            Try it <ArrowDown size={18} aria-hidden />
          </a>
          <a href={repo} className="pressable flex h-12 items-center gap-1.5 rounded-full bg-fill px-6 text-[17px]">
            GitHub <ArrowUpRight size={18} aria-hidden />
          </a>
        </div>
      </Reveal>
      <Reveal className="relative mx-auto mt-16 flex h-[560px] max-w-5xl items-start justify-center sm:h-[600px]">
        <div className="absolute right-1/2 top-16 mr-28 hidden -rotate-6 lg:block">
          <Phone tab="This week">
            <WeekScreen rows={week} approved={false} today={-1} />
          </Phone>
        </div>
        <div className="absolute left-1/2 top-16 ml-28 hidden rotate-6 lg:block">
          <Phone background="#fff">
            <NudgeScreen who={owed[0]} tone="Friendly" typed={999} sent />
          </Phone>
        </div>
        <div className="relative z-10">
          <HeroLens width={300} />
        </div>
      </Reveal>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Section
          id="agents"
          tone="grey"
          label="Meet your agents"
          title="Four agents. One for every way money moves."
          intro="Each one does a single job well, and they hand work to each other: Lens reads, Autopilot pays, Splitter shares, Nudge follows up."
        >
          <Agents />
        </Section>
        <Section
          id="snap"
          compact
          tone="white"
          label="Lens"
          title="Snap it. Flick pays it."
          intro="Lens reads what you point it at and turns it into a payment: a bill to pay, a receipt to split, a tag to buy or a jar to tip. Pick one and watch it go through PayPal."
        >
          <Snap />
        </Section>
        <Section
          id="autopilot"
          compact
          tone="grey"
          label="Autopilot"
          title="Your week, paid on autopilot."
          intro="Autopilot plans the week from what you've snapped and paid before. Edit anything in the grid, approve once, then step through the week."
        >
          <Autopilot />
        </Section>
        <Section
          id="split"
          compact
          tone="white"
          label="Splitter"
          title="Split the bill before it goes cold."
          intro="Snap the receipt, tick who had what, and Splitter sends each friend a PayPal request for their share."
        >
          <Split />
        </Section>
        <Section
          id="nudge"
          compact
          tone="grey"
          label="Nudge"
          title="Get paid back, without the awkward bit."
          intro="Nudge keeps track of who still owes you and drafts a reminder that sounds like you. Pick a friend and a tone."
        >
          <Nudge />
        </Section>
        <Section
          id="studio"
          compact
          tone="white"
          label="Money Studio"
          title="Your money HQ, built by an agent."
          intro="Every payment, request and reminder lands in Money Studio, an AG Studio workspace over your PayPal data."
        >
          <Studio />
        </Section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-8 text-[12px] text-secondary sm:px-6">
        <p>Built for the PayPal AI Hackathon, 2026. Runs on the PayPal sandbox.</p>
        <p>
          Design language from{" "}
          <a href="https://github.com/ahmedfahim21/Spatial-Agents" className="hover:text-ink">
            Air Agents
          </a>{" "}
          (MIT) ·{" "}
          <a href={repo} className="hover:text-ink">
            Open source on GitHub
          </a>
        </p>
      </footer>
    </>
  );
}
