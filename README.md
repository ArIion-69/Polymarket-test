# Polymarket Predictor

Прототип «предсказателя будущего»: вероятность YES по открытым рынкам [Polymarket](https://polymarket.com), посчитанная из **сохранённых** котировок и новостей по прозрачной формуле (не рандомайзер).

> Аналитика только. Без реальных ставок и обещаний доходности.

## Тема

**Сбудется ли событие на Polymarket до дедлайна?**  
Список живых (и нескольких закрытых) бинарных рынков → карточка прогноза с уверенностью, риском, аргументами и разбором формулы.

## Источники данных (≥2)

| Источник                                                            | Что берём                                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Polymarket Gamma API** `https://gamma-api.polymarket.com/markets` | вопрос, YES/NO цена, volume, volume24h, liquidity, spread, oneDay/oneWeek change, статус |
| **Google News RSS** `https://news.google.com/rss/search?q=…`        | заголовки, издатель, дата; запрос строится из сущностей вопроса                          |

Ключи API не обязательны. Опционально `ZAI_API_KEY` — только пересказ уже посчитанных аргументов (вероятность AI **не** считает).

## Стек

- Next.js 15 (App Router) + TypeScript + Tailwind
- SQLite + Prisma
- `tsx` скрипт ingest

## Запуск

```bash
npm install
cp .env.example .env   # уже есть DATABASE_URL=file:./dev.db
npx prisma migrate dev --name init
npm run db:seed        # источники polymarket + google_news
npm run ingest         # тянет рынки + новости, считает прогнозы
npm run dev            # http://localhost:3000
```

В UI кнопка **«Обновить данные»** вызывает тот же ingest через `/api/ingest`.

## Схема базы

- `sources` — polymarket, google_news
- `ingest_runs` — история обновлений
- `raw_records` — сырой JSON/фрагмент ответа
- `events` — бинарный рынок
- `market_snapshots` — снимки цен/объёмов
- `news_items` — новости с polarity/recency/relevance
- `indicators` — нормализованные показатели
- `forecasts` + `forecast_factors` — прогноз и вклады в logit
- `evaluations` — Brier / промах / условия пересмотра

Поток: API/RSS → raw → snapshots/news → indicators → forecast (только из БД в UI).

## Алгоритм

Фиксированные веса:

- рынок **0.50**
- новости **0.30**
- импульс цены YES **0.20**

```
p_m     = clip(yesPrice, 0.02, 0.98)
logit_m = ln(p_m / (1 - p_m))

news_evidence = polarity × (0.5 + 0.5×recency) × (0.3 + 0.7×coverage)
momentum      = clip(oneDayPriceChange / 0.10, -1, 1)

logit = 0.50×logit_m + 0.30×(news_evidence×2) + 0.20×(momentum×1.5)
p_yes = 1 / (1 + e^(-logit))
```

Новости без нейросети: лексиконы YES/NO + отрицание (`not approved`), релевантность = пересечение токенов с вопросом, свежесть `exp(-age_hours/48)`.

**Уверенность (0–100):** coverage×40% + согласие знака новостей с рынком×35% + liquidity_score×25%.

**Риск:** мало новостей / противоречие рынку / низкая ликвидность / широкий спред / дедлайн &lt; 48ч.

**Ошибка:** после резолюции Brier `(p−y)²`; промах если сторона не совпала или Brier &gt; 0.25; атрибуция по фактору с наибольшим |вкладом|. Пока открыт — пересмотр при Δ с рынком &gt; 15 п.п. или ≥3 противоположных заголовках.

## Какие цифры должны сходиться

1. Сумма `forecast_factors.contribution` = `formula_json.logit`
2. `σ(logit)` = `forecasts.pYes`
3. `forecasts.pMarket` = последний `market_snapshots.yesPrice` (clip 0.02–0.98)
4. Аргументы на карточке ссылаются на те же indicators / news_items

Пересчёт руками по `formula_json` на карточке события должен дать тот же `p_yes`.

## AI

- Вероятность — детерминированный scoring в `src/lib/scoring.ts`
- Опционально Z.ai GLM (`ZAI_API_KEY`, `ZAI_BASE_URL`, `ZAI_MODEL`) только перефразирует аргументы

## Скриншоты

См. папку [`screenshots/`](./screenshots/):

1. `01-list.png` — список событий
2. `02-card.png` — карточка прогноза с формулой
3. `03-methodology.png` — методика

## Git

Репозиторий: https://github.com/ArIion-69/Polymarket-test

```bash
git clone https://github.com/ArIion-69/Polymarket-test.git
```

## Страницы

- `/` — список событий
- `/events/[id]` — карточка прогноза
- `/methodology` — методика

## Лицензия

Учебный прототип для тестового задания.
