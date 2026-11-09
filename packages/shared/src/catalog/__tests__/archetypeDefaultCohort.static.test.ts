import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ADR-223 G4 ratchet (2026-09-18): `archetype: "default"` 이면서 `composition.layout` 이 없는 entry
 * 는 생성 CSS base 가 중립 상자 (block · box-sizing · font-family) 로 떨어진다. 이 목록을 pin 해
 * **신규 entry 가 미지정으로 들어오는 것을 막는다** — 새 컴포넌트는 archetype (`button` · `text` ·
 * `container` …) 이나 `composition.layout` 을 명시해야 한다. 기존 entry 가 명시로 옮겨가면 목록에서
 * 빼는 것은 허용 (ratchet 은 한 방향).
 *
 * 분류 (Phase 0 inventory, docs/adr/evidence/223-phase0-inventory.md):
 *   composition.containerStyles 만 3 (Disclosure · Pagination · Toolbar) + composition 없음 8.
 *
 * ActionButtonGroup (8586c64bd) · ToggleButtonGroup (3ca03f661 이 `layout: "flex-row"` 삭제): S2 1.8.2
 *   ActionButtonGroup · ToggleButtonGroup 정렬 — 방향은 `containerVariants.orientation` 의 flex-direction,
 *   flex 상자는 `structure.containerStyles` (display flex · align-items center) 가 두 consumer 에 같이 준다.
 *   (`layout` 삭제 사유는 커밋에 없다.) 상자 기하가 명시돼 있어 중립 base 로 떨어지지 않는다 — 위 「containerStyles 만」 과
 *   같은 부류.
 */
const PINNED_DEFAULT_WITHOUT_LAYOUT = [
  "ActionButtonGroup",
  "AvatarGroup",
  "body",
  "ButtonGroup",
  "Card",
  "CardView",
  "Disclosure",
  "GridListItem",
  "Pagination",
  "Tab",
  "ToggleButtonGroup",
  "Toolbar",
] as const;

describe("ADR-223 G4 — archetype 미지정 cohort ratchet", () => {
  const actual = Object.entries(COMPONENT_RULES_TABLE)
    .filter(([, rule]) => {
      const s = rule.structure;
      return s?.archetype === "default" && !s.composition?.layout;
    })
    .map(([key]) => key)
    .sort();

  it('목록 밖 신규 `archetype: "default"` entry 는 없다 (archetype 또는 composition.layout 명시 강제)', () => {
    const pinned = new Set<string>(PINNED_DEFAULT_WITHOUT_LAYOUT);
    const unexpected = actual.filter((k) => !pinned.has(k));
    expect(unexpected, "새 entry 는 archetype 을 명시한다 (ADR-223)").toEqual(
      [],
    );
  });

  it("pin 목록은 실제 표의 부분집합 (명시로 옮겨간 entry 는 목록에서 뺀다)", () => {
    const actualSet = new Set(actual);
    const stale = PINNED_DEFAULT_WITHOUT_LAYOUT.filter(
      (k) => !actualSet.has(k),
    );
    expect(stale).toEqual([]);
  });

  it("Card · Tab 의 DOM interaction 은 rootSelectors['&'] · 상태 트리 채널에 있다 (containerStyles 가장 금지)", () => {
    type RootSelectors = Record<string, { styles?: Record<string, string> }>;
    const card = COMPONENT_RULES_TABLE.Card.structure?.composition
      ?.rootSelectors as RootSelectors | undefined;
    const tab = COMPONENT_RULES_TABLE.Tab.structure?.composition
      ?.rootSelectors as RootSelectors | undefined;
    // (ADR-297 Phase 3b: the cursor is the state tree's — pointer at rest, not-allowed when disabled)
    for (const key of ["Card", "Tab"])
      expect(
        COMPONENT_RULES_TABLE[key].structure?.stateStyles?.cursor,
        key,
      ).toEqual({ default: "pointer", isDisabled: "not-allowed" });
    expect(card?.["&"]?.styles).toMatchObject({ "text-decoration": "none" });
    expect(tab?.["&"]?.styles).toMatchObject({ "user-select": "none" });
    for (const key of ["Card", "Tab", "Pagination", "Toolbar"]) {
      const cs = COMPONENT_RULES_TABLE[key].structure?.containerStyles as
        Record<string, unknown> | undefined;
      expect(cs?.cursor, key).toBeUndefined();
      expect(cs?.userSelect, key).toBeUndefined();
    }
  });
});
