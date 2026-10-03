import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { formatCurrentReset, formatWeeklyReset, parseCodexUsage } from "./status-footer-usage.js";

type UsageWindow = { usedPercent: number; resetAt: number };
type CodexUsage = { current: UsageWindow | null; weekly: UsageWindow | null };

function readCodexAccessToken(): string | null {
	try {
		const auth = JSON.parse(
			readFileSync(join(homedir(), ".pi", "agent", "auth.json"), "utf8"),
		) as { "openai-codex"?: { access?: unknown } };
		return typeof auth["openai-codex"]?.access === "string" ? auth["openai-codex"].access : null;
	} catch {
		return null;
	}
}

async function fetchCodexUsage(): Promise<CodexUsage | null> {
	const token = readCodexAccessToken();
	if (!token) return null;

	try {
		const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
			headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) return null;
		return parseCodexUsage(await response.json()) as CodexUsage | null;
	} catch {
		return null;
	}
}

function formatTokens(value: number | null | undefined): string {
	if (value === null || value === undefined) return "?";
	return value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`;
}

function ratioColor(ratio: number): "success" | "warning" | "error" {
	return ratio > 0.8 ? "error" : ratio >= 0.5 ? "warning" : "success";
}

function thinkingColor(level: string): string {
	const colors: Record<string, string> = {
		off: "thinkingOff",
		minimal: "thinkingMinimal",
		low: "thinkingLow",
		medium: "thinkingMedium",
		high: "thinkingHigh",
		xhigh: "thinkingXhigh",
	};
	return colors[level] ?? "muted";
}

export default function (pi: ExtensionAPI) {
	let usage: CodexUsage | null = null;

	const refreshUsage = async () => {
		usage = await fetchCodexUsage();
	};

	pi.on("session_start", async (_event, ctx) => {
		await refreshUsage();

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsubBranch = footerData.onBranchChange(() => tui.requestRender());
			const statusColor = (color: string, text: string) =>
				color === "success" ? `\x1b[38;2;126;231;135m${text}\x1b[39m` : theme.fg(color, text);
			const quotaRow = (label: "current" | "weekly", window: UsageWindow | null) => {
				const icon = theme.fg("accent", "󰓅 ");
				if (!window) return icon + theme.fg("dim", `${label}  —`);
				const percent = Math.max(0, Math.min(100, Math.round(window.usedPercent)));
				const color = ratioColor(percent / 100);
				const filled = Math.round(percent / 10);
				const dots = statusColor(color, "●".repeat(filled)) + theme.fg("dim", "○".repeat(10 - filled));
				const reset =
					label === "current"
						? formatCurrentReset(window.resetAt)
						: formatWeeklyReset(window.resetAt);
				return (
					icon +
					theme.fg("dim", `${label} `) +
					dots +
					" " +
					statusColor(color, `${percent.toString().padStart(3)}%`) +
					(reset ? ` ${theme.fg("dim", "↻")} ${theme.fg("muted", reset)}` : "")
				);
			};

			return {
				dispose: unsubBranch,
				invalidate() {},
				render(width: number): string[] {
					const model = ctx.model;
					const ctxUsage = ctx.getContextUsage();
					const branch = footerData.getGitBranch();
					const thinkingLevel = pi.getThinkingLevel();
					const cwd = ctx.cwd.replace(homedir(), "~");
					const percent = ctxUsage?.percent;
					const contextTokens = ctxUsage?.tokens;
					const contextWindow = ctxUsage?.contextWindow ?? model?.contextWindow;
					const ctxColor =
						contextTokens === undefined
							? "muted"
							: contextTokens >= (contextWindow ?? 0) * 0.9
								? "error"
								: contextTokens >= 272000
									? "warning"
									: "success";

					const location =
						theme.fg("accent", "󰉋 ") +
						theme.bold(cwd) +
						(branch ? ` (${theme.fg("success", " ")}${theme.fg("accent", branch)})` : "");
					const modelPart = model
						? theme.fg("warning", "󰧑 ") +
							theme.fg("muted", model.name ?? model.id) +
							` ${theme.fg("dim", "[")}${theme.fg(thinkingColor(thinkingLevel), thinkingLevel)}${theme.fg("dim", "]")}`
						: theme.fg("dim", "󰧑 —");
					const contextRow = () => {
						if (percent === undefined || contextTokens === undefined || !contextWindow) {
							return theme.fg("dim", "󰈙 ctx —");
						}
						const dots = 20;
						const filled = Math.max(0, Math.min(dots, Math.round((contextTokens / contextWindow) * dots)));
						const warningMarker = Math.max(0, Math.min(dots - 1, Math.round((272000 / contextWindow) * dots)));
						let bar = "";
						for (let index = 0; index < dots; index += 1) {
							if (index === warningMarker) bar += theme.fg("warning", "");
							else if (index < filled) bar += statusColor(ctxColor, "●");
							else bar += theme.fg("dim", "○");
						}
						return (
							theme.fg("accent", "󰈙 ") +
							theme.fg("dim", "ctx ") +
							bar +
							" " +
							statusColor(ctxColor, `${Math.round(percent)}%`) +
							` ${theme.fg("dim", `(${formatTokens(contextTokens)})`)}`
						);
					};
					const line1 = truncateToWidth([location, modelPart].join(` ${theme.fg("dim", "|")} `), width);
					const line2 = truncateToWidth(
						[quotaRow("current", usage?.current ?? null), quotaRow("weekly", usage?.weekly ?? null)].join(
							` ${theme.fg("dim", "|")} `,
						),
						width,
					);

					return [line1, line2, truncateToWidth(contextRow(), width)];
				},
			};
		});
	});

	pi.on("turn_end", async () => {
		await refreshUsage();
	});
}
