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

/**
 * `경로 → 토큰` — breakdown §5 역할 분류표 (2026-10-30). ADR-297 Phase 2 (2026-11-01): 경로는 variant 칠 조건 트리
 * (`paint.<속성>.<조건…>`) — 옛 `fill.default.hover` · `colors.outlineText` 경로를 기계로 옮겼고 rule · variant
 * 별 (토큰 · 역할) 묶음은 옛 표와 같다 (48 = 48).
 *
 * 2026-11-09 — 표에서 빠진 참조 (accent 두 역할 밖의 S2 토큰으로 옮겨 갔다):
 * - Button accent · ToggleButton 선택 emphasized 의 채움 = `{color.accent-fill}` (`3ca03f661` S2 1.8.2 Button ·
 *   ActionButton.btnStyles — ToggleButton 은 테두리 없음).
 * - Checkbox · Radio · Switch emphasized 의 선택 = `{color.selection-accent}` (`3ca03f661` · `ca2be22b3` S2 accent-900).
 * - Badge accent 의 hover · pressed 가지 삭제 · subtle · outline 글자 = `{color.gray-1000}` (`4f71aa245` S2 Badge).
 * - Input accent 의 hover 테두리 = 공용 `FIELD_INPUT_BORDER` (`3ca03f661` S2 FieldGroup).
 */
const CLASSIFICATION: Record<string, string> = {
  // 배경 역할 — 위에 on-accent 글자 · 아이콘
  "Badge.variants.accent.paint.backgroundColor.default": "accent",
  "ListBoxItem.variants.default.paint.backgroundColor.isSelected.default":
    "accent",
  "Row.variants.default.paint.backgroundColor.isSelected.default": "accent",
  // (ADR-297 Phase 3d: the emphasized selection is the default tree's `isSelected.isEmphasized` branch)
  "Tag.variants.default.paint.backgroundColor.isSelected.isEmphasized":
    "accent",
  "Tag.variants.default.paint.borderColor.isSelected.isEmphasized": "accent",
  // 바탕 위 역할 — 글자 · 선 · track 위 채움
  "Badge.variants.accent.paint.borderColor.fillStyle.outline": "accent-content",
  // (ADR-297 3h #2: an accent outline Button's text is S2 `baseColor('neutral')` — no accent-content)
  "Card.variants.primary.paint.borderColor.isSelected.default":
    "accent-content",
  "Card.variants.secondary.paint.borderColor.isSelected.default":
    "accent-content",
  "Card.variants.tertiary.paint.borderColor.isSelected.default":
    "accent-content",
  "Card.variants.quiet.paint.borderColor.isSelected.default": "accent-content",
  "ColorSwatch.variants.default.paint.borderColor.isSelected": "accent-content",
  "DateInput.variants.accent.paint.borderColor.default": "accent-content",
  "DropZone.variants.default.paint.color.isHovered": "accent-content",
  "DropZone.variants.default.paint.borderColor.isHovered": "accent-content",
  "Group.variants.accent.paint.color.default": "accent-content",
  "Input.variants.accent.paint.borderColor.default": "accent-content",
  "Link.variants.primary.paint.color.default": "accent-content",
  "Link.variants.primary.paint.color.isHovered": "accent-content-hover",
  "Link.variants.secondary.paint.color.isHovered": "accent-content",
  "Popover.variants.accent.paint.borderColor.default": "accent-content",
  "ProgressBarTrack.variants.default.fillBar": "accent-content",
  "ProgressBarFill.variants.default.paint.backgroundColor.default":
    "accent-content",
  "ProgressBarFill.variants.default.paint.backgroundColor.isHovered":
    "accent-content",
  "ProgressBarFill.variants.default.paint.backgroundColor.isPressed":
    "accent-content",
  "SliderFill.variants.emphasized.paint.backgroundColor.default":
    "accent-content",
  "SliderThumb.variants.emphasized.paint.backgroundColor.default":
    "accent-content",
  "TagGroup.variants.accent.paint.borderColor.default": "accent-content",
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

/**
 * 글자 · 테두리 leaf 가 놓이는 배경 가지 — `fillStyle.<값>` 가지의 leaf 는 배경 트리의 같은 fillStyle 가지, 나머지는
 * fillStyle · quiet 가지를 뺀 배경 트리 (옛 `fill.default` — 모든 상태).
 */
function backgroundFor(variant: Json, path: string[]): unknown {
  const bg = (variant.paint as Json | undefined)?.backgroundColor;
  if (!bg || typeof bg !== "object") return bg;
  const at = path.indexOf("fillStyle");
  if (at >= 0)
    return ((bg as Json).fillStyle as Json | undefined)?.[path[at + 1]!];
  const { fillStyle: _f, isQuiet: _q, ...rest } = bg as Json;
  return rest;
}

function backdropsOf(type: string, path: string[]): string[] {
  const rules = COMPONENT_RULES_TABLE as unknown as Record<string, Json>;
  const variants = rules[type]!.variants as Record<string, Json>;
  const variant = variants[path[2]!]!;
  let fill: unknown;
  if (path[3] === "paint" && path[4] !== "backgroundColor")
    fill = backgroundFor(variant, path.slice(5));
  else if (path[3] === "fillBar") fill = backgroundFor(variant, []);
  else {
    const track = rules[TRACK_OF[type]!]!;
    fill = Object.values(track.variants as Record<string, Json>).map((v) =>
      backgroundFor(v, []),
    );
  }
  const tokens = tokensOf(fill).filter(
    (t) => t !== "accent-content" && t !== "accent-content-hover",
  );
  return [
    ...new Set(
      // (`container` — ADR-303: the nearest container's layer, one of the same surfaces)
      tokens.flatMap((t) =>
        t === "transparent" || t === "container" ? TRANSPARENT_SURFACES : [t],
      ),
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
    const isText = parts[3] === "paint" && parts[4] === "color";
    const allowed = isText ? text : any;
    expect(backdrops.filter((b) => !allowed.has(b))).toEqual([]);
  });
});
