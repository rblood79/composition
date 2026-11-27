/**
 * ADR-321 — a StepList's DOM (breakdown §4 — the assembly, D1 exception 0): RAC `Group` (the list's
 * name — user answer 2026-11-27) `> ol > li > RAC Link`. The role · name · `aria-current` ·
 * `aria-disabled` · focus · press are RAC's (`Group` · `Link` props); the `ol` · `li` are structure
 * elements, the state word is text only a screen reader meets (react-aria `VisuallyHidden`). No
 * role, no aria attribute and no key handler is written here (HC2 — `adr321D1Assembly.static.test.ts`).
 *
 * The Group is the record's box; the `ol` fills it and takes its flex values, and each step's Link
 * does the same in its `li` (`rule/stepList.ts` — `.step-list-items` · `.step-link`), so the steps
 * and their Texts sit as the records' direct flex items do on the Canvas.
 *
 * State: the list's two keys in a running Preview are its record's runtime values (the renderer
 * reads `catalogRuntimeStateOf`); the rule `stepListState.ts` gives each step its state, and a press
 * of a step it can go to writes the pair the rule gives and tells the list's rules (When 「단계 변경」
 * · 「완료 단계 변경」 — the user's change only, as RAC's change callbacks).
 */
import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from "react";
import { VisuallyHidden } from "react-aria/VisuallyHidden";
import { Group } from "react-aria-components/Group";
import { Link } from "react-aria-components/Link";
import { useCatalogLocalized } from "./localizedStrings";
import { catalogStepChromeDom } from "./stepList";
import {
  catalogStepListPress,
  catalogStepListStates,
  type StepListPatch,
  type StepListStateInput,
  type StepListStepState,
} from "./stepListState";

const LABELS: Readonly<Record<string, string>> = {
  en: "Steps",
  ko: "단계 목록",
};

/** The state a screen reader reads after a step's label (the visual says it with a number · check). */
const STATE_TEXT: Readonly<Record<string, Record<string, string>>> = {
  en: {
    current: "Current",
    completed: "Completed",
    incomplete: "Not completed",
  },
  ko: { current: "현재", completed: "완료", incomplete: "남음" },
};

interface StepListContextValue {
  steps: ReadonlyMap<string, StepListStepState>;
  isEmphasized: boolean;
  press: (key: string) => void;
}
const StepListContext = createContext<StepListContextValue | null>(null);

export function CatalogStepListGroup(props: {
  /** The record's marker · class · `data-*` (the Group element's). */
  rootProps: Record<string, unknown>;
  style?: CSSProperties;
  /** The author's name for the list (else the language's default). */
  label?: string;
  /** The state rule's input — the list's keys and its two state keys as they stand now. */
  list: StepListStateInput;
  isEmphasized: boolean;
  /** A running Preview's write of the record's runtime state (absent = a static render). */
  write?: (patch: StepListPatch) => void;
  /** The list's rules (When) — the runtime gives them to this element. */
  onSelectionChange?: (key: string) => void;
  onLastCompletedStepChange?: (key: string | null) => void;
  children?: ReactNode;
}) {
  const fallback = useCatalogLocalized(LABELS);
  const { list, write, onSelectionChange, onLastCompletedStepChange } = props;
  const value: StepListContextValue = {
    steps: new Map(
      catalogStepListStates(list).steps.map((step) => [step.key, step]),
    ),
    isEmphasized: props.isEmphasized,
    press: (key) => {
      const outcome = catalogStepListPress(list, key);
      if (!write || !outcome.ok) return;
      const { patch } = outcome;
      if (!Object.keys(patch).length) return;
      write(patch);
      // (v3's order — `setSelectedKey` completes the passed steps, then selects.)
      if ("lastCompletedStep" in patch)
        onLastCompletedStepChange?.(patch.lastCompletedStep ?? null);
      if (patch.selectedKey !== undefined)
        onSelectionChange?.(patch.selectedKey);
    },
  };
  return (
    <Group
      {...props.rootProps}
      aria-label={props.label || fallback}
      style={props.style}
    >
      <ol className="step-list-items">
        <StepListContext.Provider value={value}>
          {props.children}
        </StepListContext.Provider>
      </ol>
    </Group>
  );
}

export function CatalogStep(props: {
  /** The step's key in its list (`id`). */
  itemKey: string;
  /** The record's marker · class (the `li`'s). */
  rootProps: Record<string, unknown>;
  style?: CSSProperties;
  /** The record's derived values — its place in the list (`catalogStepDerived`). */
  derived: Readonly<Record<string, unknown>> | undefined;
  /** The completed step's check glyph (the renderer's — sized for the step). */
  check: ReactNode;
  children?: ReactNode;
}) {
  const list = useContext(StepListContext);
  const stateText = useCatalogLocalized(STATE_TEXT);
  const step = list?.steps.get(props.itemKey);
  // The state is the list's as it stands now (a press moves it); the place is the record's.
  const drawn =
    list && step
      ? catalogStepChromeDom({
          ...props.derived,
          _stepState: step.state,
          _stepDisabled: step.disabled,
          _stepEmphasized: list.isEmphasized,
        })
      : undefined;
  // (Outside a StepList — the Step origin's own card — nothing is drawn: a box of its Texts.)
  if (!list || !step || !drawn)
    return (
      <li {...props.rootProps} style={props.style}>
        {props.children}
      </li>
    );
  return (
    <li
      {...props.rootProps}
      data-step-state={step.state}
      style={
        {
          // (The Texts take these — `domBinding.runtime.ts`: a resting color inline would stay
          //  when a press moves the current step.)
          color: drawn.label,
          "--step-description-color": drawn.description,
          ...props.style,
        } as CSSProperties
      }
    >
      <Link
        className="step-link"
        aria-current={step.state === "current" ? "step" : undefined}
        isDisabled={!step.selectable}
        onPress={() => list.press(props.itemKey)}
      >
        {props.children}
        <VisuallyHidden>{stateText[step.state]}</VisuallyHidden>
        <span className="step-visual" style={drawn.visual}>
          {drawn.glyph === "check" ? (
            props.check
          ) : drawn.glyph === "number" ? (
            <span className="step-glyph" style={{ fontSize: drawn.glyphSize }}>
              {drawn.number}
            </span>
          ) : null}
        </span>
      </Link>
      {drawn.track ? <span className="step-track" style={drawn.track} /> : null}
    </li>
  );
}
