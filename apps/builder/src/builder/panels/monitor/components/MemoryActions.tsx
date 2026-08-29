/**
 * MemoryActions Component
 *
 * 메모리 최적화 버튼 및 권장사항 표시
 */

import { RefreshCw, Recycle } from "lucide-react";
import { Button } from "@composition/shared/components";
import { iconEditProps } from "../../../../utils/ui/uiConstants";

import { translateKey, useOptionalI18n } from "../../../../i18n";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */

interface MemoryActionsProps {
  /** 최적화 실행 핸들러 */
  onOptimize: () => void;
  /** 권장사항 메시지 */
  recommendation: string;
  /** 최적화 진행 중 여부 */
  isOptimizing?: boolean;
}

export function MemoryActions({
  onOptimize,
  recommendation,
  isOptimizing = false,
}: MemoryActionsProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `monitor.${key}`, fallback) : fallback;
  return (
    <div className="memory-actions">
      <div className="recommendation">
        <span className="recommendation-text">{recommendation}</span>
      </div>
      <Button
        className="control-button optimize-button"
        size="sm"
        onPress={onOptimize}
        isDisabled={isOptimizing}
        aria-label={localize("optimizeMemory", "Optimize memory")}
      >
        {isOptimizing ? (
          <>
            <RefreshCw size={iconEditProps.size} className="spinning" />
            <span>{localize("optimizing", "Optimizing...")}</span>
          </>
        ) : (
          <>
            <Recycle size={iconEditProps.size} />
            <span>{localize("optimize", "Optimize")}</span>
          </>
        )}
      </Button>
    </div>
  );
}
