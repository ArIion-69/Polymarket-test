/**
 * Optional narrative rewrite via Z.ai GLM. Never computes probability —
 * only rephrases already-scored arguments when ZAI_API_KEY is set.
 */
export async function maybeRewriteArguments(
  question: string,
  argumentsList: string[],
  pYes: number,
  confidence: number
): Promise<string[] | null> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.ZAI_BASE_URL || "https://api.z.ai/api/paas/v4";
  const model = process.env.ZAI_MODEL || "glm-4.5-flash";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Ты переписываешь уже посчитанные аргументы прогноза простым русским языком. Не меняй цифры и не добавляй новые факты. Верни JSON-массив строк той же длины.",
          },
          {
            role: "user",
            content: JSON.stringify({
              question,
              pYes,
              confidence,
              arguments: argumentsList,
            }),
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn("Z.ai rewrite skipped:", res.status);
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map(String);
  } catch (err) {
    console.warn("Z.ai rewrite failed:", err);
    return null;
  }
}
