import { beforeEach, describe, expect, it } from "vitest";
import {
  STYLE_PANEL_SECTION_IDS,
  areAllSectionsCollapsed,
  migrateLegacySectionId,
  migrateLegacySectionIds,
  useSectionCollapse,
} from "./useSectionCollapse";

const collapsed = () => useSectionCollapse.getState().collapsedSections;

beforeEach(() => {
  useSectionCollapse.setState({
    collapsedSections: new Set(),
    focusMode: false,
    activeFocusSection: null,
  });
});

describe("areAllSectionsCollapsed", () => {
  it("treats an empty group as not collapsed", () => {
    expect(areAllSectionsCollapsed(new Set(["a"]), [])).toBe(false);
  });

  it("is true only when every member id is collapsed", () => {
    expect(areAllSectionsCollapsed(new Set(["a"]), ["a", "b"])).toBe(false);
    expect(areAllSectionsCollapsed(new Set(["a", "b", "z"]), ["a", "b"])).toBe(
      true,
    );
  });
});

describe("toggleSectionGroup", () => {
  it("collapses only the group when any member is still expanded", () => {
    useSectionCollapse.setState({
      collapsedSections: new Set(["comp-layout", "history-edits"]),
    });

    useSectionCollapse
      .getState()
      .toggleSectionGroup(["comp-layout", "comp-form"]);

    expect(collapsed()).toEqual(
      new Set(["comp-layout", "comp-form", "history-edits"]),
    );
  });

  it("expands only the group when all members are collapsed — foreign ids stay collapsed", () => {
    useSectionCollapse.setState({
      collapsedSections: new Set(["comp-layout", "comp-form", "history-edits"]),
    });

    useSectionCollapse
      .getState()
      .toggleSectionGroup(["comp-layout", "comp-form"]);

    expect(collapsed()).toEqual(new Set(["history-edits"]));
  });

  it("⌥S regression: a collapsed section of another panel no longer blocks expanding the style group", () => {
    // 종전 판정 `collapsedSections.size === 4` 는 5번째 id 가 있으면 영원히 거짓이었다
    useSectionCollapse.setState({
      collapsedSections: new Set([
        ...STYLE_PANEL_SECTION_IDS,
        "navigator-pages",
      ]),
    });

    useSectionCollapse.getState().toggleSectionGroup(STYLE_PANEL_SECTION_IDS);

    expect(collapsed()).toEqual(new Set(["navigator-pages"]));

    useSectionCollapse.getState().toggleSectionGroup(STYLE_PANEL_SECTION_IDS);

    expect(collapsed()).toEqual(
      new Set([...STYLE_PANEL_SECTION_IDS, "navigator-pages"]),
    );
  });

  it("collapseAll() without ids targets exactly the style panel group", () => {
    useSectionCollapse.getState().collapseAll();

    expect(collapsed()).toEqual(new Set(STYLE_PANEL_SECTION_IDS));
  });
});

/** ADR-225 HC6/G4 — 구 Navigator section id 승계 (hydration 에서 제거 + 치환). */
describe("legacy navigator section id migration (ADR-225)", () => {
  const STORAGE_KEY = "styles-panel-collapse";

  const seed = (
    collapsedSections: string[],
    activeFocusSection: string | null = null,
  ) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          collapsedSections,
          focusMode: false,
          activeFocusSection,
          defaultsApplied: ["position"],
        },
        version: 0,
      }),
    );
  };

  const persisted = (): { collapsedSections: string[] } =>
    JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").state;

  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["old-only", ["navigator-frames", "navigator-frame-layers"]],
    ["new-only", ["navigator-layouts", "navigator-layout-layers"]],
    [
      "both",
      [
        "navigator-frames",
        "navigator-layouts",
        "navigator-frame-layers",
        "navigator-layout-layers",
      ],
    ],
  ])("%s → new ids only, other ids untouched", (_label, stored) => {
    const result = migrateLegacySectionIds([...stored, "navigator-pages"]);
    expect(result).toEqual(
      new Set([
        "navigator-layouts",
        "navigator-layout-layers",
        "navigator-pages",
      ]),
    );
  });

  it("none → unchanged", () => {
    expect(migrateLegacySectionIds(["position", "fill"])).toEqual(
      new Set(["position", "fill"]),
    );
  });

  it("activeFocusSection old/new/null mapping", () => {
    expect(migrateLegacySectionId("navigator-frames")).toBe(
      "navigator-layouts",
    );
    expect(migrateLegacySectionId("navigator-layout-layers")).toBe(
      "navigator-layout-layers",
    );
    expect(migrateLegacySectionId(null)).toBeNull();
    expect(migrateLegacySectionId("transform")).toBe("transform");
  });

  it("hydration removes old ids, then expand → persist → reload keeps the section expanded", async () => {
    seed(["navigator-frames", "navigator-frame-layers"], "navigator-frames");
    await useSectionCollapse.persist.rehydrate();

    expect(collapsed()).toEqual(
      new Set(["navigator-layouts", "navigator-layout-layers"]),
    );
    expect(useSectionCollapse.getState().activeFocusSection).toBe(
      "navigator-layouts",
    );
    // 사용자가 섹션을 펼친다 → 다음 persist 는 승계된 집합에서 쓰이므로 구 id 가 없다
    useSectionCollapse.getState().toggleSection("navigator-layouts");
    expect(persisted().collapsedSections).toEqual(["navigator-layout-layers"]);
    expect(persisted().collapsedSections).not.toContain("navigator-frames");

    await useSectionCollapse.persist.rehydrate();
    expect(collapsed()).toEqual(new Set(["navigator-layout-layers"]));
  });

  it("does not touch the split key or unrelated ids", () => {
    seed(["navigator-split:layouts", "navigator-pages"]);
    expect(migrateLegacySectionIds(persisted().collapsedSections)).toEqual(
      new Set(["navigator-split:layouts", "navigator-pages"]),
    );
  });
});
