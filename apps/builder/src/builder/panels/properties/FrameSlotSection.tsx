import { memo, useEffect, useMemo, useState } from "react";
import { Minus } from "lucide-react";
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
import {
  useCanonicalPropertyElement,
  useCanonicalPropertyElementsMap,
} from "./hooks/useCanonicalPropertyRead";
import {
  filterSlotCandidates,
  isSlotCandidateAllowed,
  isSlotHostElement,
} from "../../components/slotHostPolicy";
import type { PanelNode } from "../panelNode";
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

export const FrameSlotSection = memo(function FrameSlotSection({
  elementId,
}: {
  elementId: string;
}) {
  const element = useCanonicalPropertyElement(elementId) as
    SlotElement | undefined;
  const elementsById = useCanonicalPropertyElementsMap();
  const { t } = useI18n();
  const addElement = useStore((state) => state.addElement);
  const updateElement = useStore((state) => state.updateElement);
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
    const latestElement = elementsById.get(element.id) ?? element;
    if (!latestElement) return;
    const candidate = resolvePanelReference(id, elementsById);
    if (!candidate) return;
    if (!isSlotCandidateAllowed(latestElement, candidate)) return;

    void addElement(
      withFrameElementMirrorId(
        {
          id: crypto.randomUUID(),
          type: "ref",
          ref: candidate.id,
          componentName: getElementLabel(candidate),
          parent_id: latestElement.id,
          page_id: latestElement.page_id ?? null,
          props: {},
        } as AddElementInput,
        getFrameElementMirrorId(latestElement),
      ),
    );
  };

  return (
    <PropertySection title={t("propertiesPanel.slotSection")}>
      {/* 읽기 전용 값도 필드 어법 (legend + 값 상자) · 추천 목록은 공용 `.list-row` · 추천 추가는
          셀렉트 행의 28 액션 열 (panel-structure §1, 2026-09-15) */}
      <div className="fieldset-row" data-wide="true">
        <fieldset className="properties-aria frame-slot-status">
          <legend className="fieldset-legend">{t("propertiesPanel.slotStatus")}</legend>
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

      {isActive ? (
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
          {reusableCandidates.length > 0 && (
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
                    <button
                      aria-label={`Remove ${item.label}`}
                      className="list-row__action frame-slot-remove"
                      onClick={() => handleRemoveRecommendation(item.id)}
                      type="button"
                    >
                      <Minus aria-hidden="true" size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </PropertySection>
  );
});
