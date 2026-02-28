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
}

export interface IRComponent {
  name: string;
  extends: string;
  children: IRNode[];
  scriptUri: string;
}
