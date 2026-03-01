import { describe, it, expect } from "vitest";
import { resolveLayout, type LayoutConfig } from "../../src/layout/index.js";
import type { IRComponent, IRNode, IRProperty } from "../../src/ir/types.js";

function makeNode(
  id: string,
  type: "Group" | "Rectangle" | "Label",
  properties: IRProperty[] = [],
  children: IRNode[] = [],
  flexStyles?: Record<string, string>,
): IRNode {
  return { id, type, properties, children, flexStyles };
}

function makeComponent(children: IRNode[]): IRComponent {
  return {
    name: "Test",
    extends: "Group",
    scriptUri: "pkg:/components/Test.brs",
    children,
  };
}

const CONFIG: LayoutConfig = { rootWidth: 1920, rootHeight: 1080 };

describe("resolveLayout", () => {
  it("returns immediately when no flex containers", async () => {
    const component = makeComponent([
      makeNode("rect_0", "Rectangle", [
        { name: "width", value: "100" },
        { name: "height", value: "100" },
      ]),
    ]);

    const result = await resolveLayout(component, CONFIG);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("resolves flex row layout", async () => {
    const component = makeComponent([
      makeNode(
        "container",
        "Group",
        [
          { name: "width", value: "1000" },
          { name: "height", value: "500" },
        ],
        [
          makeNode("child1", "Rectangle", [
            { name: "width", value: "300" },
            { name: "height", value: "200" },
          ]),
          makeNode("child2", "Rectangle", [
            { name: "width", value: "400" },
            { name: "height", value: "200" },
          ]),
        ],
        { display: "flex", "flex-direction": "row" },
      ),
    ]);

    const result = await resolveLayout(component, CONFIG);
    expect(result.errors).toEqual([]);

    const child1 = component.children[0]!.children[0]!;
    const child2 = component.children[0]!.children[1]!;

    // Child1 should be at [0, 0]
    expect(getProp(child1, "translation")).toBeUndefined();

    // Child2 should be at [300, 0]
    expect(getProp(child2, "translation")).toBe("[300, 0]");
  });

  it("resolves flex column layout", async () => {
    const component = makeComponent([
      makeNode(
        "container",
        "Group",
        [
          { name: "width", value: "500" },
          { name: "height", value: "1000" },
        ],
        [
          makeNode("child1", "Rectangle", [
            { name: "width", value: "500" },
            { name: "height", value: "200" },
          ]),
          makeNode("child2", "Rectangle", [
            { name: "width", value: "500" },
            { name: "height", value: "300" },
          ]),
        ],
        { display: "flex", "flex-direction": "column" },
      ),
    ]);

    const result = await resolveLayout(component, CONFIG);
    expect(result.errors).toEqual([]);

    const child2 = component.children[0]!.children[1]!;
    expect(getProp(child2, "translation")).toBe("[0, 200]");
  });

  it("resolves justify-content: center", async () => {
    const component = makeComponent([
      makeNode(
        "container",
        "Group",
        [
          { name: "width", value: "1000" },
          { name: "height", value: "500" },
        ],
        [
          makeNode("child1", "Rectangle", [
            { name: "width", value: "200" },
            { name: "height", value: "100" },
          ]),
        ],
        { display: "flex", "flex-direction": "row", "justify-content": "center" },
      ),
    ]);

    const result = await resolveLayout(component, CONFIG);
    expect(result.errors).toEqual([]);

    const child1 = component.children[0]!.children[0]!;
    // Should be centered: (1000 - 200) / 2 = 400
    expect(getProp(child1, "translation")).toBe("[400, 0]");
  });

  it("resolves justify-content: space-between", async () => {
    const component = makeComponent([
      makeNode(
        "container",
        "Group",
        [
          { name: "width", value: "1000" },
          { name: "height", value: "500" },
        ],
        [
          makeNode("child1", "Rectangle", [
            { name: "width", value: "200" },
            { name: "height", value: "100" },
          ]),
          makeNode("child2", "Rectangle", [
            { name: "width", value: "200" },
            { name: "height", value: "100" },
          ]),
        ],
        { display: "flex", "flex-direction": "row", "justify-content": "space-between" },
      ),
    ]);

    const result = await resolveLayout(component, CONFIG);
    expect(result.errors).toEqual([]);

    const child2 = component.children[0]!.children[1]!;
    // Space between: second child at 1000 - 200 = 800
    expect(getProp(child2, "translation")).toBe("[800, 0]");
  });

  it("resolves align-items: center", async () => {
    const component = makeComponent([
      makeNode(
        "container",
        "Group",
        [
          { name: "width", value: "1000" },
          { name: "height", value: "500" },
        ],
        [
          makeNode("child1", "Rectangle", [
            { name: "width", value: "200" },
            { name: "height", value: "100" },
          ]),
        ],
        { display: "flex", "flex-direction": "row", "align-items": "center" },
      ),
    ]);

    const result = await resolveLayout(component, CONFIG);
    expect(result.errors).toEqual([]);

    const child1 = component.children[0]!.children[0]!;
    // Centered vertically: (500 - 100) / 2 = 200
    expect(getProp(child1, "translation")).toBe("[0, 200]");
  });

  it("resolves gap between flex children", async () => {
    const component = makeComponent([
      makeNode(
        "container",
        "Group",
        [
          { name: "width", value: "1000" },
          { name: "height", value: "500" },
        ],
        [
          makeNode("child1", "Rectangle", [
            { name: "width", value: "200" },
            { name: "height", value: "100" },
          ]),
          makeNode("child2", "Rectangle", [
            { name: "width", value: "200" },
            { name: "height", value: "100" },
          ]),
        ],
        { display: "flex", "flex-direction": "row", gap: "50" },
      ),
    ]);

    const result = await resolveLayout(component, CONFIG);
    expect(result.errors).toEqual([]);

    const child2 = component.children[0]!.children[1]!;
    // After child1 (200px) + gap (50px) = 250
    expect(getProp(child2, "translation")).toBe("[250, 0]");
  });

  it("resolves flex-grow proportional sizing", async () => {
    const component = makeComponent([
      makeNode(
        "container",
        "Group",
        [
          { name: "width", value: "1920" },
          { name: "height", value: "1080" },
        ],
        [
          makeNode("sidebar", "Rectangle", [
            { name: "width", value: "400" },
            { name: "height", value: "1080" },
          ]),
          makeNode("main", "Group", [
            { name: "height", value: "1080" },
          ], [], { flex: "1" }),
        ],
        { display: "flex", "flex-direction": "row" },
      ),
    ]);

    const result = await resolveLayout(component, CONFIG);
    expect(result.errors).toEqual([]);

    const main = component.children[0]!.children[1]!;
    // Should get remaining width: 1920 - 400 = 1520
    expect(getProp(main, "width")).toBe("1520");
    expect(getProp(main, "translation")).toBe("[400, 0]");
  });

  it("resolves padding on container", async () => {
    const component = makeComponent([
      makeNode(
        "container",
        "Group",
        [
          { name: "width", value: "1000" },
          { name: "height", value: "500" },
        ],
        [
          makeNode("child1", "Rectangle", [
            { name: "width", value: "200" },
            { name: "height", value: "100" },
          ]),
        ],
        { display: "flex", "flex-direction": "row", padding: "20" },
      ),
    ]);

    const result = await resolveLayout(component, CONFIG);
    expect(result.errors).toEqual([]);

    const child1 = component.children[0]!.children[0]!;
    // Should be offset by padding: [20, 20]
    expect(getProp(child1, "translation")).toBe("[20, 20]");
  });

  it("cleans up flexStyles after processing", async () => {
    const component = makeComponent([
      makeNode(
        "container",
        "Group",
        [
          { name: "width", value: "500" },
          { name: "height", value: "500" },
        ],
        [
          makeNode("child1", "Rectangle", [
            { name: "width", value: "100" },
            { name: "height", value: "100" },
          ]),
        ],
        { display: "flex" },
      ),
    ]);

    await resolveLayout(component, CONFIG);

    expect(component.children[0]!.flexStyles).toBeUndefined();
  });
});

function getProp(node: IRNode, name: string): string | undefined {
  return node.properties.find((p) => p.name === name)?.value;
}
