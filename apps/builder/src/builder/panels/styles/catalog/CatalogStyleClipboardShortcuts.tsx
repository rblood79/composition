import { useCallback, useMemo } from "react";
import { useActiveScope } from "../../../hooks/useActiveScope";
import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
} from "../../../hooks/useKeyboardShortcutsRegistry";
import { useStyleActions } from "../hooks/useStyleActions";
import { useStylesHost } from "../stylesHost";

/**
 * ADR-248 Phase 4e-5: Styles copy / paste shortcuts (⌘⌥C / ⌘⌥V with the Styles panel active) over
 * the catalog Styles host — the same actions as the panel toolbar (the selected target's CSS view
 * as JSON on the clipboard; paste = one `setFields` step at the session breakpoint). The old app
 * registered them in `CanvasSelectionShortcutsHost`, which the catalog Builder does not mount.
 */
export function CatalogStyleClipboardShortcuts() {
  const host = useStylesHost();
  const { copyStyles, pasteStyles } = useStyleActions();
  const activeScope = useActiveScope();
  const handleCopy = useCallback(async () => {
    const { id, style } = host.readSelectedTarget();
    if (id && Object.keys(style).length) await copyStyles(style);
  }, [copyStyles, host]);
  const handlePaste = useCallback(async () => {
    await pasteStyles();
  }, [pasteStyles]);
  const shortcuts = useMemo(
    () =>
      bindHandlersToDefinitions(["copyStyles", "pasteStyles"], {
        copyStyles: handleCopy,
        pasteStyles: handlePaste,
      }),
    [handleCopy, handlePaste],
  );
  useKeyboardShortcutsRegistry(shortcuts, [shortcuts], { activeScope });
  return null;
}
