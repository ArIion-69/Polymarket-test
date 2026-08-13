import { pct, riskClass, riskLabel } from "@/lib/format";

export function ProbabilityBar({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: number;
  tone?: "cyan" | "violet" | "emerald";
}) {
  const colors = {
    cyan: "from-cyan-400 to-sky-500",
    violet: "from-violet-400 to-fuchsia-500",
    emerald: "from-emerald-400 to-teal-500",
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-white">{pct(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors[tone]}`}
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${riskClass(level)}`}>
      Риск: {riskLabel(level)}
    </span>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-200">
      Уверенность: {value.toFixed(0)}%
    </span>
  );
}
