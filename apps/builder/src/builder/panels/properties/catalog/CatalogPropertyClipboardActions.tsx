import { memo, useCallback, useMemo } from "react";
import type { EditContract } from "@composition/shared";
import { useI18n } from "../../../../i18n";
import { iconProps } from "../../../../utils/ui/uiConstants";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogCopiedProperties,
  catalogPastePropertiesCommand,
} from "../../../catalogRuntime/propertyClipboard";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { ActionIconButton } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useActiveScope } from "../../../hooks/useActiveScope";
import { useCopyPaste } from "../../../hooks/useCopyPaste";
import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
} from "../../../hooks/useKeyboardShortcutsRegistry";
import { useCatalogCommandRunner } from "../../navigator/catalog/useCatalogCommandRunner";

const { copy: CopyIcon, paste: PasteIcon } = ACTION_ICONS;

/**
 * ADR-248 Phase 4e-5: Properties copy / paste (the old `PropertyClipboardActions`) over the
 * catalog selection — copy = the first target's own semantic values as JSON on the clipboard,
 * paste = one step on the edited targets with the keys their contract offers (⌘⌥C / ⌘⌥V with the
 * Properties panel active).
 */
export const CatalogPropertyClipboardActions = memo(
  function CatalogPropertyClipboardActions({
    contract,
    targets,
  }: {
    contract: EditContract;
    targets: readonly EditTarget[];
  }) {
    const { t } = useI18n();
    const workspace = useCatalogWorkspace();
    const run = useCatalogCommandRunner();
    const activeScope = useActiveScope();
    const copied = useMemo(() => catalogCopiedProperties(contract), [contract]);
    const onPaste = useCallback(
      (data: Record<string, unknown>) => {
        const command = catalogPastePropertiesCommand(
          workspace.runtime.graph,
          workspace.readModel,
          targets,
          data,
        );
        if (command) run(command);
      },
      [run, targets, workspace],
    );
    const { copy, paste } = useCopyPaste({ onPaste, name: "properties" });
    const handleCopy = useCallback(async () => {
      if (Object.keys(copied).length) await copy(copied);
    }, [copied, copy]);
    const handlePaste = useCallback(async () => {
      await paste();
    }, [paste]);
    const shortcuts = useMemo(
      () =>
        bindHandlersToDefinitions(["copyProperties", "pasteProperties"], {
          copyProperties: handleCopy,
          pasteProperties: handlePaste,
        }),
      [handleCopy, handlePaste],
    );
    useKeyboardShortcutsRegistry(shortcuts, [shortcuts], { activeScope });

    return (
      <>
        <ActionIconButton
          onPress={handleCopy}
          aria-label={t("propertiesPanel.copyProperties")}
          isDisabled={!Object.keys(copied).length}
          tooltip={t("propertiesPanel.copyProperties")}
          shortcutId="copyProperties"
        >
          <CopyIcon
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        </ActionIconButton>
        <ActionIconButton
          onPress={handlePaste}
          aria-label={t("propertiesPanel.pasteProperties")}
          tooltip={t("propertiesPanel.pasteProperties")}
          shortcutId="pasteProperties"
        >
          <PasteIcon
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        </ActionIconButton>
      </>
    );
  },
);
