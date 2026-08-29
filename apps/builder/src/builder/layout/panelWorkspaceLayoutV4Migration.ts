import type {
  PanelWorkspaceLayoutV2,
  PanelWorkspaceRect,
  PanelWorkspaceRegistryEntry,
  PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";
import {
  parsePanelWorkspaceLayoutV3,
  upgradePanelWorkspaceLayoutV3ToV4,
} from "./panelWorkspaceLayoutV3";
import {
  normalizePanelWorkspaceLayoutV4,
  type PanelWorkspaceLayoutV4,
} from "./panelWorkspaceLayoutV4";

export interface PanelWorkspaceLayoutV4MigrationOptions {
  surfaceRect: PanelWorkspaceRect;
  migrationId: string;
}

/** v3 raw/layout을 canonical panel ID의 v4 layout으로 승격한다. */
export function migratePanelWorkspaceLayoutV3ToV4(
  input: unknown,
  registry: readonly PanelWorkspaceRegistryEntry[],
  options: PanelWorkspaceLayoutV4MigrationOptions,
): PanelWorkspaceResult<PanelWorkspaceLayoutV4> {
  if (options.migrationId.length === 0) {
    return { ok: false, error: "Migration id is empty" };
  }
  const v3 = parsePanelWorkspaceLayoutV3(input, registry, options.surfaceRect);
  if (!v3.ok) return v3;
  return normalizePanelWorkspaceLayoutV4(
    upgradePanelWorkspaceLayoutV3ToV4(v3.value, options.migrationId),
    registry,
    options.surfaceRect,
  );
}

/** 현재 runtime fixture/새 메모리 layout을 위한 v2→v4 연결. */
export function migratePanelWorkspaceLayoutV2ToV4(
  input: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  options: PanelWorkspaceLayoutV4MigrationOptions,
): PanelWorkspaceResult<PanelWorkspaceLayoutV4> {
  const v3 = migratePanelWorkspaceLayoutV2ToV3(input, registry, options);
  if (!v3.ok) return v3;
  return normalizePanelWorkspaceLayoutV4(
    upgradePanelWorkspaceLayoutV3ToV4(v3.value),
    registry,
    options.surfaceRect,
  );
}
