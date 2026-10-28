import { useCallback, useSyncExternalStore } from "react";
import type { CatalogSiteSettings } from "../../../../../../packages/shared/src/catalog/document/types";
import { setSiteSettings } from "../../../../../../packages/shared/src/catalog/commands";
import { useOptionalCatalogWorkspace } from "../../catalogRuntime/react";
import { runCatalogCommand } from "../../catalogRuntime/commandRunner";

const noop = () => () => {};
const EMPTY: CatalogSiteSettings = {};

export type SiteSettingsPatch = {
  [K in keyof CatalogSiteSettings]?: CatalogSiteSettings[K] | undefined;
};

/**
 * ADR-286 Decision 5 — the open project's site settings (`ProjectEntry.site`), each edit one
 * history step (`setSiteSettings` — a key set to `undefined` removes it). `null` outside a catalog
 * project.
 */
export function useCatalogSiteSettings(): {
  site: CatalogSiteSettings;
  change: (patch: SiteSettingsPatch) => boolean;
} | null {
  const workspace = useOptionalCatalogWorkspace();
  const subscribe = useCallback(
    (notify: () => void) =>
      workspace
        ? workspace.runtime.subscribeEntryField(
            workspace.runtime.graph.projectId,
            "site",
            notify,
          )
        : noop(),
    [workspace],
  );
  const site = useSyncExternalStore(
    subscribe,
    () =>
      workspace?.runtime.selectEntryField(
        workspace.runtime.graph.projectId,
        "site",
      ) as CatalogSiteSettings | undefined,
  );
  // A refused edit (e.g. a redirect not starting with `/`) changes nothing and shows its reason.
  const change = useCallback(
    (patch: SiteSettingsPatch) => {
      if (!workspace) return false;
      return runCatalogCommand(
        workspace,
        setSiteSettings({ patch, label: "Site settings" }),
      );
    },
    [workspace],
  );
  if (!workspace) return null;
  return { site: site ?? EMPTY, change };
}
