/**
 * FontManagerPanel - 커스텀 폰트 관리 패널
 *
 * 폰트 업로드/조회/삭제를 위한 전용 UI.
 * FontRegistryV2 기반 CRUD + Skia 자동 동기화.
 *
 * 본문은 `FontManagerBody` 공유 — 같은 내용을 Font Family 피커에서 여는
 * 모달(`FontManagerDialog`)도 쓴다.
 */

import { Type } from "lucide-react";
import { PanelHeader } from "../../components";
import { iconProps } from "../../../utils/ui/uiConstants";
import { FONT_LIMITS } from "@composition/shared";
import { FontManagerBody } from "./components/FontManagerBody";
import { useFontRegistry } from "./useFontRegistry";
import "./FontManagerPanel.css";

// 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922)
export function FontManagerPanel() {
  return <FontManagerContent />;
}

function FontManagerContent() {
  const { faceCount } = useFontRegistry();

  return (
    <div className="panel font-manager-panel">
      <PanelHeader
        icon={
          <Type
            size={iconProps.size}
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
          />
        }
        title="Fonts"
        actions={
          <span className="font-count-badge">
            {faceCount}/{FONT_LIMITS.MAX_FACES}
          </span>
        }
      />

      <div className="panel-contents">
        <FontManagerBody />
      </div>
    </div>
  );
}
