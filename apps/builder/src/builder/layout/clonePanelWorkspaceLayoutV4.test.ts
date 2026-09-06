import { describe, expect, it } from "vitest";
import { clonePanelWorkspaceLayoutV4 } from "./clonePanelWorkspaceLayoutV4";
import { createPanelWorkspaceLayoutV4Fixture } from "./panelWorkspaceLayoutV4.testFixtures";

describe("clonePanelWorkspaceLayoutV4", () => {
  it("중첩 패널 편집이 원본 layout과 저장된 migration 정보에 새지 않는다", () => {
    const original = createPanelWorkspaceLayoutV4Fixture();
    original.migrationSource = { version: 3, migrationId: "source" };
    original.clusters[0].originOffset = { x: 12, y: 24 };
    const before = structuredClone(original);
    const copy = clonePanelWorkspaceLayoutV4(original);
    expect(copy).toEqual(original);

    copy.clusters[0].originOffset!.x = 99;
    copy.clusters[0].columns[0].width += 10;
    copy.clusters[0].columns[0].rows[0].height += 10;
    copy.railOrder.left.reverse();
    copy.clusterFocusOrder.reverse();
    copy.migrationSource!.migrationId = "changed";
    expect(copy.migrationSource).not.toBe(original.migrationSource);
    expect(copy.visibility).not.toBe(original.visibility);
    expect(original).toEqual(before);
  });
});
