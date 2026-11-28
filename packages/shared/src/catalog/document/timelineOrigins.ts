// ADR-323 Phase 2 — the Timeline origins (breakdown §5.3): the TimelineItem origin
// (`component-timelineitem` — its title · date · description Texts are bound to the item's `label` ·
// `date` · `description`; the date and the description are there only while they have text) and the
// palette's Timeline (three items: completed, in progress, upcoming — every status it draws,
// 사용자 결정 1).
import type { LibraryDefinition, LibraryTemplateNode } from "./types";

export const TIMELINE_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    id: "lib:definition:origin-component-timelineitem",
    name: "TimelineItem",
    mode: "composite",
    accepts: { label: "string", date: "string", description: "string" },
    defaults: { label: "Event", date: "", description: "" },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-timelineitem",
  },
  {
    id: "lib:definition:origin-component-timeline",
    name: "Timeline",
    mode: "composite",
    accepts: {},
    defaults: {},
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-timeline",
  },
];

/** The palette sample's items by language (the origins' `localizedProps` — the site's language). */
const SAMPLE = [
  {
    status: "completed",
    date: "2026-11-24",
    en: "Order placed",
    ko: "주문 접수",
  },
  { status: "current", date: "2026-11-26", en: "Shipped", ko: "출고" },
  { status: "upcoming", date: "", en: "Delivered", ko: "배송 완료" },
] as const;

export const TIMELINE_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: "lib:template:component-timelineitem",
    definitionId: "lib:definition:type-TimelineItem",
    children: [
      "lib:template:component-timelineitem__title",
      "lib:template:component-timelineitem__date",
      "lib:template:component-timelineitem__description",
    ],
    props: {},
    visual: {},
  },
  {
    id: "lib:template:component-timelineitem__title",
    definitionId: "lib:definition:text",
    children: [],
    props: { children: "{label}" },
    visual: {},
  },
  {
    id: "lib:template:component-timelineitem__date",
    definitionId: "lib:definition:text",
    children: [],
    props: { slot: "date", children: "{date}" },
    presentWhen: "nonEmptyText",
    visual: {},
  },
  {
    id: "lib:template:component-timelineitem__description",
    definitionId: "lib:definition:text",
    children: [],
    props: { slot: "description", children: "{description}" },
    presentWhen: "nonEmptyText",
    visual: {},
  },
  {
    id: "lib:template:component-timeline",
    definitionId: "lib:definition:type-Timeline",
    slot: { name: "Items", required: false },
    children: SAMPLE.map(
      (_, n) => `lib:template:component-timeline__item-${n + 1}` as const,
    ),
    props: { orientation: "vertical", position: "end", size: "M" },
    visual: {},
  },
  ...SAMPLE.map((item, n): LibraryTemplateNode => ({
    id: `lib:template:component-timeline__item-${n + 1}`,
    definitionId: "lib:definition:origin-component-timelineitem",
    children: [],
    props: {
      id: `item-${n + 1}`,
      label: item.en,
      status: item.status,
      ...(item.date ? { date: item.date } : {}),
    },
    localizedProps: { label: { ko: item.ko } },
    visual: {},
  })),
];
