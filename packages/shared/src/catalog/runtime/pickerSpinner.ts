import {
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  ComboBoxStateContext,
  SelectStateContext,
} from "react-aria-components";
import { ProgressCircle } from "../../components/ProgressCircle";

/** S2 ComboBox — a load or filter shows the field's spinner only once it has run this long. */
const COMBOBOX_SPINNER_DELAY_MS = 500;

/**
 * S2 Picker: the trigger's spinner before the chevron while `loading`, not while open (the list
 * shows its own).
 */
function PickerSpinner({
  loadingState,
}: {
  loadingState: string;
}): ReactElement | null {
  const isOpen = useContext(SelectStateContext)?.isOpen ?? false;
  if (loadingState !== "loading" || isOpen) return null;
  return createElement(ProgressCircle, {
    isIndeterminate: true,
    size: "S",
    "aria-label": "Loading…",
  });
}

/**
 * S2 ComboBox (`showFieldSpinner`): the field's spinner before its button once a `loading` ·
 * `filtering` load has run 500ms — a new input text starts the wait again — and, filtering, only
 * while the list is open (or `menuTrigger: manual`).
 */
function ComboBoxSpinner({
  loadingState,
  manual,
}: {
  loadingState: string;
  manual: boolean;
}): ReactElement | null {
  const state = useContext(ComboBoxStateContext);
  const busy = loadingState === "loading" || loadingState === "filtering";
  const inputValue = state?.inputValue;
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!busy) {
      setShown(false);
      return undefined;
    }
    setShown(false);
    timer.current = setTimeout(() => setShown(true), COMBOBOX_SPINNER_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [busy, inputValue]);
  const visible =
    shown && (!!state?.isOpen || manual || loadingState === "loading");
  if (!visible) return null;
  // (The field's button lies over the input's end — the ComboBox sheet's negative margin — so the
  // spinner lies over it too, just before the button: S2's place. The Canvas loads nothing, so it
  // has no counterpart.)
  return createElement(
    "span",
    {
      style: {
        position: "absolute",
        insetInlineEnd: 30,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        pointerEvents: "none",
      },
    },
    createElement(ProgressCircle, {
      isIndeterminate: true,
      size: "S",
      "aria-label": "Loading…",
    }),
  );
}

/**
 * The field spinner a bound picker's part carries (`useAsyncList.loadingState` → S2
 * `loadingState`): a Select's trigger Button, a ComboBox's control Group. `undefined` for any
 * other part or an idle picker. The Canvas loads nothing, so it has no counterpart.
 */
export function catalogPickerSpinner(
  pickerType: string | undefined,
  pickerProps: Readonly<Record<string, unknown>> | undefined,
): ReactElement | undefined {
  const loadingState = pickerProps?.loadingState;
  if (typeof loadingState !== "string" || loadingState === "idle")
    return undefined;
  if (pickerType === "Select")
    return createElement(PickerSpinner, {
      key: "__picker-spinner",
      loadingState,
    });
  if (pickerType === "ComboBox")
    return createElement(ComboBoxSpinner, {
      key: "__picker-spinner",
      loadingState,
      manual: pickerProps?.menuTrigger === "manual",
    });
  return undefined;
}
