# ADR-188 Phase 2 — Typed publication channel 및 delta overlay

## 범위

Phase 2는 layout publisher의 canonical-full과 presentation-targeted publication을
분리하고, targeted lane이 canonical per-root map을 복사하지 않는 소비 계약을 고정했다.
Skia command span/hit-test patch(Phase 3)와 ADR-187 runtime 연결(Phase 4)은 이 evidence의
범위가 아니다.

## 구현

- `editorLayoutPublication.ts`
  - `LayoutPublication` union과 `canonical-full`/`presentation-targeted` typed value를
    추가했다.
  - targeted publication은 `layoutDelta`, `presentationRevision`,
    `baseCanonicalRevision`, `planSequence`만 보유한다.
  - `createLayoutOverlay()`는 `resolve(id) = delta.get(id) ?? base.get(id)`를 사용하고
    base를 복사하거나 merged map을 만들지 않는다.
  - `PresentationLayoutPublicationStore.applyTargetedGroup()`은 rootKey 중복,
    cross-root node, base revision 불일치, revision 역행, canonical base 부재를 전부
    사전 검사한 뒤 성공할 때만 overlay/revision을 함께 commit한다.
  - `LayoutPublicationChannel`은 canonical listener와 targeted listener를 별도 lane으로
    유지한다. canonical-full은 새 canonical version에서 기존 overlay를 retire하고,
    targeted 실패는 listener와 revision에 아무것도 기록하지 않는다.
- `editorPresentationLayoutLane.ts`
  - 기존 `new Map(previousLayoutMap)` merge를 제거하고 affected 값만 `layoutDelta`에
    기록한다. `writeCount`가 실제 delta write 수를 노출한다.
  - `PresentationLayoutTreeIndex.rootKeyByNodeId`를 통해 plan을 rootKey별 publication으로
    분할하며 root key를 알 수 없으면 fail-closed한다.
- `layoutRootKey.ts`
  - `page_id ?? getFrameElementMirrorId(body) ?? body.id`를 단일 helper로 만들고
    `useLayoutPublisher`, `layoutCache`, `fullTreeLayout`가 같은 helper를 사용한다.
  - targeted lane은 `getSharedLayoutMap()` 전역 병합 map을 base로 참조하지 않는다.

## G2 검증

| 항목                                        | 결과                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| canonical-full / presentation-targeted 분리 | channel listener 분리 테스트 PASS                                                                                  |
| base map 복사 0                             | `layoutDelta` write count 및 overlay identity 테스트 PASS                                                          |
| write 상한                                  | `writeCount === 1` fixture, delta 외 node 미기록 PASS                                                              |
| rootKey 경계                                | page/frame 2-root partition 및 cross-root fail-closed PASS                                                         |
| revision                                    | root별 단조 증가·base revision 일치 검사 PASS                                                                      |
| group 원자성                                | 한 publication 거부 시 다른 root revision도 미기록, 동일 plan retry PASS                                           |
| full-sync 금지                              | publication static guard에서 `layoutVersion`, `onLayoutPublished`, `resync(true)`, `getSharedLayoutMap()` 0건 PASS |

## 검증 명령

- `pnpm exec vitest run apps/builder/src/builder/presentation/editorPresentationLayoutLane.test.ts apps/builder/src/builder/presentation/editorLayoutPublication.static.test.ts apps/builder/src/builder/workspace/canvas/hooks/useLayoutPublisher.static.test.ts apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.static.test.ts apps/builder/src/builder/workspace/canvas/layout/layoutRootKey.test.ts` — 5 files / 29 tests PASS
- `pnpm run codex:typecheck` — baseline 43 known errors, new violation 0
- `git diff --check` — PASS

## 후속 경계

현재 production Skia consumer는 targeted channel을 아직 구독하지 않는다. Phase 3에서
command span/hit-test snapshot을 추가하고 Phase 4에서 ADR-187 layout allowlist만 이
channel에 연결한다. 따라서 이번 단계만으로 기존 full publisher의 global sync 동작을
변경하지 않는다.
