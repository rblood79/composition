import type { PanelWorkspaceRect } from "./panelWorkspaceLayoutV2";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import type { PanelWorkspaceLayoutV2 } from "./panelWorkspaceLayoutV2";
import type { PanelWorkspaceLayoutV4 } from "./panelWorkspaceLayoutV4";
import { migratePanelWorkspaceLayoutV2ToV4 } from "./panelWorkspaceLayoutV4Migration";

export const PANEL_WORKSPACE_TEST_SURFACE_RECT: PanelWorkspaceRect = {
  width: 1400,
  height: 900,
};

export function createPanelWorkspaceLayoutV4Fixture(
  surfaceRect: PanelWorkspaceRect = PANEL_WORKSPACE_TEST_SURFACE_RECT,
  source: PanelWorkspaceLayoutV2 = createPanelWorkspaceLayoutV2(),
): PanelWorkspaceLayoutV4 {
  const migrated = migratePanelWorkspaceLayoutV2ToV4(
    source,
    PANEL_WORKSPACE_TEST_REGISTRY,
    {
      surfaceRect,
      migrationId: "panel-workspace-v4-test-fixture",
    },
  );
  if (!migrated.ok) throw new Error(migrated.error);
  return migrated.value;
}
