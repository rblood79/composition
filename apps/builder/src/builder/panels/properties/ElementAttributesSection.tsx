/**
 * ElementAttributesSection — 모든 element 공통의 DOM/CSS 식별 축 (ID · Class Name).
 *
 * **왜 전 타입 공통인가**: `id`/`class` 는 컴포넌트별 편집 계약(catalog `accepts`)이 아니라
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
 * 경로와 동일.
 */

import { Braces } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import {
  PropertyCustomId,
  PropertyInput,
  PropertySection,
} from "../../components";
import { useStore } from "../../stores";
import { useCanonicalPropertyElement } from "./hooks/useCanonicalPropertyRead";

export const ElementAttributesSection = memo(function ElementAttributesSection({
  elementId,
}: {
  elementId: string;
}) {
  const element = useCanonicalPropertyElement(elementId);

  const customId = element?.customId ?? "";
  const className = useMemo(() => {
    const props = (element?.props ?? {}) as Record<string, unknown>;
    return typeof props.className === "string" ? props.className : "";
  }, [element?.props]);

  const handleClassNameChange = useCallback((value: string) => {
    useStore.getState().updateSelectedProperties({
      className: value || undefined,
    });
  }, []);

  if (!element) return null;

  return (
    <PropertySection title="Attributes">
      <PropertyCustomId
        label="ID"
        value={customId}
        elementId={elementId}
        placeholder={`${element.type.toLowerCase()}_1`}
      />
      <PropertyInput
        icon={Braces}
        label="Class Name"
        value={className}
        onChange={handleClassNameChange}
        placeholder="hero-title"
      />
    </PropertySection>
  );
});
