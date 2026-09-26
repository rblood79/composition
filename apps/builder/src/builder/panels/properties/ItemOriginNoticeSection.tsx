import { memo, useMemo } from "react";

import { PropertySection } from "../../components";
import { useActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import {
  getAncestors,
  getNodeMap,
} from "../../stores/canonical/canonicalTraversalHelpers";
import { resolveEnclosingItemTemplateOrigin } from "./itemOriginNotice";
import { useI18n } from "@/i18n";
import "./ItemOriginNoticeSection.css";

/**
 * ADR-150 A3' — 데이터 행을 더블클릭하면 그 행을 펼치는 항목 템플릿 origin (Components 페이지) 으로
 * 이동해 선택한다. 그 origin 이나 안쪽 요소를 편집하면 이 origin 을 쓰는 모든 카드 · 행에 퍼진다는
 * 것을 알린다 (ADR-162 Phase 5 「카드 필드」 절과 같은 절 체계).
 */
export const ItemOriginNoticeSection = memo(function ItemOriginNoticeSection({
  elementId,
}: {
  elementId: string;
}) {
  const { t } = useI18n();
  const document = useActiveCanonicalDocument();
  const origin = useMemo(
    () =>
      document
        ? resolveEnclosingItemTemplateOrigin(
            elementId,
            getNodeMap(),
            getAncestors,
          )
        : null,
    [document, elementId],
  );
  if (!origin) return null;
  return (
    <PropertySection title={t("propertiesPanel.itemOriginSection")}>
      <p className="item-origin-notice" data-item-origin-notice={origin.id}>
        {t("propertiesPanel.itemOriginNotice")}
      </p>
    </PropertySection>
  );
});
