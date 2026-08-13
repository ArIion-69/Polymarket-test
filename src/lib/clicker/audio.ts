"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MUTE_KEY = "fine-tycoon-muted";

type SoundKind = "sip" | "crit" | "buy" | "boost" | "crisis" | "penalty" | "twist";

function createCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctx();
}

function beep(
  ctx: AudioContext,
  {
    freq,
    duration = 0.08,
    type = "sine",
    gain = 0.08,
    slideTo,
  }: {
    freq: number;
    duration?: number;
    type?: OscillatorType;
    gain?: number;
    slideTo?: number;
  }
) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseBurst(ctx: AudioContext, duration = 0.2, gain = 0.05) {
  const now = ctx.currentTime;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  src.buffer = buffer;
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start(now);
}

export function useClickerAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const ensure = useCallback(async () => {
    if (!ctxRef.current) ctxRef.current = createCtx();
    const ctx = ctxRef.current;
    if (ctx && ctx.state === "suspended") await ctx.resume();
    return ctx;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const play = useCallback(
    async (kind: SoundKind) => {
      if (muted) return;
      const ctx = await ensure();
      if (!ctx) return;

      switch (kind) {
        case "sip":
          beep(ctx, { freq: 520, duration: 0.06, type: "triangle", gain: 0.06, slideTo: 280 });
          break;
        case "crit":
          beep(ctx, { freq: 660, duration: 0.07, type: "square", gain: 0.05 });
          setTimeout(() => beep(ctx, { freq: 880, duration: 0.1, type: "square", gain: 0.05 }), 60);
          break;
        case "buy":
          beep(ctx, { freq: 400, duration: 0.05, type: "sine", gain: 0.05 });
          setTimeout(() => beep(ctx, { freq: 600, duration: 0.08, type: "sine", gain: 0.05 }), 50);
          break;
        case "boost":
          beep(ctx, { freq: 500, duration: 0.1, type: "sine", gain: 0.06, slideTo: 900 });
          break;
        case "crisis":
          noiseBurst(ctx, 0.25, 0.07);
          beep(ctx, { freq: 180, duration: 0.2, type: "sawtooth", gain: 0.04, slideTo: 90 });
          break;
        case "penalty":
          beep(ctx, { freq: 220, duration: 0.15, type: "sawtooth", gain: 0.05, slideTo: 110 });
          break;
        case "twist":
          beep(ctx, { freq: 300, duration: 0.08, type: "triangle", gain: 0.05, slideTo: 160 });
          setTimeout(() => beep(ctx, { freq: 700, duration: 0.12, type: "triangle", gain: 0.05 }), 120);
          break;
      }
    },
    [ensure, muted]
  );

  return { muted, toggleMute, play, unlock: ensure };
}
