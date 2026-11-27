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
  // ADR-321 Phase 3 (사용자 결정 2 · 자리 「감싸는 새 type」, 2026-11-27): the StepList and one panel per
  // step (paired by key — `itemId` ↔ the Step's `id`); only the current step's panel is drawn.
  {
    id: "lib:definition:origin-component-stepper",
    name: "Stepper",
    mode: "composite",
    accepts: {},
    defaults: {},
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-stepper",
  },
];

/**
 * A step's sample texts by language (the origins' `localizedProps` — the resolver shows the site's
 * language; the Builder's 「+」 names a new step with the same word).
 */
export const STEP_TEXT: Readonly<
  Record<
    string,
    { readonly step: (n: number) => string; readonly content: (n: number) => string }
  >
> = {
  en: { step: (n) => `Step ${n}`, content: (n) => `Step ${n} content` },
  ko: { step: (n) => `단계 ${n}`, content: (n) => `단계 ${n} 내용` },
};

/** A sample text in every language but English (the template's `props` holds the English). */
const localized = (
  word: "step" | "content",
  n: number,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(STEP_TEXT)
      .filter(([language]) => language !== "en")
      .map(([language, words]) => [language, words[word](n)]),
  );

const step = (
  n: number,
  stem: `lib:template:${string}` = "lib:template:component-steplist",
): LibraryTemplateNode => ({
  id: `${stem}__step-${n}`,
  definitionId: "lib:definition:origin-component-step",
  children: [],
  props: { id: `step-${n}`, label: STEP_TEXT.en!.step(n) },
  localizedProps: { label: localized("step", n) },
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
  step(1),
  step(2),
  step(3),
  // (The placed Stepper owns its StepList · Steps · StepPanels through its root slot — Tabs' way.)
  {
    id: "lib:template:component-stepper",
    definitionId: "lib:definition:type-Stepper",
    slot: { name: "Stepper", required: false },
    children: [
      "lib:template:component-stepper__list",
      ...[1, 2, 3].map(
        (n) => `lib:template:component-stepper__panel-${n}` as const,
      ),
    ],
    props: {},
    visual: { width: "100%" },
  },
  {
    id: "lib:template:component-stepper__list",
    definitionId: "lib:definition:type-StepList",
    children: [1, 2, 3].map(
      (n) => `lib:template:component-stepper__list__step-${n}` as const,
    ),
    props: {
      orientation: "horizontal",
      size: "M",
      defaultSelectedKey: "step-1",
    },
    visual: {},
  },
  ...[1, 2, 3].map((n) => step(n, "lib:template:component-stepper__list")),
  ...[1, 2, 3].flatMap((n): LibraryTemplateNode[] => [
    {
      id: `lib:template:component-stepper__panel-${n}`,
      definitionId: "lib:definition:type-StepPanel",
      children: [
        `lib:template:component-stepper__panel-${n}__content` as const,
      ],
      props: { itemId: `step-${n}` },
      visual: {},
    },
    {
      id: `lib:template:component-stepper__panel-${n}__content`,
      definitionId: "lib:definition:text",
      children: [],
      props: { children: STEP_TEXT.en!.content(n) },
      localizedProps: { children: localized("content", n) },
      visual: {},
    },
  ]),
];
