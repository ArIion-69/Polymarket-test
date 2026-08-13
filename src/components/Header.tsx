"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "События" },
  { href: "/methodology", label: "Методика" },
  { href: "/clicker", label: "Кликер" },
];

export function Header() {
  const pathname = usePathname();
  const onClicker = pathname.startsWith("/clicker");

  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={onClicker ? "/clicker" : "/"} className="group">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
            {onClicker ? "Meme Tycoon" : "Future Predictor"}
          </div>
          <div className="text-lg font-semibold text-white group-hover:text-cyan-200">
            {onClicker ? "This is Fine · кликер" : "Polymarket · новости → вероятность"}
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 ${
                  active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                } ${l.href === "/clicker" ? "border border-orange-400/40 text-orange-100" : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
