const WEEK_SECONDS = 24 * 60 * 60;

function asWindow(value) {
	if (!value || typeof value !== "object") return null;
	if (typeof value.used_percent !== "number" || typeof value.reset_at !== "number") return null;
	return { usedPercent: value.used_percent, resetAt: value.reset_at };
}

/** Convert OpenAI Codex's subscription quota response into footer rows. */
export function parseCodexUsage(payload) {
	const rateLimit = payload?.rate_limit;
	if (!rateLimit || typeof rateLimit !== "object") return null;

	let current = null;
	let weekly = null;
	for (const [key, fallback] of [
		["primary_window", "current"],
		["secondary_window", "weekly"],
	]) {
		const window = asWindow(rateLimit[key]);
		if (!window) continue;
		const span = rateLimit[key].limit_window_seconds;
		const kind = typeof span === "number" ? (span >= WEEK_SECONDS ? "weekly" : "current") : fallback;
		if (kind === "weekly" && !weekly) weekly = window;
		if (kind === "current" && !current) current = window;
	}

	return current || weekly ? { current, weekly } : null;
}

export function formatCurrentReset(resetAt, now = Date.now() / 1000) {
	if (typeof resetAt !== "number") return "";
	const seconds = Math.max(0, Math.round(resetAt - now));
	if (seconds === 0) return "now";
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return hours > 0 ? `${hours}hr ${minutes}min` : `${minutes}min`;
}

export function formatWeeklyReset(resetAt, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
	if (typeof resetAt !== "number") return "";
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone,
	})
		.format(new Date(resetAt * 1000))
		.replace(", ", " ")
		.toLowerCase();
}
