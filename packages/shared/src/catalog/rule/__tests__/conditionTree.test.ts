/**
 * ADR-297 G0 (d) RED → G1 — 조건 트리의 순서 규칙 (S2 `style-macro.ts:558`: 같은 깊이의 나중 키가 이기고, 부모의
 * 나중 조건이 자식 가지를 덮는다) 을 evaluator 와 compiler 가 같이 따르는가.
 */
import { S2_TOUCH_MEDIA } from "@composition/rendering";
import { describe, expect, it } from "vitest";
import {
  compileConditionTree,
  conditionTreeKeys,
  evaluateConditionTree,
  type ConditionalValue,
} from "../conditionTree";

const input: ConditionalValue<string> = {
  default: "{color.border}",
  isHovered: "{color.border-hover}",
  isFocused: "{color.accent-content}",
  isQuiet: {
    default: "transparent",
    isHovered: "quiet-hover",
  },
  isInvalid: { default: "{color.negative}", isFocused: "neg-focus" },
};

describe("evaluateConditionTree", () => {
  it("leaf and default", () => {
    expect(evaluateConditionTree("x", {})).toBe("x");
    expect(evaluateConditionTree(input, {})).toBe("{color.border}");
  });

  it("later key wins at the same depth", () => {
    expect(evaluateConditionTree(input, { isHovered: true })).toBe(
      "{color.border-hover}",
    );
    expect(
      evaluateConditionTree(input, { isHovered: true, isFocused: true }),
    ).toBe("{color.accent-content}");
  });

  it("a later parent condition covers an earlier branch's children (quiet+hover+invalid)", () => {
    expect(
      evaluateConditionTree(input, {
        isQuiet: true,
        isHovered: true,
        isInvalid: true,
      }),
    ).toBe("{color.negative}");
    expect(
      evaluateConditionTree(input, { isQuiet: true, isHovered: true }),
    ).toBe("quiet-hover");
  });

  it("a true branch with no match leaves the value it covers", () => {
    expect(
      evaluateConditionTree(
        { default: "a", isSelected: { isHovered: "b" } },
        {
          isSelected: true,
        },
      ),
    ).toBe("a");
  });

  it("value conditions pick their branch by value", () => {
    const tree: ConditionalValue<string> = {
      variant: { accent: { default: "a", isHovered: "ah" }, primary: "p" },
      fillStyle: { outline: "transparent" },
    };
    expect(evaluateConditionTree(tree, { variant: "accent" })).toBe("a");
    expect(
      evaluateConditionTree(tree, { variant: "accent", isHovered: true }),
    ).toBe("ah");
    expect(
      evaluateConditionTree(tree, { variant: "accent", fillStyle: "outline" }),
    ).toBe("transparent");
    expect(evaluateConditionTree(tree, { variant: "x" })).toBeUndefined();
  });

  it("domOnly branches are never evaluated", () => {
    expect(
      evaluateConditionTree(
        {
          default: "a",
          domOnly: { "& > .x": "b" },
        } as ConditionalValue<string>,
        {},
      ),
    ).toBe("a");
  });
});

describe("compileConditionTree", () => {
  const css = (tree: ConditionalValue<string>) =>
    compileConditionTree(tree, ".react-aria-Input", "border-color", {
      touchMedia: S2_TOUCH_MEDIA,
    }).map(
      (b) =>
        `${b.media ? `${b.media} ` : ""}${b.selector} { ${b.property}: ${b.value} }`,
    );

  it("emits one block per leaf in evaluation order, every condition inside :where()", () => {
    expect(css(input)).toEqual([
      ".react-aria-Input { border-color: {color.border} }",
      ".react-aria-Input:where([data-hovered]) { border-color: {color.border-hover} }",
      ".react-aria-Input:where(:is([data-focused],[data-focus-within])) { border-color: {color.accent-content} }",
      ".react-aria-Input:where([data-quiet]) { border-color: transparent }",
      ".react-aria-Input:where([data-quiet][data-hovered]) { border-color: quiet-hover }",
      ".react-aria-Input:where([data-invalid]) { border-color: {color.negative} }",
      ".react-aria-Input:where([data-invalid]:is([data-focused],[data-focus-within])) { border-color: neg-focus }",
    ]);
  });

  it("value conditions are data attributes; media conditions wrap the block", () => {
    expect(
      css({
        variant: { accent: { default: "a", forcedColors: "ButtonText" } },
        touch: "t",
      } as ConditionalValue<string>),
    ).toEqual([
      '.react-aria-Input:where([data-variant="accent"]) { border-color: a }',
      '@media (forced-colors: active) .react-aria-Input:where([data-variant="accent"]) { border-color: ButtonText }',
      `@media ${S2_TOUCH_MEDIA} .react-aria-Input { border-color: t }`,
    ]);
  });

  it("domOnly raw selectors follow the tree blocks with their own specificity", () => {
    expect(
      css({
        default: "a",
        domOnly: { "& > .toast-close-button": "b" },
      } as ConditionalValue<string>),
    ).toEqual([
      ".react-aria-Input { border-color: a }",
      ".react-aria-Input > .toast-close-button { border-color: b }",
    ]);
  });
});

describe("conditionTreeKeys", () => {
  it("lists the condition keys a tree uses", () => {
    expect([...conditionTreeKeys(input)].sort()).toEqual(
      ["isFocused", "isHovered", "isInvalid", "isQuiet"].sort(),
    );
  });
});
