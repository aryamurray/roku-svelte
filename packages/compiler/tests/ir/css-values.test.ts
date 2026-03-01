import { describe, it, expect } from "vitest";
import {
  resolveLength,
  cssColorToRokuHex,
  parseTransform,
  resolveFont,
  type LengthContext,
} from "../../src/ir/css-values.js";

const DEFAULT_CTX: LengthContext = {
  canvasWidth: 1920,
  canvasHeight: 1080,
  parentWidth: 1920,
  parentHeight: 1080,
  parentFontSize: 16,
};

describe("resolveLength", () => {
  it("resolves bare numbers", () => {
    expect(resolveLength("100", "width", DEFAULT_CTX)).toBe(100);
    expect(resolveLength("0", "width", DEFAULT_CTX)).toBe(0);
    expect(resolveLength("3.5", "width", DEFAULT_CTX)).toBe(3.5);
  });

  it("resolves px values", () => {
    expect(resolveLength("100px", "width", DEFAULT_CTX)).toBe(100);
    expect(resolveLength("50.5px", "height", DEFAULT_CTX)).toBe(50.5);
  });

  it("resolves rem values (1rem = 16px)", () => {
    expect(resolveLength("1rem", "width", DEFAULT_CTX)).toBe(16);
    expect(resolveLength("2rem", "width", DEFAULT_CTX)).toBe(32);
    expect(resolveLength("0.5rem", "width", DEFAULT_CTX)).toBe(8);
  });

  it("resolves em values using parentFontSize", () => {
    expect(resolveLength("1em", "width", DEFAULT_CTX)).toBe(16);
    expect(resolveLength("2em", "width", { ...DEFAULT_CTX, parentFontSize: 24 })).toBe(48);
  });

  it("resolves vh values", () => {
    expect(resolveLength("100vh", "height", DEFAULT_CTX)).toBe(1080);
    expect(resolveLength("50vh", "height", DEFAULT_CTX)).toBe(540);
  });

  it("resolves vw values", () => {
    expect(resolveLength("100vw", "width", DEFAULT_CTX)).toBe(1920);
    expect(resolveLength("50vw", "width", DEFAULT_CTX)).toBe(960);
  });

  it("resolves percentage values", () => {
    expect(resolveLength("50%", "width", DEFAULT_CTX)).toBe(960);
    expect(resolveLength("100%", "height", DEFAULT_CTX)).toBe(1080);
    expect(resolveLength("25%", "width", { ...DEFAULT_CTX, parentWidth: 800 })).toBe(200);
  });

  it("returns null for vh/vw when no canvas size", () => {
    const noCanvas: LengthContext = { canvasWidth: 0, canvasHeight: 0 };
    expect(resolveLength("50vh", "height", noCanvas)).toBeNull();
    expect(resolveLength("50vw", "width", noCanvas)).toBeNull();
  });

  it("returns null for percentage when no parent size", () => {
    const noParent: LengthContext = { canvasWidth: 1920, canvasHeight: 1080, parentWidth: 0, parentHeight: 0 };
    expect(resolveLength("50%", "width", noParent)).toBeNull();
  });

  it("returns null for auto", () => {
    expect(resolveLength("auto", "width", DEFAULT_CTX)).toBeNull();
  });

  it("returns null for calc()", () => {
    expect(resolveLength("calc(100% - 20px)", "width", DEFAULT_CTX)).toBeNull();
  });

  it("handles negative values", () => {
    expect(resolveLength("-10px", "width", DEFAULT_CTX)).toBe(-10);
    expect(resolveLength("-5", "width", DEFAULT_CTX)).toBe(-5);
  });
});

describe("cssColorToRokuHex", () => {
  it("passes through 0x format", () => {
    expect(cssColorToRokuHex("0xff0000ff")).toBe("0xff0000ff");
  });

  it("converts #rrggbb to 0xRRGGBBff", () => {
    expect(cssColorToRokuHex("#ff0000")).toBe("0xff0000ff");
    expect(cssColorToRokuHex("#00ff00")).toBe("0x00ff00ff");
    expect(cssColorToRokuHex("#0000ff")).toBe("0x0000ffff");
  });

  it("converts #rgb shorthand", () => {
    expect(cssColorToRokuHex("#f00")).toBe("0xff0000ff");
    expect(cssColorToRokuHex("#fff")).toBe("0xffffffff");
  });

  it("converts #rrggbbaa", () => {
    expect(cssColorToRokuHex("#ff000080")).toBe("0xff000080");
  });

  it("converts rgb(r, g, b)", () => {
    expect(cssColorToRokuHex("rgb(255, 0, 0)")).toBe("0xff0000ff");
    expect(cssColorToRokuHex("rgb(0, 128, 255)")).toBe("0x0080ffff");
  });

  it("converts rgba(r, g, b, a)", () => {
    expect(cssColorToRokuHex("rgba(255, 0, 0, 0.5)")).toBe("0xff000080");
    expect(cssColorToRokuHex("rgba(0, 0, 0, 0)")).toBe("0x00000000");
    expect(cssColorToRokuHex("rgba(255, 255, 255, 1)")).toBe("0xffffffff");
  });

  it("converts named colors", () => {
    expect(cssColorToRokuHex("white")).toBe("0xffffffff");
    expect(cssColorToRokuHex("black")).toBe("0x000000ff");
    expect(cssColorToRokuHex("red")).toBe("0xff0000ff");
    expect(cssColorToRokuHex("transparent")).toBe("0x00000000");
  });

  it("converts expanded named colors", () => {
    expect(cssColorToRokuHex("gray")).toBe("0x808080ff");
    expect(cssColorToRokuHex("orange")).toBe("0xffa500ff");
    expect(cssColorToRokuHex("purple")).toBe("0x800080ff");
    expect(cssColorToRokuHex("cyan")).toBe("0x00ffffff");
    expect(cssColorToRokuHex("magenta")).toBe("0xff00ffff");
    expect(cssColorToRokuHex("pink")).toBe("0xffc0cbff");
    expect(cssColorToRokuHex("navy")).toBe("0x000080ff");
    expect(cssColorToRokuHex("teal")).toBe("0x008080ff");
    expect(cssColorToRokuHex("gold")).toBe("0xffd700ff");
    expect(cssColorToRokuHex("coral")).toBe("0xff7f50ff");
    expect(cssColorToRokuHex("crimson")).toBe("0xdc143cff");
    expect(cssColorToRokuHex("indigo")).toBe("0x4b0082ff");
    expect(cssColorToRokuHex("salmon")).toBe("0xfa8072ff");
    expect(cssColorToRokuHex("violet")).toBe("0xee82eeff");
    expect(cssColorToRokuHex("aqua")).toBe("0x00ffffff");
  });

  it("returns input for unknown colors", () => {
    expect(cssColorToRokuHex("papayawhip")).toBe("papayawhip");
  });

  it("is case-insensitive", () => {
    expect(cssColorToRokuHex("RED")).toBe("0xff0000ff");
    expect(cssColorToRokuHex("#FF0000")).toBe("0xff0000ff");
  });

  it("clamps rgb values", () => {
    expect(cssColorToRokuHex("rgb(300, 0, 0)")).toBe("0xff0000ff");
  });
});

describe("parseTransform", () => {
  it("parses translate(x, y)", () => {
    const result = parseTransform("translate(100, 200)");
    expect(result.translation).toEqual([100, 200]);
  });

  it("parses translate with single value", () => {
    const result = parseTransform("translate(50, 0)");
    expect(result.translation).toEqual([50, 0]);
  });

  it("parses rotate(Xdeg)", () => {
    const result = parseTransform("rotate(45deg)");
    expect(result.rotation).toBe(45);
  });

  it("parses rotate without deg suffix", () => {
    const result = parseTransform("rotate(90)");
    expect(result.rotation).toBe(90);
  });

  it("parses scale(n)", () => {
    const result = parseTransform("scale(2)");
    expect(result.scale).toEqual([2, 2]);
  });

  it("parses scale(x, y)", () => {
    const result = parseTransform("scale(1.5, 2)");
    expect(result.scale).toEqual([1.5, 2]);
  });

  it("parses compound transforms", () => {
    const result = parseTransform("translate(10, 20) rotate(45deg)");
    expect(result.translation).toEqual([10, 20]);
    expect(result.rotation).toBe(45);
  });

  it("parses translate + scale + rotate", () => {
    const result = parseTransform("translate(10, 20) scale(2, 3) rotate(90deg)");
    expect(result.translation).toEqual([10, 20]);
    expect(result.scale).toEqual([2, 3]);
    expect(result.rotation).toBe(90);
  });

  it("returns empty for unknown transforms", () => {
    const result = parseTransform("skewX(10deg)");
    expect(result.translation).toBeUndefined();
    expect(result.rotation).toBeUndefined();
    expect(result.scale).toBeUndefined();
  });
});

describe("resolveFont", () => {
  it("maps bold to MediumBoldSystemFont", () => {
    expect(resolveFont("bold")).toBe("font:MediumBoldSystemFont");
    expect(resolveFont("700")).toBe("font:MediumBoldSystemFont");
  });

  it("maps normal to MediumSystemFont", () => {
    expect(resolveFont("normal")).toBe("font:MediumSystemFont");
    expect(resolveFont("400")).toBe("font:MediumSystemFont");
  });

  it("maps lighter to SmallSystemFont", () => {
    expect(resolveFont("lighter")).toBe("font:SmallSystemFont");
    expect(resolveFont("100")).toBe("font:SmallSystemFont");
    expect(resolveFont("300")).toBe("font:SmallSystemFont");
  });

  it("returns null for unmapped weights", () => {
    expect(resolveFont("bolder")).toBeNull();
    expect(resolveFont("inherit")).toBeNull();
  });
});
