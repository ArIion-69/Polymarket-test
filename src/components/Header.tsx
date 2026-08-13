import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="group">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
            Future Predictor
          </div>
          <div className="text-lg font-semibold text-white group-hover:text-cyan-200">
            Polymarket · новости → вероятность
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white"
          >
            События
          </Link>
          <Link
            href="/methodology"
            className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Методика
          </Link>
        </nav>
      </div>
    </header>
  );
}
