# ADR-189 Phase 1 / G1 evidence — commit dirty-root 도출

> 대상: [ADR-189](../189-commit-lane-incremental-record.md) Phase 1.
> 산출: `apps/builder/src/builder/presentation/commitPatchPlan.ts` (+ 동명 테스트 14건).

## 1. 무엇을 만들었나

`createCommitPatchPlan({ mutations, tree, revision })` → rootKey 별
`CommitPatchPlan { rootKey, dirtyRootIds, affectedIds, revision }` 또는
fallback reason. breakdown §Phase 1 의 산출 계약 그대로다.

commit lane 이 presentation lane 위에 **더한 것은 셋뿐**이다:

| 축             | commit lane                                    | presentation lane (ADR-188)     |
| -------------- | ---------------------------------------------- | ------------------------------- |
| structure 편집 | `add`/`remove`/`order` → **부모**가 dirty root | fail-closed (Phase 4 범위 밖)   |
| rootKey 분할   | page/frame 경계로 plan 분할, 전량 성공만 ok    | 동일 (Phase 2 publication 계승) |
| fallback 방향  | **full rebuild** (전부 다시 그림)              | commit-only (아무것도 안 그림)  |

promotion 판정 자체는 **재구현하지 않았다** — `createPresentationLayoutPlan` 과
`getDescriptorUsedSizeEffect`(Phase 1 에서 lane 에 export 추가) 두 심볼만 경유한다.
정적 가드가 이를 고정한다 (테스트 "promotion 판정을 재구현하지 않는다").

## 2. G1 통과 항목

| 조건                                          | 결과                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------- |
| 편집 유형별 dirty-root 가 시각 변화 범위 포함 | PASS — 위치/크기/텍스트/스타일/자식 추가·제거 5유형 fixture (아래 §3) |
| ADR-188 promotion 재사용 (신규 diff 계층 0)   | PASS — 정적 가드 (lane import 필수 + 규칙표 재구현 흔적 0)            |
| 부분 적용 금지                                | PASS — 한 target 실패 시 commit 전체 fail-closed                      |
| 회귀                                          | PASS — presentation 14 파일 96 test, type-check baseline 신규 위반 0  |

## 3. 편집 유형 fixture 실측

트리: `root(flex) > [sidebar(240x100), content(flex) > [text, image(40x40)]]`

| 편집                  | dirtyRootIds | affected 포함      | 판정 근거                                   |
| --------------------- | ------------ | ------------------ | ------------------------------------------- |
| paint-only (`color`)  | `content`    | content+text+image | 승격 없음. 상속 자손은 서브트리로 덮인다    |
| 크기 (`width`)        | `root`       | image·sidebar 포함 | content 가 auto 라 재분배가 root 까지 전파  |
| 크기 + 명시 크기 조상 | `content`    | sidebar **미포함** | 확정 크기 경계에서 승격 정지                |
| 텍스트 (`fontSize`)   | `root`       | image 포함         | content-box 축 승격                         |
| 자식 추가 (`add`)     | `content`    | content 서브트리   | span 길이 변화의 소유자는 부모              |
| 자식 제거 (`remove`)  | `content`    | image **미포함**   | post-commit 트리 + payload.parentId 로 도출 |

fail-closed 4종: `reparent`/`ref`/`slot` → `unsupported-structure-operation` ·
rootKey 미상 → `unknown-root-key` · promotion 입력(nodeById) 부재 →
`missing-tree-node` · mutation 0 → `no-dirty-root`.

## 4. 설계 판정 2건 (구현 중 확정)

- **조상 collapse 는 도출 단계 소속**이다. dirty root 둘이 조상-자손이면 Phase 2
  splice 에서 span 이 겹쳐 이중 기록이 된다. `collapseDescendantRoots` 가 도출
  시점에 자손을 제거한다.
- **`remove` 의 트리는 post-commit** 이다. 대상 노드가 이미 사라졌으므로
  `operation.payload.parentId` 가 1차 단서고, 없으면 부모를 특정할 수 없어
  full rebuild 로 보낸다. 이 계약을 모듈 헤더에 명시했다.

## 5. G1 에서 **하지 않은 것** (정직한 경계)

Gate 문구의 "full 대조 diff 0" 중 **렌더 결과 대조**는 Phase 1 에서 수행할 수
없다 — 대조할 증분 렌더 경로가 아직 없기 때문이다(Phase 2 splice 가 그것을
만든다). Phase 1 이 고정한 것은 **도출 계약**이다: 승격 규칙이 lane 과 동일하고
(정적 가드), affected 가 dirty root 의 서브트리 전체를 덮고, 실패가 전부 full
rebuild 로 수렴한다.

따라서 **렌더 대조 diff 0 은 G2 의 통과 조건으로 이월**한다. G2 문구가 이미
"stream 구조 full 대조 동일"을 포함하므로 게이트 공백은 생기지 않는다.

## 6. 다음

Phase 2(splice)는 **ADR-188 G6 통과 후** 착수한다 (ADR-189 Soft Constraint).
현재 ADR-188 은 Phase 4/G5 까지 Implemented, Phase 5/G6 진행 중이다.
