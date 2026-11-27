// ADR-321 Phase 1 — the StepList origins (breakdown §5.1): the Step origin (`component-step` — its
// label · description Texts are bound to the Step's `label` · `description`; the description is there
// only while it has text, 사용자 결정 4) and the palette's StepList (three steps: one completed, the
// current one, one remaining — every state the list draws).
import type { LibraryDefinition, LibraryTemplateNode } from "./types";

export const STEP_LIST_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    id: "lib:definition:origin-component-step",
    name: "Step",
    mode: "composite",
    accepts: { label: "string", description: "string" },
    defaults: { label: "Step", description: "" },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-step",
  },
  {
    id: "lib:definition:origin-component-steplist",
    name: "StepList",
    mode: "composite",
    accepts: {},
    defaults: {},
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-steplist",
  },
];

const step = (n: number, label: string): LibraryTemplateNode => ({
  id: `lib:template:component-steplist__step-${n}`,
  definitionId: "lib:definition:origin-component-step",
  children: [],
  props: { id: `step-${n}`, label },
  visual: {},
});

export const STEP_LIST_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: "lib:template:component-step",
    definitionId: "lib:definition:type-Step",
    children: [
      "lib:template:component-step__label",
      "lib:template:component-step__description",
    ],
    props: {},
    visual: {},
  },
  {
    id: "lib:template:component-step__label",
    definitionId: "lib:definition:text",
    children: [],
    props: { children: "{label}" },
    visual: {},
  },
  {
    id: "lib:template:component-step__description",
    definitionId: "lib:definition:text",
    children: [],
    props: { slot: "description", children: "{description}" },
    presentWhen: "nonEmptyText",
    visual: {},
  },
  {
    id: "lib:template:component-steplist",
    definitionId: "lib:definition:type-StepList",
    slot: { name: "Steps", required: false },
    children: [
      "lib:template:component-steplist__step-1",
      "lib:template:component-steplist__step-2",
      "lib:template:component-steplist__step-3",
    ],
    props: {
      orientation: "horizontal",
      size: "M",
      defaultSelectedKey: "step-2",
      defaultLastCompletedStep: "step-1",
    },
    visual: {},
  },
  step(1, "Step 1"),
  step(2, "Step 2"),
  step(3, "Step 3"),
];
