import { NextResponse } from "next/server";

const DEFAULT_OPENOLLAMA_URL = "http://localhost:11434/v1";

function getOpenOllamaBaseUrl() {
  return (process.env.OPENOLLAMA_BASE_URL ?? DEFAULT_OPENOLLAMA_URL).replace(
    /\/v1\/?$/,
    ""
  );
}

export async function GET() {
  const baseUrl = getOpenOllamaBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { models: [], error: `OpenOllama respondeu com HTTP ${response.status}.` },
        { status: 502 }
      );
    }

    const payload: unknown = await response.json();
    const models =
      payload && typeof payload === "object" && "models" in payload && Array.isArray(payload.models)
        ? payload.models
            .map((model) =>
              model && typeof model === "object" && "name" in model && typeof model.name === "string"
                ? model.name
                : null
            )
            .filter((model): model is string => model !== null)
        : [];

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json(
      { models: [], error: "OpenOllama não está disponível." },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
