/**
 * ADR-190 Phase 1 — generic canonical store commit 의 descriptor 변환.
 *
 * ADR-189 가 만든 sparse commit lane 의 진입점은 presentation session 의 typed
 * 터미널 descriptor 하나뿐이었다. 그래서 `updateElementProps` 로 들어오는 편집
 * (Properties 패널 / 캔버스 텍스트 / AI tool / preview ingress) 은 patch queue 에
 * 진입조차 못 하고 매번 full DFS rebuild 를 탔다 (N=5,000 에서 73.1ms).
 *
 * 본 모듈은 그 patch 를 `style.patch` descriptor 로 **서술만** 한다. dirty-root
 * 도출과 splice 는 기존 소비자(`createCommitPatchPlan` → subtree patcher)가
 * 그대로 소유한다.
 *
 * **fail-closed 가 이 모듈의 본질** (ADR-190 R1): 조금이라도 해석이 불확실하면
 * `null` 을 반환해 full rebuild 로 보낸다. 잘못 emit 하면 dirty root 가 과소
 * 산출되어 화면에 stale 픽셀이 남지만, emit 하지 않으면 최악이 오늘의 성능이다.
 * 두 실패의 비용이 비대칭이므로 판정은 항상 보수적이어야 한다.
 */

import { isRenderProjectionId } from "../projection/renderProjectionIds";
import type {
  EditorMutationDescriptor,
  EditorMutationPropagation,
} from "./editorPresentationTypes";
import { getEditorMutationEffectRule } from "./invalidation/editorMutationEffectRegistry";

/**
 * `updateElementProps` 의 props patch 를 style.patch descriptor 로 변환한다.
 *
 * @returns descriptor, 또는 sparse lane 으로 보낼 수 없는 입력이면 `null`
 *   (호출자는 이 경우 기존 full rebuild 경로를 그대로 둔다)
 */
export function createStoreStyleCommitDescriptor(input: {
  readonly elementId: string;
  readonly patch: Readonly<Record<string, unknown>>;
}): EditorMutationDescriptor | null {
  // projected id 는 canonical 문서에 없다 (ADR-135) — dirty root 를 특정할 수 없다.
  if (isRenderProjectionId(input.elementId)) return null;

  const patchKeys = Object.keys(input.patch);
  // prop 축(label/items/size 등)은 style.patch 로 서술할 수 없다. 하나라도
  // 섞이면 commit 전체를 거부한다 — 일부만 patch 하면 한 프레임에 두 경로가
  // 섞여 revision 원자성이 깨진다 (ADR-189 HC4).
  if (patchKeys.length !== 1 || patchKeys[0] !== "style") return null;

  const style = input.patch.style;
  if (!isPlainRecord(style)) return null;

  const styleKeys = Object.keys(style);
  if (styleKeys.length === 0) return null;

  let propagation: EditorMutationPropagation = "self";
  for (const key of styleKeys) {
    const rule = getEditorMutationEffectRule("style", key);
    // 규칙이 없는 키는 used-size 승격 판정에서 조용히 "none" 으로 축소되어
    // dirty root 가 부모로 올라가야 할 때도 안 올라간다. 미등재 키는 emit 하지
    // 않는다 — 신규 style 키는 registry 등재가 sparse lane 진입의 전제다.
    if (!rule) return null;
    // 상속 전파 키가 하나라도 있으면 전체를 inherited-subtree 로 승격한다.
    // 좁은 쪽(self)으로 축소하면 자손이 갱신되지 않는다.
    if (rule.propagation === "inherited-subtree") {
      propagation = "inherited-subtree";
    }
  }

  const target = {
    kind: "canonical-node",
    nodeId: input.elementId,
  } as const;

  return propagation === "inherited-subtree"
    ? { patch: { ...style }, propagation, target, type: "style.patch" }
    : { patch: { ...style }, target, type: "style.patch" };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
