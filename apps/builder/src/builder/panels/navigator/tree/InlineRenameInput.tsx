import { useRef } from "react";

/**
 * A tree row's inline name field (Pages · Layouts): Enter or blur commits the typed name, Escape
 * cancels (`onDone(undefined)`). Pointer and key events stay in the field — the row (RAC tree item)
 * would otherwise take them as a press or a navigation key.
 */
export function InlineRenameInput({
  label,
  defaultValue,
  onDone,
}: {
  label: string;
  defaultValue: string;
  onDone: (name: string | undefined) => void;
}) {
  const cancelRef = useRef(false);
  return (
    <input
      className="page-title-rename-input"
      aria-label={label}
      defaultValue={defaultValue}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={(event) =>
        onDone(cancelRef.current ? undefined : event.currentTarget.value)
      }
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelRef.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}
