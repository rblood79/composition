# ADR-190 Phase 4 / G4 — live builder 검증과 종결

> 본문: [../completed/190-commit-descriptor-emitter-expansion.md](../completed/190-commit-descriptor-emitter-expansion.md) ·
> Phase 3: [190-phase-3-g3-path-classification.md](190-phase-3-g3-path-classification.md)

## 판정

**G4 통과 — Phase 4 완료 (2026-08-24). ADR-190 Implemented.**

실제 Chrome 에서 사람이 하는 것과 같은 조작 (컴포넌트 팔레트 클릭, Delete 키,
⌘Z) 으로 emitter 가 동작함을 확인했다. 프로그램으로 store 를 호출한 probe 가
아니라 **UI 이벤트에서 출발한 경로**다.

## 1. live builder exercise

`localhost:5173` 에서 새 프로젝트 `adr190-live-gate` 를 만들고 조작했다.
계측은 `__composition_COMMIT_LANE_DEBUG__` 와
`__composition_STORE_COMMIT_SINK_DEBUG__` 를 조작 직전 리셋 후 판독했다.

| 조작                              | 경로                        | queue | patchSuccess | fallback | full build | 결과                                      |
| --------------------------------- | --------------------------- | ----: | -----------: | -------: | ---------: | ----------------------------------------- |
| Components 팔레트에서 `text` 클릭 | `addElement` (structure)    |     1 |            1 |        0 |          0 | Text 캔버스 렌더, 히스토리 1/1            |
| 선택 후 `Delete` 키               | `removeElement` (structure) |     1 |            1 |        0 |      **0** | 요소 소멸 + Skia registry 에서도 소멸     |
| `⌘Z`                              | undo (의도적 full rebuild)  |     — |            — |        — |          — | Text 복원 (store·Skia 양쪽), 히스토리 3/4 |

삭제 직후 `getSkiaNode(id)` 가 `false`, undo 후 `true` — store 와 렌더 registry
가 함께 움직였다. 캔버스 스크린샷으로도 소멸·복원을 확인했다.

## 2. Style 패널은 ADR-190 경로가 아니다 (live 확인)

Style 패널의 Width 필드를 실제로 편집했더니 값은 반영됐지만
(`width: 180%`, 캔버스 `702 × 24`) commit lane queue 도 sink 카운터도 0이었다.
store action 을 래핑해 재현했을 때 `updateElementProps` /
`batchUpdateElementProps` / `updateElement` **어느 것도 호출되지 않았다**.

Style 패널은 ADR-187 presentation session → `commitEditorPresentationStyle` →
`runCanonicalMutation` 경로를 쓴다. store action 을 우회하므로 ADR-190 emitter
와 무관하며, Phase 0 §3 에서 코드로 확인한 "두 생산자의 구조적 분리" 가 live
에서도 성립함을 보여준다 (R2 가 실체 없음의 재확인).

> 부수 관찰 (ADR-190 범위 밖): `%` 단위 width 는 ADR-187 commit allowlist 가
> px 만 받으므로 presentation 터미널 descriptor 가 되지 않는다. 값은 반영되지만
> 두 lane 어디에도 진입하지 않는다. ADR-187 영역의 별도 판단 대상이다.

## 3. 발견·수정: 진단 게이트 불일치

live 검증 첫 시도에서 `__composition_COMMIT_LANE_DEBUG__` 는 있는데
`__composition_STORE_COMMIT_SINK_DEBUG__` 만 없었다. commit lane 은
`import.meta.env.DEV || ?adr189Metrics` 인데 sink 는 URL 파라미터만 봤기
때문이다.

카운터를 만든 목적이 "queue 가 0인 이유를 구분" 하는 것인데, 하필 그 구분이
필요한 상황(파라미터 없는 일반 dev 세션)에서 카운터가 없었다. 두 게이트를 같은
식으로 정렬했다.

## 4. before / after 최종 (ADR-190 §Context 대비)

| 축                                       |  before |                   after |
| ---------------------------------------- | ------: | ----------------------: |
| N=5,000 스타일 commit `render.frame` p95 | 73.1ms¹ |               **2.8ms** |
| N=5,000 content record p95               |  69.2ms |                   **0** |
| N=5,000 full DFS visits                  |   5,056 | **0** (subtree build 1) |
| 1,000-node 컨테이너 자식 추가 p95        |  22.3ms |               **1.2ms** |
| 1,000-node 컨테이너 자식 삭제 p95        |  19.4ms |               **1.1ms** |
| 2,000-node 단일 batch 편집 p95           |  22.6ms |               **1.2ms** |
| patch ↔ full rebuild 픽셀 차이           |       — |        **0** (1440×852) |

¹ ADR-189 G0 baseline. Phase 1 에서 같은 스크립트로 emitter 비활성 상태 79.9ms
재실측.

## 5. Gate 종합

| Gate | 조건                                                          | 결과                                                     |
| ---- | ------------------------------------------------------------- | -------------------------------------------------------- |
| G1   | queue·patchSuccess / pixel diff 0 / p95 < 4ms / 이중 큐 회귀  | PASS — 8/8, diff 0, 2.8ms, 정적 계약 6건                 |
| G2   | structure patch 성공 + 신규·삭제 노드 parity / reparent 계약  | PASS — 12/12 정합, reparent 비대상 테스트                |
| G3   | 경로 분류 100% / 대량 mutation 역전 0                         | PASS — 분류 완료, R4 는 임계 불요로 판정 (근거 §Phase 3) |
| G4   | N-tier 재실측 · long task 0 · console error 0 · live exercise | PASS — 본 문서                                           |

## 6. 잔존 (본 ADR 범위 밖)

| 항목                                       | 다음 소유                                        |
| ------------------------------------------ | ------------------------------------------------ |
| commit patcher 의 다중 dirty root 지원     | ADR-189 영역 — 다중 선택·정렬·다중 드래그의 레버 |
| `updateElement` 의 canonical sync 위치     | 별도 리팩터링 (emit 계약 지점 확보)              |
| ADR-187 style allowlist 의 `%` 단위 미수용 | ADR-187 영역                                     |
| instance snapshot batch                    | 다중 root 지원 이후 재검토                       |
