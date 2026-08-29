import { memo, useMemo } from "react";

import { PropertySection } from "../../components";
import { useStore } from "../../stores";
import { globalToast } from "../../stores/toast";
import { requestEditingSemanticsDetachConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import {
  resolveReference,
  type ReferenceResolvable,
} from "../../../utils/component/referenceResolution";
import {
  canDetachInstance,
  getEditingSemanticsImpactInstanceIds,
  getEditingSemanticsLabel,
  getEditingSemanticsOriginId,
  getEditingSemanticsOverrideItems,
  getEditingSemanticsRole,
  type EditingSemanticsOverrideItem,
} from "../../utils/editingSemantics";
import { getFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
import {
  useCanonicalPropertyElement,
  useCanonicalPropertyElementsMap,
} from "./hooks/useCanonicalPropertyRead";
import type { PanelNode } from "../panelNode";

function resolveOriginElement(
  originId: string | null,
  elements: Iterable<PanelNode>,
): PanelNode | null {
  if (!originId) return null;
  return (
    resolveReference(
      originId,
      elements as unknown as Iterable<PanelNode & ReferenceResolvable>,
    ) ?? null
  );
}

function getComponentDisplayName(
  element: PanelNode,
  originElement: PanelNode | null,
): string {
  return (
    element.componentName ??
    element.customId ??
    originElement?.componentName ??
    originElement?.customId ??
    originElement?.type ??
    element.type
  );
}

function isFrameBodyElement(element: PanelNode): boolean {
  return (
    element.type.toLowerCase() === "body" &&
    getFrameElementMirrorId(element) !== null
  );
}

export const ComponentSemanticsSection = memo(
  function ComponentSemanticsSection({ elementId }: { elementId: string }) {
    const element = useCanonicalPropertyElement(elementId);
    const elementsById = useCanonicalPropertyElementsMap();
    const lookupElements = useMemo(
      () => Array.from(elementsById.values()),
      [elementsById],
    );
    const selectElementWithPageTransition = useStore(
      (state) => state.selectElementWithPageTransition,
    );
    const setSelectedElements = useStore((state) => state.setSelectedElements);
    const detachInstance = useStore((state) => state.detachInstance);
    const toggleComponentOrigin = useStore(
      (state) => state.toggleComponentOrigin,
    );
    const resetInstanceOverrideField = useStore(
      (state) => state.resetInstanceOverrideField,
    );
    const undo = useStore((state) => state.undo);
    const role = getEditingSemanticsRole(element);
    const label = getEditingSemanticsLabel(role);
    const originId = getEditingSemanticsOriginId(element);
    const originElement = resolveOriginElement(originId, lookupElements);
    const isDetachableInstance = canDetachInstance(element);
    const overrideItems = getEditingSemanticsOverrideItems(element);
    const instanceIds =
      role === "origin"
        ? getEditingSemanticsImpactInstanceIds(element, lookupElements)
        : [];
    const roleLabel = label ?? "Standard";
    const roleClass = role ?? "standard";

    if (!element) return null;
    if (isFrameBodyElement(element)) return null;
    const componentName = getComponentDisplayName(element, originElement);

    const handleGoToOrigin = () => {
      if (!originElement) return;
      selectElementWithPageTransition(
        originElement.id,
        originElement.page_id ?? null,
      );
    };

    const handleDetachInstance = async () => {
      if (!isDetachableInstance) return;
      const confirmed = await requestEditingSemanticsDetachConfirmation({
        instanceId: elementId,
        instanceLabel: componentName,
        originId,
        originLabel: originElement
          ? getComponentDisplayName(originElement, null)
          : originId,
      });
      if (!confirmed) return;
      detachInstance(elementId);
    };

    const handleCreateComponent = async () => {
      await toggleComponentOrigin(elementId);
    };

    const handleRemoveComponent = async () => {
      await toggleComponentOrigin(elementId);
    };

    const handleSelectInstances = () => {
      if (instanceIds.length === 0) return;
      const firstInstance =
        elementsById.get(instanceIds[0]) ??
        lookupElements.find((candidate) => candidate.id === instanceIds[0]);
      if (firstInstance) {
        selectElementWithPageTransition(
          firstInstance.id,
          firstInstance.page_id ?? null,
        );
      }
      setSelectedElements(instanceIds);
    };

    const handleResetOverrideField = (item: EditingSemanticsOverrideItem) => {
      resetInstanceOverrideField(elementId, item.fieldKey, item.descendantPath);
      // (b) 확인 다이얼로그 없이 즉시 실행 — 흐름을 끊지 않되, 실수로 무거운
      // override (특히 dataBinding) 를 날려도 되돌릴 수 있게 undo 액션 토스트를
      // 띄운다. reset 은 history entry 1건이므로 undo() 1회로 정확히 복구된다.
      const isItemsFork = item.fieldKey === "items" && !item.descendantPath;
      const label = isItemsFork ? "items (forked)" : item.label;
      globalToast.info(`'${label}' override 해제됨`, {
        // 같은 필드를 반복해서 reset 해도 매번 회복 안내가 떠야 하므로 쿨다운 무시.
        bypassCooldown: true,
        action: { label: "실행취소", onClick: () => undo() },
      });
    };

    return (
      <PropertySection title="Component">
        <div className="component-semantics-row">
          <span className="component-semantics-name">Name</span>
          <span className="component-semantics-value">{componentName}</span>
        </div>
        <div className="component-semantics-row">
          <span className="component-semantics-name">Role</span>
          <span
            className={`component-semantics-badge component-semantics-badge--${roleClass}`}
          >
            {roleLabel}
          </span>
        </div>
        {role === "origin" && (
          <div className="component-semantics-row">
            <span className="component-semantics-name">Impacts</span>
            <span className="component-semantics-count">
              {instanceIds.length} instances
            </span>
          </div>
        )}
        {!role && (
          <button
            className="component-semantics-action"
            onClick={handleCreateComponent}
            type="button"
          >
            Create component
          </button>
        )}
        {role === "origin" && (
          <button
            aria-label="Remove component"
            className="component-semantics-action"
            onClick={handleRemoveComponent}
            type="button"
          >
            [-] Remove component
          </button>
        )}
        {role === "instance" && (
          <>
            <button
              className="component-semantics-action"
              disabled={!originElement}
              onClick={handleGoToOrigin}
              type="button"
            >
              Go to component
            </button>
            {isDetachableInstance && (
              <button
                className="component-semantics-action"
                onClick={handleDetachInstance}
                type="button"
              >
                Detach instance
              </button>
            )}
            {overrideItems.length > 0 && (
              <fieldset className="properties-aria component-semantics-overrides">
                <legend className="fieldset-legend">Overrides</legend>
                <div className="react-aria-Group component-semantics-field-list">
                  {overrideItems.map((item) => {
                    // ADR-138 A-3: instance 가 props.items 를 override 하면
                    // origin 과 shallow fork — origin items 변경이 더 이상
                    // 반영되지 않는다. 일반 override 와 구분해 fork 임을 명시.
                    const isItemsFork =
                      item.fieldKey === "items" && !item.descendantPath;
                    return (
                      <button
                        aria-label={
                          isItemsFork
                            ? "Reset forked items to origin"
                            : `Reset ${item.label} override`
                        }
                        className={
                          isItemsFork
                            ? "component-semantics-field component-semantics-field--fork"
                            : "component-semantics-field"
                        }
                        key={item.id}
                        onClick={() => handleResetOverrideField(item)}
                        title={
                          isItemsFork
                            ? "이 인스턴스의 items 가 origin 과 분리(fork)되었습니다 — origin items 변경이 반영되지 않습니다. Reset 시 origin 에 다시 연결됩니다."
                            : undefined
                        }
                        type="button"
                      >
                        <span className="component-semantics-field-dot" />
                        <span className="component-semantics-field-name">
                          {isItemsFork ? "items (forked)" : item.label}
                        </span>
                        <span className="component-semantics-field-reset">
                          {isItemsFork ? "Reset to origin" : "Reset"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </>
        )}
        {role === "origin" && instanceIds.length > 0 && (
          <button
            className="component-semantics-action"
            onClick={handleSelectInstances}
            type="button"
          >
            Select instances ({instanceIds.length})
          </button>
        )}
      </PropertySection>
    );
  },
);
