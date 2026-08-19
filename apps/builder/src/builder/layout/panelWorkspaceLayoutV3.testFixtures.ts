import type { PanelWorkspaceRect } from "./panelWorkspaceLayoutV2";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import type { PanelWorkspaceLayoutV2 } from "./panelWorkspaceLayoutV2";
import type { PanelWorkspaceLayoutV3 } from "./panelWorkspaceLayoutV3";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";

export const PANEL_WORKSPACE_TEST_SURFACE_RECT: PanelWorkspaceRect = {
  width: 1400,
  height: 900,
};

export function createPanelWorkspaceLayoutV3Fixture(
  surfaceRect: PanelWorkspaceRect = PANEL_WORKSPACE_TEST_SURFACE_RECT,
  source: PanelWorkspaceLayoutV2 = createPanelWorkspaceLayoutV2(),
): PanelWorkspaceLayoutV3 {
  const migrated = migratePanelWorkspaceLayoutV2ToV3(
    source,
    PANEL_WORKSPACE_TEST_REGISTRY,
    {
      surfaceRect,
      migrationId: "panel-workspace-v3-test-fixture",
    },
  );
  if (!migrated.ok) throw new Error(migrated.error);
  return migrated.value;
}
