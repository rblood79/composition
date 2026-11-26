import type { FormEvent, ReactElement, ReactNode, RefObject } from "react";
import {
  Children,
  createElement,
  Fragment,
  isValidElement,
  useCallback,
  useRef,
} from "react";
import { DEFAULT_SLOT } from "react-aria-components";
import { Button, ButtonContext } from "react-aria-components/Button";
import { FormContext } from "react-aria-components/Form";
import { useLocale } from "react-aria-components/I18nProvider";
import { Popover } from "react-aria-components/Popover";
import { CATALOG_EVENT_EDITS } from "../../interactions/bindings";
import { catalogLocalized } from "./localizedStrings";
import { CATALOG_GLYPH_1EM, catalogLucideGlyph } from "./lucideGlyph";

/**
 * S2 체크리스트 §9.3 (6-6) — S2 `EditableCell` (`TableView.tsx` `EditableCellInner`): a Cell holding
 * its editing Form (`catalogEditableCell`). Its `ActionButton[slot=edit]` opens a popover under the
 * cell (S2 `placement="bottom start"`, at least the cell's width) holding the Form (S2 `renderEditing`)
 * and S2's cancel · save buttons; a submit updates the row (`onSave` — the session's
 * `useListData.update`) and closes it, the Form's own When `onSubmit` running too (RAC
 * `FormContext` merges the handlers — a `callEndpoint` Do saves it). A press outside saves (S2
 * `shouldCloseOnInteractOutside` → `requestSubmit`), Escape cancels. The button is hidden at rest
 * (the Table rule's `[slot="edit"]` part — the row's hover · focus shows it); `data-editing` keeps it
 * shown while the popover is open.
 */
export interface CatalogEditableCellProps {
  /** The editing Form's record id (the child drawn in the popover, not in the cell). */
  formId: string;
  /** The submitted fields (by `name` — the column key) onto the cell's row. */
  /** The save — the edit's number (ADR-317 Phase 4), absent when nothing was written. */
  onSave: (values: Record<string, unknown>) => number | undefined;
}

/** S2 intl `table.editCell` · `table.cancel` · `table.save` (the languages the S2 package ships here). */
const LABELS: Readonly<
  Record<string, { edit: string; cancel: string; save: string }>
> = {
  en: { edit: "Edit cell", cancel: "Cancel", save: "Save" },
  ko: { edit: "셀 편집", cancel: "취소", save: "저장" },
  ja: { edit: "セルを編集", cancel: "キャンセル", save: "保存" },
  zh: { edit: "编辑单元格", cancel: "取消", save: "保存" },
};

/** The cell's content and its editing popover — `children` the Cell's drawn children. */
export function CatalogEditableCellContent({
  editable,
  cellRef,
  isOpen,
  setOpen,
  children,
}: {
  editable: CatalogEditableCellProps;
  cellRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  children?: ReactNode;
}): ReactElement {
  const { locale } = useLocale();
  const labels = catalogLocalized(LABELS, locale);
  const formRef = useRef<HTMLFormElement | null>(null);
  const parts = Children.toArray(children);
  const isForm = (child: ReactNode) =>
    isValidElement(child) &&
    (child.props as { id?: unknown }).id === editable.formId;
  const form = parts.find(isForm);
  const content = parts.filter((child) => !isForm(child));
  const { onSave } = editable;
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const values: Record<string, unknown> = {};
      for (const [key, value] of new FormData(event.currentTarget))
        values[key] = typeof value === "string" ? value : value.name;
      const seq = onSave(values);
      // (ADR-317 Phase 4 — the Form's own submit rule runs after this with the same event (RAC
      //  `mergeProps(contextProps, props)`): a save it sends clears this edit's marks.)
      if (seq !== undefined)
        (event as unknown as Record<symbol, unknown>)[CATALOG_EVENT_EDITS] = [
          seq,
        ];
      setOpen(false);
    },
    [onSave, setOpen],
  );
  const width = cellRef.current?.clientWidth ?? 0;
  return createElement(
    Fragment,
    null,
    createElement(
      ButtonContext.Provider,
      {
        value: {
          slots: {
            [DEFAULT_SLOT]: {},
            edit: { onPress: () => setOpen(true) },
          },
        },
      },
      content,
    ),
    isOpen
      ? createElement(
          Popover,
          {
            isOpen,
            onOpenChange: (open: boolean) => {
              if (!open) setOpen(false);
            },
            triggerRef: cellRef,
            placement: "bottom start",
            "aria-label": labels.edit,
            className: "react-aria-Popover catalog-edit-cell-popover",
            style: { minWidth: width ? `${width}px` : undefined },
            // (S2: a press outside saves the edit.)
            shouldCloseOnInteractOutside: () => {
              formRef.current?.requestSubmit();
              return false;
            },
          },
          createElement(
            "div",
            { className: "catalog-edit-cell-body" },
            createElement(
              FormContext.Provider,
              { value: { ref: formRef, onSubmit: submit } },
              form,
            ),
            createElement(
              "div",
              { className: "catalog-edit-cell-actions" },
              createElement(
                Button,
                {
                  className: "catalog-edit-cell-button",
                  "aria-label": labels.cancel,
                  onPress: () => setOpen(false),
                },
                catalogLucideGlyph("x", CATALOG_GLYPH_1EM),
              ),
              createElement(
                Button,
                {
                  className: "catalog-edit-cell-button",
                  "aria-label": labels.save,
                  onPress: () => formRef.current?.requestSubmit(),
                },
                catalogLucideGlyph("check", CATALOG_GLYPH_1EM),
              ),
            ),
          ),
        )
      : null,
  );
}
