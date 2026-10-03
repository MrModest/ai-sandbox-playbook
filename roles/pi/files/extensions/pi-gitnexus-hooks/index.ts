import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { basename, extname, isAbsolute } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const CONFIG_URL = new URL("./config.json", import.meta.url);

type HookConfig = {
  enabled: boolean;
  tools: string[];
  maxPatterns: number;
  timeoutMs: number;
  minPatternLength: number;
  ignoredPatterns: string[];
  secondaryPatterns: "off" | "fallback" | "always";
  showStatus: boolean;
};

const DEFAULT_CONFIG: HookConfig = {
  enabled: true,
  tools: ["read", "grep", "find", "bash", "read_many"],
  maxPatterns: 3,
  timeoutMs: 7000,
  minPatternLength: 3,
  ignoredPatterns: ["index", "config", "settings", "package", "readme", "license", "changelog", "utils", "types", "helpers", "constants", "test", "spec"],
  secondaryPatterns: "fallback",
  showStatus: true,
};

function readJson(path: string): any | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function loadConfig(): HookConfig {
  const raw = readJson(CONFIG_URL.pathname) ?? {};
  const num = (key: keyof HookConfig, fallback: number) => {
    const value = raw[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  return {
    enabled: raw.enabled !== false,
    tools: Array.isArray(raw.tools) && raw.tools.every((x: unknown) => typeof x === "string") ? raw.tools : DEFAULT_CONFIG.tools,
    maxPatterns: Math.max(1, num("maxPatterns", DEFAULT_CONFIG.maxPatterns)),
    timeoutMs: Math.max(1000, num("timeoutMs", DEFAULT_CONFIG.timeoutMs)),
    minPatternLength: Math.max(1, num("minPatternLength", DEFAULT_CONFIG.minPatternLength)),
    ignoredPatterns: Array.isArray(raw.ignoredPatterns) && raw.ignoredPatterns.every((x: unknown) => typeof x === "string")
      ? raw.ignoredPatterns
      : DEFAULT_CONFIG.ignoredPatterns,
    secondaryPatterns: raw.secondaryPatterns === "off" || raw.secondaryPatterns === "always" || raw.secondaryPatterns === "fallback"
      ? raw.secondaryPatterns
      : DEFAULT_CONFIG.secondaryPatterns,
    showStatus: raw.showStatus !== false,
  };
}

function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((part: any) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function identifierFromText(raw: string | undefined, minLength: number): string | null {
  if (!raw) return null;
  const unescaped = raw.replace(/\\[bBdDsSwW]/g, " ").replace(/\\(.)/g, "$1");
  const matches = unescaped.match(/[A-Za-z_][A-Za-z0-9_-]{2,}/g) ?? [];
  const candidates = matches
    .map((m) => m.replace(/^-+|-+$/g, ""))
    .filter((m) => m.length >= minLength && !/^(true|false|null|undefined|const|let|var|function|return|import|export)$/i.test(m));
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}

function identifierFromPath(raw: string | undefined, minLength: number): string | null {
  if (!raw) return null;
  const clean = raw.replace(/^@/, "").split(/[?#]/)[0] ?? raw;
  const base = basename(clean, extname(clean));
  return identifierFromText(base.replace(/[^A-Za-z0-9_-]/g, " "), minLength);
}

function shellTokens(command: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let esc = false;
  for (const ch of command) {
    if (esc) { cur += ch; esc = false; continue; }
    if (ch === "\\" && quote !== "'") { esc = true; continue; }
    if ((ch === "'" || ch === '"')) {
      if (quote === ch) quote = null;
      else if (!quote) quote = ch as "'" | '"';
      else cur += ch;
      continue;
    }
    if (!quote && /\s/.test(ch)) {
      if (cur) { out.push(cur); cur = ""; }
      continue;
    }
    if (!quote && "|;&".includes(ch)) {
      if (cur) { out.push(cur); cur = ""; }
      out.push(ch);
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function patternFromBash(command: string | undefined, minLength: number): string | null {
  if (!command || !/\b(rg|grep)\b/.test(command)) return null;
  const tokens = shellTokens(command);
  const flagsWithValues = new Set(["-e", "-f", "-m", "-A", "-B", "-C", "-g", "--glob", "-t", "--type", "--include", "--exclude"]);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!/(^|\/)(rg|grep)$/.test(tok)) continue;
    for (let j = i + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (["|", ";", "&"].includes(t)) break;
      if (t.startsWith("-")) {
        if (flagsWithValues.has(t)) j++;
        continue;
      }
      return identifierFromText(t, minLength) ?? (t.length >= minLength ? t : null);
    }
  }
  return null;
}

function secondaryPatternsFromOutput(output: string, minLength: number, max: number): string[] {
  const clean = stripAnsi(output);
  const paths = clean.match(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9]+/g) ?? [];
  const names = paths.map((p) => identifierFromPath(p, minLength)).filter((x): x is string => Boolean(x));
  return unique(names).slice(0, max);
}

function unique(items: Array<string | null | undefined>, ignoredPatterns: string[] = []): string[] {
  const seen = new Set<string>();
  const ignored = new Set(ignoredPatterns.map((p) => p.toLowerCase()));
  const out: string[] = [];
  for (const item of items) {
    const value = item?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (ignored.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function patternsForTool(toolName: string, input: any, output: string, config: HookConfig): string[] {
  const primary: Array<string | null> = [];
  if (toolName === "read") {
    primary.push(identifierFromPath(input?.path ?? input?.file_path ?? input?.filePath ?? input?.file, config.minPatternLength));
  } else if (toolName === "read_many") {
    const paths = Array.isArray(input?.paths) ? input.paths : [];
    for (const path of paths) primary.push(identifierFromPath(String(path), config.minPatternLength));
  } else if (toolName === "grep") {
    primary.push(identifierFromText(input?.pattern ?? input?.query ?? input?.regex, config.minPatternLength));
  } else if (toolName === "find") {
    primary.push(identifierFromText(input?.pattern, config.minPatternLength));
  } else if (toolName === "bash") {
    primary.push(patternFromBash(input?.command, config.minPatternLength));
  }
  const primaryPatterns = unique(primary, config.ignoredPatterns);
  if (config.secondaryPatterns === "off") return primaryPatterns.slice(0, config.maxPatterns);
  if (config.secondaryPatterns === "fallback" && primaryPatterns.length > 0) return primaryPatterns.slice(0, config.maxPatterns);

  const secondarySlots = Math.max(0, config.maxPatterns - primaryPatterns.length);
  return unique([...primaryPatterns, ...secondaryPatternsFromOutput(output, config.minPatternLength, secondarySlots)], config.ignoredPatterns).slice(0, config.maxPatterns);
}

function hasGitNexusBlock(output: string): boolean {
  return /(^|\n)---\s*\n?\[GitNexus\]/.test(output) || /(^|\n)\[GitNexus\]/.test(output);
}

async function runAugment(pi: ExtensionAPI, pattern: string, cwd: string, timeoutMs: number): Promise<string> {
  const result = await pi.exec("gitnexus", ["augment", "--", pattern], { cwd, timeout: timeoutMs });
  const combined = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const marker = combined.indexOf("[GitNexus]");
  return marker >= 0 ? combined.slice(marker).trim() : "";
}

export default function gitnexusHooks(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig();
    if (!config.showStatus || !ctx.hasUI) return;
    ctx.ui.setStatus("gitnexus-hooks", config.enabled ? "gitnexus hooks" : undefined);
  });

  pi.on("tool_result", async (event: any, ctx: ExtensionContext) => {
    const config = loadConfig();
    if (!config.enabled) return;
    const toolName = String(event.toolName ?? "");
    if (!config.tools.includes(toolName)) return;

    const output = textFromContent(event.content);
    if (!output || hasGitNexusBlock(output)) return;

    const patterns = patternsForTool(toolName, event.input ?? {}, output, config);
    if (patterns.length === 0) return;

    const results = await Promise.all(patterns.map((pattern) => runAugment(pi, pattern, ctx.cwd, config.timeoutMs).catch(() => "")));
    const blocks = results.filter(Boolean);
    if (blocks.length === 0) return;

    const suffix = `\n\n---\n${blocks.join("\n\n---\n")}\n---`;
    return {
      content: [...event.content, { type: "text", text: suffix }],
    };
  });

  pi.registerCommand("gitnexus-hooks", {
    description: "Show GitNexus hook extension status",
    handler: async (_args, ctx) => {
      const config = loadConfig();
      ctx.ui.notify([
        `enabled: ${config.enabled}`,
        `tools: ${config.tools.join(",")}`,
        `maxPatterns: ${config.maxPatterns}`,
        `timeoutMs: ${config.timeoutMs}`,
        `ignoredPatterns: ${config.ignoredPatterns.join(",")}`,
        `secondaryPatterns: ${config.secondaryPatterns}`,
        `config: ${CONFIG_URL.pathname}`,
      ].join("\n"), config.enabled ? "info" : "warning");
    },
  });
}
