import { memo, useCallback, useMemo, useSyncExternalStore } from "react";
import type { SlotRole } from "@composition/shared";
import { useI18n } from "@/i18n";
import {
  catalogItemRoleCommand,
  catalogItemRoles,
  type CatalogItemRoles,
} from "../../../catalogRuntime/itemRoles";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { PropertySection, PropertySwitch } from "../../../components";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

const ROLE_LABEL_KEY: Partial<Record<SlotRole, string>> = {
  icon: "propertiesPanel.itemRoleIcon",
  avatar: "propertiesPanel.itemRoleAvatar",
  label: "propertiesPanel.itemRoleLabel",
  description: "propertiesPanel.itemRoleDescription",
  shortcut: "propertiesPanel.itemRoleShortcut",
};

/**
 * ADR-248 Phase 4e-4e: the item roles section over the catalog document (the old
 * ItemSlotRolesSection's instance surface) — a collection item's optional roles switch on and off,
 * the required label is listed without a switch. Each switch is one step.
 */
export const CatalogItemRolesSection = memo(function CatalogItemRolesSection({
  identity,
}: {
  identity: string;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const read = useCallback((): CatalogItemRoles | null => {
    const position = workspace.positionOfRecord(identity);
    if (!position) return null;
    try {
      return catalogItemRoles(workspace.runtime.graph, position);
    } catch {
      return null;
    }
  }, [identity, workspace]);
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const viewKey = useSyncExternalStore(subscribe, () => JSON.stringify(read()));
  const roles = useMemo(
    () => JSON.parse(viewKey) as CatalogItemRoles | null,
    [viewKey],
  );
  if (!roles) return null;
  const label = (role: SlotRole) => {
    const key = ROLE_LABEL_KEY[role];
    return key ? t(key as never) : role;
  };
  return (
    <PropertySection title={t("propertiesPanel.itemRolesSection" as never)}>
      {roles.rows.map((row) =>
        row.required ? (
          <div
            className="list-row item-role-row"
            data-item-role={row.role}
            key={row.role}
          >
            <div className="list-row__body">
              <span className="list-row__label">{label(row.role)}</span>
            </div>
            <span className="list-row__meta">
              {t("propertiesPanel.itemRoleRequired" as never)}
            </span>
          </div>
        ) : (
          <PropertySwitch
            key={row.role}
            label={label(row.role)}
            labelMode="inline"
            isSelected={row.enabled}
            onChange={(next) => run(catalogItemRoleCommand(row, next))}
          />
        ),
      )}
    </PropertySection>
  );
});
