import type { IRComponent, IRNode } from "../ir/types.js";

export function emitXML(component: IRComponent): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<component name="${escapeXml(component.name)}" extends="${escapeXml(component.extends)}">`,
  );
  lines.push(
    `  <script type="text/brightscript" uri="${escapeXml(component.scriptUri)}" />`,
  );

  if (component.children.length > 0) {
    lines.push("  <children>");
    for (const child of component.children) {
      emitNode(child, lines, 4);
    }
    lines.push("  </children>");
  }

  lines.push("</component>");

  return lines.join("\n");
}

function emitNode(node: IRNode, lines: string[], indent: number): void {
  const pad = " ".repeat(indent);
  const attrs = buildAttributes(node);

  if (node.children.length === 0) {
    lines.push(`${pad}<${node.type}${attrs} />`);
  } else {
    lines.push(`${pad}<${node.type}${attrs}>`);
    for (const child of node.children) {
      emitNode(child, lines, indent + 2);
    }
    lines.push(`${pad}</${node.type}>`);
  }
}

function buildAttributes(node: IRNode): string {
  const attrs: string[] = [];

  attrs.push(`id="${escapeXml(node.id)}"`);

  // Only emit static properties in XML. Dynamic properties are set in BrightScript.
  for (const prop of node.properties) {
    if (!prop.dynamic) {
      attrs.push(`${escapeXml(prop.name)}="${escapeXml(prop.value)}"`);
    }
  }

  return attrs.length > 0 ? " " + attrs.join(" ") : "";
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
