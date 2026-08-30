/**
 * MorphIcon — 아이콘 종류에 무관한 형태 전환 (ADR-197 Phase 1)
 *
 * `icon` 이 바뀌면 두 형태 사이를 spring 으로 잇는다. lucide-react 컴포넌트와
 * 같은 presentation prop (`size` / `strokeWidth` / `color`) 을 받으므로
 * `iconProps` 스프레드를 그대로 쓸 수 있다.
 *
 * DOM 은 lucide-react 의 다중 `<path>/<circle>` 대신 **단일 `<path>`** 다
 * (subpath 는 `d` 안의 `M` 으로 이어진다) — 이것이 morph 의 write contract 이고,
 * 크롬 CSS 가 svg 자식 구조를 참조하지 않는다는 것은 Phase 0 재grep 으로 확인했다.
 *
 * `d` 는 마운트 시점 값으로 **얼려서** JSX 에 둔다. 매 render 마다 목표의 canonical
 * `d` 를 내려보내면 React 가 전환 시작 프레임에서 목표 형태를 먼저 써버려 driver 의
 * 애니메이션을 앞질러 간다 — 마운트 후의 `d` 는 driver 만 쓴다.
 *
 * 접근성: 기본 `reducedMotion: "user"` — OS 의 동작 줄이기가 켜져 있으면 전환이
 * 프레임 0 의 즉시 교체가 된다 (upstream driver 기본값은 `"never"` 이므로 여기서
 * 뒤집는다). `"never"` 는 호출부가 명시할 때만.
 */

import { useEffect, useRef, useState } from "react";
import type { Morph, MorphOptions, ReducedMotionMode } from "./dom/index";
import { createMorph } from "./dom/index";
import type { SpringPreset } from "./core/spring";
import type { MorphIconInput } from "./iconNodes";
import { resolveIconInput, safeCanonicalD } from "./iconNodes";

export interface MorphIconProps {
  /** 레지스트리 이름 (예: `"chevron-down"`) 또는 IconNode 직접 전달. */
  icon: MorphIconInput;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  /** 전환 물리. 기본 `"smooth"` (임계 감쇠 — overshoot 0). */
  spring?: SpringPreset | MorphOptions;
  /** 기본 `"user"`. */
  reducedMotion?: ReducedMotionMode;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
}

export function MorphIcon({
  icon,
  size = 24,
  strokeWidth = 2,
  color = "currentColor",
  className,
  spring = "smooth",
  reducedMotion = "user",
  "aria-hidden": ariaHidden = true,
  "aria-label": ariaLabel,
}: MorphIconProps) {
  const node = resolveIconInput(icon);

  // 마운트 시점 값 묶음 (지연 초기화 1회) — d 를 얼리는 자리이자 driver 의 출발점.
  // 그릴 수 없는 입력으로 마운트되면 렌더 0 이고 그 상태가 유지된다. 조건부로
  // 나타나는 아이콘은 호출부가 마운트를 나누거나 `key` 로 교체한다.
  const [mount] = useState(() => ({
    node,
    d: node ? safeCanonicalD(node) : null,
    reducedMotion,
  }));
  const morphRef = useRef<Morph | null>(null);
  const targetRef = useRef(mount.node);
  const pathRef = useRef<SVGPathElement | null>(null);

  // driver 는 **effect** 로 붙인다 (콜백 ref 아님). 빌더 패널은 `<Activity>` 안에
  // 살아서 (layout/PanelWorkspace.tsx) 닫힌 동안 effect 가 해제되고 다시 열릴 때
  // 재실행된다 — 콜백 ref 로 붙이면 숨은 채 마운트된 패널에서 driver 가 영영
  // 생기지 않아 아이콘이 마운트 형태에 고정된다 (2026-08-30 라이브 실측).
  // 아래 세 effect 는 선언 순서가 계약이다: 생성 → 정책 → 목표.
  useEffect(() => {
    const el = pathRef.current;
    const first = targetRef.current;
    if (!el || !first) return;
    const morph = createMorph(el, first, {
      reducedMotion: mount.reducedMotion,
    });
    morphRef.current = morph;
    return () => {
      morph.destroy();
      morphRef.current = null;
    };
  }, [mount]);

  useEffect(() => {
    if (morphRef.current) morphRef.current.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    const morph = morphRef.current;
    const previous = targetRef.current;
    targetRef.current = node;
    if (!morph || !node || node === previous) return;
    morph.morphTo(node, spring);
    // spring 은 전환 물리라 의존성이 아니다 (다음 전환부터 적용).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  if (!node || mount.d === null) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
      aria-label={ariaLabel}
    >
      <path ref={pathRef} d={mount.d} />
    </svg>
  );
}
