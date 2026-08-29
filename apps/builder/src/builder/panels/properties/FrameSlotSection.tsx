import { memo, useEffect, useMemo, useState } from "react";
import { Layers, Minus, X } from "lucide-react";
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
    <PropertySection title="Slot">
      <div className="frame-slot-row">
        <span className="frame-slot-name">State</span>
        <span className="frame-slot-value">
          {isActive ? `${recommendedIds.length} recommendations` : "Inactive"}
        </span>
      </div>

      {isActive ? (
        <button
          aria-label="Disable slot"
          className="control-button"
          onClick={handleDisable}
          type="button"
        >
          <Minus aria-hidden="true" size={14} />
          <span>[-] Disable slot</span>
        </button>
      ) : (
        <button
          aria-label="Enable slot"
          className="control-button"
          onClick={handleEnable}
          type="button"
        >
          <AddIcon aria-hidden="true" size={14} />
          <span>[+] Enable slot</span>
        </button>
      )}

      {isActive && (
        <>
          {reusableCandidates.length > 0 && (
            <div className="frame-slot-picker">
              <PropertySelect
                label="Recommended component"
                value={selectedCandidateId}
                onChange={setSelectedCandidateId}
                options={reusableCandidates}
                icon={Layers}
                popoverWidthMode="width"
              />
              <button
                aria-label="Add recommended component"
                className="control-button"
                disabled={!selectedCandidateId}
                onClick={handleAddRecommendation}
                type="button"
              >
                <AddIcon aria-hidden="true" size={14} />
                <span>Add</span>
              </button>
            </div>
          )}

          <div aria-label="Recommended components" className="frame-slot-list">
            {recommendedItems.length === 0 ? (
              <span className="frame-slot-empty">
                No recommended components
              </span>
            ) : (
              recommendedItems.map((item) => (
                <div className="frame-slot-item" key={item.id}>
                  <span className="frame-slot-item-label">{item.label}</span>
                  <button
                    aria-label={`Insert ${item.label}`}
                    className="frame-slot-remove"
                    onClick={() => handleInsertDefault(item.id)}
                    type="button"
                  >
                    <AddIcon aria-hidden="true" size={14} />
                  </button>
                  <button
                    aria-label={`Remove ${item.label}`}
                    className="frame-slot-remove"
                    onClick={() => handleRemoveRecommendation(item.id)}
                    type="button"
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </PropertySection>
  );
});
