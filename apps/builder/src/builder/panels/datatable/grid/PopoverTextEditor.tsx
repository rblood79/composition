/**
 * PopoverTextEditor — the data grid's popover cell editor as a part of its own (사용자 2026-10-29
 * 「json 편집 popover 창, table 의 편집 popover 창 같이 쓰면」): a popover on the cell with a title
 * (+ a hint), a textarea, the key hints and Cancel · Save. Supabase 어법: ⏎ saves, ⇧⏎ keeps the
 * newline, Esc cancels; an outside press cancels too. The owner says what a draft means
 * (`onCommit` → false keeps the editor open, marked invalid) and locks its own grid's focus
 * (`useDisableGridNavigation` · the variable table's lock) before rendering this.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog } from "react-aria-components/Dialog";
import { Heading } from "react-aria-components/Heading";
import { Popover } from "react-aria-components/Popover";
import { useOptionalI18n } from "../../../../i18n";
import { formatShortcut } from "../../../hooks/useKeyboardShortcutsRegistry";
import "./PopoverTextEditor.css";

export interface PopoverTextEditorProps {
  /** The cell the popover anchors on. */
  triggerRef: RefObject<HTMLElement | null>;
  /** The title (「Edit key」) and its hint (the value's shape — JSON · a date's format). */
  title: string;
  hint?: string;
  /** The textarea's accessible name — a label, or the id of the column header naming it. */
  label?: string;
  labelledBy?: string;
  initial: string;
  rows?: number;
  placeholder?: string;
  /** Save: true closes (the owner wrote it); false keeps the editor open, marked invalid. */
  onCommit: (draft: string) => boolean | Promise<boolean>;
  onCancel: () => void;
  /** The grid's `data-grid-editor` marker on the body (its tests · CSS read it). */
  bodyMarker?: string;
}

export function PopoverTextEditor({
  triggerRef,
  title,
  hint,
  label,
  labelledBy,
  initial,
  rows = 8,
  placeholder,
  onCommit,
  onCancel,
  bodyMarker = "popover",
}: PopoverTextEditorProps) {
  const i18n = useOptionalI18n();
  const t = (key: string, fallback: string) =>
    i18n ? i18n.t(`datatable.${key}`) : fallback;
  const [draft, setDraft] = useState(initial);
  const [isInvalid, setIsInvalid] = useState(false);
  const settledRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // The caret starts after the value (autofocus alone puts it first — typing then prepends to a
  // `{}` · a long cell, 5174 실측 2026-10-29).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const commit = async () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const ok = await onCommit(draft);
    if (!ok) {
      settledRef.current = false;
      setIsInvalid(true);
    }
  };
  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancel();
  };

  return (
    <Popover
      triggerRef={triggerRef}
      isOpen
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
      placement="bottom start"
      // The shared `.react-aria-Popover` · `.react-aria-Dialog` sheets carry the surface (bg ·
      // border · shadow · radius) — a bare class name would drop them (5174 실측 2026-10-29).
      className="react-aria-Popover datagrid-popover"
    >
      <Dialog className="react-aria-Dialog datagrid-popover-dialog">
        <div className="datagrid-popover-body" data-grid-editor={bodyMarker}>
          <Heading slot="title" className="datagrid-popover-title">
            {title}
            {hint && <span className="datagrid-popover-hint">{hint}</span>}
          </Heading>
          <textarea
            ref={textareaRef}
            autoFocus
            data-shortcut-local="undo redo"
            className="datagrid-popover-textarea"
            aria-label={label}
            aria-labelledby={labelledBy}
            aria-invalid={isInvalid || undefined}
            aria-multiline="true"
            rows={rows}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setIsInvalid(false);
            }}
            onKeyDown={(e) => {
              // Supabase 어법: ⏎ saves, ⇧⏎ keeps the newline (⌘⏎ saves too), Esc cancels.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                void commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancel();
              } else if (e.key !== "Tab") {
                e.stopPropagation();
              }
            }}
          />
          <div className="datagrid-popover-footer">
            <div className="datagrid-popover-keys">
              {/* Key glyphs come from the shortcut formatter (platform-aware — ⇧ on Mac). */}
              <span className="datagrid-popover-key">
                <kbd>{formatShortcut({ key: "Enter", modifier: "none" })}</kbd>
                {t("gridKeySave", "Save")}
              </span>
              <span className="datagrid-popover-key">
                <kbd>{formatShortcut({ key: "Enter", modifier: "shift" })}</kbd>
                {t("gridKeyNewline", "New line")}
              </span>
              <span className="datagrid-popover-key">
                <kbd>{formatShortcut({ key: "Escape", modifier: "none" })}</kbd>
                {t("gridKeyCancel", "Cancel")}
              </span>
            </div>
            <Button className="control-button" onPress={cancel}>
              {i18n ? i18n.t("common.cancel") : "Cancel"}
            </Button>
            <Button
              className="control-button"
              data-variant="primary"
              onPress={() => void commit()}
            >
              {i18n ? i18n.t("common.save") : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Popover>
  );
}
