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
  flexStyles?: Record<string, string>;
}

export interface IRArrayItemField {
  name: string;
  type: "string" | "number" | "boolean";
}

export interface IRArrayItem {
  fields: Record<string, string>;
}

export interface IRFetchCall {
  url: string;
  urlIsLiteral: boolean;
  hasOptions: boolean;
  optionsSource?: string;
}

export interface IRStateVariable {
  name: string;
  initialValue: string;
  type: "number" | "string" | "boolean" | "array";
  arrayItemFields?: IRArrayItemField[];
  arrayItems?: IRArrayItem[];
  fetchCall?: IRFetchCall;
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
  brsExpression?: string;
}

export type IRHandlerStatement =
  | { type: "increment"; variable: string }
  | { type: "decrement"; variable: string }
  | { type: "assign-literal"; variable: string; value: string }
  | { type: "assign-negate"; variable: string }
  | { type: "assign-add"; variable: string; operand: string }
  | { type: "assign-sub"; variable: string; operand: string }
  | { type: "assign-expr"; variable: string; brsCode: string; preamble?: string[] }
  | { type: "expr-statement"; brsCode: string; preamble?: string[] };

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

export interface IREachBlock {
  arrayVar: string;
  itemAlias: string;
  itemComponentName: string;
  listNodeId: string;
}

export interface IRItemTextPart {
  type: "static" | "field";
  value: string;
}

export interface IRItemFieldBinding {
  nodeId: string;
  property: string;
  field: string;
  textParts?: IRItemTextPart[];
}

export interface IRItemComponent {
  name: string;
  scriptUri: string;
  children: IRNode[];
  fieldBindings: IRItemFieldBinding[];
  itemSize?: [number, number];
}

export interface AssetReference {
  sourcePath: string;
  destPath: string;
  pkgPath: string;
  transform?: "rasterize";
  rasterizeWidth?: number;
  rasterizeHeight?: number;
}

export interface IRComponent {
  name: string;
  extends: string;
  children: IRNode[];
  scriptUri: string;
  assets?: AssetReference[];
  state?: IRStateVariable[];
  handlers?: IRHandler[];
  bindings?: IRBinding[];
  events?: IREvent[];
  autofocusNodeId?: string;
  eachBlocks?: IREachBlock[];
  itemComponents?: IRItemComponent[];
  requiresRuntime?: boolean;
  requiresStdlib?: boolean;
  requiredPolyfills?: Set<string>;
  extractedCallbacks?: IRHandler[];
}
