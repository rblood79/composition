/**
 * usePresetApply - 프리셋 적용 훅
 *
 * Phase 6: Layout 프리셋 적용 핵심 로직
 *
 * 핵심 기능:
 * 1. 기존 Slot 감지
 * 2. 모드별 처리 (replace/merge/cancel)
 * 3. Slot 일괄 생성 (addComplexElement 패턴)
 * 4. History 단일 엔트리 기록
 */

import { useCallback, useMemo, useState } from "react";
import { useStore } from "../../../../stores";
import {
  useCanonicalFrameElementScopes,
  visitCanonicalDocumentElements,
} from "../../../../stores/canonical/canonicalElementsView";
import {
  useCanonicalPropertyChildrenMap,
  useCanonicalPropertyElement,
  useCanonicalPropertyElements,
  useCanonicalPropertyElementsMap,
} from "../../hooks/useCanonicalPropertyRead";
import { getActiveCanonicalDocument } from "../../../../stores/canonical/canonicalElementsBridge";
import { useCanonicalDocumentStore } from "../../../../stores/canonical/canonicalDocumentStore";
import { LAYOUT_PRESETS } from "./presetDefinitions";
import { normalizeFramePresetContainerStyle } from "./presetStyle";
import type {
  PresetApplyMode,
  ExistingSlotInfo,
  SlotDefinition,
} from "./types";
import { isLegacyFrameElementForFrame } from "../../../../../adapters/canonical/frameElementLoader";
import type { CanonicalFrameElementScope } from "../../../../../adapters/canonical/frameElementScope";
import { withFrameElementMirrorId } from "../../../../../adapters/canonical/frameMirror";
import { getSlotMirrorName } from "../../../../../adapters/canonical/slotMirror";
import { setElementsCanonicalPrimary } from "@/adapters/canonical/canonicalMutations";
import { getDB } from "../../../../../lib/db";

export { normalizeFramePresetContainerStyle } from "./presetStyle";

interface PresetElementNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  layout_id?: string | null;
  deleted?: boolean;
}

interface PresetSlotElement extends PresetElementNode {
  type: "Slot";
  parent_id: string;
  page_id: null;
}

function getElementSlotName(element: PresetElementNode): string | null {
  const slotName = getSlotMirrorName(element);
  return slotName && slotName.length > 0 ? slotName : null;
}

function readSlotElementName(element: PresetElementNode): string {
  const propsName = (element.props as { name?: unknown } | undefined)?.name;
  if (typeof propsName === "string" && propsName.length > 0) {
    return propsName;
  }
  return getElementSlotName(element) ?? "unnamed";
}

function readAssignedSlotName(element: PresetElementNode): string | null {
  return getElementSlotName(element) ?? getSlotMirrorName(element.props);
}

function buildElementMap(
  elementsById: ReadonlyMap<string, PresetElementNode>,
  canonicalElements: PresetElementNode[] | null,
): Map<string, PresetElementNode> {
  const combined = new Map<string, PresetElementNode>(elementsById);
  for (const element of canonicalElements ?? []) {
    combined.set(element.id, element);
  }
  return combined;
}

function collectPresetSourceElements(
  doc: Parameters<typeof visitCanonicalDocumentElements>[0],
): PresetElementNode[] {
  const elements: PresetElementNode[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  return elements;
}

function hasSlotChildren(
  slotElement: PresetElementNode,
  slotName: string,
  childrenByParent: ReadonlyMap<string, PresetElementNode[]>,
  combinedElements: ReadonlyMap<string, PresetElementNode>,
): boolean {
  if ((childrenByParent.get(slotElement.id) ?? []).length > 0) return true;

  for (const element of combinedElements.values()) {
    if (element.id === slotElement.id) continue;
    if (element.parent_id === slotElement.id) return true;
    if (element.type !== "Slot" && readAssignedSlotName(element) === slotName) {
      return true;
    }
  }

  return false;
}

export function collectExistingFrameSlots({
  layoutId,
  elementsById,
  childrenByParent,
  canonicalElements,
  frameScope,
}: {
  layoutId: string;
  elementsById: ReadonlyMap<string, PresetElementNode>;
  childrenByParent: ReadonlyMap<string, PresetElementNode[]>;
  canonicalElements: PresetElementNode[] | null;
  frameScope: CanonicalFrameElementScope | null;
}): ExistingSlotInfo[] {
  const slotsById = new Map<string, PresetElementNode>();

  elementsById.forEach((element) => {
    if (
      element.type === "Slot" &&
      isLegacyFrameElementForFrame(element, layoutId)
    ) {
      slotsById.set(element.id, element);
    }
  });

  if (canonicalElements && frameScope) {
    for (const element of canonicalElements) {
      if (element.type === "Slot" && frameScope.elementIds.has(element.id)) {
        slotsById.set(element.id, element);
      }
    }
  }

  const combinedElements = buildElementMap(elementsById, canonicalElements);

  return Array.from(slotsById.values()).map((element) => {
    const slotName = readSlotElementName(element);
    return {
      slotName,
      elementId: element.id,
      hasChildren: hasSlotChildren(
        element,
        slotName,
        childrenByParent,
        combinedElements,
      ),
    };
  });
}

export function filterElementsForPresetSlotReplace(
  elements: PresetElementNode[],
  slotIds: ReadonlySet<string>,
): PresetElementNode[] {
  if (slotIds.size === 0) return elements;
  return elements.filter((element) => !slotIds.has(element.id));
}

async function persistActiveCanonicalDocument(
  db: Awaited<ReturnType<typeof getDB>>,
): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return;
  const doc = canonical.documents.get(projectId);
  if (!doc) return;

  await db.documents.put(projectId, doc);
}

async function removeCanonicalPresetSlots(slotIds: string[]): Promise<void> {
  if (slotIds.length === 0) return;

  const doc = getActiveCanonicalDocument();
  if (!doc) return;

  const slotIdSet = new Set(slotIds);
  const sourceElements = collectPresetSourceElements(doc);
  const filteredElements = filterElementsForPresetSlotReplace(
    sourceElements,
    slotIdSet,
  );

  if (filteredElements.length === sourceElements.length) return;

  setElementsCanonicalPrimary(filteredElements);

  try {
    const db = await getDB();
    await persistActiveCanonicalDocument(db);
  } catch (error) {
    console.warn(
      "⚠️ [IndexedDB] preset slot 교체 반영 중 오류 (메모리는 정상):",
      error,
    );
  }
}

interface UsePresetApplyOptions {
  /** Layout ID */
  layoutId: string;
  /** Body node ID */
  bodyElementId: string;
}

interface UsePresetApplyReturn {
  /** 현재 Layout의 기존 Slot 목록 */
  existingSlots: ExistingSlotInfo[];
  /** 현재 적용된 프리셋 키 (감지된 경우) */
  currentPresetKey: string | null;
  /** 프리셋 적용 함수 */
  applyPreset: (presetKey: string, mode: PresetApplyMode) => Promise<void>;
  /** 적용 중 여부 */
  isApplying: boolean;
}

/**
 * 프리셋 적용 훅
 */
export function usePresetApply({
  layoutId,
  bodyElementId,
}: UsePresetApplyOptions): UsePresetApplyReturn {
  const [isApplying, setIsApplying] = useState(false);
  const canonicalElements = useCanonicalPropertyElements();
  const frameElementScopes = useCanonicalFrameElementScopes();
  const elementsById = useCanonicalPropertyElementsMap();
  const childrenByParent = useCanonicalPropertyChildrenMap();
  const bodyElement = useCanonicalPropertyElement(bodyElementId);

  // Store actions
  const addComplexElement = useStore((state) => state.addComplexElement);
  const removeElements = useStore((state) => state.removeElements);
  const updateElementProps = useStore((state) => state.updateElementProps);

  // 현재 Layout의 기존 Slot 목록.
  //
  // ADR-111 P2 fix: 이전 구현은 `belongsToLegacyLayout(el, layoutId, canonicalDoc)`
  // 로 canonical document 기반 매칭. 그러나 `convertLayoutToReusableFrame` 가
  // slot element 를 `convertElementWithSlotHoisting` 으로 hoist 하여 canonical
  // frame.children 에 slot 이 사라짐 → `isCanonicalDescendantOf(slot, frame)`
  // 항상 false → existingSlots 0개 → currentPresetKey null → 우측 LayoutPresetSelector
  // 의 "적용됨" 표시 stale.
  //
  // Direct cutover 이후 FramesTab 은 canonical frame scope 를 우선 읽는다.
  // 따라서 preset 교체도 legacy mirror 와 canonical scope 를 함께 보지 않으면
  // 기존 Slot 을 못 보고 새 Slot 을 누적한다.
  const existingSlots = useMemo((): ExistingSlotInfo[] => {
    return collectExistingFrameSlots({
      layoutId,
      elementsById,
      childrenByParent,
      canonicalElements,
      frameScope: frameElementScopes?.get(layoutId) ?? null,
    });
  }, [
    elementsById,
    childrenByParent,
    canonicalElements,
    frameElementScopes,
    layoutId,
  ]);

  // ⭐ 현재 적용된 프리셋 감지 (body element의 appliedPreset prop에서 읽기)
  const currentPresetKey = useMemo((): string | null => {
    const body = elementsById.get(bodyElementId) ?? bodyElement;
    if (!body) return null;

    const appliedPreset = (body.props as { appliedPreset?: string })
      ?.appliedPreset;

    // appliedPreset이 있고, 해당 프리셋이 존재하며, 현재 slots과 일치하는지 검증
    if (appliedPreset && LAYOUT_PRESETS[appliedPreset]) {
      const preset = LAYOUT_PRESETS[appliedPreset];
      const presetSlotNames = new Set(preset.slots.map((s) => s.name));
      const existingSlotNames = new Set(existingSlots.map((s) => s.slotName));

      // slot 구성이 여전히 일치하면 유효
      if (
        existingSlotNames.size === presetSlotNames.size &&
        [...existingSlotNames].every((name) => presetSlotNames.has(name))
      ) {
        return appliedPreset;
      }
    }

    return null;
  }, [bodyElement, bodyElementId, elementsById, existingSlots]);

  // 프리셋 적용 함수
  const applyPreset = useCallback(
    async (presetKey: string, mode: PresetApplyMode): Promise<void> => {
      if (mode === "cancel") return;

      const preset = LAYOUT_PRESETS[presetKey];
      if (!preset) {
        console.error(`[usePresetApply] Unknown preset: ${presetKey}`);
        return;
      }

      console.log(
        `[Preset] Applying "${preset.name}" to layout ${layoutId.slice(0, 8)}...`,
      );

      setIsApplying(true);

      try {
        // ============================================
        // Step 1: 기존 Slot 처리
        // ============================================
        if (mode === "replace" && existingSlots.length > 0) {
          console.log(
            `[Preset] Removing ${existingSlots.length} existing slots...`,
          );

          // 병렬 removeElement 는 각 삭제가 오래된 currentState 를 기준으로
          // set 할 수 있어, 마지막 commit 이 앞선 삭제를 메모리에 되살린다.
          // replace 는 동일 부모의 slot 집합을 한 번에 제거해야 한다.
          const existingSlotIds = existingSlots.map((slot) => slot.elementId);

          await removeElements(existingSlotIds);
          await removeCanonicalPresetSlots(existingSlotIds);

          console.log(
            `[Preset] Removed ${existingSlots.length} existing slots`,
          );
        }

        // ============================================
        // Step 2: 새 Slot 생성 준비
        // ============================================
        const existingSlotNames = new Set(existingSlots.map((s) => s.slotName));
        const slotsToCreate: SlotDefinition[] =
          mode === "merge"
            ? preset.slots.filter((s) => !existingSlotNames.has(s.name))
            : preset.slots;

        if (slotsToCreate.length === 0) {
          console.log("[Preset] No new slots to create (all already exist)");
          setIsApplying(false);
          return;
        }

        console.log(`[Preset] Creating ${slotsToCreate.length} new slots...`);

        // ============================================
        // Step 3: Slot node 배열 생성
        // ============================================
        const slotElements: PresetSlotElement[] = slotsToCreate.map(
          (slotDef): PresetSlotElement =>
            withFrameElementMirrorId(
              {
                id: crypto.randomUUID(),
                type: "Slot",
                props: {
                  name: slotDef.name,
                  required: slotDef.required,
                  description: slotDef.description,
                  style: slotDef.defaultStyle,
                },
                parent_id: bodyElementId,
                page_id: null,
              },
              layoutId,
            ),
        );

        // ============================================
        // Step 4: Body에 containerStyle 및 appliedPreset 저장
        // ============================================
        const body = elementsById.get(bodyElementId) ?? bodyElement;
        if (body) {
          const currentStyle =
            ((body.props as { style?: Record<string, unknown> })
              ?.style as Record<string, unknown>) || {};

          // containerStyle이 있으면 병합, 없으면 기존 스타일 유지
          const presetContainerStyle = normalizeFramePresetContainerStyle(
            preset.containerStyle,
          );
          const mergedStyle =
            Object.keys(presetContainerStyle).length > 0
              ? { ...currentStyle, ...presetContainerStyle }
              : currentStyle;

          // ⭐ appliedPreset 키 저장 (동일 프리셋 감지용)
          await updateElementProps(bodyElementId, {
            style: mergedStyle,
            appliedPreset: presetKey,
          });
          console.log(`[Preset] Saved appliedPreset="${presetKey}" to body`);
        }

        // ============================================
        // Step 5: Slot 일괄 생성 (단일 History 엔트리)
        // ============================================
        if (slotElements.length > 0) {
          // addComplexElement 의 childElements 인자는 history grouping 용이다.
          // 각 Slot 의 parent_id 는 위에서 bodyElementId 로 고정한다.
          const [firstSlot, ...restSlots] = slotElements;
          await addComplexElement(firstSlot, restSlots);

          console.log(
            `[Preset] Created ${slotElements.length} slots with single history entry`,
          );
        }

        console.log(`[Preset] "${preset.name}" applied successfully`);
      } catch (error) {
        console.error("[Preset] Failed to apply preset:", error);
        throw error;
      } finally {
        setIsApplying(false);
      }
    },
    [
      layoutId,
      bodyElementId,
      existingSlots,
      bodyElement,
      elementsById,
      addComplexElement,
      removeElements,
      updateElementProps,
    ],
  );

  return {
    existingSlots,
    currentPresetKey,
    applyPreset,
    isApplying,
  };
}

export default usePresetApply;
