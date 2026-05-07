import { memo, useMemo } from "react";
import { Component as ComponentIcon } from "lucide-react";
import type { Element } from "../../../types/core/store.types";
import { PropertySection } from "../../components";
import { useStore } from "../../stores";
import { useCanonicalElements } from "../../stores/canonical/canonicalElementsView";
import { requestEditingSemanticsDetachConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import { resolveReference } from "../../../utils/component/referenceResolution";
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

function resolveOriginElement(
  originId: string | null,
  elements: Iterable<Element>,
): Element | null {
  if (!originId) return null;
  return resolveReference(originId, elements) ?? null;
}

function getComponentDisplayName(
  element: Element,
  originElement: Element | null,
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

function isFrameBodyElement(element: Element): boolean {
  return (
    element.type.toLowerCase() === "body" &&
    getFrameElementMirrorId(element) !== null
  );
}

export const ComponentSemanticsSection = memo(
  function ComponentSemanticsSection({ elementId }: { elementId: string }) {
    const legacyElement = useStore((state) => state.elementsMap.get(elementId));
    const elementsMap = useStore((state) => state.elementsMap);
    const canonicalElements = useCanonicalElements();
    const element = useMemo(
      () =>
        canonicalElements?.find((candidate) => candidate.id === elementId) ??
        legacyElement,
      [canonicalElements, elementId, legacyElement],
    );
    const lookupElements = useMemo(
      () => canonicalElements ?? Array.from(elementsMap.values()),
      [canonicalElements, elementsMap],
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
        elementsMap.get(instanceIds[0]) ??
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
    };

    return (
      <PropertySection title="Component" icon={ComponentIcon}>
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
              <div
                aria-label="Overrides"
                className="component-semantics-overrides"
              >
                <span className="component-semantics-name">Overrides</span>
                <div className="component-semantics-field-list">
                  {overrideItems.map((item) => (
                    <button
                      aria-label={`Reset ${item.label} override`}
                      className="component-semantics-field"
                      key={item.id}
                      onClick={() => handleResetOverrideField(item)}
                      type="button"
                    >
                      <span className="component-semantics-field-dot" />
                      <span className="component-semantics-field-name">
                        {item.label}
                      </span>
                      <span className="component-semantics-field-reset">
                        Reset
                      </span>
                    </button>
                  ))}
                </div>
              </div>
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
