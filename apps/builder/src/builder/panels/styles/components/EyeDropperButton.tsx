import { Button } from "react-aria-components/Button";
import { ActionTooltipTrigger } from "../../../components/ui/ActionTooltip";
/**
 * EyeDropperButton - 브라우저 EyeDropper API 버튼
 *
 * Chrome 95+, Edge 95+ 지원.
 * 미지원 브라우저에서는 자동 숨김.
 *
 * @since 2026-02-10 Color Picker Phase 3
 */

import { memo, useCallback, useState } from 'react';
import { Pipette } from 'lucide-react';

import './EyeDropperButton.css';

/** EyeDropper API 브라우저 타입 */
interface EyeDropperAPI {
  open(): Promise<{ sRGBHex: string }>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperAPI;
  }
}

const isSupported = typeof window !== 'undefined' && 'EyeDropper' in window;

interface EyeDropperButtonProps {
  onColorPick: (color: string) => void;
}

export const EyeDropperButton = memo(function EyeDropperButton({
  onColorPick,
}: EyeDropperButtonProps) {
  const [picking, setPicking] = useState(false);

  const handleClick = useCallback(async () => {
    if (!window.EyeDropper || picking) return;

    setPicking(true);
    try {
      const dropper = new window.EyeDropper();
      const result = await dropper.open();
      // sRGBHex: "#RRGGBB" → "#RRGGBBFF"로 정규화
      const hex = result.sRGBHex.length === 7
        ? `${result.sRGBHex}FF`
        : result.sRGBHex;
      onColorPick(hex.toUpperCase());
    } catch {
      // 사용자가 ESC로 취소한 경우 — 무시
    } finally {
      setPicking(false);
    }
  }, [onColorPick, picking]);

  if (!isSupported) return null;

  return (
    <ActionTooltipTrigger tooltip="Pick color from screen">
      <Button
        className="eye-dropper-btn"
        onPress={handleClick}
        aria-label="Pick color from screen"
        data-picking={picking || undefined}
      >
        <Pipette size={14} strokeWidth={2} />
      </Button>
    </ActionTooltipTrigger>
  );
});
