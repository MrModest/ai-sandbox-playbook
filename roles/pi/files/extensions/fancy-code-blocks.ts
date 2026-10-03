/**
 * fancy-code-blocks.ts
 *
 * Replaces raw backtick fences in agent markdown code blocks with box-drawing
 * borders that embed the language name, matching the style of pi-tool-display's
 * user message box.
 *
 *   ┌─ javascript ──────────────────────────────────────────────────────────────┐
 *     const msg = "hello";
 *   └───────────────────────────────────────────────────────────────────────────┘
 *
 * Implementation: monkey-patches Markdown.prototype.renderToken (the same
 * technique pi-tool-display uses for UserMessageComponent.prototype.render).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Markdown, visibleWidth } from "@earendil-works/pi-tui";

// ─── types ───────────────────────────────────────────────────────────────────

type RenderToken = (
  token: Record<string, unknown>,
  width: number,
  nextTokenType?: string,
  styleContext?: unknown,
) => string[];

interface PatchedMarkdown {
  __fancyCodeBlocksPatched?: number;
  renderToken: RenderToken;
}

// ─── patch version (bump to force re-patch after reload) ─────────────────────

const PATCH_VERSION = 1;

// ─── box-drawing helpers ─────────────────────────────────────────────────────

function buildTopBorder(
  lang: string | undefined,
  width: number,
  styleBorder: (s: string) => string,
  styleLang: (s: string) => string,
): string {
  const label = lang ? ` ${lang} ` : "";
  const styledLabel = lang ? styleLang(label) : "";
  const labelVisWidth = visibleWidth(label);
  // width includes left "┌" and right "┐" (1 char each)
  const fillLen = Math.max(0, width - 2 - labelVisWidth);
  return styleBorder("┌") + styledLabel + styleBorder("─".repeat(fillLen) + "┐");
}

function buildBottomBorder(
  width: number,
  styleBorder: (s: string) => string,
): string {
  const fillLen = Math.max(0, width - 2);
  return styleBorder("└" + "─".repeat(fillLen) + "┘");
}

// ─── patch ───────────────────────────────────────────────────────────────────

function applyPatch(): void {
  const proto = Markdown.prototype as unknown as PatchedMarkdown;

  if (proto.__fancyCodeBlocksPatched === PATCH_VERSION) {
    return; // already patched at this version
  }

  const originalRenderToken = proto.renderToken;

  proto.renderToken = function patchedRenderToken(
    this: {
      theme: {
        codeBlockBorder: (s: string) => string;
        codeBlockIndent?: string;
        codeBlock: (s: string) => string;
        highlightCode?: (code: string, lang: string) => string[];
        bold: (s: string) => string;
        fg?: (color: string, s: string) => string;
      };
    },
    token: Record<string, unknown>,
    width: number,
    nextTokenType?: string,
    styleContext?: unknown,
  ): string[] {
    if (token.type !== "code") {
      // Not a code block — call original for everything else
      return originalRenderToken.call(this, token, width, nextTokenType, styleContext);
    }

    // ── Replicate the original "code" branch but swap fence lines ─────────
    const indent = this.theme.codeBlockIndent ?? "  ";
    const lang = (token.lang as string | undefined) || undefined;

    const styleBorder = this.theme.codeBlockBorder.bind(this.theme);

    // Use accent color for lang label if theme exposes fg(), else fall back to border color
    const styleLang = (s: string): string => {
      try {
        if (typeof this.theme.fg === "function") {
          return this.theme.fg("accent", this.theme.bold(s));
        }
      } catch {}
      return styleBorder(s);
    };

    const lines: string[] = [];

    // Top border with language label
    lines.push(buildTopBorder(lang, width, styleBorder, styleLang));

    // Code lines (identical to original)
    if (this.theme.highlightCode && lang) {
      const highlighted = this.theme.highlightCode(token.text as string, lang);
      for (const hlLine of highlighted) {
        lines.push(`${indent}${hlLine}`);
      }
    } else {
      const codeLines = (token.text as string).split("\n");
      for (const codeLine of codeLines) {
        lines.push(`${indent}${this.theme.codeBlock(codeLine)}`);
      }
    }

    // Bottom border
    lines.push(buildBottomBorder(width, styleBorder));

    // Spacing after (identical to original)
    if (nextTokenType && nextTokenType !== "space") {
      lines.push("");
    }

    return lines;
  };

  proto.__fancyCodeBlocksPatched = PATCH_VERSION;
}

function removePatch(): void {
  const proto = Markdown.prototype as unknown as PatchedMarkdown;
  delete proto.__fancyCodeBlocksPatched;
  // We can't easily restore the original without storing it, but on reload
  // jiti re-imports the module so the prototype is fresh anyway.
}

// ─── extension entry point ───────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  applyPatch();

  pi.on("session_shutdown", async (event: { reason?: string }) => {
    if (event?.reason === "reload") {
      removePatch();
    }
  });
}
