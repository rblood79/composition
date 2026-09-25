import { memo, useEffect, useMemo, useState } from "react";
import { Minus, X } from "lucide-react";
import { SwatchIconButton } from "../../components/ui/SwatchIconButton";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  matchesReference,
  resolveReference,
  type ReferenceResolvable,
} from "../../../utils/component/referenceResolution";
import { PropertySection, PropertySelect } from "../../components";
import { useStore } from "../../stores";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../../adapters/canonical/frameMirror";
import { COMPONENT_DESCENDANTS_MIRROR_FIELD } from "../../../adapters/canonical/componentSemanticsMirror";
import {
  useCanonicalPropertyChildren,
  useCanonicalPropertyElement,
  useCanonicalPropertyElementsMap,
} from "./hooks/useCanonicalPropertyRead";
import {
  filterSlotCandidates,
  isSlotCandidateAllowed,
  isSlotHostElement,
  resolveSlotInsertAction,
  ROOT_REGION_SLOT_HOST_TYPES,
  SELF_LIST_SLOT_HOST_TYPES,
} from "../../components/slotHostPolicy";
import {
  SLOT_FILL_PRIMITIVE_TYPES,
  buildSlotFillPrimitiveProps,
  slotFillPrimitiveLabel,
} from "../../components/slotFillNodes";
import type { PanelNode } from "../panelNode";
import { planTabItemInsert } from "../../components/collectionItemInsert";
import { planGroupItemInsert } from "../../components/groupItemInsert";
import {
  planTableColumnInsert,
  planTableRowInsert,
} from "../../components/tableColumnInsert";
import {
  applyTableColumnInsertPlan,
  applyTableRowInsertPlan,
} from "../../components/tableColumnWrite";
import { historyManager } from "../../stores/history";
import {
  confirmStructuralOriginImpact,
  runAfterStructuralOriginImpact,
} from "../../stores/utils/elementUpdate";
import { getActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { ACTION_ICONS } from "../../config/actionIcons";
import { useI18n } from "@/i18n";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;
type AddElementInput = Parameters<
  ReturnType<typeof useStore.getState>["addElement"]
>[0];

type SlotElement = PanelNode & {
  metadata?: Record<string, unknown>;
  slot?: false | string[];
};

function getElementLabel(element: PanelNode): string {
  return element.componentName ?? element.customId ?? element.type;
}

function asReferenceTarget(
  element: PanelNode,
): PanelNode & ReferenceResolvable {
  return element as unknown as PanelNode & ReferenceResolvable;
}

function resolvePanelReference(
  reference: string,
  elementsById: ReadonlyMap<string, PanelNode>,
): PanelNode | undefined {
  return (
    elementsById.get(reference) ??
    resolveReference(
      reference,
      elementsById.values() as unknown as Iterable<
        PanelNode & ReferenceResolvable
      >,
    )
  );
}

function getSlotValue(element: SlotElement): false | string[] {
  return Array.isArray(element.slot) ? element.slot : false;
}

function withSlotMetadata(
  element: SlotElement,
  slot: false | string[],
): Pick<SlotElement, "metadata" | "slot"> {
  return {
    metadata: {
      ...(element.metadata ?? {}),
      slot,
    },
    slot,
  };
}

/**
 * root ref instance 가 목록 틀 = owner 인 가족의 instance 면 체인 끝 origin. 패널은 root instance 를 raw (`ref`,
 * slot 없음) 로 받으므로 origin 의 slot 을 추천 목록으로 보여 주고 "+" 는 instance 자기 자식으로 넣는다.
 */
function resolveSelfListInstanceMaster(
  element: SlotElement | undefined,
  elementsById: ReadonlyMap<string, PanelNode>,
): SlotElement | null {
  if (!element || element.type !== "ref") return null;
  let current: SlotElement | undefined = element;
  for (let depth = 0; current?.type === "ref" && depth < 8; depth += 1) {
    const ref: unknown = (current as { ref?: unknown }).ref;
    current =
      typeof ref === "string"
        ? (elementsById.get(ref) as SlotElement | undefined)
        : undefined;
  }
  // ADR-234 Phase 3d~3f · ADR-237 — 목록 틀이 곧 owner 인 가족 (ListBox · GridList · Menu · 그룹 9종).
  if (!current || !SELF_LIST_SLOT_HOST_TYPES.has(current.type)) return null;
  return Array.isArray(current.slot) ? current : null;
}

export const FrameSlotSection = memo(function FrameSlotSection({
  elementId,
}: {
  elementId: string;
}) {
  const rawElement = useCanonicalPropertyElement(elementId) as
    SlotElement | undefined;
  const elementsById = useCanonicalPropertyElementsMap();
  const instanceListMaster = useMemo(
    () => resolveSelfListInstanceMaster(rawElement, elementsById),
    [rawElement, elementsById],
  );
  // instance 는 origin 의 slot 을 읽기 전용으로 쓴다 (추천 목록 편집은 origin 에서).
  const isInstanceListHost = instanceListMaster != null;
  // ADR-240 Phase 2 — Popover · Tooltip instance root = 자유 내용 영역 (자기 자식 · inherited 뒤).
  const isRootRegionInstance =
    instanceListMaster != null &&
    ROOT_REGION_SLOT_HOST_TYPES.has(instanceListMaster.type);
  const ownChildren = useCanonicalPropertyChildren(elementId);
  const element = useMemo(
    () =>
      instanceListMaster && rawElement
        ? ({
            ...instanceListMaster,
            id: rawElement.id,
            page_id: rawElement.page_id,
          } as SlotElement)
        : rawElement,
    [instanceListMaster, rawElement],
  );
  const { t } = useI18n();
  const addElement = useStore((state) => state.addElement);
  const removeElements = useStore((state) => state.removeElements);
  const updateElement = useStore((state) => state.updateElement);
  const updateElementProps = useStore((state) => state.updateElementProps);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");

  const slot = element ? getSlotValue(element) : false;
  const recommendedIds = useMemo(
    () => (Array.isArray(slot) ? slot : []),
    [slot],
  );
  const isActive = Array.isArray(slot);

  const reusableCandidates = useMemo(() => {
    const recommended = recommendedIds;
    if (!element) return [];
    return filterSlotCandidates(element, [...elementsById.values()])
      .filter(
        (candidate) =>
          candidate.id !== elementId &&
          !recommended.some((reference) =>
            matchesReference(asReferenceTarget(candidate), reference),
          ),
      )
      .map((candidate) => ({
        label: getElementLabel(candidate),
        value: candidate.id,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [element, elementId, elementsById, recommendedIds]);

  const recommendedItems = useMemo(
    () =>
      recommendedIds.map((id) => {
        const candidate = resolvePanelReference(id, elementsById);
        return {
          id,
          label: candidate ? getElementLabel(candidate) : id,
        };
      }),
    [elementsById, recommendedIds],
  );

  useEffect(() => {
    if (
      selectedCandidateId &&
      reusableCandidates.some(
        (candidate) => candidate.value === selectedCandidateId,
      )
    ) {
      return;
    }
    setSelectedCandidateId(reusableCandidates[0]?.value ?? "");
  }, [reusableCandidates, selectedCandidateId]);

  if (!element || !isSlotHostElement(element)) return null;

  const saveSlot = (nextSlot: false | string[]) => {
    void updateElement(element.id, withSlotMetadata(element, nextSlot));
  };

  const handleEnable = () => {
    if (isActive) return;
    saveSlot([]);
  };

  const handleDisable = () => {
    if (!isActive) return;
    saveSlot(false);
  };

  const handleAddRecommendation = () => {
    if (!isActive || !selectedCandidateId) return;
    const selectedCandidate = elementsById.get(selectedCandidateId);
    if (
      selectedCandidate &&
      !isSlotCandidateAllowed(element, selectedCandidate)
    ) {
      return;
    }
    if (
      selectedCandidate &&
      recommendedIds.some((reference) =>
        matchesReference(asReferenceTarget(selectedCandidate), reference),
      )
    ) {
      return;
    }
    saveSlot([...recommendedIds, selectedCandidateId]);
  };

  const handleRemoveRecommendation = (id: string) => {
    if (!isActive) return;
    saveSlot(recommendedIds.filter((candidateId) => candidateId !== id));
  };

  const handleInsertDefault = (id: string) => {
    const latestElement = isInstanceListHost
      ? element
      : (elementsById.get(element.id) ?? element);
    if (!latestElement) return;
    const candidate = resolvePanelReference(id, elementsById);
    if (!candidate) return;
    if (!isSlotCandidateAllowed(latestElement, candidate)) return;

    const insertAction = resolveSlotInsertAction(latestElement, candidate);
    // ADR-237 Phase 1 — 그룹 "+" = 가족 origin 의 instance 자식 + 선택 값 · Radio value · 단일 선택 정규화를
    //   한 history 항목으로 (origin 영향 확인은 트랜잭션 밖에서 먼저 — 확인된 대상은 안쪽에서 동기 통과).
    if (insertAction.kind === "group-item") {
      const document = getActiveCanonicalDocument();
      const plan = document
        ? planGroupItemInsert({
            document,
            hostId: latestElement.id,
            candidateId: candidate.id,
            newId: crypto.randomUUID(),
          })
        : null;
      if (!plan) return;
      const mirrorId = getFrameElementMirrorId(latestElement);
      const pageId = latestElement.page_id ?? null;
      void (async () => {
        // host 자신이나 조상이 origin 이면 모든 instance 가 바뀐다 (ADR-236 E4).
        const gate = confirmStructuralOriginImpact([
          plan.hostId,
          ...plan.propsUpdates.map((update) => update.id),
        ]);
        if (gate !== true && !(await gate)) return;
        const pendingWrites = historyManager.runInTransaction(
          { type: "batch", elementId: plan.hostId },
          (): Promise<unknown>[] => [
            addElement(
              withFrameElementMirrorId(
                {
                  ...plan.child,
                  parent_id: plan.hostId,
                  page_id: pageId,
                } as unknown as AddElementInput,
                mirrorId,
              ),
            ),
            ...plan.propsUpdates.map((update) =>
              updateElementProps(update.id, update.props),
            ),
            ...(plan.instanceDescendants
              ? [
                  updateElement(plan.hostId, {
                    [COMPONENT_DESCENDANTS_MIRROR_FIELD]:
                      plan.instanceDescendants,
                  } as Partial<AddElementInput>),
                ]
              : []),
          ],
        );
        await Promise.all(pendingWrites);
      })();
      return;
    }
    // ADR-241 Phase 2 — TableHeader "+" = Column origin 의 instance (형제와 다른 key · instance 는 descendants mode C).
    if (insertAction.kind === "table-column") {
      const document = getActiveCanonicalDocument();
      const plan = document
        ? planTableColumnInsert({ document, hostId: latestElement.id })
        : null;
      if (!plan) return;
      const mirrorId = getFrameElementMirrorId(latestElement);
      const pageId = latestElement.page_id ?? null;
      void (async () => {
        // 열 추가 · 셀 동기화를 병렬로 쓰기 전에 한 번 묻는다 — header 가 origin 자손이어도 (ADR-236 E4).
        if (plan.kind === "plain") {
          const gate = confirmStructuralOriginImpact([plan.headerId]);
          if (gate !== true && !(await gate)) return;
        }
        await applyTableColumnInsertPlan(
          plan,
          { addElement, updateElement, removeElements },
          { pageId, mirrorId },
        );
      })();
      return;
    }
    // ADR-241 Phase 3 — TableBody (TableView) "+" = Row origin 의 instance + 열 수만큼 셀 (instance 는 descendants mode C).
    if (insertAction.kind === "table-row") {
      const document = getActiveCanonicalDocument();
      const plan = document
        ? planTableRowInsert({ document, hostId: latestElement.id })
        : null;
      if (!plan) return;
      const mirrorId = getFrameElementMirrorId(latestElement);
      const pageId = latestElement.page_id ?? null;
      void (async () => {
        if (plan.kind === "plain") {
          const gate = confirmStructuralOriginImpact([plan.bodyId]);
          if (gate !== true && !(await gate)) return;
        }
        await applyTableRowInsertPlan(
          plan,
          { addElement, updateElement, removeElements },
          { pageId, mirrorId },
        );
      })();
      return;
    }
    // ADR-234 Phase 3 — 목록 틀 "+" = 항목 instance (Tabs 는 짝 TabPanel 도 · instance 는 descendants mode C).
    if (insertAction.kind === "list-item") {
      const document = getActiveCanonicalDocument();
      const plan = document
        ? planTabItemInsert({
            document,
            hostId: latestElement.id,
            candidateId: candidate.id,
            newKey: crypto.randomUUID(),
          })
        : null;
      if (!plan) return;
      if (plan.kind === "instance") {
        void updateElement(plan.instanceId, {
          [COMPONENT_DESCENDANTS_MIRROR_FIELD]: plan.descendants,
          ...(plan.props ? { props: plan.props } : {}),
        } as Partial<AddElementInput>);
        return;
      }
      const mirrorId = getFrameElementMirrorId(latestElement);
      const pageId = latestElement.page_id ?? null;
      void (async () => {
        const gate = confirmStructuralOriginImpact([
          plan.tabListId,
          plan.tabPanelsId,
        ]);
        if (gate !== true && !(await gate)) return;
        await addElement(
          withFrameElementMirrorId(
            {
              ...plan.tab,
              parent_id: plan.tabListId,
              page_id: pageId,
            } as unknown as AddElementInput,
            mirrorId,
          ),
        );
        // 선택 모양 후보 — owner 선택 key 에 새 항목 key (ADR-234 후속).
        if (plan.selection) {
          await updateElementProps(
            plan.selection.ownerId,
            plan.selection.props,
          );
        }
        if (plan.panel && plan.tabPanelsId) {
          await addElement(
            withFrameElementMirrorId(
              {
                ...plan.panel,
                parent_id: plan.tabPanelsId,
                page_id: pageId,
              } as unknown as AddElementInput,
              mirrorId,
            ),
          );
        }
      })();
      return;
    }
    const hostId = latestElement.id;
    runAfterStructuralOriginImpact([hostId], () => {
      void addElement(
        withFrameElementMirrorId(
          {
            id: crypto.randomUUID(),
            type: "ref",
            ref: candidate.id,
            componentName: getElementLabel(candidate),
            parent_id: hostId,
            page_id: latestElement.page_id ?? null,
            props: {},
          } as AddElementInput,
          getFrameElementMirrorId(latestElement),
        ),
      );
    });
  };

  const handleInsertPrimitive = (type: string) => {
    if (!rawElement) return;
    runAfterStructuralOriginImpact([rawElement.id], () => {
      void addElement(
        withFrameElementMirrorId(
          {
            id: crypto.randomUUID(),
            type,
            parent_id: rawElement.id,
            page_id: rawElement.page_id ?? null,
            props: buildSlotFillPrimitiveProps(type),
          } as AddElementInput,
          getFrameElementMirrorId(rawElement),
        ),
      );
    });
  };

  const handleClearOwnChildren = () => {
    const ids = ownChildren.map((child) => child.id);
    if (ids.length === 0) return;
    runAfterStructuralOriginImpact(ids, () => void removeElements(ids));
  };

  return (
    <PropertySection title={t("propertiesPanel.slotSection")}>
      {/* 읽기 전용 값도 필드 어법 (legend + 값 상자) · 추천 목록은 공용 `.list-row` · 추천 추가는
          셀렉트 행의 28 액션 열 (panel-structure §1, 2026-09-15) */}
      <div className="fieldset-row" data-wide="true">
        <fieldset className="properties-aria frame-slot-status">
          <legend className="fieldset-legend">
            {t("propertiesPanel.slotStatus")}
          </legend>
          <div className="react-aria-control react-aria-Group">
            <span className="frame-slot-value">
              {isActive
                ? t("propertiesPanel.slotRecommendations", {
                    count: recommendedIds.length,
                  })
                : t("propertiesPanel.slotInactive")}
            </span>
          </div>
        </fieldset>
      </div>

      {isInstanceListHost ? null : isActive ? (
        <button
          aria-label={t("propertiesPanel.slotDisable")}
          className="control-button"
          onClick={handleDisable}
          type="button"
        >
          <Minus aria-hidden="true" size={14} />
          <span>{t("propertiesPanel.slotDisable")}</span>
        </button>
      ) : (
        <button
          aria-label={t("propertiesPanel.slotEnable")}
          className="control-button"
          onClick={handleEnable}
          type="button"
        >
          <AddIcon aria-hidden="true" size={14} />
          <span>{t("propertiesPanel.slotEnable")}</span>
        </button>
      )}

      {isActive && (
        <>
          {!isInstanceListHost && reusableCandidates.length > 0 && (
            <div className="fieldset-row frame-slot-picker" data-wide="true">
              <PropertySelect
                label="Recommended component"
                value={selectedCandidateId}
                onChange={setSelectedCandidateId}
                options={reusableCandidates}
                popoverWidthMode="width"
              />
              <div className="fieldset-actions actions-slot-add">
                <SwatchIconButton
                  aria-label="Add recommended component"
                  isDisabled={!selectedCandidateId}
                  onPress={handleAddRecommendation}
                >
                  <AddIcon aria-hidden="true" size={iconProps.size} />
                </SwatchIconButton>
              </div>
            </div>
          )}

          <div aria-label="Recommended components" className="frame-slot-list">
            {recommendedItems.length === 0 ? (
              <span className="frame-slot-empty">
                No recommended components
              </span>
            ) : (
              recommendedItems.map((item) => (
                <div className="list-row frame-slot-item" key={item.id}>
                  <div className="list-row__body">
                    <span className="list-row__label frame-slot-item-label">
                      {item.label}
                    </span>
                  </div>
                  <div className="list-row__actions">
                    <button
                      aria-label={`Insert ${item.label}`}
                      className="list-row__action frame-slot-insert"
                      onClick={() => handleInsertDefault(item.id)}
                      type="button"
                    >
                      <AddIcon aria-hidden="true" size={12} />
                    </button>
                    {isInstanceListHost ? null : (
                      <button
                        aria-label={`Remove ${item.label}`}
                        className="list-row__action frame-slot-remove"
                        onClick={() => handleRemoveRecommendation(item.id)}
                        type="button"
                      >
                        <Minus aria-hidden="true" size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {isRootRegionInstance && (
            <div aria-label="Free content" className="frame-slot-list">
              {SLOT_FILL_PRIMITIVE_TYPES.map((type) => {
                const label = slotFillPrimitiveLabel(type);
                return (
                  <div className="list-row frame-slot-item" key={type}>
                    <div className="list-row__body">
                      <span className="list-row__label frame-slot-item-label">
                        {label}
                      </span>
                    </div>
                    <div className="list-row__actions">
                      <button
                        aria-label={`Insert ${label}`}
                        className="list-row__action frame-slot-insert"
                        onClick={() => handleInsertPrimitive(type)}
                        type="button"
                      >
                        <AddIcon aria-hidden="true" size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isRootRegionInstance && ownChildren.length > 0 && (
            <button
              aria-label="Clear slot"
              className="control-button"
              onClick={handleClearOwnChildren}
              type="button"
            >
              <X aria-hidden="true" size={14} />
              <span>Clear</span>
            </button>
          )}
        </>
      )}
    </PropertySection>
  );
});
