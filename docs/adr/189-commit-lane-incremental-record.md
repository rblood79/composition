# ADR-189: 커밋 레인 record 증분화 — dirty-root 서브트리 재기록

## Status

Accepted — 2026-08-22 (Proposed 2026-08-22, 리뷰 round 1 이슈 3건 전건 fixed — reviews/189.md)

Related: [ADR-188 타깃 레이아웃 입력과 Skia 서브트리 패치](completed/188-targeted-layout-and-skia-subtree-patching.md),
[ADR-153 렌더 최적화 measurement-first 도입](completed/153-render-optimization-measurement-first-adoption.md),
[ADR-921 RenderScene·Backend 통합](921-render-scene-backend-integration.md)
(Proposed — command stream 계약이 교차하므로 어느 쪽이든 착수 시 상호 조정)

## Context

canonical mutation(commit) 1회는 여전히 whole-tree 렌더 비용을 지불한다.
`layoutVersion` 전역 증가 → `renderCommands.ts::getCachedCommandStream` cache
miss → `buildRenderCommandStream()` full DFS, 이어서 `SkiaRenderer.ts` 의 content
재기록이 command stream **전량**을 실행하고 `StoreRenderBridge.ts::resync` /
SpatialIndex full snapshot 이 뒤따른다. ADR-153 의 node picture 캐시
(`nodePictureCache.ts`) 가 clean 노드의 재기록을 replay 로 바꿨지만 replay 호출
수 자체가 N 비례이고, content surface 는 전면 재래스터 + `makeImageSnapshot`
CoW 로 남는다.

실측 (2026-07-27, live builder 120Hz): 활성 프레임에서 record.content mean
2.05ms(프레임의 ~40%), 대형 1920 콘텐츠 페이지 p95 3.6ms — **가시 요소 수에
비례**. flush.content 2.91ms(~56%, max 117.9ms 스파이크). JS 조립 축은 2-7%로
이미 캐시가 실효 중이다. 즉 commit 경로의 지배 비용은 CanvasKit 재기록/재래스터
축이며, 요소 수가 늘수록 첫 번째로 frame 예산을 넘는 축이다.

ADR-188 은 이 문제를 **presentation lane**(drag preview) 에서 해결했다 — dirty
root 기반 targeted layout, subtree command span, clip/z-order 4전제, draw·hit
원자 교체 patcher(`subtreeCommandPatch.ts`). 그러나 Phase 4 승격 범위는
`position:absolute` 숫자형 left/top presentation descriptor 로 한정되고,
**canonical commit 자체는 여전히 full rebuild** 다. 본 ADR 은 그 기계를 commit
lane 으로 일반화한다. vello 의 scene fragment 사상(장면을 요소 단위 retained
fragment 로 조립, 변경분만 재인코딩)과 같은 방향이다.

3-domain 판정: 본 결정은 D3 시각 스타일의 Builder(Skia) consumer **내부** 렌더
파이프라인이다. D1 DOM/접근성, D2 Props/API, canonical document/persistence
schema 는 변경하지 않는다. Preview(DOM) 대칭은 시각 결과 무변화로 유지한다
(Generator/Spec 확장 없음 — 해당 체크 비대상).

**Hard Constraints**:

1. commit 1회의 stream 재구축 + content 재기록 비용은 전체 가시 노드 수 `N` 이
   아니라 dirty subtree 크기 `k` 와 damage 면적에 비례해야 한다. splice 로 인한
   후속 span 재계산이 `O(N)` write 로 남으면 이 제약 위반이다 (ADR-188 HC1 의
   "복사 후 덮어쓰기 금지" 와 동형).
2. 시각 결과는 full rebuild 와 **pixel 동일**해야 한다 — 증분 경로와 full 경로의
   대조 diff 0 이 모든 Gate 의 전제다 (D3 symmetric consumer 불변).
3. 120Hz 기준 commit 직후 프레임 p95 4ms 이하, p99 8.33ms 미만 (ADR-187/188 계승).
4. draw bounds 와 `hitBoundsMap`/SpatialIndex 는 같은 revision 을 원자 교체한다
   (ADR-188 HC4 계승). 부분 갱신이 두 소비자를 다른 상태로 두는 중간 프레임 금지.
5. 실패한 patch 는 stale 화면이 아니라 **full rebuild fallback** 으로 수렴한다 —
   presentation lane(commit-only fallback)과 반대 방향의 fail-safe 다. BC 훼손
   없음: 사용자 문서/스키마 영향 0%, 재직렬화 0 파일.

**Soft Constraints**:

- ADR-188 의 patcher/4전제/`SubtreeBuildContext` 를 재사용하고 병렬 패치 기계를
  복제하지 않는다. ADR-188 G6 통과가 Phase 2+ 착수 조건.
- ADR-153 의 node picture 캐시·측정 인프라를 확장 지점으로 사용한다.
- Phase 별 rollback 가능, 실측으로 축소 종결 가능한 구조 (measurement-first).

## Alternatives Considered

### 대안 A: 현상 유지 — ADR-153 picture 캐시로 종결

- 설명: commit 시 full rebuild 를 유지하고 node picture replay 절감에 만족한다.
- 근거: ADR-153 은 Implemented 이고 record 원가를 이미 낮췄다. Chromium 도
  display list 재생성 자체는 저렴하다는 전제로 paint 단계를 운용한다
  ([Chromium compositing docs](https://chromium.googlesource.com/chromium/src/+/main/docs/how_cc_works.md)).
- 위험:
  - 기술: LOW — 변경 없음.
  - 성능: HIGH — record 축이 요소 수 비례로 남는다 (p95 3.6ms 실측, 5k 문서에서
    frame 예산 초과 축). enterprise 대형 문서 목표와 충돌.
  - 유지보수: LOW — 현행 유지.
  - 마이그레이션: LOW — 없음.

### 대안 B: ADR-188 patcher 의 commit lane 일반화 + damage 부분 재기록

- 설명: commit 의 dirty-root 를 targeted layout 결과(ADR-188 Phase 1)에서
  재사용해 (1) command stream 은 subtree span splice(가변 길이 허용)로, (2)
  content surface 는 damage rect clip 부분 재기록으로, (3) hit/SpatialIndex 는
  기존 원자 교체 patcher 로 갱신한다. 실패 시 full rebuild fallback.
- 근거: vello 는 장면을 fragment 단위로 인코딩해 append 조립한다
  ([vello Scene/fragment API](https://docs.rs/vello/latest/vello/struct.Scene.html)).
  Skia `SkPicture` 는 cull rect 기반 부분 playback 을 명시한다
  ([SkPicture reference](https://api.skia.org/classSkPicture.html)). Chromium
  compositor 는 damage tracking 으로 부분 래스터를 수행한다
  ([cc damage/raster](https://chromium.googlesource.com/chromium/src/+/main/docs/how_cc_works.md)).
  세 시스템 모두 "변경분만 재인코딩/재래스터" 를 검증된 경계로 제공한다.
- 위험:
  - 기술: HIGH — 가변 길이 splice 의 span offset 재표현, damage rect 정확성,
    CoW snapshot 과의 상호작용이 미검증.
  - 성능: MEDIUM — 성공 시 `O(k)`. splice 재계산과 damage 산출 자체 비용은 G0
    실측으로 관리.
  - 유지보수: MEDIUM — commit lane 에 patch plan 계약 추가. 단 기계는 ADR-188
    재사용이라 병렬 구조는 없다.
  - 마이그레이션: MEDIUM — full rebuild fallback 이 항상 유효해 rollback 단순.

### 대안 C: retained scene 전면 재설계 (fragment 기반 인코딩 도입 / 렌더러 교체)

- 설명: command stream 을 버리고 요소별 retained fragment scene(vello 형)으로
  전면 전환하거나 vello_hybrid 류 렌더러로 교체한다.
- 근거: vello_hybrid 는 CPU 전처리 + WebGL2 로 동작하는 fragment 기반 렌더러다
  ([vello_hybrid](https://github.com/linebender/vello/tree/main/sparse_strips/vello_hybrid)).
  단 alpha 상태이고 mask/filter 미지원, 텍스트 스택(parley)이 Skia Paragraph 와
  비호환 — 2026-08-22 조사에서 "추적만" 판정.
- 위험:
  - 기술: CRITICAL — 텍스트/필터/마스크 스택 전면 재작성.
  - 성능: MEDIUM — 이론 상한은 높으나 미검증.
  - 유지보수: CRITICAL — CanvasKit 과 병행 기간의 이중 렌더러 drift.
  - 마이그레이션: CRITICAL — 전 컴포넌트 시각 대칭 재검증.

### 대안 D: damage flush 만 도입 (record 는 full 유지)

- 설명: 재기록은 전량 유지하되 flush/래스터만 damage rect 로 제한한다.
- 근거: flush 축(56%)이 record 축(40%)보다 크므로 절반의 효과는 있다.
- 위험:
  - 기술: MEDIUM — CanvasKit CoW snapshot 이 damage 를 존중하는지 미검증
    (ADR-153 R7 동일 축).
  - 성능: HIGH — record 축 3.6ms(p95, 요소 수 비례)가 그대로 남아 HC1 미충족.
  - 유지보수: LOW — 변경 국소.
  - 마이그레이션: LOW — 단순.

### Risk Threshold Check

| 대안 | 기술     | 성능   | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | -------- | ------ | -------- | ------------ | :--------: |
| A    | LOW      | HIGH   | LOW      | LOW          |     1      |
| B    | HIGH     | MEDIUM | MEDIUM   | MEDIUM       |     1      |
| C    | CRITICAL | MEDIUM | CRITICAL | CRITICAL     |     3      |
| D    | MEDIUM   | HIGH   | LOW      | LOW          |     1      |

모든 대안이 HIGH 1+ 이므로 루프 판정: 대안 C 는 CRITICAL 3 으로 근본 접근이
아니라 기각 대상이다. 새 대안 추가 대신, 대안 B 의 HIGH(기술) 를 **Phase 0
측정 게이트 + Phase 축소 종결 경로**(G0 에서 commit 비용이 예산 대비 작으면
Phase 2·3 미착수 종결)로 제한해 수용한다 — ADR-153 이 같은 구조로 위험을
상한한 전례를 따른다.

## Decision

**대안 B: ADR-188 patcher 의 commit lane 일반화 + damage 부분 재기록**을
선택한다.

선택 근거:

1. 실측이 지목한 두 축(record 40-51% / flush 32-56%)을 모두 `k`·damage 비례로
   바꾸는 유일한 대안이면서, 기계는 ADR-188 산출물 재사용이라 신규 표면이 patch
   plan 계약 하나로 제한된다.
2. 잔존 HIGH(기술) 는 "성공해야만 켜지는" 구조로 수용 가능하다 — 실패 조건은
   전부 full rebuild fallback 으로 수렴해 시각 정확성(HC2)이 위험에 노출되지
   않고, G0 측정으로 착수 자체를 기각할 수 있는 종결 경로를 내장한다.
3. vello fragment/Skia partial playback/Chromium damage tracking — 세 외부
   시스템이 같은 경계를 검증했다.

기각 사유:

- **대안 A 기각**: record 축의 요소 수 비례가 그대로 남아 대형 문서에서 frame
  예산 초과의 첫 축이 된다 — enterprise 목표와 충돌. 단 G0 실측이 예산 여유를
  보이면 본 ADR 을 축소 종결하는 형태로 A 를 부분 보존한다.
- **대안 C 기각**: CRITICAL 3. 렌더러 교체/전면 재설계는 본 ADR 범위가 아니라
  장기 추적 항목이다 (2026-08-22 vello 조사 결론과 일치).
- **대안 D 기각(부분 보존)**: 단독으로는 HC1 미충족. 단 그 내용물(damage
  flush)은 대안 B 의 Phase 3 에 포함된다.

> 구현 상세: [189-commit-lane-incremental-record-breakdown.md](design/189-commit-lane-incremental-record-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                         | 심각도 | 대응                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 가변 길이 splice 후 후속 span offset 재계산이 `O(N)` write 로 남아 HC1 을 위장 통과. 경로: `renderCommands.ts::buildRenderCommandStream`, `subtreeCommandPatch.ts`, `skiaFramePipeline.ts`                                                   |  HIGH  | span 을 (segment, offset) 2계층 또는 lazy shift 로 재표현 (breakdown §Phase 2). G2 에서 splice write 수 ≤ 재기록 span 길이 단언 + N=5,000 counter                             |
| R2  | damage rect 누락/과소 산출로 stale pixel 이 화면에 남음 (fallback 이 발동하지 않는 조용한 시각 결함). 경로: `SkiaRenderer.ts` content 재기록, `renderCommands.ts` boundsMap, `skiaFramePipeline.ts`                                          |  HIGH  | damage = 이전∪이후 bounds 합집합 고정 + G3 full-rebuild pixel diff 0 fixture (스크롤/클립/z-order/그림자 경계 포함). 의심 케이스는 damage 확대가 아니라 full rebuild fallback |
| R3  | CanvasKit CoW `makeImageSnapshot` 이 damage clip 과 무관하게 전면 복사로 남아 Phase 3 효과가 0 이 됨. 경로: `SkiaRenderer.ts` flush/snapshot, `createSurface.ts`                                                                             |  MED   | G3 에서 damage 면적 비례성 실측 — 비례하지 않으면 Phase 3 기각, Phase 2 까지로 종결 (ADR-153 R7 과 동일 판정 구조)                                                            |
| R4  | commit dirty-root 도출이 시각 변화 범위를 과소 포함 (조상 재분배/형제 이동 누락) — ADR-188 R1 의 commit lane 재현. 경로: `presentation/invalidation/editorMutationEffectRegistry.ts`, `editorPresentationLayoutLane.ts`, `fullTreeLayout.ts` |  HIGH  | ADR-188 Phase 1 promotion 판정(usedSizeEffect × container 규칙표) 을 그대로 재사용 — 신규 diff 계층 신설 금지. G1 에서 편집 유형 fixture 별 full 대조 diff 0                  |
| R5  | hit/SpatialIndex 부분 갱신과 draw 의 revision 이 어긋나 ghost hit 재발. 경로: `subtreeCommandPatch.ts`, `StoreRenderBridge.ts`, `renderCommands.ts::syncSpatialIndex`                                                                        |  MED   | ADR-188 G4 원자 교체 계약을 commit lane 에 그대로 계승 — patcher 밖 부분 갱신 경로 신설 금지                                                                                  |

## Gates

| Gate | 시점    | 통과 조건                                                                                                     | 실패 시 대안                                    |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| G0   | Phase 0 | N=50/500/5,000 commit 1회 축별 비용 baseline 고정, full rebuild 방문 수 = N negative contract                 | 예산 여유면 축소 종결 (대안 A 부분 보존)        |
| G1   | Phase 1 | 편집 유형별 dirty-root 가 시각 변화 범위 포함 — full 대조 diff 0, ADR-188 promotion 재사용 (신규 diff 계층 0) | 해당 편집 유형 full rebuild 유지                |
| G2   | Phase 2 | splice write ≤ 재기록 span 길이, stream 구조 full 대조 동일, 실패 조건 전부 fallback counter 로 관측          | full rebuild fallback 유지 (부분 승격만)        |
| G3   | Phase 3 | damage 부분 재기록 pixel diff 0 + 비용이 damage 면적 비례 실측                                                | Phase 3 기각, Phase 2 종결                      |
| G4   | Phase 4 | live exercise (편집 유형별) + `/cross-check` 대칭 + 120Hz p95 <4ms / p99 <8.33ms, commit 직후 스파이크 제거   | 대안 A 로 회귀 (fallback 상시화) 후 재설계 검토 |

## Implementation Progress

- **Phase 1 / G1 — Implemented (2026-08-22)**: `commitPatchPlan.ts` 가 commit 의
  dirty-root 를 rootKey 별 `CommitPatchPlan` 으로 도출한다. promotion 판정은
  ADR-188 lane 의 `createPresentationLayoutPlan` + `getDescriptorUsedSizeEffect`
  만 경유하고(정적 가드로 재구현 0 고정), commit lane 이 더한 축은 structure
  (`add`/`remove`/`order` → 부모가 dirty root) · rootKey 분할 · full rebuild 방향
  fail-closed 셋이다. 편집 5유형 fixture + fallback 4종, 14 test PASS,
  presentation 96 test 무회귀, type-check 신규 위반 0.
  **Gate 문구 중 렌더 대조 diff 0 은 G2 로 이월** — 대조할 증분 렌더 경로가
  Phase 2 에서 생기기 때문이며, G2 가 이미 "stream 구조 full 대조 동일"을
  포함해 공백은 없다. [G1 evidence](design/189-phase-1-g1-commit-dirty-root.md)
- **Phase 0 / G0 — 미착수**: commit 1회 축별 비용 baseline. Phase 2 착수 전
  필요 (Phase 2·3 축소 종결 판정의 근거).

## Consequences

### Positive

- commit 경로의 record/flush 비용이 문서 크기와 분리되어 대형 문서 편집
  응답성이 상수화된다 — enterprise 목표의 첫 frame-예산 초과 축 제거.
- ADR-188 presentation lane 과 commit lane 이 같은 patch 기계·revision 계약을
  공유해 두 lane 의 시각/히트 정합을 한 fixture 군으로 검증할 수 있다.
- 실패가 전부 full rebuild 로 수렴하므로 부분 승격(편집 유형별 allowlist)이
  안전하다.

### Negative

- `renderCommands.ts` 의 span 표현이 절대 인덱스에서 2계층으로 바뀌면 기존
  span 소비자 (`skiaFramePipeline.ts` selfSpans 전달, `subtreeCommandPatch.ts`)
  가 계약 변경을 따라야 한다.
- commit 경로에 patch plan 분기가 생겨 full/증분 두 경로의 동작 동일성을
  지속 검증해야 한다 (G2 대조 fixture 유지 비용).
- ADR-188 G6 이전에는 Phase 2+ 를 착수할 수 없어 완결까지 선행 의존이 있다.
