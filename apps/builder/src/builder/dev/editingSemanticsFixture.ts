import type { Element, Page } from "../../types/core/store.types";
import type { ElementsState } from "../stores/elements";
import {
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
} from "../../adapters/canonical/componentSemanticsMirror";

type SemanticFixtureElement = Element & {
  [COMPONENT_ROLE_MIRROR_FIELD]?: "master" | "instance";
  [COMPONENT_MASTER_ID_MIRROR_FIELD]?: string;
  reusable?: boolean;
};

const FIXTURE_PARAM = "editingSemanticsFixture";
const PAGE_ID = "adr-112-editing-semantics-page";
const BODY_ID = "adr-112-editing-semantics-body";
const ORIGIN_ID = "adr-112-origin";
const INSTANCE_ID = "adr-112-instance";
const SLOT_FRAME_ID = "adr-112-slot-frame";
const SLOT_INSTANCE_ID = "adr-112-slot-instance";
const SLOT_RECOMMENDATION_ID = "adr-112-slot-recommendation";

export function shouldApplyEditingSemanticsFixture(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(FIXTURE_PARAM);
}

function getInitialSelection(): string {
  if (typeof window === "undefined") return ORIGIN_ID;

  const value = new URLSearchParams(window.location.search).get(FIXTURE_PARAM);
  if (value === "slot") return SLOT_FRAME_ID;
  if (value === "slot-instance") return SLOT_INSTANCE_ID;
  return value === "instance" ? INSTANCE_ID : ORIGIN_ID;
}

export function applyEditingSemanticsFixture(store: ElementsState): void {
  const now = new Date().toISOString();
  const page: Page = {
    id: PAGE_ID,
    title: "ADR-112 Editing Semantics",
    project_id: "adr-112-fixture",
    slug: "adr-112-editing-semantics",
    created_at: now,
    updated_at: now,
  };

  const body: SemanticFixtureElement = {
    id: BODY_ID,
    type: "body",
    page_id: PAGE_ID,
    parent_id: null,
    props: {
      style: {
        alignItems: "flex-start",
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: "32px",
        minHeight: "100%",
        padding: "56px",
        width: "100%",
      },
    },
    created_at: now,
    updated_at: now,
  };

  const origin: SemanticFixtureElement = {
    id: ORIGIN_ID,
    type: "Button",
    reusable: true,
    page_id: PAGE_ID,
    parent_id: BODY_ID,
    props: {
      children: "Origin marker",
      style: {
        height: "44px",
        width: "180px",
      },
      variant: "primary",
    },
    created_at: now,
    updated_at: now,
  };

  const instanceA: SemanticFixtureElement = {
    id: INSTANCE_ID,
    type: "Button",
    [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: ORIGIN_ID,
    page_id: PAGE_ID,
    parent_id: BODY_ID,
    props: {
      children: "Instance marker",
      style: {
        height: "44px",
        width: "180px",
      },
      variant: "secondary",
    },
    created_at: now,
    updated_at: now,
  };

  const instanceB: SemanticFixtureElement = {
    ...instanceA,
    id: "adr-112-instance-b",
    props: {
      ...instanceA.props,
      children: "Instance marker B",
    },
  };

  const slotRecommendation: SemanticFixtureElement = {
    id: SLOT_RECOMMENDATION_ID,
    type: "NumberField",
    componentName: "RecommendedNumberField",
    reusable: true,
    page_id: PAGE_ID,
    parent_id: BODY_ID,
    props: {
      label: "Recommended number",
      style: {
        height: "72px",
        width: "220px",
      },
    },
    created_at: now,
    updated_at: now,
  };

  const slotFrame: SemanticFixtureElement = {
    id: SLOT_FRAME_ID,
    type: "frame",
    componentName: "ArticleFrame",
    reusable: true,
    page_id: PAGE_ID,
    parent_id: BODY_ID,
    slot: [SLOT_RECOMMENDATION_ID],
    metadata: {
      slot: [SLOT_RECOMMENDATION_ID],
    },
    props: {
      style: {
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        height: "160px",
        padding: "16px",
        width: "280px",
      },
    },
    created_at: now,
    updated_at: now,
  } as SemanticFixtureElement;

  const slotInstance: SemanticFixtureElement = {
    id: SLOT_INSTANCE_ID,
    type: "ref",
    ref: SLOT_FRAME_ID,
    page_id: PAGE_ID,
    parent_id: BODY_ID,
    props: {
      style: {
        height: "160px",
        width: "280px",
      },
    },
    created_at: now,
    updated_at: now,
  } as SemanticFixtureElement;

  store.setPages([page]);
  // dev-only evidence fixture: keep raw top-level markers such as slot/ref/reusable.
  store.setElements([
    body,
    origin,
    instanceA,
    instanceB,
    slotRecommendation,
    slotFrame,
    slotInstance,
  ]);
  store.setCurrentPageId(PAGE_ID);
  store.selectElementWithPageTransition(getInitialSelection(), PAGE_ID);

  if (import.meta.env.DEV) {
    console.info(
      "[ADR-112] editing semantics fixture loaded. Use ?editingSemanticsFixture=origin, =instance, =slot, or =slot-instance.",
    );
  }
}
