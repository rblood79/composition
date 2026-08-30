import { memo, useMemo } from "react";
import { Boxes } from "lucide-react";

import { PropertySection } from "../../components";
import { ACTION_ICONS } from "../../config/actionIcons";
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
  isEditingSemanticsInstance,
  isEditingSemanticsOrigin,
  type EditingSemanticsOverrideItem,
} from "../../utils/editingSemantics";
import { getFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
import {
  useCanonicalPropertyElement,
  useCanonicalPropertyElementsMap,
} from "./hooks/useCanonicalPropertyRead";
import type { PanelNode } from "../panelNode";

/**
 * Component 섹션 레이아웃 — pencil app 어법 (2026-08-30).
 *
 * pencil 의 properties 패널은 컴포넌트 정체를 **한 줄 칩**(다이아몬드 아이콘 +
 * 이름, 역할 색 테두리)으로 보이고 그 **아래 한 줄**에 액션을 모은다. 종전
 * composition 은 Name / Role / Impacts 를 각각 key-value 행으로 쌓고 그 아래
 * 액션 버튼을 다시 세로로 쌓아, 폭 222px 패널에서 standard 3줄 / origin 5줄을
 * 썼다 — 값이 3개뿐인데 라벨 열이 절반을 먹는 구조였다.
 *
 * 옮겨 온 것은 **배치**뿐이고 크롬은 composition 정본을 쓴다:
 * - 역할 색은 `--editing-semantics-*` — 캔버스 오버레이(semanticOverlayColors.ts)
 *   와 Navigator 점이 이미 쓰는 토큰. 패널만 다른 색을 쓰면 같은 요소가 화면마다
 *   다르게 읽힌다. pencil 의 solid/dashed 선 구분은 채택하지 않는다 — composition
 *   캔버스는 역할을 **색으로만** 구분하므로(ADR-112) 패널에만 선 축을 새로 만들면
 *   두 화면의 마커 언어가 갈린다.
 * - 라벨 액션은 `.control-button` 정본. 좁은 폭에 두 액션이 함께 서는 origin /
 *   instance 는 pencil 처럼 보조 액션을 아이콘 전용으로 줄이되, chrome 은 같은
 *   `.control-button` 을 폭만 정사각으로 좁혀 쓴다 (두 번째 버튼 정의 안 만듦).
 * - 액션 아이콘 3종은 `ACTION_ICONS` — 캔버스 컨텍스트 메뉴의 같은 액션과 같은
 *   그림이어야 한다 (registry 주석이 이미 "Properties 패널 Component 섹션" 을
 *   소비처로 적어 두고 있었는데 실제로는 아이콘이 없었다).
 *
 * **액션 가용성은 두 축 (2026-08-30 — Pen.app 번들 실측)**. pencil 은 선택
 * 노드마다 `prototype` (인스턴스) 과 `reusable` (원본) 을 따로 세고, 인스턴스
 * 액션 (Go to component / Detach instance) 과 컴포넌트 액션 (Detach Component
 * ↔ Create Component) 을 **동시에** 노출한다 — 그래서 인스턴스에 3개가 선다.
 * 종전 composition 은 role enum 하나로 갈라 instance 를 먼저 잡았고, 그 결과
 * 인스턴스에서는 컴포넌트 축 액션이 통째로 사라졌다 (다른 컴포넌트의 인스턴스를
 * 원본으로 승격한 노드는 해제 진입점이 아예 없어 되돌릴 수 없었다).
 * 용어도 pencil 을 따른다 — 원본 해제는 "Detach component" 하나로 부른다.
 */
const ComponentIcon = ACTION_ICONS.component;
const GoToOriginIcon = ACTION_ICONS.goToOrigin;
const DetachIcon = ACTION_ICONS.detach;

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
    const isInstance = isEditingSemanticsInstance(element);
    const isOrigin = isEditingSemanticsOrigin(element);
    const label = getEditingSemanticsLabel(role);
    const originId = getEditingSemanticsOriginId(element);
    const originElement = resolveOriginElement(originId, lookupElements);
    const isDetachableInstance = canDetachInstance(element);
    const overrideItems = getEditingSemanticsOverrideItems(element);
    const instanceIds = isOrigin
      ? getEditingSemanticsImpactInstanceIds(element, lookupElements)
      : [];
    // 두 축이 겹치는 노드는 색 마커가 하나뿐이라 (canvas 는 instance 색) 텍스트
    // 라벨이 두 정체를 다 읽어 준다 — 라벨이 역할의 1차 채널이다.
    const roleLabel =
      isInstance && isOrigin ? "Instance · Origin" : (label ?? "Standard");
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

    // 생성/해제 양방향 1개 액션 (pencil `Cmd+Opt+K` 와 같은 토글).
    const handleToggleComponentOrigin = async () => {
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
        <div className="component-semantics-identity" data-role={roleClass}>
          <ComponentIcon aria-hidden="true" size={14} />
          <span
            className="component-semantics-identity-name"
            title={componentName}
          >
            {componentName}
          </span>
          <span className="component-semantics-identity-role">{roleLabel}</span>
        </div>

        <div className="component-semantics-toolbar">
          {isInstance && (
            <>
              <button
                className="control-button"
                disabled={!originElement}
                onClick={handleGoToOrigin}
                type="button"
              >
                <GoToOriginIcon aria-hidden="true" size={14} />
                Go to component
              </button>
              {isDetachableInstance && (
                <button
                  aria-label="Detach instance"
                  className="control-button component-semantics-icon-action"
                  onClick={handleDetachInstance}
                  title="Detach instance"
                  type="button"
                >
                  <DetachIcon aria-hidden="true" size={14} />
                </button>
              )}
            </>
          )}
          {isOrigin && (
            /* 종전의 "Impacts N instances" 행은 이 라벨이 흡수한다 — 같은 수를
               읽는 자리가 둘일 이유가 없다. 0건이면 비활성으로 남겨 "인스턴스가
               아직 없다" 를 계속 보인다. */
            <button
              className="control-button"
              disabled={instanceIds.length === 0}
              onClick={handleSelectInstances}
              type="button"
            >
              <Boxes aria-hidden="true" size={14} />
              Select instances ({instanceIds.length})
            </button>
          )}
          {/* 컴포넌트 축은 인스턴스 축과 독립이라 인스턴스에도 함께 선다. */}
          <button
            className="control-button"
            onClick={handleToggleComponentOrigin}
            type="button"
          >
            <ComponentIcon aria-hidden="true" size={14} />
            {isOrigin ? "Detach component" : "Create component"}
          </button>
        </div>

        {role === "instance" && overrideItems.length > 0 && (
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
      </PropertySection>
    );
  },
);
