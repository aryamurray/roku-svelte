import { describe, it, expect } from "vitest";
import {
  emitBrightScript,
  toBrightScriptValue,
} from "../../src/emitters/brightscript.js";
import type { IRComponent } from "../../src/ir/types.js";

describe("emitBrightScript", () => {
  it("emits empty init for static-only component", () => {
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
        },
      ],
    };

    const brs = emitBrightScript(component);

    expect(brs).toContain("' HelloWorld.brs");
    expect(brs).toContain("function init()");
    expect(brs).toContain("end function");
    // Static props should NOT appear in BrightScript
    expect(brs).not.toContain("findNode");
    expect(brs).not.toContain("m.label_0");
  });

  it("emits findNode and assignments for dynamic properties", () => {
    const component: IRComponent = {
      name: "Dynamic",
      extends: "Group",
      scriptUri: "pkg:/components/Dynamic.brs",
      children: [
        {
          id: "label_0",
          type: "Label",
          properties: [
            { name: "text", value: "Hello", dynamic: true },
            { name: "color", value: "0xff0000ff" }, // static, should NOT appear
          ],
          children: [],
        },
      ],
    };

    const brs = emitBrightScript(component);

    expect(brs).toContain('m.label_0 = m.top.findNode("label_0")');
    expect(brs).toContain('m.label_0.text = "Hello"');
    // Static color should NOT appear in BrightScript
    expect(brs).not.toContain("m.label_0.color");
  });

  it("handles empty component", () => {
    const component: IRComponent = {
      name: "Empty",
      extends: "Group",
      scriptUri: "pkg:/components/Empty.brs",
      children: [],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("function init()");
    expect(brs).toContain("end function");
    expect(brs).not.toContain("findNode");
  });
});

describe("toBrightScriptValue", () => {
  it("formats numeric fields without quotes", () => {
    expect(toBrightScriptValue("width", "1920")).toBe("1920");
    expect(toBrightScriptValue("height", "1080")).toBe("1080");
    expect(toBrightScriptValue("opacity", "0.5")).toBe("0.5");
    expect(toBrightScriptValue("fontSize", "48")).toBe("48");
  });

  it("formats color values as quoted strings", () => {
    expect(toBrightScriptValue("color", "0xff0000ff")).toBe('"0xff0000ff"');
  });

  it("formats booleans without quotes", () => {
    expect(toBrightScriptValue("visible", "true")).toBe("true");
    expect(toBrightScriptValue("visible", "false")).toBe("false");
  });

  it("formats strings with double-quote escaping", () => {
    expect(toBrightScriptValue("text", "Hello")).toBe('"Hello"');
    expect(toBrightScriptValue("text", 'Say "hi"')).toBe('"Say ""hi"""');
  });
});
