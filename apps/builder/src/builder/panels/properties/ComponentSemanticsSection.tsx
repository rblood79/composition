import { memo, useMemo } from "react";

import { Button as RACButton } from "react-aria-components/Button";

import { PropertySection } from "../../components";
import { ActionTooltipTrigger } from "../../components/ui";
import { iconProps } from "../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../config/actionIcons";
import {
  resolveComponentSemanticsActions,
  toEditingSemanticsTarget,
  type ComponentSemanticsActionId,
} from "../../config/componentSemanticsActions";
import { useStore } from "../../stores";
import { globalToast } from "../../stores/toast";
import { runComponentSemanticsAction } from "../../utils/componentSemanticsRunner";
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
  readStateVariantSelf,
  type StateVariantState,
} from "../../components/stateVariantOrigins";
import {
  useCanonicalPropertyElement,
  useCanonicalPropertyElementsMap,
} from "./hooks/useCanonicalPropertyRead";
import { semanticLabelKeys, translateKey, useI18n } from "@/i18n";
import type { PanelNode } from "../panelNode";

/**
 * Component 섹션 레이아웃 — pencil 어법 두 줄 (2026-09-16 사용자 판정 「제안 A」,
 * 시안 docs/design/properties-panel-inventory 「11 Component 절」).
 *
 * pencil 의 properties 패널은 컴포넌트 정체를 **한 줄**(이름 상자 — 원본은 채움,
 * 인스턴스는 점선 테두리)로 보이고 그 **아래 한 줄**에 액션을 모은다. 종전
 * composition (panel-ui 07, 2026-09-14) 은 액션마다 라벨 + 28 열 아이콘 행을 세워
 * 인스턴스에서 3 행 = 84px 가 액션에 쓰였고, 표준 요소에도 「button_1 · STANDARD」
 * 칩이 섰다 — 바로 아래 Attributes ID 와 같은 이름이라 정보가 0 이었다.
 *
 * 옮겨 온 것은 **배치**뿐이고 크롬은 composition 정본을 쓴다:
 * - 정체 칩은 **원본·인스턴스에만** 선다. 역할은 pencil 과 같은 축 — 원본 = 역할색
 *   채움, 인스턴스 = 역할색 점선 — 에 10 mono 역할 라벨을 더한다 (두 보라
 *   `--editing-semantics-origin` / `-instance` 가 서로 가까워 글자가 1차 채널이다).
 *   색은 캔버스 오버레이 (semanticOverlayColors.ts) · Navigator 점과 같은 토큰.
 * - **액션 줄은 한 줄** (pencil 배치). 인스턴스 축 (Go to component · Detach instance)
 *   은 아이콘 전용 + 툴팁 (단축키는 `commandId` 에서 파생), 컴포넌트 축 (Create ↔
 *   Detach component) 만 글자 — 원본 해제는 인스턴스 전체에 영향이라 이름이 보여야
 *   한다. composition 만 갖는 Select instances 는 아이콘 + 수 배지. 한 줄의 버튼은
 *   전부 `.control-button` 하나 (panel-structure §1 — 아이콘 전용은 폭만 정사각으로
 *   좁힌다; 두 번째 버튼 정의를 만들지 않는다). 최대 조합 (아이콘 2 + 글자 1) 이
 *   217 안에 들어 접힘 분기가 없다.
 * - 액션 아이콘은 `ACTION_ICONS` — 캔버스 컨텍스트 메뉴의 같은 액션과 같은 그림.
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
// 정체 칩 아이콘만 여기서 고른다 — 액션 4종의 아이콘·라벨·순서는
// `COMPONENT_SEMANTICS_ACTIONS` 가 정본이다 (ADR-199).
const ComponentIcon = ACTION_ICONS.component;

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

/** ADR-230 — 상태 변형 origin 의 배지 라벨 키 (정체 칩 · 읽기 전용 표식). */
const STATE_VARIANT_BADGE_KEY: Record<
  StateVariantState,
  | "propertiesPanel.stateVariantSelected"
  | "propertiesPanel.stateVariantDisabled"
  | "propertiesPanel.stateVariantHover"
  | "propertiesPanel.stateVariantPressed"
  | "propertiesPanel.stateVariantFocusVisible"
> = {
  selected: "propertiesPanel.stateVariantSelected",
  disabled: "propertiesPanel.stateVariantDisabled",
  hover: "propertiesPanel.stateVariantHover",
  pressed: "propertiesPanel.stateVariantPressed",
  "focus-visible": "propertiesPanel.stateVariantFocusVisible",
};

function isFrameBodyElement(element: PanelNode): boolean {
  return (
    element.type.toLowerCase() === "body" &&
    getFrameElementMirrorId(element) !== null
  );
}

export const ComponentSemanticsSection = memo(
  function ComponentSemanticsSection({ elementId }: { elementId: string }) {
    const { t } = useI18n();
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
      isInstance && isOrigin
        ? t("propertiesPanel.roleInstanceOrigin")
        : label
          ? translateKey(t, semanticLabelKeys[label] ?? label, label)
          : t("propertiesPanel.roleStandard");
    const roleClass = role ?? "standard";

    if (!element) return null;
    if (isFrameBodyElement(element)) return null;
    const componentName = getComponentDisplayName(element, originElement);
    // ADR-230 — 상태 변형 origin (`ToggleButton/Selected` …) 은 정체 칩에 상태 배지를 더한다.
    //   변형은 default origin 의 그 상태 시각만 소유한다 — 배지 툴팁이 그 계약을 읽어 준다.
    const stateVariant = readStateVariantSelf(element);
    const stateVariantOrigin = stateVariant
      ? resolveOriginElement(stateVariant.variantOf, lookupElements)
      : null;

    // 실행·확인은 `runComponentSemanticsAction` 한 벌이 소유한다 (ADR-199
    // Phase 3) — 이 표면은 자기 element 해석 결과 (canonical property element)
    // 만 넘긴다. 분리 다이얼로그의 표시 이름 규칙이 여기 있던 것이 원본을
    // 되짚는 유일한 자리였고, 이제 그 규칙이 4 표면 공통이다.
    const runInput = () => ({
      targetId: elementId,
      element,
      originElement,
      originId,
    });

    const handleGoToOrigin = () => {
      void runComponentSemanticsAction("go-to-origin", runInput());
    };

    const handleDetachInstance = async () => {
      if (!isDetachableInstance) return;
      await runComponentSemanticsAction("detach-instance", runInput());
    };

    // 생성/해제 양방향 1개 액션 (pencil `Cmd+Opt+K` 와 같은 토글).
    const handleToggleComponentOrigin = async () => {
      await runComponentSemanticsAction("toggle-component-origin", runInput());
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

    // 노출 축의 정본은 `COMPONENT_SEMANTICS_ACTIONS` 다 (ADR-199) — 이 표면은
    // 항목·순서·라벨·아이콘·가용성을 다시 정의하지 않고 읽어서 그린다. 남는
    // 표면 고유 규칙은 하나 — 어느 항목이 아이콘 전용 (인스턴스 축 · Select
    // instances) 이고 어느 항목이 글자 (컴포넌트 축) 인가.
    const semanticsTarget = toEditingSemanticsTarget(element);
    const availability = {
      hasResolvedOrigin: Boolean(originElement),
      instanceCount: instanceIds.length,
      selectionSize: 1,
    };
    const semanticsActions = semanticsTarget
      ? resolveComponentSemanticsActions(
          "properties-panel",
          semanticsTarget,
          availability,
        )
      : [];
    const actionHandlers: Record<ComponentSemanticsActionId, () => void> = {
      "go-to-origin": handleGoToOrigin,
      "detach-instance": () => void handleDetachInstance(),
      "select-instances": handleSelectInstances,
      "toggle-component-origin": () => void handleToggleComponentOrigin(),
    };

    const handleResetOverrideField = (item: EditingSemanticsOverrideItem) => {
      resetInstanceOverrideField(elementId, item.fieldKey, item.descendantPath);
      // (b) 확인 다이얼로그 없이 즉시 실행 — 흐름을 끊지 않되, 실수로 무거운
      // override (특히 dataBinding) 를 날려도 되돌릴 수 있게 undo 액션 토스트를
      // 띄운다. reset 은 history entry 1건이므로 undo() 1회로 정확히 복구된다.
      const isItemsFork = item.fieldKey === "items" && !item.descendantPath;
      const label = isItemsFork
        ? t("propertiesPanel.itemsForkedLabel")
        : item.label;
      globalToast.info(t("propertiesPanel.overrideCleared", { label }), {
        // 같은 필드를 반복해서 reset 해도 매번 회복 안내가 떠야 하므로 쿨다운 무시.
        bypassCooldown: true,
        action: { label: t("errors.undo"), onClick: () => undo() },
      });
    };

    return (
      <PropertySection title="Component">
        {/* 정체 칩 — 원본·인스턴스만. 표준은 Attributes ID 가 같은 이름을 이미 보인다. */}
        {(isInstance || isOrigin) && (
          <div className="fieldset-row">
            <div className="component-semantics-identity" data-role={roleClass}>
              <ComponentIcon aria-hidden="true" size={14} />
              <span
                className="component-semantics-identity-name"
                title={componentName}
              >
                {componentName}
              </span>
              {stateVariant && (
                <span
                  className="component-semantics-identity-state"
                  data-state={stateVariant.state}
                  title={t("propertiesPanel.stateVariantOf", {
                    name: stateVariantOrigin
                      ? getComponentDisplayName(stateVariantOrigin, null)
                      : stateVariant.variantOf,
                  })}
                >
                  {t(STATE_VARIANT_BADGE_KEY[stateVariant.state])}
                </span>
              )}
              <span className="component-semantics-identity-role">
                {roleLabel}
              </span>
            </div>
          </div>
        )}

        {/* 액션 한 줄 — 인스턴스 축은 아이콘 + 툴팁, 컴포넌트 축은 글자, Select
            instances 는 아이콘 + 수 배지. 순서는 레지스트리 배열 그대로. */}
        {semanticsTarget && semanticsActions.length > 0 && (
          <div className="fieldset-row">
            <div className="component-semantics-strip">
              {semanticsActions.map((action) => {
                const actionLabel = action.labelKey(
                  semanticsTarget,
                  availability,
                );
                const label = t(actionLabel.key, actionLabel.params);
                const Icon = action.icon(semanticsTarget);
                // 원본을 못 찾은 인스턴스에서 "원본으로 이동" 은 사라지지 않고
                // 비활성으로 선다 — 자리가 유지돼야 다른 액션 위치가 흔들리지 않는다
                // (컨텍스트 메뉴는 같은 상황에서 항목을 뺀다).
                const enabled =
                  action.isEnabled?.(semanticsTarget, availability) ?? true;
                const onPress = actionHandlers[action.id];

                if (action.id === "toggle-component-origin") {
                  return (
                    <RACButton
                      className="control-button"
                      isDisabled={!enabled}
                      key={action.id}
                      onPress={onPress}
                    >
                      <Icon aria-hidden="true" size={iconProps.size} />
                      {label}
                    </RACButton>
                  );
                }

                return (
                  <ActionTooltipTrigger
                    key={action.id}
                    shortcutId={action.commandId}
                    tooltip={label}
                  >
                    <RACButton
                      aria-label={label}
                      className="control-button"
                      data-icon-only="true"
                      isDisabled={!enabled}
                      onPress={onPress}
                    >
                      <Icon aria-hidden="true" size={iconProps.size} />
                      {action.id === "select-instances" && (
                        <span
                          aria-hidden="true"
                          className="component-semantics-count"
                        >
                          {instanceIds.length}
                        </span>
                      )}
                    </RACButton>
                  </ActionTooltipTrigger>
                );
              })}
            </div>
          </div>
        )}

        {role === "instance" && overrideItems.length > 0 && (
          <fieldset className="properties-aria component-semantics-overrides">
            <legend className="fieldset-legend">{t("propertiesPanel.overridesLegend")}</legend>
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
                        ? t("propertiesPanel.resetForkedItems")
                        : t("propertiesPanel.resetOverride", { label: item.label })
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
                        ? t("propertiesPanel.itemsForkedHint")
                        : undefined
                    }
                    type="button"
                  >
                    <span className="component-semantics-field-dot" />
                    <span className="component-semantics-field-name">
                      {isItemsFork ? t("propertiesPanel.itemsForkedLabel") : item.label}
                    </span>
                    <span className="component-semantics-field-reset">
                      {isItemsFork
                        ? t("propertiesPanel.resetToOrigin")
                        : t("propertiesPanel.reset")}
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
