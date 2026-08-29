import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Layers, X } from "lucide-react";
import {
  resolveCanonicalRefMaster,
  isCanonicalRefElement,
  type CanonicalRefResolvableNode,
} from "../../utils/canonicalRefResolution";
import {
  resolveReference,
  type ReferenceResolvable,
} from "../../../utils/component/referenceResolution";
import { PropertySection, PropertySelect } from "../../components";
import { useStore } from "../../stores";
import {
  useCanonicalPropertyChildrenMap,
  useCanonicalPropertyElement,
  useCanonicalPropertyElementsMap,
} from "./hooks/useCanonicalPropertyRead";
import {
  COMPONENT_DESCENDANTS_MIRROR_FIELD,
  getComponentDescendantsMirror,
} from "../../../adapters/canonical/componentSemanticsMirror";
import {
  filterSlotCandidates,
  isSlotCandidateAllowed,
} from "../../components/slotHostPolicy";
import type { PanelNode } from "../panelNode";
import { ACTION_ICONS } from "../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;
type ComponentMirrorElement = Parameters<
  typeof getComponentDescendantsMirror
>[0];
type UpdateElementPatch = Parameters<
  ReturnType<typeof useStore.getState>["updateElement"]
>[1];

type SlotHostElement = PanelNode & {
  metadata?: { slot?: unknown };
  slot?: false | string[];
};

type SlotHostInfo = {
  host: PanelNode;
  label: string;
  path: string;
  recommendedIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getElementLabel(element: PanelNode): string {
  return element.componentName ?? element.customId ?? element.type;
}

function asElementLike(node: PanelNode): ComponentMirrorElement {
  return node as unknown as ComponentMirrorElement;
}

function asCanonicalRefNode(
  node: PanelNode | undefined,
): (PanelNode & CanonicalRefResolvableNode) | undefined {
  return node as unknown as PanelNode & CanonicalRefResolvableNode;
}

function asCanonicalRefTargets(
  elementsById: ReadonlyMap<string, PanelNode>,
): Iterable<PanelNode & CanonicalRefResolvableNode> {
  return elementsById.values() as unknown as Iterable<
    PanelNode & CanonicalRefResolvableNode
  >;
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

function getStableSegment(element: PanelNode): string {
  return element.customId ?? element.id;
}

function getSlotValue(element: PanelNode): string[] | null {
  const slotElement = element as SlotHostElement;
  if (Array.isArray(slotElement.slot)) return slotElement.slot;

  const metadataSlot = slotElement.metadata?.slot;
  if (Array.isArray(metadataSlot)) return metadataSlot;

  return null;
}

function getSlotFillChildren(instance: PanelNode, path: string): unknown[] {
  const override = getComponentDescendantsMirror(asElementLike(instance))?.[
    path
  ];
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return [];
  }
  const children = (override as { children?: unknown }).children;
  return Array.isArray(children) ? children : [];
}

function collectSlotHosts(
  parent: PanelNode,
  childrenByParent: ReadonlyMap<string, PanelNode[]>,
  pathPrefix = "",
): SlotHostInfo[] {
  const slots: SlotHostInfo[] = [];
  const children = childrenByParent.get(parent.id) ?? [];

  for (const child of children) {
    const segment = getStableSegment(child);
    const path = pathPrefix ? `${pathPrefix}/${segment}` : segment;
    const slot = getSlotValue(child);
    if (slot) {
      slots.push({
        host: child,
        label: getElementLabel(child),
        path,
        recommendedIds: slot,
      });
    }
    slots.push(...collectSlotHosts(child, childrenByParent, path));
  }

  return slots;
}

function getFillCandidateOptions(
  slot: SlotHostInfo | undefined,
  elementsById: ReadonlyMap<string, PanelNode>,
): { label: string; value: string }[] {
  if (!slot) return [];

  const recommended = slot.recommendedIds
    .map((reference) => resolvePanelReference(reference, elementsById))
    .filter((candidate): candidate is PanelNode => Boolean(candidate))
    .filter((candidate) => candidate.reusable === true);

  const candidates =
    recommended.length > 0
      ? filterSlotCandidates(slot.host, recommended)
      : filterSlotCandidates(slot.host, [...elementsById.values()]);

  return candidates
    .map((candidate) => ({
      label: getElementLabel(candidate),
      value: candidate.id,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function getFilledLabel(
  children: unknown[],
  elementsById: ReadonlyMap<string, PanelNode>,
): string {
  const labels = children.filter(isRecord).map((child) => {
    const ref = typeof child.ref === "string" ? child.ref : undefined;
    const candidate = ref
      ? resolvePanelReference(ref, elementsById)
      : undefined;
    if (candidate) return getElementLabel(candidate);
    return typeof child.type === "string" ? child.type : "Unknown";
  });

  return labels.length > 0 ? labels.join(", ") : "Empty";
}

function getFillNodeId(
  candidate: PanelNode,
  existingChildren: unknown[],
): string {
  const baseId = candidate.customId ?? candidate.id;
  const existingIds = new Set(
    existingChildren
      .filter(isRecord)
      .map((child) => child.id)
      .filter((id): id is string => typeof id === "string"),
  );

  if (!existingIds.has(baseId)) return baseId;

  let index = 2;
  let nextId = `${baseId}-${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }

  return nextId;
}

export const ComponentSlotFillSection = memo(function ComponentSlotFillSection({
  elementId,
}: {
  elementId: string;
}) {
  const element = useCanonicalPropertyElement(elementId);
  const elementsById = useCanonicalPropertyElementsMap();
  const childrenByParent = useCanonicalPropertyChildrenMap();
  const updateElement = useStore((state) => state.updateElement);
  const [selectedSlotPath, setSelectedSlotPath] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const pendingChildrenByPathRef = useRef<Record<string, unknown[]>>({});

  const master = useMemo(() => {
    if (!element || !isCanonicalRefElement(asCanonicalRefNode(element))) {
      return undefined;
    }
    const ref = element.ref;
    return typeof ref === "string"
      ? resolveCanonicalRefMaster(ref, asCanonicalRefTargets(elementsById))
      : undefined;
  }, [element, elementsById]);

  const slots = useMemo(
    () => (master ? collectSlotHosts(master, childrenByParent) : []),
    [childrenByParent, master],
  );

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.path === selectedSlotPath) ?? slots[0],
    [selectedSlotPath, slots],
  );

  const candidateOptions = useMemo(
    () => getFillCandidateOptions(selectedSlot, elementsById),
    [elementsById, selectedSlot],
  );

  const legacyOverrideKey = JSON.stringify(
    element
      ? (getComponentDescendantsMirror(asElementLike(element)) ?? {})
      : {},
  );

  useEffect(() => {
    pendingChildrenByPathRef.current = {};
  }, [elementId, legacyOverrideKey]);

  useEffect(() => {
    if (selectedSlot && selectedSlot.path !== selectedSlotPath) {
      setSelectedSlotPath(selectedSlot.path);
    }
  }, [selectedSlot, selectedSlotPath]);

  useEffect(() => {
    if (
      selectedCandidateId &&
      candidateOptions.some((option) => option.value === selectedCandidateId)
    ) {
      return;
    }
    setSelectedCandidateId(candidateOptions[0]?.value ?? "");
  }, [candidateOptions, selectedCandidateId]);

  if (
    !element ||
    !isCanonicalRefElement(asCanonicalRefNode(element)) ||
    !selectedSlot
  ) {
    return null;
  }

  const instance = element;
  const filledChildren = getSlotFillChildren(instance, selectedSlot.path);
  const filledLabel = getFilledLabel(filledChildren, elementsById);

  const handleFillSlot = () => {
    const candidate = elementsById.get(selectedCandidateId);
    if (!candidate || !selectedSlot) return;
    if (!isSlotCandidateAllowed(selectedSlot.host, candidate)) return;

    const latestInstance = elementsById.get(element.id) ?? instance;
    const legacyDescendantMap =
      getComponentDescendantsMirror(asElementLike(latestInstance)) ?? {};
    const currentChildren = getSlotFillChildren(
      latestInstance,
      selectedSlot.path,
    );
    const effectiveChildren =
      pendingChildrenByPathRef.current[selectedSlot.path] ?? currentChildren;
    const nextChildren = [
      ...effectiveChildren,
      {
        id: getFillNodeId(candidate, effectiveChildren),
        type: "ref",
        ref: candidate.id,
      },
    ];
    pendingChildrenByPathRef.current[selectedSlot.path] = nextChildren;

    void updateElement(element.id, {
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: {
        ...legacyDescendantMap,
        [selectedSlot.path]: {
          children: nextChildren,
        },
      },
    } as UpdateElementPatch);
  };

  const handleClearSlot = () => {
    const legacyDescendantMap =
      getComponentDescendantsMirror(asElementLike(instance)) ?? {};
    const nextLegacyDescendantMap = { ...legacyDescendantMap };
    delete nextLegacyDescendantMap[selectedSlot.path];
    delete pendingChildrenByPathRef.current[selectedSlot.path];

    void updateElement(element.id, {
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: nextLegacyDescendantMap,
    } as UpdateElementPatch);
  };

  return (
    <PropertySection title="Slot Fill">
      <div className="frame-slot-picker">
        <PropertySelect
          label="Target slot"
          value={selectedSlot.path}
          onChange={setSelectedSlotPath}
          options={slots.map((slot) => ({
            label: slot.label,
            value: slot.path,
          }))}
          icon={Layers}
          popoverWidthMode="width"
        />
      </div>

      {candidateOptions.length > 0 && (
        <div className="frame-slot-picker">
          <PropertySelect
            label="Component"
            value={selectedCandidateId}
            onChange={setSelectedCandidateId}
            options={candidateOptions}
            icon={Layers}
            popoverWidthMode="width"
          />
          <button
            aria-label="Fill slot"
            className="control-button"
            disabled={!selectedCandidateId}
            onClick={handleFillSlot}
            type="button"
          >
            <AddIcon aria-hidden="true" size={14} />
            <span>Fill</span>
          </button>
        </div>
      )}

      <div className="frame-slot-row">
        <span className="frame-slot-name">Filled</span>
        <span className="frame-slot-value">{filledLabel}</span>
      </div>

      {filledChildren.length > 0 && (
        <button
          aria-label="Clear slot"
          className="control-button"
          onClick={handleClearSlot}
          type="button"
        >
          <X aria-hidden="true" size={14} />
          <span>Clear</span>
        </button>
      )}
    </PropertySection>
  );
});
