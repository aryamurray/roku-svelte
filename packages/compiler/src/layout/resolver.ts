/**
 * Static Flexbox layout resolver using Yoga WASM.
 * Computes absolute positions at compile time — zero runtime cost.
 */
import type { IRComponent, IRNode } from "../ir/types.js";
import type { CompileError, CompileWarning } from "../errors/types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YogaInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YogaNode = any;

export interface LayoutConfig {
  rootWidth: number;
  rootHeight: number;
}

// Module-level Yoga cache — loaded once via dynamic import, reused
let yogaPromise: Promise<YogaInstance> | null = null;

async function getYoga(): Promise<YogaInstance> {
  if (!yogaPromise) {
    yogaPromise = import("yoga-layout").then((m) => m.default);
  }
  return yogaPromise;
}

export async function resolveLayout(
  component: IRComponent,
  config: LayoutConfig,
): Promise<{ warnings: CompileWarning[]; errors: CompileError[] }> {
  const warnings: CompileWarning[] = [];
  const errors: CompileError[] = [];

  // Walk IR tree looking for flex containers
  const flexContainers = findFlexContainers(component.children);

  if (flexContainers.length === 0) {
    // No flex containers — Yoga never loaded, zero cost
    return { warnings, errors };
  }

  const yoga = await getYoga();

  // Process each flex container top-down
  for (const container of flexContainers) {
    processFlexContainer(yoga, container, config, warnings, errors);
  }

  return { warnings, errors };
}

function findFlexContainers(nodes: IRNode[]): IRNode[] {
  const result: IRNode[] = [];

  for (const node of nodes) {
    if (node.flexStyles?.display === "flex") {
      result.push(node);
    }
    // Also check children for nested flex containers
    // (but those will be processed after their parent)
    result.push(...findFlexContainers(node.children));
  }

  return result;
}

function processFlexContainer(
  yoga: YogaInstance,
  container: IRNode,
  config: LayoutConfig,
  warnings: CompileWarning[],
  _errors: CompileError[],
): void {
  const styles = container.flexStyles!;

  // Resolve container dimensions
  const containerWidth = getNumericProp(container, "width") ?? config.rootWidth;
  const containerHeight = getNumericProp(container, "height") ?? config.rootHeight;

  if (!containerWidth || !containerHeight) {
    // Container has no size — can't compute layout
    return;
  }

  // Create Yoga root node
  const root = yoga.Node.create();
  root.setWidth(containerWidth);
  root.setHeight(containerHeight);

  // Set flex direction
  const direction = styles["flex-direction"] ?? "row";
  if (direction === "column") {
    root.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN);
  } else {
    root.setFlexDirection(yoga.FLEX_DIRECTION_ROW);
  }

  // Set justify content
  const justify = styles["justify-content"] ?? "flex-start";
  switch (justify) {
    case "center":
      root.setJustifyContent(yoga.JUSTIFY_CENTER);
      break;
    case "flex-end":
      root.setJustifyContent(yoga.JUSTIFY_FLEX_END);
      break;
    case "space-between":
      root.setJustifyContent(yoga.JUSTIFY_SPACE_BETWEEN);
      break;
    case "space-around":
      root.setJustifyContent(yoga.JUSTIFY_SPACE_AROUND);
      break;
    default:
      root.setJustifyContent(yoga.JUSTIFY_FLEX_START);
  }

  // Set align items
  const alignItems = styles["align-items"] ?? "flex-start";
  switch (alignItems) {
    case "center":
      root.setAlignItems(yoga.ALIGN_CENTER);
      break;
    case "flex-end":
      root.setAlignItems(yoga.ALIGN_FLEX_END);
      break;
    case "stretch":
      root.setAlignItems(yoga.ALIGN_STRETCH);
      break;
    default:
      root.setAlignItems(yoga.ALIGN_FLEX_START);
  }

  // Set gap
  const gap = styles.gap;
  if (gap) {
    const gapVal = parseFloat(gap);
    if (!isNaN(gapVal)) {
      root.setGap(yoga.GUTTER_ALL, gapVal);
    }
  }

  const rowGap = styles["row-gap"];
  if (rowGap) {
    const val = parseFloat(rowGap);
    if (!isNaN(val)) root.setGap(yoga.GUTTER_ROW, val);
  }

  const colGap = styles["column-gap"];
  if (colGap) {
    const val = parseFloat(colGap);
    if (!isNaN(val)) root.setGap(yoga.GUTTER_COLUMN, val);
  }

  // Set padding
  applyPadding(yoga, root, styles);

  // Create child Yoga nodes
  const childYogaNodes: YogaNode[] = [];
  for (let i = 0; i < container.children.length; i++) {
    const child = container.children[i]!;
    const childNode = yoga.Node.create();

    // Set child width/height
    const childWidth = getNumericProp(child, "width");
    const childHeight = getNumericProp(child, "height");

    // Check for percentage-based sizes
    const childWidthPct = getPercentProp(child, "width");
    const childHeightPct = getPercentProp(child, "height");

    if (childWidth != null) {
      childNode.setWidth(childWidth);
    } else if (childWidthPct != null) {
      childNode.setWidthPercent(childWidthPct);
    }

    if (childHeight != null) {
      childNode.setHeight(childHeight);
    } else if (childHeightPct != null) {
      childNode.setHeightPercent(childHeightPct);
    }

    // Check for flex-grow via child's flexStyles or inline flex properties
    const childFlex = child.flexStyles?.flex ?? child.flexStyles?.["flex-grow"];
    if (childFlex) {
      const flexGrow = parseFloat(childFlex);
      if (!isNaN(flexGrow)) {
        childNode.setFlexGrow(flexGrow);
      }
    }

    // Check for align-self
    const alignSelf = child.flexStyles?.["align-self"];
    if (alignSelf) {
      switch (alignSelf) {
        case "center":
          childNode.setAlignSelf(yoga.ALIGN_CENTER);
          break;
        case "flex-end":
          childNode.setAlignSelf(yoga.ALIGN_FLEX_END);
          break;
        case "flex-start":
          childNode.setAlignSelf(yoga.ALIGN_FLEX_START);
          break;
        case "stretch":
          childNode.setAlignSelf(yoga.ALIGN_STRETCH);
          break;
      }
    }

    // Warn on margin in flex children
    if (child.flexStyles?.margin) {
      warnings.push({
        code: "UNSUPPORTED_CSS_HINT",
        message: `CSS property "margin" is not supported on Roku. Use gap on the flex container instead.`,
        loc: { file: "", line: 0, column: 0, source: "" },
      });
    }

    root.insertChild(childNode, i);
    childYogaNodes.push(childNode);
  }

  // Compute layout
  root.calculateLayout(containerWidth, containerHeight);

  // Inject computed positions into child IR nodes
  for (let i = 0; i < container.children.length; i++) {
    const child = container.children[i]!;
    const childNode = childYogaNodes[i]!;

    const computedLeft = childNode.getComputedLeft();
    const computedTop = childNode.getComputedTop();
    const computedWidth = childNode.getComputedWidth();
    const computedHeight = childNode.getComputedHeight();

    // Set translation
    if (computedLeft !== 0 || computedTop !== 0) {
      setOrUpdateProp(child, "translation", `[${computedLeft}, ${computedTop}]`);
    }

    // Set width/height from Yoga if not explicitly set
    if (getNumericProp(child, "width") == null) {
      setOrUpdateProp(child, "width", String(computedWidth));
    }
    if (getNumericProp(child, "height") == null) {
      setOrUpdateProp(child, "height", String(computedHeight));
    }
  }

  // Clean up: free Yoga nodes and remove flexStyles from processed nodes
  for (const childNode of childYogaNodes) {
    childNode.free();
  }
  root.free();

  // Remove flexStyles from container and children
  // (preserve flexStyles on children that are themselves flex containers —
  //  they'll be processed in a later iteration of the outer loop)
  delete container.flexStyles;
  for (const child of container.children) {
    if (child.flexStyles?.display !== "flex") {
      delete child.flexStyles;
    }
  }
}

function getNumericProp(node: IRNode, name: string): number | null {
  const prop = node.properties.find((p) => p.name === name);
  if (!prop) return null;
  const num = parseFloat(prop.value);
  return isNaN(num) ? null : num;
}

function getPercentProp(node: IRNode, name: string): number | null {
  const prop = node.properties.find((p) => p.name === name);
  if (!prop) return null;
  const match = prop.value.match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  return parseFloat(match[1]!);
}

function setOrUpdateProp(node: IRNode, name: string, value: string): void {
  const existing = node.properties.find((p) => p.name === name);
  if (existing) {
    existing.value = value;
  } else {
    node.properties.push({ name, value });
  }
}

function applyPadding(yoga: YogaInstance, node: YogaNode, styles: Record<string, string>): void {
  const padding = styles.padding;
  if (padding) {
    const val = parseFloat(padding);
    if (!isNaN(val)) {
      node.setPadding(yoga.EDGE_ALL, val);
    }
  }

  const paddingTop = styles["padding-top"];
  if (paddingTop) {
    const val = parseFloat(paddingTop);
    if (!isNaN(val)) node.setPadding(yoga.EDGE_TOP, val);
  }

  const paddingRight = styles["padding-right"];
  if (paddingRight) {
    const val = parseFloat(paddingRight);
    if (!isNaN(val)) node.setPadding(yoga.EDGE_RIGHT, val);
  }

  const paddingBottom = styles["padding-bottom"];
  if (paddingBottom) {
    const val = parseFloat(paddingBottom);
    if (!isNaN(val)) node.setPadding(yoga.EDGE_BOTTOM, val);
  }

  const paddingLeft = styles["padding-left"];
  if (paddingLeft) {
    const val = parseFloat(paddingLeft);
    if (!isNaN(val)) node.setPadding(yoga.EDGE_LEFT, val);
  }
}
