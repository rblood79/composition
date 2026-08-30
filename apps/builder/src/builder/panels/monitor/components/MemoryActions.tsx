/**
 * MemoryActions Component
 *
 * 메모리 최적화 버튼 및 권장사항 표시
 */

import { RefreshCw, Recycle } from "lucide-react";
import { Button } from "react-aria-components";
import { iconEditProps } from "../../../../utils/ui/uiConstants";

import { translateKey, useOptionalI18n } from "../../../../i18n";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 삭제 아이콘 정본 (`config/actionIcons.ts`). */

interface MemoryActionsProps {
  /** 메모리 최적화 실행 */
  onOptimize: () => void;
  /** 최적화 진행 중 여부 */
  isOptimizing?: boolean;
}

/**
 * 메모리 최적화 버튼. 권장 문구는 섹션 본문의 hint 로 올라갔다 — 종전에는 이 컴포넌트가
 * 문구와 버튼을 `--bg-raised` 카드로 한 번 더 감싸, 섹션 안에 상자가 이중으로 들어갔다.
 */
export function MemoryActions({
  onOptimize,
  isOptimizing = false,
}: MemoryActionsProps) {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `monitor.${key}`, fallback) : fallback;
  return (
    <Button
      className="control-button optimize-button"
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
  );
}
