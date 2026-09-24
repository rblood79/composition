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
  isNamedRegionHost,
  isSlotCandidateAllowed,
  resolveSlotInsertAction,
} from "../../components/slotHostPolicy";
import {
  SLOT_FILL_PRIMITIVE_TYPES,
  buildSlotFillNodeForType,
  buildSlotFillRefNode,
  slotFillPrimitiveLabel,
} from "../../components/slotFillNodes";
import { planTabItemInsert } from "../../components/collectionItemInsert";
import { planTableColumnInsert } from "../../components/tableColumnInsert";
import {
  collectSlotFillHosts,
  readSlotFill,
  writeSlotFill,
  type SlotFillHost,
} from "../../components/slotFillPath";
import { getActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
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

type SlotHostInfo = SlotFillHost<PanelNode> & { label: string };

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

/** ADR-240 Phase 1 — 경로 키 = segment (`slotFillPath`). 종전 `customId ?? id` 키는 읽기 폴백 · 다음 쓰기에서 이관. */
function collectSlotHosts(
  parent: PanelNode,
  childrenByParent: ReadonlyMap<string, PanelNode[]>,
): SlotHostInfo[] {
  return collectSlotFillHosts<PanelNode>(parent.id, childrenByParent).map(
    (slot) => ({ ...slot, label: getElementLabel(slot.host) }),
  );
}

function getSlotFillChildren(
  instance: PanelNode,
  slot: SlotHostInfo,
): unknown[] {
  return readSlotFill(
    getComponentDescendantsMirror(asElementLike(instance)) ?? undefined,
    slot,
  );
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

  const reusableOptions = candidates
    .map((candidate) => ({
      label: getElementLabel(candidate),
      value: candidate.id,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
  // ADR-240 Phase 2 — 이름 영역은 추천 origin 에 더해 자유 내용 (팔레트 primitive) 을 받는다.
  if (!isNamedRegionHost(slot.host)) return reusableOptions;
  return [
    ...reusableOptions,
    ...SLOT_FILL_PRIMITIVE_TYPES.map((type) => ({
      label: slotFillPrimitiveLabel(type),
      value: `${PRIMITIVE_OPTION_PREFIX}${type}`,
    })),
  ];
}

const PRIMITIVE_OPTION_PREFIX = "primitive:";

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
  const filledChildren = getSlotFillChildren(instance, selectedSlot);
  const filledLabel = getFilledLabel(filledChildren, elementsById);

  const handleFillSlot = () => {
    if (!selectedSlot) return;
    const primitiveType = selectedCandidateId.startsWith(
      PRIMITIVE_OPTION_PREFIX,
    )
      ? selectedCandidateId.slice(PRIMITIVE_OPTION_PREFIX.length)
      : null;
    const candidate = primitiveType
      ? undefined
      : elementsById.get(selectedCandidateId);
    if (!primitiveType && !candidate) return;
    if (candidate && !isSlotCandidateAllowed(selectedSlot.host, candidate)) {
      return;
    }

    // ADR-241 Phase 2 — instance 의 TableHeader slot Fill = 자기 열 추가 (mode C · 상속 열 이어받기 · key 유일).
    if (
      candidate &&
      resolveSlotInsertAction(selectedSlot.host, candidate).kind ===
        "table-column"
    ) {
      const document = getActiveCanonicalDocument();
      const plan = document
        ? planTableColumnInsert({
            document,
            hostId: `${element.id}/${selectedSlot.path}`,
          })
        : null;
      if (plan?.kind !== "instance") return;
      void updateElement(plan.instanceId, {
        [COMPONENT_DESCENDANTS_MIRROR_FIELD]: plan.descendants,
      } as UpdateElementPatch);
      return;
    }

    // ADR-234 Phase 3 — 목록 틀 slot (TagList · TabList) 의 Fill = 항목 instance 추가: 상속 목록을 이어받아
    //   끝에 새 항목 (Tabs 는 짝 TabPanel 도). 빈 override 로 시작하면 상속 목록이 항목 1개로 바뀐다.
    if (
      candidate &&
      resolveSlotInsertAction(selectedSlot.host, candidate).kind === "list-item"
    ) {
      const document = getActiveCanonicalDocument();
      const plan = document
        ? planTabItemInsert({
            document,
            hostId: `${element.id}/${selectedSlot.path}`,
            candidateId: candidate.id,
            newKey: crypto.randomUUID(),
          })
        : null;
      if (plan?.kind !== "instance") return;
      void updateElement(plan.instanceId, {
        [COMPONENT_DESCENDANTS_MIRROR_FIELD]: plan.descendants,
        ...(plan.props ? { props: plan.props } : {}),
      } as UpdateElementPatch);
      return;
    }

    const latestInstance = elementsById.get(element.id) ?? instance;
    const legacyDescendantMap =
      getComponentDescendantsMirror(asElementLike(latestInstance)) ?? {};
    const currentChildren = getSlotFillChildren(latestInstance, selectedSlot);
    const effectiveChildren =
      pendingChildrenByPathRef.current[selectedSlot.path] ?? currentChildren;
    const fillNode = candidate
      ? buildSlotFillRefNode(candidate, effectiveChildren)
      : buildSlotFillNodeForType(primitiveType!, effectiveChildren);
    if (!fillNode) return;
    const nextChildren = [...effectiveChildren, fillNode];
    pendingChildrenByPathRef.current[selectedSlot.path] = nextChildren;

    void updateElement(element.id, {
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: writeSlotFill(
        legacyDescendantMap,
        selectedSlot,
        nextChildren,
      ),
    } as UpdateElementPatch);
  };

  const handleClearSlot = () => {
    const legacyDescendantMap =
      getComponentDescendantsMirror(asElementLike(instance)) ?? {};
    const nextLegacyDescendantMap = writeSlotFill(
      legacyDescendantMap,
      selectedSlot,
      null,
    );
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
