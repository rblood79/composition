/**
 * MemoryActions Component
 *
 * 메모리 최적화 버튼 및 권장사항 표시
 */

import { RefreshCw } from "lucide-react";
import { Button } from "@composition/shared/components";
import { iconEditProps } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */
const DeleteIcon = ACTION_ICONS.delete;

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
  return (
    <div className="memory-actions">
      <div className="recommendation">
        <span className="recommendation-text">{recommendation}</span>
      </div>
      <Button
        className="optimize-button"
        size="sm"
        onPress={onOptimize}
        isDisabled={isOptimizing}
        aria-label="Optimize memory"
      >
        {isOptimizing ? (
          <>
            <RefreshCw size={iconEditProps.size} className="spinning" />
            <span>Optimizing...</span>
          </>
        ) : (
          <>
            <DeleteIcon size={iconEditProps.size} />
            <span>Optimize</span>
          </>
        )}
      </Button>
    </div>
  );
}
