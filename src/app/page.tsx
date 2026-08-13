import Link from "next/link";
import { ConfidenceBadge, ProbabilityBar, RiskBadge } from "@/components/Badges";
import { RefreshButton } from "@/components/RefreshButton";
import { prisma } from "@/lib/db";
import { fmtDate, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

async function getEvents() {
  const events = await prisma.event.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      forecasts: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
    },
  });

  // Open markets first, then by latest snapshot volume24h
  events.sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    const va = a.snapshots[0]?.volume24h ?? 0;
    const vb = b.snapshots[0]?.volume24h ?? 0;
    return vb - va;
  });

  const lastRun = await prisma.ingestRun.findFirst({
    orderBy: { startedAt: "desc" },
    include: { source: true },
  });

  return { events, lastRun };
}

export default async function HomePage() {
  const { events, lastRun } = await getEvents();

  return (
    <div className="space-y-6">
      <section className="card flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white md:text-3xl">
            Список событий для прогноза
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Источники: Polymarket Gamma API + Google News RSS. Вероятность YES считается из
            сохранённых снимков рынка и заголовков по фиксированным весам (0.50 / 0.30 / 0.20).
          </p>
          {lastRun ? (
            <p className="mt-3 text-xs text-slate-500">
              Последнее обновление: {fmtDate(lastRun.startedAt)} · {lastRun.source.name} ·{" "}
              {lastRun.status}
            </p>
          ) : (
            <p className="mt-3 text-xs text-amber-300/90">
              База пуста. Нажмите «Обновить данные» или выполните <code>npm run ingest</code>.
            </p>
          )}
        </div>
        <RefreshButton />
      </section>

      {events.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          Пока нет событий. Запустите ingest, чтобы подтянуть рынки и новости.
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const forecast = event.forecasts[0];
            const snap = event.snapshots[0];
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="card block p-5 transition hover:border-cyan-400/30 hover:bg-slate-900/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-md bg-white/5 px-2 py-0.5">{event.category}</span>
                      <span
                        className={
                          event.status === "open" ? "text-emerald-300" : "text-slate-400"
                        }
                      >
                        {event.status === "open" ? "открыт" : "закрыт"}
                      </span>
                      {event.deadline ? <span>до {fmtDate(event.deadline)}</span> : null}
                      {event.resolution ? (
                        <span className="text-violet-300">
                          исход: {event.resolution.toUpperCase()}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="text-lg font-medium text-white">{event.question}</h2>
                  </div>
                  {forecast ? (
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Наш прогноз YES</div>
                        <div className="text-2xl font-semibold text-cyan-300">
                          {pct(forecast.pYes)}
                        </div>
                        <div className="text-xs text-slate-500">
                          рынок {pct(forecast.pMarket)} · Δ{" "}
                          {forecast.delta >= 0 ? "+" : ""}
                          {pct(forecast.delta)}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <ConfidenceBadge value={forecast.confidence} />
                        <RiskBadge level={forecast.riskLevel} />
                      </div>
                    </div>
                  ) : null}
                </div>
                {forecast && snap ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <ProbabilityBar label="Модель" value={forecast.pYes} tone="cyan" />
                    <ProbabilityBar label="Polymarket" value={forecast.pMarket} tone="violet" />
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
