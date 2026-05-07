import { memo, useEffect, useMemo, useState } from "react";
import { Layers, Minus, Plus, X } from "lucide-react";
import type { Element } from "../../../types/core/store.types";
import {
  matchesReference,
  resolveReference,
} from "../../../utils/component/referenceResolution";
import { PropertySection, PropertySelect } from "../../components";
import { useStore } from "../../stores";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../../adapters/canonical/frameMirror";

type SlotElement = Element & {
  metadata?: Record<string, unknown>;
  slot?: false | string[];
};

const SLOT_HOST_TYPES = new Set([
  "box",
  "cardcontent",
  "cardfooter",
  "cardheader",
  "frame",
  "group",
  "section",
]);

function isSlotHostElement(element: Element | undefined): boolean {
  return Boolean(element && SLOT_HOST_TYPES.has(element.type.toLowerCase()));
}

function getElementLabel(element: Element): string {
  return element.componentName ?? element.customId ?? element.type;
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
  const element = useStore(
    (state) => state.elementsMap.get(elementId) as SlotElement | undefined,
  );
  const elementsMap = useStore((state) => state.elementsMap);
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
    return [...elementsMap.values()]
      .filter(
        (candidate) =>
          candidate.id !== elementId &&
          candidate.reusable === true &&
          !recommended.some((reference) =>
            matchesReference(candidate, reference),
          ),
      )
      .map((candidate) => ({
        label: getElementLabel(candidate),
        value: candidate.id,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [elementId, elementsMap, recommendedIds]);

  const recommendedItems = useMemo(
    () =>
      recommendedIds.map((id) => {
        const candidate =
          elementsMap.get(id) ?? resolveReference(id, elementsMap.values());
        return {
          id,
          label: candidate ? getElementLabel(candidate) : id,
        };
      }),
    [elementsMap, recommendedIds],
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
    const selectedCandidate = elementsMap.get(selectedCandidateId);
    if (
      selectedCandidate &&
      recommendedIds.some((reference) =>
        matchesReference(selectedCandidate, reference),
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
    const latestState = useStore.getState();
    const latestElement = latestState.elementsMap.get(element.id) ?? element;
    if (!latestElement) return;
    const candidate =
      latestState.elementsMap.get(id) ??
      resolveReference(id, latestState.elementsMap.values());
    if (!candidate) return;

    const children = latestState.childrenMap.get(latestElement.id) ?? [];

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
        } as Element,
        getFrameElementMirrorId(latestElement),
      ),
    );
  };

  return (
    <PropertySection title="Slot" icon={Layers}>
      <div className="frame-slot-row">
        <span className="frame-slot-name">State</span>
        <span className="frame-slot-value">
          {isActive ? `${recommendedIds.length} recommendations` : "Inactive"}
        </span>
      </div>

      {isActive ? (
        <button
          aria-label="Disable slot"
          className="component-semantics-action frame-slot-action"
          onClick={handleDisable}
          type="button"
        >
          <Minus aria-hidden="true" size={14} />
          <span>[-] Disable slot</span>
        </button>
      ) : (
        <button
          aria-label="Enable slot"
          className="component-semantics-action frame-slot-action"
          onClick={handleEnable}
          type="button"
        >
          <Plus aria-hidden="true" size={14} />
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
                className="component-semantics-action frame-slot-action"
                disabled={!selectedCandidateId}
                onClick={handleAddRecommendation}
                type="button"
              >
                <Plus aria-hidden="true" size={14} />
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
                    <Plus aria-hidden="true" size={14} />
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
