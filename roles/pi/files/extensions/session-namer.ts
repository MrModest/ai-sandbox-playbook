/**
 * session-namer extension
 *
 * Auto-names sessions from the first real user prompt so /resume is readable.
 * Uses the `input` event (fires before skill expansion) to capture raw text,
 * so skill invocations like `/caveman` don't poison the session name.
 * Already-named sessions are left alone.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Commands / skill invocations to skip as session names
const SKIP_PREFIXES = ["/caveman", "/skill:", "/brain", "/reload", "/new", "/resume"];

function isSkippable(text: string): boolean {
  const t = text.trim();
  if (t.startsWith("---")) return true; // frontmatter dump (shouldn't happen at input stage, but guard anyway)
  return SKIP_PREFIXES.some((p) => t.startsWith(p));
}

export default function (pi: ExtensionAPI) {
  pi.on("input", async (event, _ctx) => {
    if (pi.getSessionName()) return; // already named

    const text = event.text?.trim() ?? "";
    if (!text || isSkippable(text)) return;

    // Don't name from RPC/extension-injected messages, only real user input
    if (event.source !== "interactive") return;

    const name = text.replace(/\s+/g, " ").slice(0, 60);
    pi.setSessionName(name);
  });
}
