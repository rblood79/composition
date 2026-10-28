import { memo, useCallback, useMemo } from "react";
import type { EditContract } from "@composition/shared";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogCopiedProperties,
  catalogPastePropertiesCommand,
} from "../../../catalogRuntime/propertyClipboard";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { useActiveScope } from "../../../hooks/useActiveScope";
import { useCopyPaste } from "../../../hooks/useCopyPaste";
import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
} from "../../../hooks/useKeyboardShortcutsRegistry";
import { useCatalogCommandRunner } from "../../../catalogRuntime/commandRunner";

/**
 * ADR-248 Phase 4e-5: Properties copy / paste (the old `PropertyClipboardActions`) over the
 * catalog selection — copy = the first target's own semantic values as JSON on the clipboard,
 * paste = one step on the edited targets with the keys their contract offers (⌘⌥C / ⌘⌥V with the
 * Properties panel active).
 * Property 헤더에는 버튼을 표시하지 않고 기존 단축키·메뉴 명령만 등록한다.
 */
export const CatalogPropertyClipboardActions = memo(
  function CatalogPropertyClipboardActions({
    contract,
    targets,
  }: {
    contract: EditContract;
    targets: readonly EditTarget[];
  }) {
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

    return null;
  },
);
