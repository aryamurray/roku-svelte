export type SGNodeType =
  | "Rectangle"
  | "Label"
  | "Poster"
  | "ScrollingGroup"
  | "MarkupList"
  | "MarkupGrid"
  | "TextEditBox"
  | "Video"
  | "BusySpinner"
  | "Group";

export interface IRProperty {
  name: string;
  value: string;
  dynamic?: boolean;
}

export interface IRNode {
  id: string;
  type: SGNodeType;
  properties: IRProperty[];
  children: IRNode[];
  textContent?: string;
  focusable?: boolean;
}

export interface IRStateVariable {
  name: string;
  initialValue: string;
  type: "number" | "string" | "boolean";
}

export interface IRTextPart {
  type: "static" | "dynamic";
  value: string;
}

export interface IRBinding {
  nodeId: string;
  property: string;
  stateVar: string;
  dependencies: string[];
  textParts?: IRTextPart[];
}

export type IRHandlerStatement =
  | { type: "increment"; variable: string }
  | { type: "decrement"; variable: string }
  | { type: "assign-literal"; variable: string; value: string }
  | { type: "assign-negate"; variable: string }
  | { type: "assign-add"; variable: string; operand: string }
  | { type: "assign-sub"; variable: string; operand: string };

export interface IRHandler {
  name: string;
  statements: IRHandlerStatement[];
  mutatedVariables: string[];
}

export interface IREvent {
  nodeId: string;
  eventType: "select";
  handlerName: string;
}

export interface IRComponent {
  name: string;
  extends: string;
  children: IRNode[];
  scriptUri: string;
  state?: IRStateVariable[];
  handlers?: IRHandler[];
  bindings?: IRBinding[];
  events?: IREvent[];
  autofocusNodeId?: string;
}
