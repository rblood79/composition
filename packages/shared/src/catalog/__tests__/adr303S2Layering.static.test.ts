/**
 * ADR-303 G1 — 배정 = S2. 컨테이너 · 떠 있는 요소의 배경 층 · 그림자 · 테두리가 설치 S2 1.8.2 소스와 같다.
 *
 * oracle = `fixtures/adr303-s2-layering.json` (생성기 `apps/builder/scripts/adr303-s2-layering-extract.mjs`
 * 가 설치본 `src/*.tsx` 의 style 블록 · 바인딩 대상을 뽑는다 — 손 편집 금지, `--check` 로 대조).
 * S2 이름 → rule TokenRef 는 아래 두 표뿐이다: 층 · 색 (ADR-302 alias — `base` = gray 25|25 · `border` =
 * gray 300) 과 그림자 (ADR-166 — emphasized · elevated · dragged = sm · md · lg).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

type Tree = string | number | { readonly [k: string]: Tree } | undefined;
interface Block {
  symbol: string;
  boundTo: { tag: string; line: number }[];
  props: Record<string, Tree>;
}
const oracle = JSON.parse(
  readFileSync(
    new URL("./fixtures/adr303-s2-layering.json", import.meta.url),
    "utf8",
  ),
) as { s2Version: string; files: Record<string, Block[]> };
const files = oracle.files;
const s2 = (file: string, symbol: string): Block => {
  const b = files[file].find((x) => x.symbol === symbol);
  if (!b) throw new Error(`${file} ${symbol} 없음 — fixture 재생성`);
  return b;
};
/** Modal 은 JSX 안 inline style — 바인딩 대상 (RACModal) 으로 찾는다. */
const s2Bound = (file: string, tag: string): Block => {
  const b = files[file].find((x) => x.boundTo.some((t) => t.tag === tag));
  if (!b) throw new Error(`${file} → ${tag} 없음`);
  return b;
};

const LAYER: Record<string, string> = {
  "layer-1": "{color.layer-1}",
  "layer-2": "{color.layer-2}",
  elevated: "{color.elevated}",
  "gray-25": "{color.base}",
  "gray-300": "{color.border}",
  transparent: "{color.transparent}",
};
const SHADOW: Record<string, string> = {
  emphasized: "{shadow.sm}",
  elevated: "{shadow.md}",
  dragged: "{shadow.lg}",
  none: "none",
};

type AnyRule = {
  variants: Record<
    string,
    { paint?: { backgroundColor?: Tree; borderColor?: Tree } }
  >;
  containerStyles?: { boxShadow?: string };
  partStateStyles?: Record<string, Record<string, Tree>>;
  structure?: {
    containerStyles?: { boxShadow?: string; outline?: string };
    stateStyles?: Record<string, Tree>;
    composition?: { containerStyles?: { boxShadow?: string } };
  };
};
const rule = (t: string) =>
  COMPONENT_RULES_TABLE[
    t as keyof typeof COMPONENT_RULES_TABLE
  ] as unknown as AnyRule;
const containerShadow = (t: string) =>
  rule(t).containerStyles?.boxShadow ??
  rule(t).structure?.containerStyles?.boxShadow ??
  rule(t).structure?.composition?.containerStyles?.boxShadow;
const stateShadow = (t: string) => rule(t).structure?.stateStyles?.boxShadow;
const bgOf = (t: string, v: string) =>
  rule(t).variants[v]?.paint?.backgroundColor;
/** 상태 없는 배경 (`{ default }` 하나 — selected 는 선택 표시라 허용) 의 값. */
const restingBg = (t: string, v: string) => {
  const bg = bgOf(t, v);
  if (typeof bg === "string") return bg;
  const keys = Object.keys(bg ?? {});
  expect(
    keys.filter(
      (k) => k !== "default" && k !== "isSelected" && k !== "isQuiet",
    ),
    `${t}.${v} 배경 상태`,
  ).toEqual([]);
  return (bg as Record<string, Tree>).default;
};
const map = (tree: Tree, table: Record<string, string>): Tree =>
  typeof tree === "string"
    ? (table[tree] ?? `?${tree}`)
    : tree && typeof tree === "object"
      ? Object.fromEntries(
          Object.entries(tree)
            .filter(([k]) => k !== "forcedColors")
            .map(([k, v]) => [k, map(v, table)]),
        )
      : tree;

describe("ADR-303 G1 — 배정 = S2 1.8.2", () => {
  it("fixture 는 설치 S2 의 style 블록과 바인딩 대상을 담는다", () => {
    expect(oracle.s2Version).toBe("1.8.2");
    expect(s2("TableView.tsx", "table").boundTo.map((b) => b.tag)).toContain(
      "RACTable",
    );
    expect(
      s2("TableView.tsx", "editPopover").boundTo.map((b) => b.tag),
    ).toEqual(["RACPopover"]);
  });

  it("Popover — 모든 variant layer-2 · elevated 그림자 · 1px popover-outline", () => {
    const p = s2("Popover.tsx", "popover").props;
    const layer = (p["--s2-container-bg"] as { value: { default: string } })
      .value.default;
    for (const v of Object.keys(rule("Popover").variants))
      expect(restingBg("Popover", v), v).toBe(LAYER[layer]);
    expect(containerShadow("Popover")).toBe(
      SHADOW[(p.boxShadow as { default: string }).default],
    );
    expect(p.outlineWidth).toBe(1);
    expect((p.outlineColor as { default: string }).default).toBe(
      "lightDark('transparent-white-25', 'gray-200')",
    );
    expect(rule("Popover").structure?.containerStyles?.outline).toBe(
      "1px solid var(--popover-outline)",
    );
  });

  it("Modal · Sheet · Dialog — layer-2, 그림자 없음 (underlay 가 분리)", () => {
    const m = s2Bound("Modal.tsx", "RACModal").props;
    expect(m.boxShadow).toBeUndefined();
    const layer = (m["--s2-container-bg"] as { value: string }).value;
    // Sheet 는 S2 에 없다 — 같은 계열 Modal. Dialog 는 자기 배경이 없고 Modal 의 층 위에 놓인다.
    expect(
      s2("Dialog.tsx", "dialogInner").props.backgroundColor,
    ).toBeUndefined();
    for (const t of ["Modal", "Sheet", "Dialog"]) {
      expect(restingBg(t, "default"), t).toBe(LAYER[layer]);
      expect(containerShadow(t), t).toBeUndefined();
      expect(stateShadow(t), t).toBeUndefined();
    }
    expect(
      (COMPONENT_RULES_TABLE.Modal as { underlay?: string }).underlay,
    ).toBe("{color.overlay-backdrop}");
  });

  it("Tooltip — 그림자 없음 · Toast — elevated (회귀 방지)", () => {
    expect(s2("Tooltip.tsx", "tooltip").props.boxShadow).toBeUndefined();
    expect(containerShadow("Tooltip")).toBeUndefined();
    expect(stateShadow("Tooltip")).toBeUndefined();
    const toast = s2("Toast.tsx", "toastStyle").props.boxShadow as {
      default: string;
    };
    expect(containerShadow("Toast")).toBe(SHADOW[toast.default]);
  });

  it("Card — primary elevated · secondary layer-1 배경 고정, 그림자 상태 = S2", () => {
    const c = s2("Card.tsx", "card").props;
    const layer = (
      c["--s2-container-bg"] as { value: { variant: Record<string, string> } }
    ).value.variant;
    expect(restingBg("Card", "primary")).toBe(LAYER[layer.primary]);
    expect(restingBg("Card", "secondary")).toBe(LAYER[layer.secondary]);
    expect(restingBg("Card", "tertiary")).toBe("{color.transparent}");
    expect(restingBg("Card", "quiet")).toBe("{color.transparent}");

    // 루트 그림자: tertiary 는 S2 가 box-shadow 로 그리는 2px 테두리라 rule 은 테두리 (paint) 로 옮긴다.
    const shadow = c.boxShadow as Record<string, Tree> & {
      variant: Record<string, Tree>;
    };
    const { variant: _v, ...states } = shadow;
    expect(stateShadow("Card")).toEqual({
      ...(map(states, SHADOW) as object),
      variant: {
        tertiary: "none",
        quiet: SHADOW[shadow.variant.quiet as string],
      },
    });
    // quiet 는 루트가 아니라 CardPreview (`preview` → `div@609`) 에 hover · focus · selected 그림자 (리뷰 m4).
    const preview = s2("Card.tsx", "preview");
    expect(preview.boundTo.map((b) => b.line)).toContain(609);
    expect(
      rule("Card").partStateStyles?.["&% .react-aria-CardPreview"]?.boxShadow,
    ).toEqual({
      variant: {
        quiet: map(
          (preview.props.boxShadow as { isQuiet: Tree }).isQuiet,
          SHADOW,
        ),
      },
    });
  });

  it("Card tertiary 테두리 = gray-100 → hover · focus gray-200", () => {
    const bc = rule("Card").variants.tertiary.paint?.borderColor as Record<
      string,
      Tree
    >;
    expect(bc.default).toBe("{color.neutral-surface}");
    expect(bc.isHovered).toBe("{color.neutral-surface-hover}");
    expect(bc.isFocusVisible).toBe("{color.neutral-surface-hover}");
  });

  it("Table — base · quiet transparent, 상태 배경 0 · 테두리 border · 그림자 없음", () => {
    const t = s2("TableView.tsx", "table").props;
    const bg = t.backgroundColor as Record<string, string>;
    expect(bgOf("Table", "default")).toEqual({
      default: LAYER[bg.default],
      isQuiet: LAYER[bg.isQuiet],
    });
    expect(rule("Table").variants.default.paint?.borderColor).toEqual({
      default: LAYER[(t.borderColor as { default: string }).default],
    });
    expect(t.boxShadow).toBeUndefined();
    expect(containerShadow("Table")).toBeUndefined();
    expect(stateShadow("Table")).toBeUndefined();
  });
});
