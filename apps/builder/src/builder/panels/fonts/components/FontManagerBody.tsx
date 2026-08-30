/**
 * FontManagerBody - 폰트 업로드 영역 + 패밀리 목록
 *
 * 폰트 관리 UI 본문 — 업로드 존 + 패밀리별 face 목록. 껍데기(FontManagerDialog)와
 * 분리해 둔 것은 이 본문이 모달 안에서만 살아야 할 이유가 없기 때문이다.
 */

import { Type } from "lucide-react";
import { EmptyState } from "../../../components";
import { FontUploadZone } from "./FontUploadZone";
import { FontFamilyGroup } from "./FontFamilyGroup";
import { useFontRegistry } from "../useFontRegistry";
import "../FontManager.css";
import { useI18n } from "@/i18n";

export function FontManagerBody() {
  const { t } = useI18n();
  const { familyGroups, faceCount, isFull, upload, remove } = useFontRegistry();

  return (
    <>
      <div className="font-upload-wrapper">
        <FontUploadZone onUpload={upload} disabled={isFull} />
      </div>

      {faceCount === 0 ? (
        <EmptyState
          icon={<Type size={48} />}
          message={t("fonts.emptyMessage")}
          description={t("fonts.emptyDescription")}
        />
      ) : (
        Array.from(familyGroups.entries()).map(([family, faces]) => (
          <FontFamilyGroup
            key={family}
            family={family}
            faces={faces}
            onDelete={remove}
          />
        ))
      )}
    </>
  );
}
