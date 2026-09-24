/**
 * ADR-240 Phase 1 — 이름 영역 slot seed · Dialog 영역 구조 이관 · instance 경로 전치 (breakdown §4 Phase 1).
 *
 * - **영역 seed** (없을 때만 — 사용자가 편집했거나 끈 `false` slot 은 그대로, 237 `ensureGroupSlots` 와 같은 조건):
 *   Card origin 의 영역 자식 4 (`metadata.slotRole` preview · header · content · footer) · Popover · Tooltip root.
 * - **Dialog 영역 구조** (1회 · 멱등): origin 본문 (DialogTrigger 안 Dialog) 의 Description 을 새 `frame` "Content"
 *   (slotRole content) 안으로 옮기고, DialogFooter 안 Close 앞에 새 `frame` "Actions" (slotRole action) 를 넣는다.
 *   Close 는 제자리 (고정 부품 — 경로 불변). repair (`repairCatalogOrigin`) 는 기존 children 을 보존하므로 (F17)
 *   구조는 여기서 옮긴다. 새 문서와 기존 문서가 같은 함수를 지난다.
 * - **경로 전치**: 구조를 옮긴 pass 에서만 문서 전체의 Dialog instance `descendants` 키 중 Description 경로
 *   (`<본문>/<Description>` 과 그 하위) 에 `Content/` 를 끼운다 (F7 `migrateDialogTriggerInstances` 선례). 같은
 *   전치를 저장 history 스냅샷에도 적용한다 (`rewriteDialogRegionPathsInNode` — 복원 시점).
 *
 * 바뀐 것이 없으면 같은 문서 객체.
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { catalogReusableOriginId } from "@composition/shared";

import { CARD_ORIGIN_ID } from "./card/cardTemplateOrigins";
import { COMPONENTS_SYSTEM_BODY_ID } from "../pages/systemComponentsPage";
import {
  DIALOG_ACTIONS_REGION_ID,
  DIALOG_ACTIONS_REGION_NAME,
  DIALOG_CONTENT_REGION_ID,
  DIALOG_CONTENT_REGION_NAME,
  DIALOG_ORIGIN_ID,
  buildDialogRegionPathRewrite,
  rewriteDialogRegionPathsInNode,
  type DialogRegionPathRewrite,
} from "./dialogRegionPaths";

/** 영역 → 추천 reusable (seed 일 뿐 — origin 에서 편집 · 끌 수 있다). 빈 목록 = 후보 전체 (F3). */
export const REGION_SLOT_SEEDS = {
  card: {
    // Image reusable origin 없음 (G0) — 자유 내용 (primitive) 은 Phase 2.
    preview: [],
    header: ["component-badge", "component-iconbutton"],
    content: ["component-button", "component-link", "component-taggroup"],
    footer: ["component-button", "component-link"],
  },
  // 선택 가능한 가족은 휴지 모양 먼저 (234 변형 이관이 추천 목록에 `--unselected` 를 끼우는 규칙 · 그룹 slot 과 같은 순서).
  dialogContent: [
    "component-button",
    "component-textfield",
    "component-checkbox--unselected",
    "component-checkbox",
  ],
  dialogActions: ["component-button"],
  popover: ["component-button", "component-link"],
  tooltip: [],
} as const satisfies Record<string, unknown>;

type SlotNode = CanonicalNode & { slot?: false | string[] };

function withSlotIfMissing(
  node: CanonicalNode,
  seed: readonly string[],
): CanonicalNode {
  if ((node as SlotNode).slot !== undefined) return node;
  return { ...node, slot: [...seed] } as CanonicalNode;
}

// ── origin 영역 seed · Dialog 구조 ────────────────────────────────────────────

function seedCardRegions(card: CanonicalNode): CanonicalNode {
  const seeds = REGION_SLOT_SEEDS.card as Record<string, readonly string[]>;
  let changed = false;
  const children = (card.children ?? []).map((child) => {
    const role = child.metadata?.slotRole;
    const seed = typeof role === "string" ? seeds[role] : undefined;
    if (!seed) return child;
    const next = withSlotIfMissing(child, seed);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...card, children } : card;
}

function regionFrame(
  id: string,
  name: string,
  slotRole: string,
  seed: readonly string[],
  style: Record<string, unknown>,
  children: CanonicalNode[],
): CanonicalNode {
  return {
    id,
    type: "frame",
    name,
    props: { style },
    slot: [...seed],
    metadata: { type: "dialog-origin-region", slotRole },
    children,
  } as CanonicalNode;
}

/** Dialog 본문 (DialogTrigger 안 Dialog) 에 Content · Actions 영역이 없으면 만든다. */
function migrateDialogBody(body: CanonicalNode): CanonicalNode {
  const children = body.children ?? [];
  let next = children;
  if (!children.some((child) => child.metadata?.slotRole === "content")) {
    const moved = children.filter((child) => child.type === "Description");
    const rest = children.filter((child) => child.type !== "Description");
    const firstDescription = children.findIndex(
      (child) => child.type === "Description",
    );
    // Description 이 있던 자리 (없으면 제목 뒤) — flex column 에서 frame 이 같은 자리를 차지한다.
    const insertAt =
      firstDescription >= 0
        ? firstDescription
        : Math.min(
            rest.findIndex((child) => child.type === "Heading") + 1 || 0,
            rest.length,
          );
    const content = regionFrame(
      DIALOG_CONTENT_REGION_ID,
      DIALOG_CONTENT_REGION_NAME,
      "content",
      REGION_SLOT_SEEDS.dialogContent,
      // frame 기본과 같은 투명 컨테이너 (padding 0 · gap 0) — Description 자리 · 크기 불변.
      { display: "flex", flexDirection: "column", rowGap: 0, columnGap: 0 },
      moved,
    );
    next = [...rest.slice(0, insertAt), content, ...rest.slice(insertAt)];
  }
  const withActions = next.map((child) => {
    if ((child.type as string) !== "DialogFooter") return child;
    const footerChildren = child.children ?? [];
    if (footerChildren.some((c) => c.metadata?.slotRole === "action")) {
      return child;
    }
    const closeIndex = footerChildren.findIndex(
      (c) => (c.props as { slot?: unknown } | undefined)?.slot === "close",
    );
    const at = closeIndex >= 0 ? closeIndex : footerChildren.length;
    const actions = regionFrame(
      DIALOG_ACTIONS_REGION_ID,
      DIALOG_ACTIONS_REGION_NAME,
      "action",
      REGION_SLOT_SEEDS.dialogActions,
      // 채운 버튼은 DialogFooter 와 같은 가로 흐름 · 간격 8. 비면 0 폭 — flex-end 인 Close 위치 불변 (G0).
      {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        rowGap: 0,
        columnGap: "8px",
      },
      [],
    );
    return {
      ...child,
      children: [
        ...footerChildren.slice(0, at),
        actions,
        ...footerChildren.slice(at),
      ],
    };
  });
  if (withActions.some((child, index) => child !== next[index])) {
    next = withActions;
  }
  return next === children ? body : { ...body, children: next };
}

function migrateDialogOrigin(origin: CanonicalNode): CanonicalNode {
  if (origin.type !== "DialogTrigger") return origin;
  let changed = false;
  const children = (origin.children ?? []).map((child) => {
    if (child.type !== "Dialog") return child;
    const next = migrateDialogBody(child);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...origin, children } : origin;
}

// ── 진입점 ────────────────────────────────────────────────────────────────────

const POPOVER_ORIGIN_ID = catalogReusableOriginId("Popover");
const TOOLTIP_ORIGIN_ID = catalogReusableOriginId("Tooltip");

export function ensureRegionSlots(
  document: CompositionDocument,
): CompositionDocument {
  let changed = false;
  let dialogRewrite: DialogRegionPathRewrite | null = null;
  const patchOrigin = (node: CanonicalNode): CanonicalNode => {
    if (node.reusable !== true) return node;
    let next = node;
    if (node.id === CARD_ORIGIN_ID) next = seedCardRegions(node);
    else if (node.id === POPOVER_ORIGIN_ID && node.type === "Popover") {
      next = withSlotIfMissing(node, REGION_SLOT_SEEDS.popover);
    } else if (node.id === TOOLTIP_ORIGIN_ID && node.type === "Tooltip") {
      next = withSlotIfMissing(node, REGION_SLOT_SEEDS.tooltip);
    } else if (node.id === DIALOG_ORIGIN_ID) {
      next = migrateDialogOrigin(node);
      if (next !== node) dialogRewrite = buildDialogRegionPathRewrite(next);
    }
    if (next !== node) changed = true;
    return next;
  };
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      if (node.id === COMPONENTS_SYSTEM_BODY_ID) {
        const children = (node.children ?? []).map(patchOrigin);
        return children.every((child, index) => child === node.children![index])
          ? node
          : { ...node, children };
      }
      if (!node.children) return node;
      const children = visit(node.children);
      return children.every((child, index) => child === node.children![index])
        ? node
        : { ...node, children };
    });
  let children = visit(document.children);
  if (!changed) return document;
  if (dialogRewrite) {
    const rewrite: DialogRegionPathRewrite = dialogRewrite;
    children = children.map((node) =>
      rewriteDialogRegionPathsInNode(node, rewrite),
    );
  }
  return { ...document, children };
}
