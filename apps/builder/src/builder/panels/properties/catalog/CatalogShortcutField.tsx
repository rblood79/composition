import { memo, useCallback, useMemo } from "react";
import { useI18n } from "@/i18n";
import { setFields } from "../../../../../../../packages/shared/src/catalog/commands";
import { composeOver } from "../../../../../../../packages/shared/src/catalog/commands/compose";
import type { CatalogCommand } from "../../../../../../../packages/shared/src/catalog/commands/compose";
import { readTargetProp } from "../../../../../../../packages/shared/src/catalog/resolution/fieldSource";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";
import {
  catalogItemRoleCommand,
  type CatalogItemRoleRow,
} from "../../../catalogRuntime/itemRoles";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import {
  SHORTCUT_MODIFIERS,
  formatShortcutText,
  parseShortcutText,
  shortcutPlatform,
  type ShortcutModifier,
} from "../../../catalogRuntime/shortcutText";
import { PropertyChipGroup } from "../../../components/property/PropertyChipGroup";
import { PropertyInput } from "../../../components/property/PropertyInput";
import "./CatalogShortcutField.css";

/**
 * A MenuItem's shortcut (its RAC `Keyboard` child — Menu · ActionMenu items alike) as modifier
 * toggles + a key, in place of the role's on/off switch (사용자 결정 2026-11-28 — 「토글 버튼 그룹 +
 * 키 입력」 · 「cmd 가 아닌 ⌘, 운영체제에 따라서 토글 버튼이 다르게」 · 「switch 자체가 필요없지, 토글이
 * 한개도 없으면 shortcut 비활성」). The toggles are the Builder platform's (⌃ ⌥ ⇧ ⌘ on macOS, Ctrl ·
 * Alt · Shift elsewhere); each change writes the child's text in that platform's way
 * (`shortcutText.ts`) and its `enabled` — shown while a modifier is on — in one step. A shown text
 * the toggles cannot read back stays a free text field (shown while it is not empty).
 */
export const CatalogShortcutField = memo(function CatalogShortcutField({
  row,
}: {
  row: CatalogItemRoleRow;
}) {
  const { t } = useI18n();
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const platform = useMemo(() => shortcutPlatform(), []);
  const target = row.target;
  const read = useCallback((): string => {
    try {
      const value = readTargetProp(workspace.runtime.graph, target, "children");
      return typeof value === "string" ? value : "";
    } catch {
      return "";
    }
  }, [target, workspace]);
  const text = useCatalogStepReading<string>(workspace, read);
  const parsed = parseShortcutText(text, platform);
  const write = (next: string, enabled: boolean) => {
    if (next === text && enabled === row.enabled) return;
    const commands: CatalogCommand[] = [];
    if (next !== text)
      commands.push(
        setFields({
          targets: [target],
          props: {
            children: next ? { kind: "set", value: next } : { kind: "remove" },
          },
        }),
      );
    if (enabled !== row.enabled)
      commands.push(catalogItemRoleCommand(row, enabled));
    run((reader) => composeOver(reader, "Edit shortcut", commands));
  };
  if (!parsed && row.enabled)
    return (
      <div className="fieldset-row" data-wide="true">
        <PropertyInput
          label={t("propertiesPanel.itemRoleShortcut" as never)}
          value={text}
          onChange={(next) => write(next, next.trim() !== "")}
        />
      </div>
    );
  // (A hidden shortcut shows no modifier on; its key stays for the next modifier.)
  const modifiers: ReadonlySet<ShortcutModifier> = row.enabled
    ? (parsed?.modifiers ?? new Set())
    : new Set();
  const key = parsed?.key ?? "";
  const toggle = (modifier: string, selected: boolean) => {
    const next = new Set(modifiers);
    if (selected) next.add(modifier as ShortcutModifier);
    else next.delete(modifier as ShortcutModifier);
    write(
      formatShortcutText({ modifiers: next, key }, platform),
      next.size > 0,
    );
  };
  return (
    <div className="fieldset-row" data-wide="true">
      {/* (Modifiers look like the item's other seg fields — Menu Size · Selection mode: a
          `.fieldset-row` › seg track; 사용자 2026-11-28 「size, selection mode 와 같은 패턴」. The key
          is the row's action cell like Size's glyph-size action — 「key 열 shortcut 우측 액션버튼
          영역으로 이동」.) */}
      <PropertyChipGroup
        label={t("propertiesPanel.itemRoleShortcut" as never)}
        appearance="seg"
        chips={SHORTCUT_MODIFIERS[platform].map((spec) => ({
          key: spec.modifier,
          label: spec.label,
          ariaLabel: spec.name,
          selected: modifiers.has(spec.modifier),
        }))}
        onToggle={toggle}
        className="shortcut-modifiers"
      />
      <div className="fieldset-actions actions-shortcut-key">
        <PropertyInput
          label={t("propertiesPanel.shortcutKey" as never)}
          value={key}
          placeholder="K"
          onChange={(next) =>
            write(
              formatShortcutText({ modifiers, key: next }, platform),
              modifiers.size > 0,
            )
          }
        />
      </div>
    </div>
  );
});
