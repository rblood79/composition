import { memo, useCallback, type ReactNode } from "react";
import type { SlotRole } from "@composition/shared";
import { useI18n } from "@/i18n";
import {
  catalogItemRoleCommand,
  catalogItemRoles,
  type CatalogItemRoles,
} from "../../../catalogRuntime/itemRoles";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { PropertySwitch } from "../../../components/property/PropertySwitch";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import { CatalogItemIconField } from "./CatalogItemIconField";
import { CatalogItemTextField } from "./CatalogItemTextField";
import { CatalogShortcutField } from "./CatalogShortcutField";

const ROLE_LABEL_KEY: Partial<Record<SlotRole, string>> = {
  icon: "propertiesPanel.itemRoleIcon",
  avatar: "propertiesPanel.itemRoleAvatar",
  label: "propertiesPanel.itemRoleLabel",
  description: "propertiesPanel.itemRoleDescription",
  shortcut: "propertiesPanel.itemRoleShortcut",
};

/**
 * ADR-248 Phase 4e-4e: the item roles over the catalog document (the old ItemSlotRolesSection's
 * instance surface) — 사용자 2026-11-28: each role is edited in place (icon picker · label ·
 * description text · shortcut toggles + key), a role shows while it has a value; only a role
 * without a field of its own (avatar) keeps its switch. Each edit is one step.
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
  const roles = useCatalogStepReading<CatalogItemRoles | null>(workspace, read);
  if (!roles) return null;
  const label = (role: SlotRole) => {
    const key = ROLE_LABEL_KEY[role];
    return key ? t(key as never) : role;
  };
  // (Each role is a field of the section like Content's — `.fieldset-row` › `fieldset` straight
  //  under the section content, no group fieldset around them; 사용자 2026-11-28 「children 구조가
  //  다른 fieldset 구조 패턴과 다르다」. The shortcut's toggles are a seg row like Size.)
  const wide = (key: string, field: ReactNode) => (
    <div className="fieldset-row" data-wide="true" key={key}>
      {field}
    </div>
  );
  return (
    <>
      {roles.rows.map((row) =>
        row.required ? (
          wide(
            row.role,
            <CatalogItemTextField row={row} label={label(row.role)} required />,
          )
        ) : row.role === "shortcut" ? (
          <CatalogShortcutField key={row.role} row={row} />
        ) : row.role === "icon" ? (
          wide(
            row.role,
            <CatalogItemIconField row={row} label={label(row.role)} />,
          )
        ) : row.role === "description" ? (
          wide(
            row.role,
            <CatalogItemTextField row={row} label={label(row.role)} />,
          )
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
    </>
  );
});
