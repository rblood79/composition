import {
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ComboBoxStateContext,
  type ComboBoxProps,
  type ComboBoxState,
  type Key,
} from "react-aria-components";
import { ComboBox as AriaComboBox } from "react-aria-components/ComboBox";

/** The record's runtime write: the selection and the input text, in one update. */
type SelectionTextWrite = (patch: {
  selectedKey?: Key | null;
  inputValue?: string;
}) => void;

type ComboBoxState1 = ComboBoxState<object, "single">;

/**
 * An item's text (`""` for none); undefined while the item is not in the list. Read from the whole
 * collection (the selection manager's) — `state.collection` is the one last shown while closed.
 */
const selectedText = (state: ComboBoxState1, key: Key | null) =>
  key == null ? "" : state.selectionManager.collection.getItem(key)?.textValue;

/** The last selection seen and its text — kept when a filter hides the item. */
type Seen = { key: Key | null; text: string | undefined };

/**
 * The input text follows the selection — what RAC does itself unless both `selectedKey` and
 * `inputValue` are controlled (`useComboBoxState`: "it's the user's responsibility to update
 * inputValue in onSelectionChange"). A selection made elsewhere (a rule · a load's
 * `selectedKeys`) or the selected item's text arriving later (an async list) writes the text;
 * the first render only fills an empty input.
 */
function SelectionText({
  stateRef,
  seen,
  write,
  quietText,
  settle,
}: {
  stateRef: RefObject<ComboBoxState1 | null>;
  seen: RefObject<Seen | null>;
  write: SelectionTextWrite;
  quietText: string | null;
  settle: () => void;
}): null {
  const state = useContext(ComboBoxStateContext) as ComboBoxState1 | null;
  const quietRuns = useRef(0);
  useEffect(() => {
    stateRef.current = state;
    if (!state) return;
    // (The written text has landed — RAC's effect in this commit took it as its last value; a
    // second render without it ends the quiet anyway.)
    if (quietText !== null) {
      quietRuns.current += 1;
      if (state.inputValue === quietText || quietRuns.current > 1) {
        quietRuns.current = 0;
        settle();
      }
    }
    const key = state.selectedKey;
    const text = selectedText(state, key);
    const previous = seen.current;
    seen.current = {
      key,
      text: text ?? (previous?.key === key ? previous.text : undefined),
    };
    if (text === undefined || state.inputValue === text) return;
    if (previous === null) {
      if (state.inputValue === "") write({ inputValue: text });
      return;
    }
    if (previous.key !== key || (previous.text !== text && !state.isFocused))
      write({ inputValue: text });
  });
  return null;
}

/**
 * RAC `ComboBox` whose selection and input text are both the record's runtime state (ADR-280): the
 * reference's "Fully controlled" example — `onSelectionChange` sets the input text with the key
 * (RAC also calls it with the same key to put the text back on blur).
 *
 * A pressed item closes the list first (`react-aria-item-action` → `state.close`) and selects
 * after; RAC then reads the text arriving in the focused, closed field as typing and opens the
 * list again (`useComboBoxState`: focused · closed · `inputValue !== lastValue` · not `manual`).
 * The render that brings the written text runs with `menuTrigger: "manual"`, so RAC only takes
 * it as its last value.
 */
export function CatalogComboBox({
  onSelectionText,
  children,
  ...props
}: ComboBoxProps<object> & {
  onSelectionText?: SelectionTextWrite;
  children?: ReactNode;
}): ReactElement {
  const stateRef = useRef<ComboBoxState1 | null>(null);
  const seen = useRef<Seen | null>(null);
  const [quietText, setQuietText] = useState<string | null>(null);
  if (!onSelectionText)
    return createElement(AriaComboBox as ElementType, props, children);
  const write: SelectionTextWrite = (patch) => {
    if (
      patch.inputValue !== undefined &&
      patch.inputValue !== stateRef.current?.inputValue
    )
      setQuietText(patch.inputValue);
    onSelectionText(patch);
  };
  return createElement(
    AriaComboBox as ElementType,
    {
      ...props,
      ...(quietText !== null ? { menuTrigger: "manual" } : {}),
      onSelectionChange: (key: Key | null) => {
        const state = stateRef.current;
        // (No key: RAC committed the typed text as a custom value — `allowsCustomValue` — and
        // keeps it; the text effect must not empty it either.)
        const text =
          key == null
            ? undefined
            : ((state ? selectedText(state, key) : undefined) ??
              (seen.current?.key === key ? seen.current.text : undefined));
        seen.current = { key, text: key == null ? "" : text };
        write(
          text === undefined
            ? { selectedKey: key }
            : { selectedKey: key, inputValue: text },
        );
        // (The rest — the record's `onSelectionChange` rules, `withRuntime`.)
        props.onSelectionChange?.(key);
      },
    },
    children,
    createElement(SelectionText, {
      stateRef,
      seen,
      write,
      quietText,
      settle: () => setQuietText(null),
    }),
  );
}
