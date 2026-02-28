import { describe, it, expect } from "vitest";
import {
  emitBrightScript,
  toBrightScriptValue,
} from "../../src/emitters/brightscript.js";
import type { IRComponent } from "../../src/ir/types.js";

describe("emitBrightScript - v0.1 fallback", () => {
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
    expect(brs).toContain("v0.1");
    expect(brs).toContain("function init()");
    expect(brs).toContain("end function");
    expect(brs).not.toContain("findNode");
    expect(brs).not.toContain("m.label_0");
  });

  it("emits findNode and assignments for dynamic properties (v0.1)", () => {
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
            { name: "color", value: "0xff0000ff" },
          ],
          children: [],
        },
      ],
    };

    const brs = emitBrightScript(component);

    expect(brs).toContain('m.label_0 = m.top.findNode("label_0")');
    expect(brs).toContain('m.label_0.text = "Hello"');
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

describe("emitBrightScript - v0.2 state", () => {
  it("emits state initialization in init()", () => {
    const component: IRComponent = {
      name: "Counter",
      extends: "Group",
      scriptUri: "pkg:/components/Counter.brs",
      children: [
        {
          id: "label_0",
          type: "Label",
          properties: [],
          children: [],
        },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);

    expect(brs).toContain("v0.2");
    expect(brs).toContain("m.state = { count: 0, dirty: {} }");
    expect(brs).toContain('m.label_0 = m.top.findNode("label_0")');
    expect(brs).toContain("m_update()");
  });

  it("emits string state with quotes", () => {
    const component: IRComponent = {
      name: "Greeting",
      extends: "Group",
      scriptUri: "pkg:/components/Greeting.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "name", initialValue: "world", type: "string" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "name",
          dependencies: ["name"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain('m.state = { name: "world", dirty: {} }');
  });

  it("emits boolean state", () => {
    const component: IRComponent = {
      name: "Toggle",
      extends: "Group",
      scriptUri: "pkg:/components/Toggle.brs",
      children: [
        { id: "rect_0", type: "Rectangle", properties: [], children: [] },
      ],
      state: [{ name: "active", initialValue: "true", type: "boolean" }],
      bindings: [
        {
          nodeId: "rect_0",
          property: "visible",
          stateVar: "active",
          dependencies: ["active"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.state = { active: true, dirty: {} }");
  });

  it("emits multiple state variables", () => {
    const component: IRComponent = {
      name: "Multi",
      extends: "Group",
      scriptUri: "pkg:/components/Multi.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [
        { name: "count", initialValue: "0", type: "number" },
        { name: "label", initialValue: "hello", type: "string" },
        { name: "visible", initialValue: "true", type: "boolean" },
      ],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain(
      'm.state = { count: 0, label: "hello", visible: true, dirty: {} }',
    );
  });
});

describe("emitBrightScript - m_update", () => {
  it("emits dirty checks for bindings", () => {
    const component: IRComponent = {
      name: "Counter",
      extends: "Group",
      scriptUri: "pkg:/components/Counter.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);

    expect(brs).toContain("function m_update()");
    expect(brs).toContain("if m.state.dirty.count then");
    expect(brs).toContain(
      "m.label_0.text = Str(m.state.count).Trim()",
    );
    expect(brs).toContain("m.state.dirty = {}");
    expect(brs).toContain("end function");
  });

  it("emits text interpolation with concatenation", () => {
    const component: IRComponent = {
      name: "Interp",
      extends: "Group",
      scriptUri: "pkg:/components/Interp.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
          textParts: [
            { type: "static", value: "Count:" },
            { type: "dynamic", value: "count" },
          ],
        },
      ],
    };

    const brs = emitBrightScript(component);

    expect(brs).toContain(
      'm.label_0.text = "Count:" + Str(m.state.count).Trim()',
    );
  });

  it("emits boolean binding to visible directly", () => {
    const component: IRComponent = {
      name: "Toggle",
      extends: "Group",
      scriptUri: "pkg:/components/Toggle.brs",
      children: [
        { id: "rect_0", type: "Rectangle", properties: [], children: [] },
      ],
      state: [{ name: "active", initialValue: "true", type: "boolean" }],
      bindings: [
        {
          nodeId: "rect_0",
          property: "visible",
          stateVar: "active",
          dependencies: ["active"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.rect_0.visible = m.state.active");
  });

  it("emits string state to string field directly", () => {
    const component: IRComponent = {
      name: "StringTest",
      extends: "Group",
      scriptUri: "pkg:/components/StringTest.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "name", initialValue: "world", type: "string" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "name",
          dependencies: ["name"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.label_0.text = m.state.name");
  });
});

describe("emitBrightScript - onKeyEvent", () => {
  it("emits onKeyEvent for on:select events", () => {
    const component: IRComponent = {
      name: "Counter",
      extends: "Group",
      scriptUri: "pkg:/components/Counter.brs",
      children: [
        {
          id: "label_0",
          type: "Label",
          properties: [],
          children: [],
          focusable: true,
        },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
      events: [
        { nodeId: "label_0", eventType: "select", handlerName: "increment" },
      ],
      handlers: [
        {
          name: "increment",
          statements: [{ type: "increment", variable: "count" }],
          mutatedVariables: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);

    expect(brs).toContain(
      "function onKeyEvent(key as String, press as Boolean) as Boolean",
    );
    expect(brs).toContain("if press then");
    expect(brs).toContain('if key = "OK" then');
    expect(brs).toContain("focused = m.top.focusedChild");
    expect(brs).toContain('focused.id = "label_0"');
    expect(brs).toContain("increment()");
    expect(brs).toContain("return true");
    expect(brs).toContain("return false");
  });

  it("does not emit onKeyEvent when no events", () => {
    const component: IRComponent = {
      name: "Static",
      extends: "Group",
      scriptUri: "pkg:/components/Static.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).not.toContain("onKeyEvent");
  });
});

describe("emitBrightScript - handler functions", () => {
  it("emits increment handler", () => {
    const component: IRComponent = {
      name: "Counter",
      extends: "Group",
      scriptUri: "pkg:/components/Counter.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
      handlers: [
        {
          name: "increment",
          statements: [{ type: "increment", variable: "count" }],
          mutatedVariables: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);

    expect(brs).toContain("function increment()");
    expect(brs).toContain(
      "m.state.count = m.state.count + 1",
    );
    expect(brs).toContain("m.state.dirty.count = true");
    expect(brs).toContain("m_update()");
  });

  it("emits decrement handler", () => {
    const component: IRComponent = {
      name: "Test",
      extends: "Group",
      scriptUri: "pkg:/components/Test.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "count", initialValue: "10", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
      handlers: [
        {
          name: "decrement",
          statements: [{ type: "decrement", variable: "count" }],
          mutatedVariables: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.state.count = m.state.count - 1");
  });

  it("emits assign-literal handler", () => {
    const component: IRComponent = {
      name: "Test",
      extends: "Group",
      scriptUri: "pkg:/components/Test.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
      handlers: [
        {
          name: "reset",
          statements: [
            { type: "assign-literal", variable: "count", value: "0" },
          ],
          mutatedVariables: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.state.count = 0");
  });

  it("emits assign-negate handler", () => {
    const component: IRComponent = {
      name: "Test",
      extends: "Group",
      scriptUri: "pkg:/components/Test.brs",
      children: [
        { id: "rect_0", type: "Rectangle", properties: [], children: [] },
      ],
      state: [{ name: "active", initialValue: "true", type: "boolean" }],
      bindings: [
        {
          nodeId: "rect_0",
          property: "visible",
          stateVar: "active",
          dependencies: ["active"],
        },
      ],
      handlers: [
        {
          name: "toggle",
          statements: [{ type: "assign-negate", variable: "active" }],
          mutatedVariables: ["active"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.state.active = not m.state.active");
  });

  it("emits assign-add handler", () => {
    const component: IRComponent = {
      name: "Test",
      extends: "Group",
      scriptUri: "pkg:/components/Test.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
      handlers: [
        {
          name: "addFive",
          statements: [
            { type: "assign-add", variable: "count", operand: "5" },
          ],
          mutatedVariables: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.state.count = m.state.count + 5");
  });

  it("emits assign-sub handler", () => {
    const component: IRComponent = {
      name: "Test",
      extends: "Group",
      scriptUri: "pkg:/components/Test.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [{ name: "count", initialValue: "10", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
      handlers: [
        {
          name: "subThree",
          statements: [
            { type: "assign-sub", variable: "count", operand: "3" },
          ],
          mutatedVariables: ["count"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.state.count = m.state.count - 3");
  });
});

describe("emitBrightScript - multi-dependency m_update", () => {
  it("emits or-condition for binding with multiple dependencies", () => {
    const component: IRComponent = {
      name: "Multi",
      extends: "Group",
      scriptUri: "pkg:/components/Multi.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [
        { name: "first", initialValue: "John", type: "string" },
        { name: "last", initialValue: "Doe", type: "string" },
      ],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "first",
          dependencies: ["first", "last"],
          textParts: [
            { type: "dynamic", value: "first" },
            { type: "static", value: " " },
            { type: "dynamic", value: "last" },
          ],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.state.dirty.first or m.state.dirty.last");
    expect(brs).toContain('m.label_0.text = m.state.first + " " + m.state.last');
  });
});

describe("emitBrightScript - handler with multiple mutations", () => {
  it("emits dirty flags for all mutated variables", () => {
    const component: IRComponent = {
      name: "Test",
      extends: "Group",
      scriptUri: "pkg:/components/Test.brs",
      children: [
        { id: "label_0", type: "Label", properties: [], children: [] },
      ],
      state: [
        { name: "count", initialValue: "0", type: "number" },
        { name: "label", initialValue: "hi", type: "string" },
      ],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
      handlers: [
        {
          name: "multi",
          statements: [
            { type: "increment", variable: "count" },
            { type: "assign-literal", variable: "label", value: "updated" },
          ],
          mutatedVariables: ["count", "label"],
        },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("function multi()");
    expect(brs).toContain("m.state.dirty.count = true");
    expect(brs).toContain("m.state.dirty.label = true");
  });
});

describe("emitBrightScript - multiple onKeyEvent targets", () => {
  it("emits if/else if chain for multiple select events", () => {
    const component: IRComponent = {
      name: "Test",
      extends: "Group",
      scriptUri: "pkg:/components/Test.brs",
      children: [
        { id: "btn_0", type: "Label", properties: [], children: [], focusable: true },
        { id: "btn_1", type: "Label", properties: [], children: [], focusable: true },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        { nodeId: "btn_0", property: "text", stateVar: "count", dependencies: ["count"] },
      ],
      events: [
        { nodeId: "btn_0", eventType: "select", handlerName: "increment" },
        { nodeId: "btn_1", eventType: "select", handlerName: "decrement" },
      ],
      handlers: [
        { name: "increment", statements: [{ type: "increment", variable: "count" }], mutatedVariables: ["count"] },
        { name: "decrement", statements: [{ type: "decrement", variable: "count" }], mutatedVariables: ["count"] },
      ],
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain('if focused.id = "btn_0"');
    expect(brs).toContain('else if focused.id = "btn_1"');
    expect(brs).toContain("increment()");
    expect(brs).toContain("decrement()");
  });
});

describe("emitBrightScript - autofocus", () => {
  it("emits setFocus(true) for autofocusNodeId", () => {
    const component: IRComponent = {
      name: "Focused",
      extends: "Group",
      scriptUri: "pkg:/components/Focused.brs",
      children: [
        {
          id: "label_0",
          type: "Label",
          properties: [],
          children: [],
          focusable: true,
        },
      ],
      state: [{ name: "count", initialValue: "0", type: "number" }],
      bindings: [
        {
          nodeId: "label_0",
          property: "text",
          stateVar: "count",
          dependencies: ["count"],
        },
      ],
      autofocusNodeId: "label_0",
    };

    const brs = emitBrightScript(component);
    expect(brs).toContain("m.label_0.setFocus(true)");
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
