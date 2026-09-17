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
 */
const PINNED_DEFAULT_WITHOUT_LAYOUT = [
  "AvatarGroup",
  "body",
  "ButtonGroup",
  "Card",
  "CardView",
  "Disclosure",
  "GridListItem",
  "Pagination",
  "Tab",
  "TableView",
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

  it("Card · Tab 의 DOM interaction 은 rootSelectors['&'] 채널에 있다 (containerStyles 가장 금지)", () => {
    type RootSelectors = Record<string, { styles?: Record<string, string> }>;
    const card = COMPONENT_RULES_TABLE.Card.structure?.composition
      ?.rootSelectors as RootSelectors | undefined;
    const tab = COMPONENT_RULES_TABLE.Tab.structure?.composition
      ?.rootSelectors as RootSelectors | undefined;
    expect(card?.["&"]?.styles).toMatchObject({ cursor: "pointer" });
    expect(tab?.["&"]?.styles).toMatchObject({
      cursor: "pointer",
      "user-select": "none",
    });
    for (const key of ["Card", "Tab", "Pagination", "Toolbar", "TableView"]) {
      const cs = COMPONENT_RULES_TABLE[key].structure?.containerStyles as
        Record<string, unknown> | undefined;
      expect(cs?.cursor, key).toBeUndefined();
      expect(cs?.userSelect, key).toBeUndefined();
    }
  });
});
