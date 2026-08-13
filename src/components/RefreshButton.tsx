"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.details || `Ошибка обновления (${res.status})`);
      }
      setMessage(data.message || "Данные обновлены");
      startTransition(() => router.refresh());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
      >
        {loading ? "Обновляю…" : "Обновить данные"}
      </button>
      {message ? <span className="max-w-xs text-right text-xs text-slate-400">{message}</span> : null}
    </div>
  );
}
