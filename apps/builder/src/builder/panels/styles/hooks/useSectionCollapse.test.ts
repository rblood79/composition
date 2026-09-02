import { beforeEach, describe, expect, it } from "vitest";
import {
  STYLE_PANEL_SECTION_IDS,
  areAllSectionsCollapsed,
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

    useSectionCollapse.getState().toggleSectionGroup(["comp-layout", "comp-form"]);

    expect(collapsed()).toEqual(
      new Set(["comp-layout", "comp-form", "history-edits"]),
    );
  });

  it("expands only the group when all members are collapsed — foreign ids stay collapsed", () => {
    useSectionCollapse.setState({
      collapsedSections: new Set(["comp-layout", "comp-form", "history-edits"]),
    });

    useSectionCollapse.getState().toggleSectionGroup(["comp-layout", "comp-form"]);

    expect(collapsed()).toEqual(new Set(["history-edits"]));
  });

  it("⌥S regression: a collapsed section of another panel no longer blocks expanding the style group", () => {
    // 종전 판정 `collapsedSections.size === 4` 는 5번째 id 가 있으면 영원히 거짓이었다
    useSectionCollapse.setState({
      collapsedSections: new Set([...STYLE_PANEL_SECTION_IDS, "navigator-pages"]),
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
