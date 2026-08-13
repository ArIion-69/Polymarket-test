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
      <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100/90">
        Аналитический прототип. Без реальных ставок и обещаний доходности. Прогноз считается
        из сохранённых данных по фиксированной формуле.
      </div>
    </header>
  );
}
