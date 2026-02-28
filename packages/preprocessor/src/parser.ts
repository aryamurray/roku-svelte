export type Platform = "roku" | "web";

/**
 * Depth-tracking tag transformer for <roku>, <web>, and <screen> tags.
 * Scans character-by-character — NOT regex-based.
 */
export function transformMarkup(content: string, platform: Platform): string {
  let result = "";
  let i = 0;
  const len = content.length;

  // Tags to strip vs unwrap based on platform
  const stripTag = platform === "roku" ? "web" : "roku";
  const unwrapTag = platform === "roku" ? "roku" : "web";

  while (i < len) {
    // Skip HTML comments
    if (content.startsWith("<!--", i)) {
      const end = content.indexOf("-->", i + 4);
      if (end === -1) {
        result += content.slice(i);
        break;
      }
      result += content.slice(i, end + 3);
      i = end + 3;
      continue;
    }

    // Skip <script> blocks
    if (content.startsWith("<script", i)) {
      const scriptEnd = findClosingTag(content, i, "script");
      if (scriptEnd === -1) {
        result += content.slice(i);
        break;
      }
      result += content.slice(i, scriptEnd);
      i = scriptEnd;
      continue;
    }

    // Skip <style> blocks
    if (content.startsWith("<style", i)) {
      const styleEnd = findClosingTag(content, i, "style");
      if (styleEnd === -1) {
        result += content.slice(i);
        break;
      }
      result += content.slice(i, styleEnd);
      i = styleEnd;
      continue;
    }

    // Check for self-closing tags: <web />, <roku />, <screen />
    const selfClose = matchSelfClosingTag(content, i);
    if (selfClose) {
      if (selfClose.name === stripTag || selfClose.name === unwrapTag) {
        // Self-closing platform tag — no content, just skip it
        i = selfClose.end;
        continue;
      }
      if (selfClose.name === "screen") {
        // Self-closing <screen /> — empty scene group
        result += `<group data-roku-extends="Scene"></group>`;
        i = selfClose.end;
        continue;
      }
    }

    // Check for opening tags
    const openTag = matchOpenTag(content, i);
    if (openTag) {
      if (openTag.name === stripTag) {
        // Strip this tag and all its content
        const end = findMatchingClose(content, openTag.end, stripTag);
        i = end;
        continue;
      }

      if (openTag.name === unwrapTag) {
        // Unwrap: skip opening tag, keep children, skip closing tag
        const innerStart = openTag.end;
        const closeStart = findMatchingCloseStart(content, openTag.end, unwrapTag);
        const closeEnd = findMatchingClose(content, openTag.end, unwrapTag);
        // Recursively transform the inner content (for nested same-name tags)
        const inner = content.slice(innerStart, closeStart);
        result += transformMarkup(inner, platform);
        i = closeEnd;
        continue;
      }

      if (openTag.name === "screen") {
        // Replace <screen ...> with <group data-roku-extends="Scene" ...>
        const innerStart = openTag.end;
        const closeStart = findMatchingCloseStart(content, openTag.end, "screen");
        const closeEnd = findMatchingClose(content, openTag.end, "screen");
        const attrs = openTag.attrs ? " " + openTag.attrs : "";
        const inner = content.slice(innerStart, closeStart);
        result += `<group data-roku-extends="Scene"${attrs}>`;
        result += transformMarkup(inner, platform);
        result += `</group>`;
        i = closeEnd;
        continue;
      }
    }

    // Regular character — pass through
    result += content[i];
    i++;
  }

  return result;
}

interface TagMatch {
  name: string;
  attrs: string;
  end: number;
}

function matchSelfClosingTag(content: string, pos: number): TagMatch | null {
  if (content[pos] !== "<") return null;
  const match = content.slice(pos).match(/^<(roku|web|screen)(\s[^>]*)?\s*\/>/);
  if (!match) return null;
  return {
    name: match[1]!,
    attrs: (match[2] ?? "").trim(),
    end: pos + match[0].length,
  };
}

function matchOpenTag(content: string, pos: number): TagMatch | null {
  if (content[pos] !== "<") return null;
  const match = content.slice(pos).match(/^<(roku|web|screen)(\s[^>]*)?\s*>/);
  if (!match) return null;
  return {
    name: match[1]!,
    attrs: (match[2] ?? "").trim(),
    end: pos + match[0].length,
  };
}

/**
 * Find the position AFTER the matching closing tag, tracking depth.
 */
function findMatchingClose(content: string, start: number, tagName: string): number {
  let depth = 1;
  let i = start;
  const len = content.length;

  while (i < len && depth > 0) {
    // Check for self-closing tag (doesn't affect depth)
    const selfClose = content.slice(i).match(new RegExp(`^<${tagName}(\\s[^>]*)?\\s*\\/>`));
    if (selfClose) {
      i += selfClose[0].length;
      continue;
    }

    // Check for opening tag
    const openMatch = content.slice(i).match(new RegExp(`^<${tagName}(\\s[^>]*)?\\s*>`));
    if (openMatch) {
      depth++;
      i += openMatch[0].length;
      continue;
    }

    // Check for closing tag
    const closeMatch = content.slice(i).match(new RegExp(`^<\\/${tagName}\\s*>`));
    if (closeMatch) {
      depth--;
      i += closeMatch[0].length;
      continue;
    }

    i++;
  }

  return i;
}

/**
 * Find the START position of the matching closing tag (before the `</`).
 */
function findMatchingCloseStart(content: string, start: number, tagName: string): number {
  let depth = 1;
  let i = start;
  const len = content.length;

  while (i < len && depth > 0) {
    const selfClose = content.slice(i).match(new RegExp(`^<${tagName}(\\s[^>]*)?\\s*\\/>`));
    if (selfClose) {
      i += selfClose[0].length;
      continue;
    }

    const openMatch = content.slice(i).match(new RegExp(`^<${tagName}(\\s[^>]*)?\\s*>`));
    if (openMatch) {
      depth++;
      i += openMatch[0].length;
      continue;
    }

    const closeMatch = content.slice(i).match(new RegExp(`^<\\/${tagName}\\s*>`));
    if (closeMatch) {
      depth--;
      if (depth === 0) return i;
      i += closeMatch[0].length;
      continue;
    }

    i++;
  }

  return i;
}

/**
 * Find the end of a raw block like <script>...</script> or <style>...</style>.
 * Returns position after the closing tag.
 */
function findClosingTag(content: string, start: number, tagName: string): number {
  const closeTag = `</${tagName}>`;
  const idx = content.indexOf(closeTag, start);
  if (idx === -1) return -1;
  return idx + closeTag.length;
}
