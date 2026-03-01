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

export interface IRPropVariable {
  name: string;
  type: "string" | "number" | "boolean";
  defaultValue: string;
}

export interface IRProperty {
  name: string;
  value: string;
  dynamic?: boolean;
}

export interface IRNode {
  id: string;
  type: string;
  properties: IRProperty[];
  children: IRNode[];
  textContent?: string;
  focusable?: boolean;
  flexStyles?: Record<string, string>;
  isComponent?: boolean;
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

export interface IRObjectField {
  name: string;
  value: string;
  type: "string" | "number" | "boolean";
}

export interface IRStateVariable {
  name: string;
  initialValue: string;
  type: "number" | "string" | "boolean" | "array" | "object";
  arrayItemFields?: IRArrayItemField[];
  arrayItems?: IRArrayItem[];
  objectFields?: IRObjectField[];
  fetchCall?: IRFetchCall;
  derivedFrom?: {
    brsExpression: string;
    dependencies: string[];
    preamble?: string[];
  };
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
  | { type: "expr-statement"; brsCode: string; preamble?: string[] }
  | { type: "if"; testBrs: string; testPreamble?: string[]; consequent: IRHandlerStatement[]; alternate?: IRHandlerStatement[] }
  | { type: "for-each"; variable: string; iterableBrs: string; iterablePreamble?: string[]; body: IRHandlerStatement[] }
  | { type: "while"; testBrs: string; testPreamble?: string[]; body: IRHandlerStatement[] }
  | { type: "return"; valueBrs?: string; valuePreamble?: string[] }
  | { type: "var-decl"; variable: string; valueBrs: string; valuePreamble?: string[] }
  | { type: "try-catch"; tryBody: IRHandlerStatement[]; catchVar: string; catchBody: IRHandlerStatement[] };

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
  indexName?: string;
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

export interface IRTwoWayBinding {
  nodeId: string;
  property: string;
  stateVar: string;
}

export interface IRContinuation {
  name: string;
  awaitType: "fetch" | "generic";
  awaitTarget: string;
  fetchUrl?: string;
  resultVar?: string;
  statements: IRHandlerStatement[];
  mutatedVariables: string[];
}

export interface IRAsyncHandler extends IRHandler {
  isAsync: true;
  continuations: IRContinuation[];
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
  props?: IRPropVariable[];
  componentImports?: Array<{ name: string; path: string }>;
  onMountHandler?: IRHandler;
  onDestroyHandler?: IRHandler;
  twoWayBindings?: IRTwoWayBinding[];
  asyncHandlers?: IRAsyncHandler[];
  usesAsync?: boolean;
}
