/**
 * ADR-290 G2 — catalog rule 의 accent 참조는 역할 둘로 나뉜다.
 *
 * 규칙 하나: 같은 상태에서 그 면 위에 on-accent 를 얹으면 `accent` (배경), surface 위에 바로 놓이면
 * `accent-content` (글자 · 선 · track 위 채움). 아래 표가 분류의 정본 (breakdown §5) — rule 에 accent 참조가
 * 새로 생기거나 역할이 바뀌면 여기서 RED 다.
 *
 * 둘째 단언: `accent-content` 가 놓이는 바탕을 rule 에서 유도해, 탐색의 대비 대상
 * (`ACCENT_CONTENT_TEXT_BACKDROPS` · `ACCENT_CONTENT_GRAPHIC_BACKDROPS`) 안에 있는지 본다. 새 rule 이 새
 * 바탕을 들이면 RED — 탐색이 모르는 바탕 위의 대비는 보장되지 않는다.
 */
import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import {
  ACCENT_CONTENT_GRAPHIC_BACKDROPS,
  ACCENT_CONTENT_TEXT_BACKDROPS,
} from "../../../../../../packages/shared/src/catalog/runtime/tintToSkiaColors";

const ACCENT_REF =
  /\{color\.(accent|accent-hover|accent-pressed|accent-content|accent-content-hover)\}|var\(--(accent|accent-hover|accent-pressed|accent-content|accent-content-hover)\)/g;

/** `경로 → 토큰` — breakdown §5 역할 분류표 (2026-10-30). */
const CLASSIFICATION: Record<string, string> = {
  // 배경 역할 — 위에 on-accent 글자 · 아이콘
  "Badge.variants.accent.fill.default.base": "accent",
  "Badge.variants.accent.fill.default.hover": "accent",
  "Badge.variants.accent.fill.default.pressed": "accent",
  "Button.variants.accent.fill.default.base": "accent",
  "Button.variants.accent.fill.default.hover": "accent-hover",
  "Button.variants.accent.fill.default.pressed": "accent-pressed",
  "Button.variants.accent.colors.border": "accent",
  "Button.variants.accent.colors.borderHover": "accent-hover",
  "Checkbox.variants.emphasized.fill.default.selected": "accent",
  "Checkbox.variants.emphasized.colors.selectedBorder": "accent",
  "ListBoxItem.variants.default.fill.default.selected": "accent",
  "Radio.variants.emphasized.fill.default.selected": "accent",
  "Radio.variants.emphasized.colors.selectedBorder": "accent",
  "Switch.variants.emphasized.fill.default.selected": "accent",
  "Row.variants.default.fill.default.selected": "accent",
  "Tag.variants.selectedEmphasized.fill.default.base": "accent",
  "Tag.variants.selectedEmphasized.fill.default.hover": "accent",
  "Tag.variants.selectedEmphasized.fill.default.pressed": "accent",
  "Tag.variants.selectedEmphasized.colors.border": "accent",
  "ToggleButton.variants.default.fill.default.emphasizedSelected": "accent",
  "ToggleButton.variants.default.colors.emphasizedSelectedBorder": "accent",
  // 바탕 위 역할 — 글자 · 선 · track 위 채움
  "Badge.variants.accent.colors.subtleText": "accent-content",
  "Badge.variants.accent.colors.outlineText": "accent-content",
  "Badge.variants.accent.colors.outlineBorder": "accent-content",
  "Button.variants.accent.colors.outlineText": "accent-content",
  "Card.variants.primary.colors.selectedBorder": "accent-content",
  "Card.variants.secondary.colors.selectedBorder": "accent-content",
  "Card.variants.tertiary.colors.selectedBorder": "accent-content",
  "Card.variants.quiet.colors.selectedBorder": "accent-content",
  "ColorSwatch.variants.selected.colors.border": "accent-content",
  "DateInput.variants.accent.colors.border": "accent-content",
  "DateInput.variants.accent.colors.borderHover": "accent-content-hover",
  "DropZone.variants.default.colors.textHover": "accent-content",
  "DropZone.variants.default.colors.borderHover": "accent-content",
  "Group.variants.accent.colors.text": "accent-content",
  "Input.variants.accent.colors.border": "accent-content",
  "Input.variants.accent.colors.borderHover": "accent-content-hover",
  "Link.variants.primary.colors.text": "accent-content",
  "Link.variants.primary.colors.textHover": "accent-content-hover",
  "Link.variants.secondary.colors.textHover": "accent-content",
  "Popover.variants.accent.colors.border": "accent-content",
  "ProgressBarTrack.variants.default.fillBar": "accent-content",
  "ProgressBarFill.variants.default.fill.default.base": "accent-content",
  "ProgressBarFill.variants.default.fill.default.hover": "accent-content",
  "ProgressBarFill.variants.default.fill.default.pressed": "accent-content",
  "SliderFill.variants.emphasized.fill.default.base": "accent-content",
  "SliderThumb.variants.emphasized.fill.default.base": "accent-content",
  "TagGroup.variants.accent.colors.border": "accent-content",
};

/** 생성 sheet 로 가는 DOM 상태 선택자 (focus · drop · quiet 밑줄) — 전부 바탕 위 선 · 글자. */
const SELECTOR_ROLE = "accent-content";

type Json = Record<string, unknown>;

function walk(node: unknown, path: string[], out: Array<[string, string]>) {
  if (typeof node === "string") {
    for (const m of node.matchAll(ACCENT_REF))
      out.push([path.join("."), (m[1] ?? m[2])!]);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node as Json)) walk(v, [...path, k], out);
}

function accentRefs(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [type, rule] of Object.entries(COMPONENT_RULES_TABLE))
    walk(rule, [type], out);
  return out;
}

const TRANSPARENT_SURFACES = [
  "base",
  "raised",
  "layer-1",
  "layer-2",
  "elevated",
];
/** 채움 자체가 accent-content 인 부품 → 그 아래 track rule. */
const TRACK_OF: Record<string, string> = {
  ProgressBarFill: "ProgressBarTrack",
  SliderFill: "SliderTrack",
  SliderThumb: "SliderTrack",
};

function tokensOf(value: unknown): string[] {
  const out: string[] = [];
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      const m = /^\{color\.([a-z0-9-]+)\}$/.exec(v);
      if (m) out.push(m[1]!);
    } else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(value);
  return out;
}

/** `colors.<key>` 가 놓이는 fill 축 — subtle* · outline* 은 그 fillStyle, 나머지는 default. */
function fillFor(variant: Json, key: string): unknown {
  const fill = variant.fill as Json | undefined;
  if (!fill) return undefined;
  if (key.startsWith("subtle")) return fill.subtle;
  if (key.startsWith("outline")) return fill.outline;
  return fill.default;
}

function backdropsOf(type: string, path: string[]): string[] {
  const rules = COMPONENT_RULES_TABLE as unknown as Record<string, Json>;
  const variants = rules[type]!.variants as Record<string, Json>;
  const variant = variants[path[2]!]!;
  let fill: unknown;
  if (path[3] === "colors") fill = fillFor(variant, path[4]!);
  else if (path[3] === "fillBar") fill = (variant.fill as Json).default;
  else {
    const track = rules[TRACK_OF[type]!]!;
    fill = Object.values(track.variants as Record<string, Json>).map(
      (v) => (v.fill as Json).default,
    );
  }
  const tokens = tokensOf(fill).filter(
    (t) => t !== "accent-content" && t !== "accent-content-hover",
  );
  return [
    ...new Set(
      tokens.flatMap((t) => (t === "transparent" ? TRANSPARENT_SURFACES : [t])),
    ),
  ];
}

describe("ADR-290 G2 — accent 역할 분류", () => {
  it("variant 의 accent 참조가 분류표와 같다 (새 참조 · 역할 변경은 RED)", () => {
    const actual: Record<string, string> = {};
    for (const [path, token] of accentRefs())
      if (/\.variants\./.test(path) && !/Selectors/.test(path))
        actual[path] = token;
    expect(actual).toEqual(CLASSIFICATION);
  });

  it("DOM 상태 선택자 (focus · drop · quiet 밑줄 · track 채움 변수) 의 accent 는 accent-content", () => {
    const selectorRefs = accentRefs().filter(([path]) =>
      /Selectors|\.nested\.|\.styles\./.test(path),
    );
    expect(selectorRefs.length).toBeGreaterThan(0);
    const wrong = selectorRefs.filter(
      ([path, token]) =>
        token !== SELECTOR_ROLE &&
        // 배경 칠 (`background` · `background-color`) 은 배경 역할
        !/\.(background|background-color)$/.test(path),
    );
    expect(wrong).toEqual([]);
  });
});

describe("ADR-290 G2 — accent-content 의 바탕은 탐색의 대비 대상 안", () => {
  const text = new Set<string>(ACCENT_CONTENT_TEXT_BACKDROPS);
  const any = new Set<string>([
    ...ACCENT_CONTENT_TEXT_BACKDROPS,
    ...ACCENT_CONTENT_GRAPHIC_BACKDROPS,
  ]);
  const contentPaths = Object.entries(CLASSIFICATION).filter(([, t]) =>
    t.startsWith("accent-content"),
  );

  it.each(contentPaths)("%s", (path) => {
    const parts = path.split(".");
    const backdrops = backdropsOf(parts[0]!, parts);
    expect(backdrops.length).toBeGreaterThan(0);
    const isText = parts[3] === "colors" && /text/i.test(parts[4]!);
    const allowed = isText ? text : any;
    expect(backdrops.filter((b) => !allowed.has(b))).toEqual([]);
  });
});
