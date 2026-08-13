import { WEIGHTS, NEWS_SCALE, MOMENTUM_SCALE } from "@/lib/scoring";

export default function MethodologyPage() {
  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-6">
        <h1 className="text-2xl font-semibold text-white">Методика</h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Тема прототипа: <strong className="text-slate-200">сбудется ли событие на Polymarket</strong>{" "}
          (вероятность YES до дедлайна). Это аналитика, а не торговый бот: реальные деньги и ставки
          не подключаются, доходность не обещается.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">Источники данных (≥2)</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>
            <strong>Polymarket Gamma API</strong> — вопрос, цены YES/NO, volume/volume24h,
            liquidity, spread, oneDayPriceChange.
          </li>
          <li>
            <strong>Google News RSS</strong> — заголовки по запросу из сущностей вопроса (без
            API-ключа).
          </li>
        </ol>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">База данных</h2>
        <p className="text-sm text-slate-400">
          SQLite (Prisma): sources → ingest_runs → raw_records; events → market_snapshots,
          news_items, indicators, forecasts → forecast_factors, evaluations. Прогноз всегда
          читается из таблицы forecasts, а не генерируется «на лету» без сохранения.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">Алгоритм</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>
            Веса: рынок {WEIGHTS.market}, новости {WEIGHTS.news}, импульс {WEIGHTS.momentum}
          </li>
          <li>
            Новости: лексиконы YES/NO + отрицание, релевантность по пересечению токенов, свежесть
            exp(−age_hours/48)
          </li>
          <li>
            Формула:
            <pre className="mt-2 overflow-x-auto rounded-xl bg-black/40 p-3 text-xs text-cyan-100">{`p_m = clip(yesPrice, 0.02, 0.98)
logit_m = ln(p_m / (1 - p_m))
news_evidence = polarity × (0.5 + 0.5×recency) × (0.3 + 0.7×coverage)
momentum = clip(oneDayPriceChange / 0.10, -1, 1)
logit = ${WEIGHTS.market}×logit_m + ${WEIGHTS.news}×(news_evidence×${NEWS_SCALE}) + ${WEIGHTS.momentum}×(momentum×${MOMENTUM_SCALE})
p_yes = 1 / (1 + e^(-logit))`}</pre>
          </li>
        </ul>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">Какие цифры должны сходиться</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Сумма вкладов факторов = logit в formula_json</li>
          <li>σ(logit) = p_yes в forecasts</li>
          <li>p_market берётся из последнего market_snapshots.yesPrice</li>
          <li>Аргументы и риск ссылаются на те же сохранённые indicators/news_items</li>
        </ul>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">Ошибка и пересмотр</h2>
        <p className="text-sm text-slate-300">
          После резолюции: Brier = (p − y)²; промах, если сторона p≥0.5 не совпала с исходом или
          Brier &gt; 0.25; в attribution указывается фактор с наибольшим |вкладом| не в ту сторону.
          Пока рынок открыт: пересмотр при |модель − рынок| &gt; 15 п.п. или ≥3 противоположных
          заголовках.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">AI</h2>
        <p className="text-sm text-slate-300">
          Вероятность считается детерминированно без нейросети. Если задан{" "}
          <code>ZAI_API_KEY</code>, опционально переписываются уже посчитанные аргументы через
          GLM (Z.ai) — без изменения чисел.
        </p>
      </section>
    </div>
  );
}
