import { describe, it, expect } from "vitest";
import { emitXML, emitItemComponentXML } from "../../src/emitters/xml.js";
import type { IRComponent, IRItemComponent } from "../../src/ir/types.js";

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

// === v0.3 — MarkupList + item component XML ===

describe("emitXML - v0.3 MarkupList", () => {
  it("emits MarkupList with itemComponentName attribute", () => {
    const component: IRComponent = {
      name: "MovieList",
      extends: "Group",
      scriptUri: "pkg:/components/MovieList.brs",
      children: [
        {
          id: "markuplist_0",
          type: "MarkupList",
          properties: [
            { name: "itemComponentName", value: "MovieList_Item0" },
            { name: "itemSize", value: "[1920, 100]" },
          ],
          children: [],
        },
      ],
    };

    const xml = emitXML(component);
    expect(xml).toContain("MarkupList");
    expect(xml).toContain('itemComponentName="MovieList_Item0"');
    expect(xml).toContain('itemSize="[1920, 100]"');
  });
});

describe("emitItemComponentXML", () => {
  it("emits item component with interface section + itemContent field", () => {
    const itemComp: IRItemComponent = {
      name: "MovieList_Item0",
      scriptUri: "pkg:/components/MovieList_Item0.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      fieldBindings: [
        { nodeId: "label_0", property: "text", field: "title" },
      ],
      itemSize: [1920, 100],
    };

    const xml = emitItemComponentXML(itemComp);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('name="MovieList_Item0"');
    expect(xml).toContain('extends="Group"');
    expect(xml).toContain("<interface>");
    expect(xml).toContain('id="itemContent"');
    expect(xml).toContain('type="node"');
    expect(xml).toContain('onChange="onItemContentChanged"');
    expect(xml).toContain("</interface>");
    expect(xml).toContain('uri="pkg:/components/MovieList_Item0.brs"');
    expect(xml).toContain("<children>");
    expect(xml).toContain('id="item_root"');
    expect(xml).toContain("Label");
    expect(xml).toContain("</component>");
  });

  it("emits root Group wrapper sized to itemSize", () => {
    const itemComp: IRItemComponent = {
      name: "Test_Item0",
      scriptUri: "pkg:/components/Test_Item0.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      fieldBindings: [],
      itemSize: [1920, 150],
    };

    const xml = emitItemComponentXML(itemComp);

    expect(xml).toContain('width="1920"');
    expect(xml).toContain('height="150"');
  });

  it("omits width/height on root Group when no itemSize specified", () => {
    const itemComp: IRItemComponent = {
      name: "Test_Item0",
      scriptUri: "pkg:/components/Test_Item0.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      fieldBindings: [],
    };

    const xml = emitItemComponentXML(itemComp);

    expect(xml).toContain('id="item_root"');
    expect(xml).not.toContain("width=");
    expect(xml).not.toContain("height=");
  });

  it("emits item component children correctly", () => {
    const itemComp: IRItemComponent = {
      name: "Test_Item0",
      scriptUri: "pkg:/components/Test_Item0.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
        { id: "label_1", type: "Label", properties: [], children: [] },
      ],
      fieldBindings: [],
      itemSize: [1920, 100],
    };

    const xml = emitItemComponentXML(itemComp);

    expect(xml).toContain('id="label_0"');
    expect(xml).toContain('id="label_1"');
  });
});
