import type { AST } from "svelte/compiler";
import type { IRComponent, IRNode, IRProperty, SGNodeType } from "./types.js";
import type { CompileWarning } from "../errors/types.js";
import { WarningCode } from "../errors/types.js";
import { createWarning, locationFromOffset } from "../errors/formatter.js";

const ELEMENT_MAP: Record<string, SGNodeType> = {
  rectangle: "Rectangle",
  view: "Rectangle",
  text: "Label",
  image: "Poster",
  scroll: "ScrollingGroup",
  list: "MarkupList",
  grid: "MarkupGrid",
  input: "TextEditBox",
  video: "Video",
  spinner: "BusySpinner",
  group: "Group",
};

const CSS_PROPERTY_MAP: Record<string, string | null> = {
  color: "color",
  "font-size": "fontSize",
  "background-color": "color",
  width: "width",
  height: "height",
  opacity: "opacity",
};

const ATTRIBUTE_MAP: Record<string, string> = {
  src: "uri",
  width: "width",
  height: "height",
  color: "color",
  opacity: "opacity",
  text: "text",
  visible: "visible",
};

let nodeIdCounter = 0;

function generateId(prefix: string): string {
  return `${prefix}_${nodeIdCounter++}`;
}

export interface BuildOptions {
  isEntry?: boolean;
}

export interface BuildResult {
  component: IRComponent;
  warnings: CompileWarning[];
}

export function buildIR(
  ast: AST.Root,
  source: string,
  filename: string,
  options?: BuildOptions,
): BuildResult {
  nodeIdCounter = 0;
  const warnings: CompileWarning[] = [];

  const basename = filename.replace(/\\/g, "/").split("/").pop() ?? filename;
  const name = basename.replace(/\.svelte$/, "");

  const children = buildFragment(ast.fragment, source, filename, warnings);

  const component: IRComponent = {
    name,
    extends: options?.isEntry ? "Scene" : "Group",
    children,
    scriptUri: `pkg:/components/${name}.brs`,
  };

  return { component, warnings };
}

function buildFragment(
  fragment: AST.Fragment,
  source: string,
  filename: string,
  warnings: CompileWarning[],
): IRNode[] {
  const nodes: IRNode[] = [];

  for (const child of fragment.nodes) {
    if (child.type === "RegularElement") {
      const irNode = buildElement(
        child as unknown as SvelteElement,
        source,
        filename,
        warnings,
      );
      if (irNode) {
        nodes.push(irNode);
      }
    }
  }

  return nodes;
}

interface SvelteElement {
  name: string;
  start: number;
  attributes: SvelteAttribute[];
  fragment: AST.Fragment;
}

interface SvelteAttribute {
  type: string;
  name: string;
  start: number;
  value:
    | true
    | Array<{ type: string; data?: string; start: number }>;
}

function buildElement(
  element: SvelteElement,
  source: string,
  filename: string,
  warnings: CompileWarning[],
): IRNode | null {
  const tagName = element.name;
  const sgType = ELEMENT_MAP[tagName];

  if (!sgType) {
    warnings.push(
      createWarning(
        WarningCode.UNKNOWN_ELEMENT,
        locationFromOffset(source, element.start, filename),
        { element: tagName },
      ),
    );
    return null;
  }

  const properties: IRProperty[] = [];
  let explicitId: string | null = null;

  for (const attr of element.attributes) {
    if (attr.type === "Attribute") {
      const attrName = attr.name;
      const value = extractStaticAttributeValue(attr);

      if (attrName === "id") {
        explicitId = value;
        continue;
      }

      if (attrName === "style") {
        const styleProps = parseInlineStyle(
          value,
          source,
          filename,
          element.start,
          warnings,
        );
        properties.push(...styleProps);
        continue;
      }

      const sgField = ATTRIBUTE_MAP[attrName];
      if (sgField && value !== null) {
        properties.push({ name: sgField, value: convertValue(sgField, value) });
      }
    } else if (attr.type === "StyleDirective") {
      const cssProp = attr.name;
      const value = extractStaticAttributeValue(attr);
      const sgField = CSS_PROPERTY_MAP[cssProp];

      if (sgField === undefined) {
        warnings.push(
          createWarning(
            WarningCode.UNSUPPORTED_CSS,
            locationFromOffset(source, attr.start, filename),
            { property: cssProp },
          ),
        );
      } else if (sgField !== null && value !== null) {
        properties.push({ name: sgField, value: convertValue(sgField, value) });
      }
    }
  }

  const id = explicitId ?? generateId(sgType.toLowerCase());

  const children = buildFragment(element.fragment, source, filename, warnings);

  let textContent: string | undefined;
  if (sgType === "Label") {
    textContent = extractTextContent(element.fragment);
    if (textContent) {
      properties.push({ name: "text", value: textContent });
    }
  }

  return {
    id,
    type: sgType,
    properties,
    children,
    textContent,
  };
}

function extractStaticAttributeValue(attr: SvelteAttribute): string | null {
  if (attr.value === true) return "true";
  if (Array.isArray(attr.value)) {
    const parts: string[] = [];
    for (const part of attr.value) {
      if (part.type === "Text") {
        parts.push(part.data ?? "");
      } else {
        return null;
      }
    }
    return parts.join("");
  }
  return null;
}

function extractTextContent(fragment: AST.Fragment): string | undefined {
  const texts: string[] = [];
  for (const node of fragment.nodes) {
    if (node.type === "Text") {
      const textNode = node as unknown as { data: string };
      const trimmed = textNode.data.trim();
      if (trimmed) texts.push(trimmed);
    }
  }
  return texts.length > 0 ? texts.join(" ") : undefined;
}

function convertValue(sgField: string, value: string): string {
  if (sgField === "color") {
    return cssColorToRokuHex(value);
  }
  if (sgField === "visible") {
    return value === "false" || value === "none" ? "false" : "true";
  }
  return value;
}

export function cssColorToRokuHex(color: string): string {
  const trimmed = color.trim().toLowerCase();

  if (trimmed.startsWith("0x")) return trimmed;

  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return `0x${trimmed.slice(1)}ff`;
  }

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const r = trimmed[1]! + trimmed[1]!;
    const g = trimmed[2]! + trimmed[2]!;
    const b = trimmed[3]! + trimmed[3]!;
    return `0x${r}${g}${b}ff`;
  }

  if (/^#[0-9a-f]{8}$/.test(trimmed)) {
    return `0x${trimmed.slice(1)}`;
  }

  const namedColors: Record<string, string> = {
    white: "0xffffffff",
    black: "0x000000ff",
    red: "0xff0000ff",
    green: "0x00ff00ff",
    blue: "0x0000ffff",
    yellow: "0xffff00ff",
    transparent: "0x00000000",
  };

  return namedColors[trimmed] ?? color;
}

function parseInlineStyle(
  style: string | null,
  source: string,
  filename: string,
  nodeOffset: number,
  warnings: CompileWarning[],
): IRProperty[] {
  if (!style) return [];
  const props: IRProperty[] = [];

  const declarations = style
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);

  for (const decl of declarations) {
    const colonIndex = decl.indexOf(":");
    if (colonIndex === -1) continue;

    const cssProp = decl.slice(0, colonIndex).trim();
    const cssValue = decl.slice(colonIndex + 1).trim();

    if (cssProp === "display" && cssValue === "none") {
      props.push({ name: "visible", value: "false" });
      continue;
    }

    const sgField = CSS_PROPERTY_MAP[cssProp];
    if (sgField === undefined) {
      warnings.push(
        createWarning(
          WarningCode.UNSUPPORTED_CSS,
          locationFromOffset(source, nodeOffset, filename),
          { property: cssProp },
        ),
      );
      continue;
    }
    if (sgField === null) continue;

    props.push({ name: sgField, value: convertValue(sgField, cssValue) });
  }

  return props;
}
