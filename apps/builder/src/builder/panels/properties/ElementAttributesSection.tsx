/**
 * ElementAttributesSection — 모든 element 공통의 DOM 축 (ID · Class Name · Aria Label).
 *
 * **왜 전 타입 공통인가**: `id`/`class`/`aria-label` 은 컴포넌트별 편집 계약(catalog `accepts`)이 아니라
 * 모든 DOM 노드가 갖는 구조 축이다 — 퍼블리싱된 문서가 그대로 실어야 하고, 인터랙션
 * 규칙이 대상을 지목할 때도 사람이 읽는 식별자가 그 id 다 (`TargetPicker` 가 customId 를
 * 라벨로 쓴다 — 미설정이면 `Type (uuid8)` 로 보인다).
 *
 * **회귀 경위 (2026-08-29 사용자 지적)**: catalog cutover 후 live 경로가
 * `GenericFieldRenderer` 로 바뀌면서 ID/Class 입력이 **body 에만** 남았다 (PageBodyEditor).
 * 구 경로(`GenericPropertyEditor` / `CatalogInspectorFields`)의 customId 주입은 소비되지
 * 않는다. 그래서 일반 컴포넌트는 id 도 class 도 지정할 수단이 없었다.
 *
 * 값 쓰기: customId 는 `PropertyCustomId` 가 유일성 검증 후 자체 commit (updateElement),
 * className 은 선택 element props 로 write (`updateSelectedProperties`) — body 가 쓰던
 * 경로와 동일. `aria-label` 도 같은 경로이며 emit 은 `resolveAuthoredAriaLabel`
 * (`@composition/shared`) 단일 규칙 — `toRacProps` 의 allowlist(`accepts`) 를 타지 않는다.
 *
 * `aria-label` 을 여기 둔 계기 (2026-09-05): `role="progressbar"` 처럼 **접근 가능한 이름이
 * 필수인** 컴포넌트를 빌더에서 만들면 이름을 넣을 수단이 아예 없었다. 컴포넌트마다 prop 을
 * 늘리는 대신 축을 하나 연다 — 성격이 `id`/`class` 와 같기 때문이다.
 */

import { memo, useCallback, useMemo } from "react";
import { Fingerprint } from "lucide-react";
import {
  PropertyCustomId,
  PropertyInput,
  PropertySection,
} from "../../components";
import { ActionTooltipTrigger, SwatchIconButton } from "../../components/ui";
import { useStore } from "../../stores";
import { globalToast } from "../../stores/toast";
import { iconProps } from "../../../utils/ui/uiConstants";
import { generateCustomId } from "../../utils/idGeneration";
import { resolveUniqueCustomId } from "../../utils/idValidation";
import {
  useCanonicalPropertyChildren,
  useCanonicalPropertyElement,
  useCanonicalPropertyElements,
} from "./hooks/useCanonicalPropertyRead";
import { useEditContract } from "./hooks/useEditContract";
import { needsAuthoredAriaLabel } from "./ariaLabelNeed";
import { useI18n } from "@/i18n";

export const ElementAttributesSection = memo(function ElementAttributesSection({
  elementId,
}: {
  elementId: string;
}) {
  const { t } = useI18n();
  const element = useCanonicalPropertyElement(elementId);
  const children = useCanonicalPropertyChildren(elementId);
  const contract = useEditContract(elementId);
  const allElements = useCanonicalPropertyElements();

  const customId = element?.customId ?? "";
  const className = useMemo(() => {
    const props = (element?.props ?? {}) as Record<string, unknown>;
    return typeof props.className === "string" ? props.className : "";
  }, [element?.props]);

  const ariaLabel = useMemo(() => {
    const props = (element?.props ?? {}) as Record<string, unknown>;
    return typeof props["aria-label"] === "string" ? props["aria-label"] : "";
  }, [element?.props]);

  const handleClassNameChange = useCallback((value: string) => {
    useStore.getState().updateSelectedProperties({
      className: value || undefined,
    });
  }, []);

  const handleAriaLabelChange = useCallback((value: string) => {
    useStore.getState().updateSelectedProperties({
      "aria-label": value.trim() || undefined,
    });
  }, []);

  // ID 행 액션 (2026-09-16 사용자 지시) — 중복 검사 · 중복 제거. 비어 있으면 `type_N` 을
  //   지정하고, 다른 요소와 겹치면 `base_N` 의 빈 번호로 옮긴다 (쓰기는 PropertyCustomId
  //   와 같은 `updateElement`). 고유하면 토스트로 알리기만 한다. 변경은 history 1건이라
  //   토스트의 Undo 가 정확히 되돌린다.
  const handleCheckId = useCallback(() => {
    const type = element?.type ?? "";
    const undo = () => useStore.getState().undo();
    if (!customId) {
      const next = generateCustomId(type, allElements);
      void useStore.getState().updateElement(elementId, { customId: next });
      globalToast.info(t("propertiesPanel.idAssigned", { id: next }), {
        bypassCooldown: true,
        action: { label: t("errors.undo"), onClick: undo },
      });
      return;
    }
    const next = resolveUniqueCustomId(customId, elementId, allElements);
    if (next === customId) {
      globalToast.info(t("propertiesPanel.idUnique", { id: customId }), {
        bypassCooldown: true,
      });
      return;
    }
    void useStore.getState().updateElement(elementId, { customId: next });
    globalToast.info(t("propertiesPanel.idDeduped", { id: next }), {
      bypassCooldown: true,
      action: { label: t("errors.undo"), onClick: undo },
    });
  }, [allElements, customId, element?.type, elementId, t]);

  if (!element) return null;

  // RAC 가 이름을 스스로 만드는 요소 (label prop · 텍스트 콘텐츠) 에는 Aria Label 을 보이지
  //   않는다 — 빈자리 (label 없는 field · 컬렉션 · 아이콘 전용 버튼) 만 (ariaLabelNeed.ts)
  const showAriaLabel = needsAuthoredAriaLabel({
    type: element.type,
    props: element.props as Record<string, unknown> | undefined,
    hasLabelField: contract.fields.some(
      (field) => field.origin === "semantic" && field.key === "label",
    ),
    children,
  });

  // 라벨은 legend (상자 위, Styles 패널과 같은 어법 — 2026-09-15 사용자 판정), 아이콘 prefix
  //   (#, 중괄호, aria) 는 라벨이 있으면 중복이라 뺀다 (panel-ui 07, 2026-09-14).
  return (
    <PropertySection title={t("propertiesPanel.attributes")}>
      <div className="fieldset-row" data-wide="true">
        <PropertyCustomId
          label="ID"
          value={customId}
          elementId={elementId}
          placeholder={`${element.type.toLowerCase()}_1`}
        />
        {/* 행 끝 28 열 — ID 중복 검사/제거 (Data 행의 「새 테이블」 과 같은 자리·크롬) */}
        <div className="fieldset-actions">
          <ActionTooltipTrigger tooltip={t("propertiesPanel.idCheckUnique")}>
            <SwatchIconButton
              aria-label={t("propertiesPanel.idCheckUnique")}
              onPress={handleCheckId}
            >
              <Fingerprint
                aria-hidden="true"
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </SwatchIconButton>
          </ActionTooltipTrigger>
        </div>
      </div>
      <div className="fieldset-row" data-wide="true">
        <PropertyInput
          label="Class Name"
          value={className}
          onChange={handleClassNameChange}
          placeholder={t("propertiesPanel.classNamePlaceholder")}
        />
      </div>
      {showAriaLabel && (
        <div className="fieldset-row" data-wide="true">
          <PropertyInput
            label="Aria Label"
            value={ariaLabel}
            onChange={handleAriaLabelChange}
            placeholder={t("propertiesPanel.ariaLabelPlaceholder")}
          />
        </div>
      )}
    </PropertySection>
  );
});
