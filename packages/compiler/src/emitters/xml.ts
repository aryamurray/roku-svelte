import MagicString from "magic-string";
import type { IRComponent, IRNode, IRItemComponent } from "../ir/types.js";

export function emitXML(component: IRComponent): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<component name="${escapeXml(component.name)}" extends="${escapeXml(component.extends)}">`,
  );
  lines.push(
    `  <script type="text/brightscript" uri="${escapeXml(component.scriptUri)}" />`,
  );

  if (component.requiresRuntime) {
    lines.push(
      '  <script type="text/brightscript" uri="pkg:/source/runtime/Fetch.brs" />',
    );
  }

  if (component.children.length > 0) {
    lines.push("  <children>");
    for (const child of component.children) {
      emitNode(child, lines, 4);
    }
    lines.push("  </children>");
  }

  lines.push("</component>");

  // Use MagicString as output buffer — ready for .generateMap() later
  const ms = new MagicString(lines.join("\n"));
  return ms.toString();
}

export function emitItemComponentXML(itemComp: IRItemComponent): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<component name="${escapeXml(itemComp.name)}" extends="Group">`,
  );

  // Interface section with itemContent field
  lines.push("  <interface>");
  lines.push('    <field id="itemContent" type="node" onChange="onItemContentChanged" />');
  lines.push("  </interface>");

  lines.push(
    `  <script type="text/brightscript" uri="${escapeXml(itemComp.scriptUri)}" />`,
  );

  lines.push("  <children>");

  // Root Group wrapper sized to itemSize
  const rootAttrs: string[] = ['id="item_root"'];
  if (itemComp.itemSize) {
    rootAttrs.push(`width="${itemComp.itemSize[0]}"`);
    rootAttrs.push(`height="${itemComp.itemSize[1]}"`);
  }

  if (itemComp.children.length > 0) {
    lines.push(`    <Group ${rootAttrs.join(" ")}>`);
    for (const child of itemComp.children) {
      emitNode(child, lines, 6);
    }
    lines.push("    </Group>");
  } else {
    lines.push(`    <Group ${rootAttrs.join(" ")} />`);
  }

  lines.push("  </children>");
  lines.push("</component>");

  const ms = new MagicString(lines.join("\n"));
  return ms.toString();
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

  if (node.focusable) {
    attrs.push('focusable="true"');
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
