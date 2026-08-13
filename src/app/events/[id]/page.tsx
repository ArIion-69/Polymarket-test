import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfidenceBadge, ProbabilityBar, RiskBadge } from "@/components/Badges";
import { prisma } from "@/lib/db";
import { fmtDate, fmtNum, parseJsonArray, parseJsonObject, pct, riskLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EventPage({ params }: Props) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      forecasts: {
        orderBy: { createdAt: "desc" },
        include: { factors: true, evaluations: { orderBy: { evaluatedAt: "desc" } } },
      },
      snapshots: { orderBy: { capturedAt: "desc" }, take: 8 },
      newsItems: { orderBy: [{ relevance: "desc" }, { capturedAt: "desc" }], take: 12 },
      indicators: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });

  if (!event) notFound();

  const forecast = event.forecasts[0];
  if (!forecast) {
    return (
      <div className="card p-6">
        <Link href="/" className="text-sm text-cyan-300">
          ← К списку
        </Link>
        <h1 className="mt-4 text-xl text-white">{event.question}</h1>
        <p className="mt-2 text-slate-400">Прогноз ещё не рассчитан. Запустите ingest.</p>
      </div>
    );
  }

  const args = parseJsonArray(forecast.argumentsJson);
  const risks = parseJsonArray(forecast.riskReasons);
  const formula = parseJsonObject(forecast.formulaJson);
  const contributionSum = forecast.factors.reduce((s, f) => s + f.contribution, 0);
  const evaluation =
    forecast.evaluations.find((e) => e.outcomeYes === 0 || e.outcomeYes === 1) ??
    forecast.evaluations[0] ??
    null;
  const indicator = event.indicators[0];
  const latestSnap = event.snapshots[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← К списку событий
        </Link>
      </div>

      <section className="card space-y-4 p-6">
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-md bg-white/5 px-2 py-0.5">{event.category}</span>
          <span>{event.status === "open" ? "открыт" : "закрыт"}</span>
          {event.deadline ? <span>дедлайн {fmtDate(event.deadline)}</span> : null}
          {event.resolution ? (
            <span className="text-violet-300">резолюция: {event.resolution.toUpperCase()}</span>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold text-white md:text-3xl">{event.question}</h1>
        {event.description ? (
          <p className="text-sm leading-relaxed text-slate-400 line-clamp-4">{event.description}</p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <div className="text-xs uppercase tracking-wide text-cyan-200/80">Прогноз YES</div>
            <div className="mt-1 text-4xl font-semibold text-cyan-200">{pct(forecast.pYes)}</div>
            <div className="mt-2 text-xs text-slate-400">создан {fmtDate(forecast.createdAt)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Уверенность</div>
            <div className="mt-1 text-3xl font-semibold text-white">
              {forecast.confidence.toFixed(0)}%
            </div>
            <div className="mt-3">
              <ConfidenceBadge value={forecast.confidence} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Риск</div>
            <div className="mt-1 text-3xl font-semibold text-white">
              {riskLabel(forecast.riskLevel)}
            </div>
            <div className="mt-3">
              <RiskBadge level={forecast.riskLevel} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ProbabilityBar label="Модель (наш YES)" value={forecast.pYes} tone="cyan" />
          <ProbabilityBar label="Polymarket YES" value={forecast.pMarket} tone="violet" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3 p-6">
          <h2 className="text-lg font-semibold text-white">Аргументы</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            {args.map((a, i) => (
              <li key={i} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                {a}
              </li>
            ))}
          </ul>
        </div>
        <div className="card space-y-3 p-6">
          <h2 className="text-lg font-semibold text-white">Почему может не сработать</h2>
          {risks.length === 0 ? (
            <p className="text-sm text-emerald-300/90">Явных флагов риска нет.</p>
          ) : (
            <ul className="space-y-2 text-sm text-amber-100/90">
              {risks.map((r, i) => (
                <li key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold text-white">Как сошлись цифры</h2>
        <p className="text-sm text-slate-400">
          logit = 0.50×logit(p_m) + 0.30×(news_evidence×2) + 0.20×(momentum×1.5); p_yes =
          σ(logit). Ниже — подстановка из <code>formula_json</code>.
        </p>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Фактор</th>
                <th className="px-3 py-2">Вес</th>
                <th className="px-3 py-2">Сырое</th>
                <th className="px-3 py-2">Вклад в logit</th>
                <th className="px-3 py-2">Пояснение</th>
              </tr>
            </thead>
            <tbody>
              {forecast.factors.map((f) => (
                <tr key={f.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white">{f.label}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{fmtNum(f.weight, 2)}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{fmtNum(f.rawValue, 4)}</td>
                  <td className="px-3 py-2 font-mono text-cyan-200">{fmtNum(f.contribution, 4)}</td>
                  <td className="px-3 py-2 text-slate-400">{f.explanation}</td>
                </tr>
              ))}
              <tr className="border-t border-cyan-400/20 bg-cyan-500/5 font-medium">
                <td className="px-3 py-2 text-white" colSpan={3}>
                  Сумма вкладов (= logit)
                </td>
                <td className="px-3 py-2 font-mono text-cyan-200">{fmtNum(contributionSum, 4)}</td>
                <td className="px-3 py-2 text-slate-400">
                  σ({fmtNum(Number(formula.logit ?? contributionSum), 4)}) ={" "}
                  {pct(Number(formula.p_yes ?? forecast.pYes))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 rounded-xl bg-black/30 p-4 font-mono text-xs text-slate-300 md:grid-cols-2">
          <div>p_m = {fmtNum(Number(formula.p_m), 4)}</div>
          <div>logit_m = {fmtNum(Number(formula.logit_m), 4)}</div>
          <div>news_evidence = {fmtNum(Number(formula.news_evidence), 4)}</div>
          <div>momentum = {fmtNum(Number(formula.momentum), 4)}</div>
          <div>coverage = {fmtNum(Number(formula.coverage), 4)}</div>
          <div>weighted_polarity = {fmtNum(Number(formula.weighted_polarity), 4)}</div>
          <div>logit = {fmtNum(Number(formula.logit), 4)}</div>
          <div>p_yes = {fmtNum(Number(formula.p_yes), 4)}</div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3 p-6">
          <h2 className="text-lg font-semibold text-white">Использованные новости</h2>
          {event.newsItems.length === 0 ? (
            <p className="text-sm text-slate-400">Новостей не найдено.</p>
          ) : (
            <ul className="space-y-3">
              {event.newsItems.map((n) => (
                <li key={n.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-cyan-200 hover:underline"
                  >
                    {n.title}
                  </a>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{n.publisher || "источник?"}</span>
                    <span>{fmtDate(n.publishedAt)}</span>
                    <span>polarity {fmtNum(n.polarity)}</span>
                    <span>recency {fmtNum(n.recencyWeight)}</span>
                    <span>relevance {fmtNum(n.relevance)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-3 p-6">
          <h2 className="text-lg font-semibold text-white">Снимки рынка</h2>
          {latestSnap && indicator ? (
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>volume24h: {latestSnap.volume24h.toLocaleString("ru-RU")}</div>
              <div>liquidity: {latestSnap.liquidity.toLocaleString("ru-RU")}</div>
              <div>1d change: {(latestSnap.oneDayPriceChange * 100).toFixed(2)} п.п.</div>
              <div>liquidity_score: {fmtNum(indicator.liquidityScore)}</div>
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-2 py-2">Время</th>
                  <th className="px-2 py-2">YES</th>
                  <th className="px-2 py-2">NO</th>
                  <th className="px-2 py-2">Spread</th>
                </tr>
              </thead>
              <tbody>
                {event.snapshots.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="px-2 py-2 text-slate-400">{fmtDate(s.capturedAt)}</td>
                    <td className="px-2 py-2 font-mono text-cyan-200">{pct(s.yesPrice)}</td>
                    <td className="px-2 py-2 font-mono">{pct(s.noPrice)}</td>
                    <td className="px-2 py-2 font-mono">{pct(s.spread)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">Как система понимает, что ошиблась</h2>
        {evaluation ? (
          <div className="space-y-2 text-sm text-slate-300">
            {evaluation.outcomeYes === 0 || evaluation.outcomeYes === 1 ? (
              <>
                <p>
                  Исход: <strong>{evaluation.outcomeYes === 1 ? "YES" : "NO"}</strong> · Brier ={" "}
                  <strong>{fmtNum(evaluation.brierScore, 3)}</strong> ·{" "}
                  {evaluation.wasWrong ? (
                    <span className="text-rose-300">зафиксирован промах</span>
                  ) : (
                    <span className="text-emerald-300">сторона совпала</span>
                  )}
                </p>
                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  {evaluation.attribution}
                </p>
              </>
            ) : (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100">
                {evaluation.attribution}
              </p>
            )}
            {parseJsonArray(evaluation.revisionTriggers || "[]").length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-slate-400">
                {parseJsonArray(evaluation.revisionTriggers || "[]").map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">Условий немедленного пересмотра нет.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Для открытых рынков пересмотр срабатывает при расхождении &gt;15 п.п. с рынком или ≥3
            противоположных заголовках. После резолюции считается Brier и атрибуция фактора.
          </p>
        )}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">История прогнозов</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Время</th>
                <th className="px-3 py-2">Модель</th>
                <th className="px-3 py-2">Рынок</th>
                <th className="px-3 py-2">Δ</th>
                <th className="px-3 py-2">Увер.</th>
                <th className="px-3 py-2">Риск</th>
              </tr>
            </thead>
            <tbody>
              {event.forecasts.map((f) => (
                <tr key={f.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-400">{fmtDate(f.createdAt)}</td>
                  <td className="px-3 py-2 font-mono text-cyan-200">{pct(f.pYes)}</td>
                  <td className="px-3 py-2 font-mono">{pct(f.pMarket)}</td>
                  <td className="px-3 py-2 font-mono">
                    {f.delta >= 0 ? "+" : ""}
                    {pct(f.delta)}
                  </td>
                  <td className="px-3 py-2">{f.confidence.toFixed(0)}%</td>
                  <td className="px-3 py-2">{riskLabel(f.riskLevel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
