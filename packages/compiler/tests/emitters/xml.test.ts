import { describe, it, expect } from "vitest";
import { emitXML } from "../../src/emitters/xml.js";
import type { IRComponent } from "../../src/ir/types.js";

describe("emitXML", () => {
  it("emits a basic component", () => {
    const component: IRComponent = {
      name: "HelloWorld",
      extends: "Group",
      scriptUri: "pkg:/components/HelloWorld.brs",
      children: [
        {
          id: "label_0",
          type: "Label",
          properties: [{ name: "text", value: "Hello" }],
          children: [],
          textContent: "Hello",
        },
      ],
    };

    const xml = emitXML(component);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('name="HelloWorld"');
    expect(xml).toContain('extends="Group"');
    expect(xml).toContain(
      'uri="pkg:/components/HelloWorld.brs"',
    );
    expect(xml).toContain("<children>");
    expect(xml).toContain('id="label_0"');
    expect(xml).toContain('text="Hello"');
    expect(xml).toContain("</component>");
  });

  it("emits self-closing tags for leaf nodes", () => {
    const component: IRComponent = {
      name: "Test",
      extends: "Group",
      scriptUri: "pkg:/components/Test.brs",
      children: [
        {
          id: "rect_0",
          type: "Rectangle",
          properties: [{ name: "width", value: "100" }],
          children: [],
        },
      ],
    };

    const xml = emitXML(component);
    expect(xml).toContain("<Rectangle");
    expect(xml).toContain("/>");
    expect(xml).not.toContain("</Rectangle>");
  });

  it("emits nested children", () => {
    const component: IRComponent = {
      name: "Nested",
      extends: "Group",
      scriptUri: "pkg:/components/Nested.brs",
      children: [
        {
          id: "group_0",
          type: "Group",
          properties: [],
          children: [
            {
              id: "label_0",
              type: "Label",
              properties: [{ name: "text", value: "Inner" }],
              children: [],
            },
          ],
        },
      ],
    };

    const xml = emitXML(component);
    expect(xml).toContain("<Group");
    expect(xml).toContain("</Group>");
    expect(xml).toContain("Label");
  });

  it("escapes XML special characters", () => {
    const component: IRComponent = {
      name: "Test",
      extends: "Group",
      scriptUri: "pkg:/components/Test.brs",
      children: [
        {
          id: "label_0",
          type: "Label",
          properties: [{ name: "text", value: 'A & B "quoted"' }],
          children: [],
        },
      ],
    };

    const xml = emitXML(component);
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;");
  });

  it("emits focusable attribute", () => {
    const component: IRComponent = {
      name: "Focusable",
      extends: "Group",
      scriptUri: "pkg:/components/Focusable.brs",
      children: [
        {
          id: "label_0",
          type: "Label",
          properties: [],
          children: [],
          focusable: true,
        },
      ],
    };

    const xml = emitXML(component);
    expect(xml).toContain('focusable="true"');
  });

  it("does not emit focusable when not set", () => {
    const component: IRComponent = {
      name: "NoFocus",
      extends: "Group",
      scriptUri: "pkg:/components/NoFocus.brs",
      children: [
        {
          id: "label_0",
          type: "Label",
          properties: [{ name: "text", value: "Hello" }],
          children: [],
        },
      ],
    };

    const xml = emitXML(component);
    expect(xml).not.toContain("focusable");
  });
});
