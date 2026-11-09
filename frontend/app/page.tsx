import { ArrowDown, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Bot, botColors } from "@/components/bot";
import { Phone } from "@/components/phone";
import { Nav } from "@/components/nav";
import { Glow, Reveal, Section, type Face } from "@/components/ui";
import { ShowDemo } from "@/lib/live";
import { Agents } from "./_landing/agents";
import { AskDemo } from "./_landing/ask";
import { Autopilot, WeekScreen } from "./_landing/autopilot";
import { agents, friends, owed, week } from "./_landing/data";
import { HeroLens, Snap } from "./_landing/lens";
import { Nudge, NudgeScreen } from "./_landing/nudge";
import { Split } from "./_landing/split";
import { Studio } from "./_landing/studio";

// Flick's one-pager, in the Air Agents style: a mock demo of what Flick can do. The hero's phones
// show the app, and each section below is a demo you can play with, always on demo data (<ShowDemo>).
// The navbar leads to the working pages, on the live backend.

const repo = "https://github.com/minrawsjar/Flick";

/** A notification floating by the hero's phones: something an agent just did. */
function Chip({ face, title, sub, className, delay }: { face: Face; title: string; sub: string; className: string; delay: number }) {
  return (
    <div
      className={`loop-bob absolute z-20 hidden items-center gap-2.5 rounded-2xl bg-card/85 py-2.5 pl-2.5 pr-4 text-left shadow-[0_14px_36px_-10px_rgba(0,0,0,0.3)] ring-1 ring-ink/5 backdrop-blur-xl lg:flex ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <Bot {...face} size={32} mood="awake" />
      <span>
        <span className="block text-[13px] leading-[17px]">{title}</span>
        <span className="block text-[12px] leading-4 text-secondary">{sub}</span>
      </span>
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="tone-white overflow-hidden px-4 pt-16 text-center sm:px-6 sm:pt-24">
      <Reveal>
        <h1 className="mx-auto max-w-4xl text-[52px] leading-[1.04] tracking-[-0.03em] text-balance sm:text-[96px]">
          Snap it. <span className="text-gradient">Flick pays.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-[21px] leading-[1.4] text-secondary text-pretty sm:text-[24px]">
          Point your camera at a bill, a receipt or something you want. Flick pays it with PayPal, learns it, and runs your week on autopilot.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/lens" className="pressable flex h-12 items-center gap-1.5 rounded-full bg-ink px-6 text-[17px] text-on-ink">
            Try Flick <ArrowUpRight size={18} aria-hidden />
          </Link>
          <a href="#agents" className="pressable flex h-12 items-center gap-1.5 rounded-full bg-fill px-6 text-[17px]">
            See how it works <ArrowDown size={18} aria-hidden />
          </a>
          <a href={repo} className="pressable hidden h-12 items-center gap-1.5 rounded-full bg-fill px-6 text-[17px] sm:flex">
            GitHub <ArrowUpRight size={18} aria-hidden />
          </a>
        </div>
      </Reveal>
      <Reveal className="relative mx-auto mt-16 flex h-[560px] max-w-5xl items-start justify-center sm:h-[600px]">
        {/* The agents' colours, drifting behind the phones. */}
        <Glow color="var(--color-lens)" opacity={0.45} className="loop-drift -left-10 top-[4%] size-[26rem]" />
        <Glow color="var(--color-violet)" opacity={0.45} className="loop-drift -right-10 top-0 size-[26rem] [animation-delay:-5s]" />
        <Glow color="var(--color-autopilot)" opacity={0.4} className="loop-drift left-[12%] top-[50%] size-96 [animation-delay:-10s]" />
        <Glow color="var(--color-nudge)" opacity={0.4} className="loop-drift right-[10%] top-[54%] size-96 [animation-delay:-3s]" />

        <div className="absolute right-1/2 top-16 mr-28 hidden -rotate-6 lg:block">
          <Phone tab="This week">
            <WeekScreen rows={week} approved={false} today={-1} />
          </Phone>
        </div>
        <div className="absolute left-1/2 top-16 ml-28 hidden rotate-6 lg:block">
          <Phone background="var(--color-page)">
            <NudgeScreen name={owed[0].friend.name} amount={owed[0].amount} what={owed[0].what} days={owed[0].days} tone="Friendly" text={owed[0].drafts.Friendly} typed={999} sent />
          </Phone>
        </div>
        <div className="relative z-10">
          <HeroLens width={300} />
        </div>

        <Chip face={agents.autopilot} title="Paid City Power" sub="$64.20 · just now" className="-left-4 top-[150px]" delay={0} />
        <Chip face={agents.splitter} title="Nori Sushi, split 4 ways" sub="3 PayPal requests sent" className="-left-10 top-[430px]" delay={2.2} />
        <Chip face={friends[0]} title="Maya paid you back" sub="$18.56 with PayPal" className="-right-4 top-[110px]" delay={1.1} />
        <Chip face={agents.lens} title="Lens read a price tag" sub="Trail runners · $89.00" className="-right-10 top-[410px]" delay={3} />
      </Reveal>
    </section>
  );
}

const snappable = [
  ["Electricity bills", "lens"],
  ["Dinner receipts", "splitter"],
  ["Price tags", "sky"],
  ["Tip jars", "nudge"],
  ["Phone plans", "autopilot"],
  ["Rent", "violet"],
  ["Groceries", "lens"],
  ["Gym fees", "splitter"],
  ["Concert tickets", "nudge"],
  ["Water bills", "sky"],
  ["Coffee runs", "autopilot"],
  ["Parking", "violet"],
] as const;

// One pass of the band: the list three times over (about 5,000px), so it's always wider than the
// screen. The band scrolls two identical passes by half its width and starts over, which is only
// seamless while a single pass can fill the screen on its own.
const pass = [...snappable, ...snappable, ...snappable];

/** Everything Lens can read, scrolling by. */
function Marquee() {
  return (
    <div className="tone-white overflow-hidden border-y border-separator/40 py-5">
      <p className="sr-only">Things you can snap: {snappable.map(([thing]) => thing).join(", ")}.</p>
      <div className="loop-marquee flex w-max" aria-hidden>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 gap-12 pr-12">
            {pass.map(([thing, color], i) => (
              <span key={i} className="flex items-center gap-2.5 whitespace-nowrap text-[19px] text-secondary">
                <span className="size-2.5 rounded-full" style={{ background: `var(--color-${color})` }} />
                {thing}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// The closing band is dark in both themes, so its gradient always uses the agents' bright colours.
const brightGradient = { "--color-g1": botColors.cyan, "--color-g2": botColors.blue, "--color-g3": botColors.violet, "--color-g4": botColors.pink } as CSSProperties;

function Closing() {
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-black px-4 py-24 text-center text-white sm:py-32" style={brightGradient}>
      <Glow color="var(--color-lens)" className="loop-drift -left-24 top-0 size-96" />
      <Glow color="var(--color-nudge)" className="loop-drift -right-24 bottom-0 size-96 [animation-delay:-6s]" />
      <Glow color="var(--color-violet)" className="loop-drift -bottom-48 left-1/3 size-96 [animation-delay:-11s]" />
      <Reveal className="relative">
        <div className="flex justify-center gap-3">
          {Object.values(agents).map((a, i) => (
            <span key={a.name} className="loop-bob" style={{ animationDelay: `${i * 0.4}s` }}>
              <Bot {...a} size={52} mood="awake" />
            </span>
          ))}
        </div>
        <h2 className="mt-8 text-[44px] leading-[1.05] tracking-[-0.03em] text-balance sm:text-[80px]">
          Point. Snap. <span className="text-gradient">Paid.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[19px] leading-[1.45] text-white/65 text-pretty">
          Four agents, one PayPal approval a week, and a money HQ that builds itself.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/lens" className="pressable flex h-12 items-center gap-1.5 rounded-full bg-white px-6 text-[17px] text-black">
            Try Flick <ArrowUpRight size={18} aria-hidden />
          </Link>
          <Link href="/dashboard" className="pressable flex h-12 items-center gap-1.5 rounded-full bg-white/15 px-6 text-[17px] text-white">
            Open Money Studio <ArrowUpRight size={18} aria-hidden />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Nav />
      <ShowDemo>
      <main>
        <Hero />
        <Marquee />
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
          agent={agents.lens}
          glow="left"
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
          agent={agents.autopilot}
          glow="left"
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
          agent={agents.splitter}
          glow="right"
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
          agent={agents.nudge}
          glow="left"
          label="Nudge"
          title="Get paid back, without the awkward bit."
          intro="Nudge keeps track of who still owes you and drafts a reminder that sounds like you. Pick a friend and a tone."
        >
          <Nudge />
        </Section>
        <Section
          id="ask"
          compact
          tone="white"
          label="Ask Flick"
          title="One sentence. Every agent."
          intro="Tell Flick what you need in plain words. It reads your real data, plans across Lens, Autopilot, Splitter and Nudge, and asks before it does anything."
        >
          <AskDemo />
        </Section>
        <Section
          id="studio"
          compact
          tone="grey"
          label="Money Studio"
          title="Your money HQ, built by an agent."
          intro="Every payment, request and reminder lands in Money Studio, an AG Studio workspace over your PayPal data."
        >
          <Studio />
        </Section>
        <Closing />
      </main>
      </ShowDemo>
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
