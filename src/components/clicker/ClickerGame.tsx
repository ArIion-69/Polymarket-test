"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyIdle,
  clickPower,
  comboCap,
  cps,
  crisisLossRate,
  critChance,
  currentStage,
  formatCope,
  PREMIUM_OFFERS,
  resolveClick,
  STAGES,
  tryBuyUpgrade,
  applyPremium,
  upgradeCost,
  UPGRADES,
  type ClickerState,
  type PremiumKey,
  type UpgradeKey,
} from "@/lib/clicker/economy";
import { useClickerAudio } from "@/lib/clicker/audio";

type LogItem = { id: string; kind: string; title: string; detail: string; createdAt: string };
type PurchaseItem = { id: string; sku: string; kind: string; cost: number; createdAt: string };

type LiveEvent = {
  kind: "boost" | "crisis" | "penalty" | "twist";
  title: string;
  detail: string;
  until: number;
  multiplier: number;
  blockClicks: boolean;
};

const EVENT_POOL: Array<Omit<LiveEvent, "until">> = [
  {
    kind: "boost",
    title: "Reddit front page",
    detail: "Мем залетел. Cope ×2 на 18 секунд.",
    multiplier: 2,
    blockClicks: false,
  },
  {
    kind: "crisis",
    title: "Приехала пожарная",
    detail: "Клики не работают 10 секунд. Idle тоже чахнет.",
    multiplier: 0.2,
    blockClicks: true,
  },
  {
    kind: "penalty",
    title: "Автор комикса хочет роялти",
    detail: "Штраф: часть cope уходит на «лицензию».",
    multiplier: 1,
    blockClicks: false,
  },
  {
    kind: "twist",
    title: "This is NOT fine",
    detail: "Пёс паникует. Следующие глотки слабые, потом взрыв хайпа.",
    multiplier: 0.25,
    blockClicks: false,
  },
];

function MemeArt({ sipping, fire }: { sipping: boolean; fire: number }) {
  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-orange-400/25 bg-black/40">
      <div
        className={`relative aspect-square w-full transition duration-150 ${sipping ? "scale-[1.03] brightness-110" : ""}`}
      >
        <Image
          src="/clicker/this-is-fine.png"
          alt="This is fine — пёс пьёт кофе в горящей комнате"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover object-center"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-orange-950/50 via-transparent to-transparent"
          style={{ opacity: 0.35 + fire * 0.08 }}
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] uppercase tracking-wide text-amber-100">
          this is fine
        </div>
      </div>
    </div>
  );
}

export function ClickerGame({
  initial,
}: {
  initial: { state: ClickerState; events: LogItem[]; purchases: PurchaseItem[] };
}) {
  const [state, setState] = useState<ClickerState>(initial.state);
  const [combo, setCombo] = useState(0);
  const [sipping, setSipping] = useState(false);
  const [floaters, setFloaters] = useState<Array<{ id: number; text: string; crit: boolean }>>([]);
  const [live, setLive] = useState<LiveEvent | null>(null);
  const [ad, setAd] = useState<string | null>(null);
  const [logs, setLogs] = useState(initial.events);
  const [purchases, setPurchases] = useState(initial.purchases);
  const [message, setMessage] = useState<string | null>(null);
  const comboTimer = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  const clicksSinceEvent = useRef(0);
  const floaterId = useRef(0);
  const { muted, toggleMute, play, unlock } = useClickerAudio();

  stateRef.current = state;
  const stageMeta = STAGES[state.stage] ?? STAGES[0];

  const persist = useCallback((next: ClickerState) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetch("/api/clicker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", state: next }),
      }).catch(() => null);
    }, 400);
  }, []);

  const recordEvent = useCallback(async (kind: string, title: string, detail: string, nextState: ClickerState) => {
    setLogs((prev) => [
      { id: crypto.randomUUID(), kind, title, detail, createdAt: new Date().toISOString() },
      ...prev,
    ].slice(0, 12));
    await fetch("/api/clicker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "event", event: { kind, title, detail }, state: nextState }),
    }).catch(() => null);
  }, []);

  useEffect(() => {
    const idle = applyIdle(stateRef.current);
    if (idle.gained > 0.05) {
      setState(idle.state);
      persist(idle.state);
    }
    const t = window.setInterval(() => {
      setState((prev) => {
        let rate = cps(prev);
        if (live?.kind === "crisis") rate *= live.multiplier;
        if (live?.kind === "boost") rate *= live.multiplier;
        const gained = rate * 0.25;
        if (gained <= 0) {
          const tick = { ...prev, lastTick: new Date().toISOString() };
          return tick;
        }
        const next = {
          ...prev,
          cope: prev.cope + gained,
          totalCope: prev.totalCope + gained,
          lastTick: new Date().toISOString(),
          stage: currentStage(prev.totalCope + gained),
        };
        persist(next);
        return next;
      });
    }, 250);
    return () => window.clearInterval(t);
  }, [live, persist]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setLive((cur) => {
        if (cur && Date.now() > cur.until) {
          if (!stateRef.current.premium.noAds) {
            setAd("Реклама демо: Fine Insurance — «ваш дом уже горит, оформите полис»");
            window.setTimeout(() => setAd(null), 2800);
          }
          return null;
        }
        return cur;
      });
    }, 400);
    return () => window.clearInterval(t);
  }, []);

  const spawnEvent = useCallback(
    (nextState: ClickerState) => {
      if (live) return;
      const pool = EVENT_POOL;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const duration = pick.kind === "crisis" ? 10000 : pick.kind === "boost" ? 18000 : 12000;
      let after = nextState;
      if (pick.kind === "penalty") {
        const lost = nextState.cope * crisisLossRate(nextState);
        after = { ...nextState, cope: Math.max(0, nextState.cope - lost) };
        setState(after);
        persist(after);
      }
      setLive({ ...pick, until: Date.now() + duration });
      void play(pick.kind);
      void recordEvent(pick.kind, pick.title, pick.detail, after);
    },
    [live, persist, play, recordEvent]
  );

  function sip() {
    void unlock();
    if (ad) return;
    if (live?.blockClicks) {
      setMessage("Пожарные не дают пить кофе");
      void play("crisis");
      return;
    }
    const result = resolveClick(state, combo);
    let gain = result.gain;
    if (live?.kind === "boost") gain *= live.multiplier;
    if (live?.kind === "twist") gain *= live.multiplier;
    const next = {
      ...result.state,
      cope: state.cope + gain,
      totalCope: state.totalCope + gain,
      stage: currentStage(state.totalCope + gain),
    };
    setState(next);
    persist(next);
    setCombo(result.combo);
    setSipping(true);
    window.setTimeout(() => setSipping(false), 120);
    if (comboTimer.current) window.clearTimeout(comboTimer.current);
    comboTimer.current = window.setTimeout(() => setCombo(0), 700);

    void play(result.crit ? "crit" : "sip");

    const id = ++floaterId.current;
    setFloaters((f) => [...f.slice(-8), { id, text: `+${formatCope(gain)}`, crit: result.crit }]);
    window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 700);

    clicksSinceEvent.current += 1;
    if (clicksSinceEvent.current >= 14 + Math.floor(Math.random() * 10)) {
      clicksSinceEvent.current = 0;
      spawnEvent(next);
    }
  }

  async function buy(key: UpgradeKey) {
    const local = tryBuyUpgrade(state, key);
    if (!local.ok) {
      setMessage(local.reason || "Нельзя купить");
      return;
    }
    setState(local.state);
    persist(local.state);
    setPurchases((p) => [
      {
        id: crypto.randomUUID(),
        sku: key,
        kind: "upgrade",
        cost: local.cost,
        createdAt: new Date().toISOString(),
      },
      ...p,
    ].slice(0, 12));
    setMessage(`Куплено: ${UPGRADES.find((u) => u.key === key)?.name}`);
    void play("buy");
    await fetch("/api/clicker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "buy", key, state: local.state, cost: local.cost }),
    }).catch(() => null);
  }

  async function buyPremium(key: PremiumKey) {
    const local = applyPremium(state, key);
    if (!local.ok) {
      setMessage(local.reason || "Уже есть");
      return;
    }
    setState(local.state);
    persist(local.state);
    setPurchases((p) => [
      {
        id: crypto.randomUUID(),
        sku: key,
        kind: "iap_demo",
        cost: 0,
        createdAt: new Date().toISOString(),
      },
      ...p,
    ].slice(0, 12));
    setMessage("Демо-покупка применена. Реальной оплаты нет.");
    void play("buy");
    await fetch("/api/clicker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "premium", key, state: local.state }),
    }).catch(() => null);
  }

  const power = useMemo(() => clickPower(state), [state]);
  const idle = useMemo(() => cps(state), [state]);
  const nextStage = STAGES[state.stage + 1];

  return (
    <div className="space-y-5">
      {ad ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="card max-w-sm p-6 text-center">
            <div className="text-xs uppercase tracking-widest text-amber-300">Ad break · демо</div>
            <p className="mt-3 text-sm text-slate-200">{ad}</p>
            <p className="mt-2 text-xs text-slate-500">Это макет рекламы, денег нет</p>
          </div>
        </div>
      ) : null}

      <section className="card overflow-hidden p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-300">This is Fine Tycoon</div>
            <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Пей кофе, пока горит</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Мем KC Green: пёс в горящей комнате. Ресурс — <strong className="text-amber-200">cope</strong>.
              Глоток кофе (клик/тап) даёт cope. Улучшения меняют клики, idle, криты и комбо.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {state.premium.battlePass ? (
              <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs text-amber-200">
                Сезон дыма
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void unlock();
                toggleMute();
              }}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              aria-label={muted ? "Включить звук" : "Выключить звук"}
              title={muted ? "Включить звук" : "Выключить звук"}
            >
              {muted ? "🔇 Звук выкл" : "🔊 Звук вкл"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Cope" value={formatCope(state.cope)} />
          <Stat label="За клик" value={formatCope(power)} />
          <Stat label="Idle / сек" value={idle > 0 ? formatCope(idle) : "нет"} />
          <Stat label="Этап" value={`${state.stage + 1}/5`} />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>{stageMeta.name}</span>
            {nextStage ? (
              <span>
                до «{nextStage.name}»: {formatCope(Math.max(0, nextStage.unlockAt - state.totalCope))}
              </span>
            ) : (
              <span>максимальный мем</span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500"
              style={{
                width: `${Math.min(100, nextStage ? ((state.totalCope - stageMeta.unlockAt) / (nextStage.unlockAt - stageMeta.unlockAt)) * 100 : 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-400">{stageMeta.blurb}</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="card relative p-4 sm:p-6">
          {live ? (
            <div
              className={`mb-3 rounded-xl border px-3 py-2 text-sm ${
                live.kind === "boost"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : live.kind === "crisis"
                    ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              <div className="font-medium">{live.title}</div>
              <div className="text-xs opacity-80">{live.detail}</div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={sip}
            className="relative mx-auto flex w-full max-w-md flex-col items-center rounded-3xl border border-orange-400/20 bg-gradient-to-b from-orange-950/40 to-slate-950 p-4 transition active:scale-[0.98] sm:p-6"
          >
            <MemeArt fire={stageMeta.fire} sipping={sipping} />
            <span className="mt-2 text-lg font-semibold text-amber-100">Глоток кофе</span>
            <span className="text-xs text-slate-400">тап / клик · {state.clicks} глотков</span>
            {comboCap(state) > 0 ? (
              <span className="mt-2 text-xs text-cyan-200">
                комбо {combo}/{comboCap(state)}
              </span>
            ) : null}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {floaters.map((f) => (
                <span
                  key={f.id}
                  className={`absolute left-1/2 top-8 -translate-x-1/2 animate-bounce text-sm font-bold ${f.crit ? "text-yellow-300" : "text-orange-200"}`}
                >
                  {f.crit ? "CRIT " : ""}
                  {f.text}
                </span>
              ))}
            </div>
          </button>
          {message ? <p className="mt-3 text-center text-xs text-slate-400">{message}</p> : null}
          <p className="mt-3 text-center text-xs text-slate-500">
            крит {Math.round(critChance(state) * 100)}% · страховка держит {Math.round(crisisLossRate(state) * 100)}%
            потерь
          </p>
        </section>

        <section className="card space-y-3 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Улучшения</h2>
          <div className="space-y-2">
            {UPGRADES.map((u) => {
              const locked = state.stage < u.unlockStage;
              const level = state.upgrades[u.key];
              const cost = upgradeCost(u, level);
              const maxed = level >= u.max;
              return (
                <button
                  key={u.key}
                  type="button"
                  disabled={locked || maxed || state.cope < cost}
                  onClick={() => buy(u.key)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left disabled:opacity-40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-white">
                        {u.name}{" "}
                        <span className="text-xs text-slate-500">
                          lv {level}/{u.max}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">{u.description}</div>
                      <div className="mt-1 text-[11px] text-amber-200/80">
                        {u.kind === "mechanic" ? "механика: " : "стат: "}
                        {u.mechanic}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm text-orange-200">
                      {locked ? `этап ${u.unlockStage + 1}` : maxed ? "MAX" : formatCope(cost)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card space-y-3 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Как игра зарабатывала бы деньги</h2>
        <p className="text-xs text-slate-500">Макеты IAP. Реальной оплаты нет — кнопка сразу выдаёт эффект.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PREMIUM_OFFERS.map((o) => (
            <div key={o.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-sm font-medium text-white">{o.name}</div>
              <div className="text-xs text-amber-200">{o.priceLabel}</div>
              <p className="mt-2 text-xs text-slate-400">{o.pitch}</p>
              <p className="mt-1 text-[11px] text-slate-500">{o.effect}</p>
              <button
                type="button"
                disabled={state.premium[o.key]}
                onClick={() => buyPremium(o.key)}
                className="mt-3 w-full rounded-lg bg-orange-500/20 px-3 py-2 text-sm text-orange-100 disabled:opacity-40"
              >
                {state.premium[o.key] ? "Куплено (демо)" : "Взять в демо"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Лента событий</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {logs.length === 0 ? (
              <li className="text-slate-500">Пока тихо. Пей кофе — события приходят пачками кликов.</li>
            ) : (
              logs.map((e) => (
                <li key={e.id} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                  <span className="text-xs uppercase text-slate-500">{e.kind}</span>
                  <div className="text-slate-200">{e.title}</div>
                  <div className="text-xs text-slate-400">{e.detail}</div>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Покупки в базе</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {purchases.length === 0 ? (
              <li className="text-slate-500">Улучшения и демо-IAP появятся здесь.</li>
            ) : (
              purchases.map((p) => (
                <li key={p.id} className="flex justify-between rounded-lg border border-white/5 px-3 py-2 text-slate-300">
                  <span>
                    {p.sku} · {p.kind}
                  </span>
                  <span className="font-mono text-orange-200">{p.cost ? formatCope(p.cost) : "демо"}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
