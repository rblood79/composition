// @vitest-environment node
/**
 * ADR-158 — 등재 capability 의 prop 이 **실제로 컴포넌트에 닿는가**.
 *
 * **Why (2026-08-16 라이브 실측)**: `CAPABILITY_REGISTRY.Modal.open` 은
 * `racRef: "Modal.md — ModalOverlayProps.isOpen (controlled)"` 로 등재돼 있었지만,
 * catalog cutover 경로의 `Modal.binding.accepts` 에 `isOpen` 이 없었다. `toRacProps`
 * 는 `accepts` 에 선언된 키만 emit 하므로 **그 prop 은 RAC 에 영원히 도달하지
 * 않는다**. dispatcher 는 성공을 돌려주고 화면은 그대로 — G2 modal open 이 여기서
 * 막혔다.
 *
 * racRef 는 "RAC 에 그런 controlled prop 이 있다" 는 증빙이지 "우리 렌더 경로가
 * 그걸 전달한다" 는 증빙이 아니다. G1 이 검증한 것과 실제 배선 사이의 이 틈을
 * 여기서 기계로 닫는다.
 *
 * 판정 범위 — **catalog cutover 타입의 non-style prop 만**:
 * - `style.*` capability(공통 show/hide/toggle)는 `props.style` 이 전 렌더러에
 *   전달되므로(ADR-907 Layer C) binding accepts 와 무관하다.
 * - cutover 되지 않은 타입은 per-component `rendererMap` 이 렌더하며 각 renderer 가
 *   `element.props` 를 직접 읽는다 — accepts 게이트를 거치지 않는다.
 * - `imperative: true` 는 prop 이 아니라 DOM ref 경유라 대상이 아니다.
 */
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_REGISTRY,
  isCatalogCutover,
  getPrimitiveBinding,
} from "@composition/shared";
import {
  DELEGATING_INTERNAL_RENDERERS,
  DELEGATING_RAC_RENDERERS,
} from "../../../../preview/components/canonicalRendererRegistry";

interface Unreachable {
  type: string;
  capability: string;
  prop: string;
  racRef: string;
}

function collectUnreachable(): Unreachable[] {
  const out: Unreachable[] = [];

  for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY)) {
    if (!isCatalogCutover(type)) continue;

    const binding = getPrimitiveBinding(type);
    if (!binding) continue;

    // rendererMap 위임 경로는 `accepts` 게이트를 안 거친다 — render{Type} 이
    // `element.props` 를 직접 읽으므로 선언되지 않은 prop 도 도달한다.
    const isDelegating =
      (binding.source.kind === "internal" &&
        DELEGATING_INTERNAL_RENDERERS.has(binding.source.renderer)) ||
      (binding.source.kind === "rac" && DELEGATING_RAC_RENDERERS.has(type));
    if (isDelegating) continue;

    const accepts = binding.props?.accepts ?? {};

    for (const [capability, def] of Object.entries(entry.capabilities)) {
      if (def.imperative) continue;
      if (!def.prop || def.prop.startsWith("style.")) continue;
      if (Object.prototype.hasOwnProperty.call(accepts, def.prop)) continue;
      out.push({ type, capability, prop: def.prop, racRef: def.racRef });
    }
  }
  return out;
}

describe("capability prop 이 렌더 경로까지 닿는다", () => {
  it("catalog cutover 타입의 등재 capability prop 은 binding 이 받는다", () => {
    expect(
      collectUnreachable(),
      "capability 는 등재됐는데 `toRacProps` 가 emit 하지 않는 prop 이다 — " +
        "dispatcher 가 patch 해도 컴포넌트에 도달하지 않아 '눌렀는데 아무 일도 " +
        "없다' 가 된다. 해당 `{type}.binding.ts` 의 `accepts` 에 prop 을 추가하거나, " +
        "전달 경로가 없다면 capability 를 `deferred` 로 내린다.",
    ).toEqual([]);
  });

  it("판정 대상이 비어 있지 않다 (게이트 무력화 감지)", () => {
    // cutover 판정이나 registry 파싱이 깨지면 위 단언이 조용히 통과한다.
    const covered = Object.entries(CAPABILITY_REGISTRY).filter(
      ([type, entry]) =>
        isCatalogCutover(type) &&
        Object.values(entry.capabilities).some(
          (d) => d.prop && !d.prop.startsWith("style.") && !d.imperative,
        ),
    );
    expect(covered.length).toBeGreaterThanOrEqual(3);
  });
});
