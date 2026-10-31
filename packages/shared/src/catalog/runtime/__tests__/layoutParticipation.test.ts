import { describe, expect, it } from "vitest";
import {
  catalogHasDisplayedLayout,
  catalogParticipatesInFlow,
  catalogParticipatesInLayout,
} from "../layoutParticipation";

type LayoutRecord = Parameters<typeof catalogParticipatesInLayout>[0];
const absent: LayoutRecord[] = [
  { hidden: true, layout: {} },
  { layout: { display: "none" } },
];
const presentLayouts: Record<string, string>[] = [
  { position: "sticky" },
  { display: "contents" },
  { visibility: "hidden" },
  { width: "0", height: "0" },
];

describe("catalog layout participation", () => {
  it("presence/display suppress layout, while absolute/fixed only leave normal flow", () => {
    for (const record of absent) {
      expect(catalogParticipatesInLayout(record)).toBe(false);
      expect(catalogParticipatesInFlow(record)).toBe(false);
    }
    for (const position of ["absolute", "fixed"]) {
      const record = { layout: { position } };
      expect(catalogParticipatesInLayout(record)).toBe(true);
      expect(catalogParticipatesInFlow(record)).toBe(false);
    }
    for (const layout of presentLayouts) {
      expect(catalogParticipatesInLayout({ layout })).toBe(true);
      expect(catalogParticipatesInFlow({ layout })).toBe(true);
    }
  });

  it.each(absent)(
    "a hidden ancestor suppresses editing geometry through contents wrappers: %j",
    (hidden) => {
      const child = {
        id: "child",
        parentId: "contents",
        layout: { display: "grid" },
      };
      const wrapper = {
        id: "contents",
        parentId: "parent",
        layout: { display: "contents" },
      };
      const parent = { id: "parent", parentId: "root", ...hidden };
      const records = new Map<
        string,
        {
          id: string;
          parentId: string;
          hidden?: boolean;
          layout: Record<string, string>;
        }
      >([
        [child.id, child],
        [wrapper.id, wrapper],
        [parent.id, parent],
      ]);
      expect(catalogHasDisplayedLayout(child, records)).toBe(false);
      records.set(parent.id, { ...parent, hidden: false, layout: {} });
      expect(catalogHasDisplayedLayout(child, records)).toBe(true);
      records.set(parent.id, {
        ...parent,
        hidden: false,
        layout: {},
        parentId: child.id,
      });
      expect(catalogHasDisplayedLayout(child, records)).toBe(false);
    },
  );
});
