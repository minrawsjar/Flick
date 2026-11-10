"use client";

import { BellDot, CircleCheck, CloudOff, Download, Maximize, Share, Share2, SquarePlus, Zap } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { install, QrCode, useInstallWay, type InstallWay } from "@/components/pwa";
import { Logo, Primary } from "@/components/ui";

// /install: getting Flick onto a phone's home screen (or a computer's dock), whichever way this
// browser does it, and a QR code to carry it from a computer to a phone.

const never = () => () => {};

export function Install() {
  const way = useInstallWay();
  const origin = useSyncExternalStore(never, () => window.location.origin, () => null);

  return (
    <div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-[1fr_auto]">
      <div className="rounded-[28px] bg-card p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-separator/50 pb-5">
          <Logo size={56} />
          <span>
            <span className="block text-[19px]">Flick</span>
            <span className="block text-[13px] text-secondary">Snap it. Flick pays. Finance, free.</span>
          </span>
        </div>
        <Steps way={way} />
      </div>
      {origin && (
        <div className="flex items-center gap-5 rounded-[28px] bg-card p-6 max-md:hidden">
          <span className="rounded-2xl bg-white p-1.5">
            <QrCode text={`${origin}/install`} size={148} />
          </span>
          <p className="max-w-[12rem] text-[15px] leading-snug text-secondary">
            On a computer? Point your phone&apos;s camera here to open Flick on it.
          </p>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 md:col-span-2 lg:grid-cols-3">
        {perks.map(([Icon, title, text]) => (
          <li key={title} className="rounded-[22px] bg-card p-5">
            <Icon size={20} strokeWidth={1.75} aria-hidden />
            <p className="mt-3 text-[15px]">{title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-secondary">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Steps({ way }: { way: InstallWay }) {
  switch (way) {
    case "installed":
      return (
        <div>
          <p className="flex items-center gap-2 text-[19px]">
            <CircleCheck size={20} className="text-paid" aria-hidden /> Flick is installed.
          </p>
          <p className="mt-1 text-[15px] text-secondary">Open it from your home screen, or carry on here.</p>
          <Link href="/home" className="pressable mt-5 flex h-10 items-center justify-center rounded-full bg-ink text-[13px] text-on-ink">
            Go to Today
          </Link>
        </div>
      );
    case "prompt":
      return (
        <div>
          <p className="text-[19px]">One tap, no app store.</p>
          <p className="mt-1 text-[15px] text-secondary">Flick installs from this page and opens on its own, full screen.</p>
          <Primary onClick={() => void install()} className="mt-5 h-11 text-[15px]">
            <Download size={16} aria-hidden /> Install Flick
          </Primary>
        </div>
      );
    case "ios":
      return (
        <Numbered title="Three taps in Safari.">
          <li>
            Tap <Key><Share size={14} aria-label="Share" /></Key> at the bottom of the screen (top right on iPad).
          </li>
          <li>
            Scroll down, tap <Key><SquarePlus size={14} aria-hidden /> Add to Home Screen</Key>.
          </li>
          <li>
            Tap <Key>Add</Key>. Flick is on your home screen.
          </li>
        </Numbered>
      );
    case "mac-safari":
      return (
        <Numbered title="Add Flick to your Dock.">
          <li>
            In Safari&apos;s menu bar, choose <Key>File</Key> then <Key>Add to Dock</Key>.
          </li>
          <li>Flick opens from the Dock in its own window.</li>
        </Numbered>
      );
    case "menu":
      return (
        <Numbered title="From your browser's menu.">
          <li>
            Open the browser&apos;s menu (<Key>⋮</Key> or <Key>⋯</Key>).
          </li>
          <li>
            Choose <Key>Install app</Key> or <Key>Add to Home screen</Key>.
          </li>
          <li className="text-secondary">No such option? On iPhone use Safari; elsewhere Chrome or Edge.</li>
        </Numbered>
      );
    case "unknown":
      return <div className="h-32" />;
  }
}

function Numbered({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[19px]">{title}</p>
      <ol className="mt-4 grid list-inside list-decimal gap-3 text-[15px] leading-relaxed marker:text-secondary">{children}</ol>
    </div>
  );
}

const Key = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-flex items-center gap-1 rounded-lg bg-fill px-2 py-0.5 align-middle text-[13px]">{children}</span>
);

const perks = [
  [Maximize, "Full screen", "Opens like an app, on Today, without the browser around it."],
  [CloudOff, "Opens offline", "Your week and who owes you, as Flick last knew them. Paying waits for a connection."],
  [Share2, "Share photos to Lens", "On Android, share a photo from any app to Flick, and Lens reads it."],
  [Zap, "Shortcuts", "Long-press the icon: Snap a bill, This week, Ask Flick, Get paid back."],
  [BellDot, "A badge when you're needed", "The icon shows a count when the week waits for your OK or a payment fails."],
  [Download, "Nothing to download", "It's this site: always up to date, and removed like any other app."],
] as const;
