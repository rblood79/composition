/**
 * FontManagerBody - 폰트 업로드 영역 + 패밀리 목록
 *
 * 폰트 관리 UI 본문. 도킹 패널(FontManagerPanel)과 모달(FontManagerDialog) 이
 * 같은 본문을 쓴다 — 껍데기(패널 헤더 / 다이얼로그 헤더)만 다르다.
 */

import { Type } from "lucide-react";
import { EmptyState } from "../../../components";
import { FontUploadZone } from "./FontUploadZone";
import { FontFamilyGroup } from "./FontFamilyGroup";
import { useFontRegistry } from "../useFontRegistry";
// 두 껍데기(패널·모달) 가 같은 본문 스타일을 쓰므로 본문이 스타일시트를 소유한다.
import "../FontManagerPanel.css";

export function FontManagerBody() {
  const { familyGroups, faceCount, isFull, upload, remove } = useFontRegistry();

  return (
    <>
      <div className="font-upload-wrapper">
        <FontUploadZone onUpload={upload} disabled={isFull} />
      </div>

      {faceCount === 0 ? (
        <EmptyState
          icon={<Type size={48} />}
          message="등록된 폰트가 없습니다"
          description="폰트 파일(.woff2, .woff, .ttf, .otf)을 드래그하거나 업로드하세요"
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
