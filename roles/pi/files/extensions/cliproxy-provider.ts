/**
 * cliproxy-provider extension
 *
 * Registers a `cliproxy` provider whose model list comes from the proxy itself,
 * so a model enabled in cliproxy shows up in /model without editing models.json.
 * Only OpenAI-account chat models: `/v1/models` says who owns a model, the Codex
 * catalog (`?client_version=`) has limits and reasoning levels. Image models
 * have no `max_tokens` there and are skipped.
 *
 * Pi refreshes from the network at interactive startup and on `pi update --models`;
 * every other refresh is offline, so the list is persisted and served from there.
 */

import type { ExtensionAPI, ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";

const PROVIDER = "cliproxy";
const BASE_URL = "https://cliproxy.modestlab.dev/v1";
const API = "openai-responses";
const THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;
// The proxy reports 272K for models that accept longer contexts; raise those.
const DEFAULT_CONTEXT = 272_000;
const LONG_CONTEXT = 1_050_000;

interface CodexModel {
  slug: string;
  display_name?: string;
  context_window?: number;
  max_tokens?: number;
  input_modalities?: string[];
  supported_reasoning_levels?: { effort: string }[];
}

async function fetchJson<T>(path: string, key: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${key}` }, signal });
  if (!res.ok) throw new Error(`cliproxy ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchModels(key: string, signal: AbortSignal): Promise<ProviderModelConfig[]> {
  const [list, catalog] = await Promise.all([
    fetchJson<{ data: { id: string; owned_by: string }[] }>("/models", key, signal),
    fetchJson<{ models: CodexModel[] }>("/models?client_version=0.200.0", key, signal),
  ]);
  const openai = new Set(list.data.filter((m) => m.owned_by === "openai").map((m) => m.id));
  // The proxy has no prices; Pi's bundled openai catalog does. Models it lacks stay at 0
  // unless models.json sets `cost` in modelOverrides.
  const prices = new Map(getBuiltinModels("openai").map((m) => [m.id, m.cost]));

  return catalog.models
    .filter((m) =>
      openai.has(m.slug) // only OpenAI-account models for now
      && m.max_tokens // image models (gpt-image-*) look like chat models in the Codex catalog; only their missing max_tokens tells them apart
      && m.context_window // Pi requires both limits, so a model without them is skipped rather than given made-up ones
    )
    .map((m) => {
      const efforts = new Set((m.supported_reasoning_levels ?? []).map((l) => l.effort));
      return {
        id: m.slug,
        name: m.display_name ?? m.slug,
        api: API,
        reasoning: efforts.size > 0,
        thinkingLevelMap: efforts.size
          ? Object.fromEntries(THINKING_LEVELS.map((l) => [l, efforts.has(l) ? l : null]))
          : undefined,
        input: m.input_modalities?.includes("image") ? ["text", "image"] : ["text"],
        contextWindow: m.context_window === DEFAULT_CONTEXT ? LONG_CONTEXT : m.context_window!,
        maxTokens: m.max_tokens!,
        cost: prices.get(m.slug) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      } as ProviderModelConfig;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider(PROVIDER, {
    name: "CLIProxy",
    baseUrl: BASE_URL,
    api: API,
    async refreshModels(context) {
      const stored = context.stored?.models as ProviderModelConfig[] | undefined;
      const key = context.credential?.type === "api_key" ? context.credential.key : undefined;
      if (!context.allowNetwork || !key) return stored ?? [];
      try {
        const models = await fetchModels(key, context.signal);
        await context.publish({ persist: { models: models as any, checkedAt: Date.now() } });
        return models;
      } catch (err) {
        if (context.signal.aborted) return stored ?? [];
        console.error(`[${PROVIDER}] model refresh failed:`, err);
        return stored ?? [];
      }
    },
  });
}
