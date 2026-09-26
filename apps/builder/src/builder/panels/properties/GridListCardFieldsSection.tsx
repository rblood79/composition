import { memo, useMemo } from "react";

import { PropertyFieldTemplateInput, PropertySection } from "../../components";
import { useStore } from "../../stores";
import { useCollections } from "../../stores/data";
import { useActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { getNodeMap } from "../../stores/canonical/canonicalTraversalHelpers";
import { useCanonicalPropertyElementType } from "./hooks/useCanonicalPropertyRead";
import { fieldsFromOwner } from "./hooks/useOwnerCollectionColumns";
import { readGridListCardFields } from "./gridListCardFields";
import { useI18n } from "@/i18n";

/**
 * ADR-162 Phase 5 — 데이터 GridList 의 「카드 필드」 절. 항목 origin 자손의 연결 가능 prop 마다 ADR-159
 * `PropertyFieldTemplateInput` (컬럼 = 선택된 GridList 의 데이터) 을 붙인다. 쓰기는 origin 문서 노드 —
 * origin 영향 확인은 `updateElementProps` 게이트 (ADR-236 E4) 가 맡는다.
 */
export const GridListCardFieldsSection = memo(
  function GridListCardFieldsSection({ elementId }: { elementId: string }) {
    const { t } = useI18n();
    const document = useActiveCanonicalDocument();
    const collections = useCollections();
    // GridList (ref 는 origin type) 가 아니면 문서를 읽지 않는다 — 모든 선택에 붙는 절.
    const elementType = useCanonicalPropertyElementType(elementId);
    const read = useMemo(
      () =>
        document && elementType === "GridList"
          ? readGridListCardFields(elementId, getNodeMap())
          : null,
      [document, elementId, elementType],
    );
    const fields = useMemo(
      () => (read ? fieldsFromOwner(read.owner, collections) : null),
      [read, collections],
    );
    if (!read || !fields || fields.length === 0 || read.rows.length === 0) {
      return null;
    }
    const columns = fields.map((field) => field.key);

    return (
      <PropertySection title={t("propertiesPanel.cardFieldsSection")}>
        {read.rows.map((row) => (
          <PropertyFieldTemplateInput
            key={`${row.nodeId}:${row.key}`}
            label={`${row.nodeLabel} · ${row.key}`}
            value={row.value}
            columns={columns}
            fields={fields}
            onChange={(next) => {
              void useStore.getState().updateElementProps(row.nodeId, {
                [row.key]: next === "" ? undefined : next,
              });
            }}
          />
        ))}
      </PropertySection>
    );
  },
);
