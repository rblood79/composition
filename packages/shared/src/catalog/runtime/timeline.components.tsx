/**
 * ADR-323 Phase 2 — a TimelineItem's status as text a screen reader meets (판독 F7): the marker and
 * the line say it with color only (`data-status` is not read). react-aria `VisuallyHidden` — no
 * role, no aria attribute (StepList's state word, `stepList.components.tsx`). It is not a record:
 * the Canvas draws nothing for it, and the DOM box it takes is none.
 */
import { VisuallyHidden } from "react-aria/VisuallyHidden";
import { useCatalogLocalized } from "./localizedStrings";

/** The status word after the item's texts (the binding's option labels, by language). */
const STATUS_TEXT: Readonly<Record<string, Record<string, string>>> = {
  en: {
    completed: "Completed",
    current: "In progress",
    upcoming: "Upcoming",
  },
  ko: { completed: "완료", current: "진행 중", upcoming: "예정" },
};

export function CatalogTimelineStatus(props: { status: string }) {
  const text = useCatalogLocalized(STATUS_TEXT);
  const word = text[props.status];
  return word ? <VisuallyHidden>{word}</VisuallyHidden> : null;
}
