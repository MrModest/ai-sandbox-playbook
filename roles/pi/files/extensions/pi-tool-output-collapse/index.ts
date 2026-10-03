import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ExtensionRunner } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth, type Component } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";

const PATCH_STATE = Symbol.for("pi-tool-output-collapse.runnerPatchState.v2");
const WRAPPED_RENDER_RESULT = Symbol.for("pi-tool-output-collapse.renderResultWrapped.v2");
const CONFIG_URL = new URL("./config.json", import.meta.url);

type ToolEntry = {
  definition?: {
    name?: string;
    renderResult?: (...args: any[]) => Component | undefined;
    [WRAPPED_RENDER_RESULT]?: boolean;
    [key: string]: unknown;
  };
  sourceInfo?: unknown;
};

type CollapseConfig = {
  enabled: boolean;
  collapseAfterLines: number;
  collapsedLines: number;
  tools: string[];
  excludeTools: string[];
};

const DEFAULT_CONFIG: CollapseConfig = {
  enabled: true,
  collapseAfterLines: 100,
  collapsedLines: 20,
  tools: ["*"],
  excludeTools: [],
};

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function loadConfig(): CollapseConfig {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_URL, "utf8")) as Partial<CollapseConfig> & {
      // Backwards-compatible aliases from <= v0.1 config.
      minLinesToCollapse?: unknown;
      maxCollapsedLines?: unknown;
    };
    return {
      enabled: raw.enabled !== false,
      collapseAfterLines: Math.max(1, numberOr(raw.collapseAfterLines ?? raw.minLinesToCollapse, DEFAULT_CONFIG.collapseAfterLines)),
      collapsedLines: Math.max(1, numberOr(raw.collapsedLines ?? raw.maxCollapsedLines, DEFAULT_CONFIG.collapsedLines)),
      tools: Array.isArray(raw.tools) && raw.tools.every((x) => typeof x === "string") ? raw.tools : DEFAULT_CONFIG.tools,
      excludeTools: Array.isArray(raw.excludeTools) && raw.excludeTools.every((x) => typeof x === "string") ? raw.excludeTools : DEFAULT_CONFIG.excludeTools,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function toolEnabled(toolName: string, config: CollapseConfig): boolean {
  if (config.excludeTools.includes(toolName)) return false;
  return config.tools.includes("*") || config.tools.includes(toolName);
}

function extractText(result: any): string {
  const content = result?.content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

function normalizePreviouslyCollapsedLines(lines: string[]): { lines: string[]; totalLines: number; hadLegacyHint: boolean } {
  let hiddenByLegacyWrapper = 0;
  let hadLegacyHint = false;
  const filtered = lines.filter((line) => {
    const match = line.match(/↳\s+(\d+)\s+rendered lines hidden after pi-tool-display; expand tool for more/);
    if (!match) return true;
    hiddenByLegacyWrapper += Number(match[1] ?? 0);
    hadLegacyHint = true;
    return false;
  });

  return {
    lines: filtered,
    totalLines: filtered.length + hiddenByLegacyWrapper,
    hadLegacyHint,
  };
}

class CollapsedToolResult implements Component {
  wantsKeyRelease?: boolean;

  constructor(
    private readonly inner: Component,
    private readonly toolName: string,
    private readonly expanded: boolean,
    private readonly hint: (text: string) => string,
  ) {
    this.wantsKeyRelease = inner.wantsKeyRelease;
  }

  handleInput(data: string): void {
    this.inner.handleInput?.(data);
  }

  invalidate(): void {
    this.inner.invalidate();
  }

  render(width: number): string[] {
    const config = loadConfig();
    const renderedLines = this.inner.render(width);
    const normalized = normalizePreviouslyCollapsedLines(renderedLines);
    const lines = normalized.lines;
    const totalLines = Math.max(normalized.totalLines, renderedLines.length);

    if (!config.enabled || !toolEnabled(this.toolName, config)) return lines;
    if (this.expanded) return lines;
    if (!normalized.hadLegacyHint && totalLines < config.collapseAfterLines) return lines;
    if (!normalized.hadLegacyHint && lines.length <= config.collapsedLines) return lines;

    const contentLines = Math.max(0, config.collapsedLines - 1);
    const hintText = `↳ ${totalLines} lines returned • Ctrl+O to expand`;
    const hintLine = truncateToWidth(this.hint(hintText), width);

    return [
      ...lines.slice(0, contentLines),
      hintLine,
    ];
  }
}

function wrapToolDefinition(entry: ToolEntry): ToolEntry {
  const definition = entry.definition;
  if (!definition || definition[WRAPPED_RENDER_RESULT]) return entry;

  const toolName = typeof definition.name === "string" ? definition.name : "tool";
  const originalRenderResult = definition.renderResult;

  definition.renderResult = function collapsedRenderResult(result: any, options: any, theme: any, context: any): Component {
    const rendered = typeof originalRenderResult === "function"
      ? originalRenderResult.call(this, result, options, theme, context)
      : new Text(extractText(result), 0, 0);

    const inner = rendered && typeof rendered.render === "function"
      ? rendered
      : new Text(String(rendered ?? ""), 0, 0);

    return new CollapsedToolResult(
      inner,
      toolName,
      Boolean(options?.expanded),
      (text) => theme?.fg ? theme.fg("dim", text) : text,
    );
  };

  Object.defineProperty(definition, WRAPPED_RENDER_RESULT, {
    value: true,
    enumerable: false,
    configurable: true,
  });

  return entry;
}

function installRunnerPatch(): void {
  const proto = ExtensionRunner.prototype as any;
  const previousState = proto[PATCH_STATE] as { original?: (...args: any[]) => ToolEntry[] } | undefined;
  const original = typeof previousState?.original === "function"
    ? previousState.original
    : proto.getAllRegisteredTools;

  proto.getAllRegisteredTools = function patchedGetAllRegisteredTools(...args: any[]) {
    const tools = original.apply(this, args) as ToolEntry[];
    return tools.map(wrapToolDefinition);
  };

  Object.defineProperty(proto, PATCH_STATE, {
    value: { original },
    enumerable: false,
    configurable: true,
  });
}

export default function piToolOutputCollapse(pi: ExtensionAPI) {
  installRunnerPatch();

  pi.registerCommand("tool-output-collapse", {
    description: "Show pi-tool-output-collapse config/status",
    handler: async (_args, ctx) => {
      const config = loadConfig();
      const lines = [
        `enabled: ${config.enabled}`,
        `collapseAfterLines: ${config.collapseAfterLines}`,
        `collapsedLines: ${config.collapsedLines}`,
        `tools: ${config.tools.join(",")}`,
        `excludeTools: ${config.excludeTools.join(",") || "none"}`,
        `config: ${CONFIG_URL.pathname}`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
