import { useState } from "react";
import type { PressEvent } from "react-aria";
import { useGlobalListeners } from "react-aria/private/utils/useGlobalListeners";

/** S2: overlay underlay의 pressEnd가 아닌 실제 pointerup에서 press scale을 해제한다. */
export function useOverlayTriggerPress() {
  const [isPressed, setPressed] = useState(false);
  const { addGlobalListener, removeAllGlobalListeners } = useGlobalListeners();
  const onPressStart = (event: PressEvent) => {
    if (event.pointerType !== "mouse") return;
    removeAllGlobalListeners();
    setPressed(true);
    const release = () => {
      setPressed(false);
      removeAllGlobalListeners();
    };
    const doc = event.target.ownerDocument;
    addGlobalListener(doc, "pointerup", () => release(), { capture: true });
    addGlobalListener(doc, "pointercancel", () => release(), { capture: true });
    if (doc.defaultView)
      addGlobalListener(doc.defaultView, "blur", () => release());
  };
  return { isPressed, onPressStart };
}
