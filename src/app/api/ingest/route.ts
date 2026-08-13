import { spawn } from "child_process";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function runIngest(): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const script = path.join(process.cwd(), "scripts", "ingest.ts");
    const child = spawn("npx", ["tsx", script], {
      cwd: process.cwd(),
      env: process.env,
      shell: true,
    });

    let output = "";
    child.stdout.on("data", (d) => {
      output += d.toString();
    });
    child.stderr.on("data", (d) => {
      output += d.toString();
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, output });
    });
  });
}

export async function POST() {
  try {
    const result = await runIngest();
    if (!result.ok) {
      return NextResponse.json(
        { error: "Ingest завершился с ошибкой", details: result.output.slice(-2000) },
        { status: 500 }
      );
    }
    const markets = result.output.match(/Markets=(\d+)/)?.[1] ?? "?";
    const news = result.output.match(/news=(\d+)/)?.[1] ?? "?";
    return NextResponse.json({
      message: `Обновлено: рынков ${markets}, новостей ${news}`,
      output: result.output.slice(-1500),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
