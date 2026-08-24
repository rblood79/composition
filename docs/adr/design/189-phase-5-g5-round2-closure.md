# ADR-189 Phase 5 / G5 — Round 2 corrective closure

## 판정

**G5 통과 — Phase 5 Complete (2026-08-24)**

Round 2의 HIGH 3건, MEDIUM 1건, LOW 2건을 코드·실측·문서 경계에서 모두 닫았다.
핵심 판정은 “damage rect를 썼다”가 아니라 commit patch와 content replay 모두에서
전체 문서 `N`에 결합된 탐색/실행을 제거했는지다.

## 결함별 폐쇄

| Review issue             | 수정                                                                   | 재발 방지 증거                                               |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| H1 global span scan      | dirty span의 command 구간에서 `CMD_ELEMENT_BEGIN`만 열거               | `subtreeSpans.entries()`를 throw하도록 막은 회귀 테스트 PASS |
| H2 full command replay   | SpatialIndex 후보 + 조상 closure를 balanced compact sequence로 구성    | N=50/500/5,000에서 target+body만 포함, command 수 `<10` 고정 |
| H3 duration 미판정       | area·duration·command count를 같은 sample에 기록하고 G3 Gate 문구 정정 | 실제 Chrome small/large 각 8회 duration과 command count 기록 |
| M4 structure target 오판 | 새 Chrome 프로젝트에 Button을 추가하고 그 노드 자체를 비교             | Preview 80×40 + Skia selection bounds 80×40, 동일 text/fill  |
| L5 외부 근거 과장        | Vello append와 SkPicture cull rect를 구조 참고로 격하                  | 로컬 counter·pixel oracle만 복잡도/정확성 판정 근거로 명시   |
| L6 문서 구조 drift       | ADR phase 상세를 breakdown/evidence로 이동하고 README 완료 표로 이동   | ADR 본문 필수 7섹션 유지, 상태 인덱스 동기화                 |

## 구현 계약

### Commit patch

- `getSubtreeElementIds()`는 전체 `subtreeSpans` map을 순회하지 않고 dirty command
  span 내부만 읽는다.
- `childrenSpans`도 piece-table cursor metadata로 유지해 variable-length commit
  patch 뒤 compact sequence가 최신 child block 경계를 읽는다.

### Sparse damage playback

- SpatialIndex `queryRect()`가 현재 damage contributor를 고른다.
- 각 후보에서 root까지의 ancestor closure를 구성하고, 원 command span 시작점으로
  sibling/root를 정렬한다.
- 조상 self draw와 `CHILDREN_BEGIN/END`, relevant child subtree만 복사해 balanced
  sequence를 만든다. context/span이 하나라도 불완전하면 `null`을 반환해 full
  rebuild로 수렴한다.
- 실행 시 추가 AABB culling을 하지 않는다. SpatialIndex가 후보를 이미 정했고,
  ancestor AABB를 다시 적용하면 `overflow: visible` descendant를 잘못 탈락시킬 수
  있기 때문이다. 최종 Canvas clip은 damage rect가 소유한다.
- SpatialIndex는 hit bounds index라 그림자·outline·transform 등의 paint outsets를
  완전 열거하지 못한다. 이런 요소 ID를 stream의 `damageUnsafeElementIds`에 O(k)로
  유지하며, 장면에 하나라도 있으면 sparse 진입을 거부하고 full rebuild로 수렴한다.

### Region-synchronized ping-pong surface

- full render 직후 두 surface를 한 번 동기화한다.
- damage render는 standby의 해당 rect만 clear하고 sparse sequence를 그린 뒤 같은
  rect만 반대 surface에 복제한다. commit마다 old snapshot 전면 blit하지 않는다.
- 첫 region `clip + clear + blit`의 cold GPU setup은 full sync에서 1px로 예열하고
  snapshot을 즉시 복원한다. 예열 전 실제 Chrome 첫 sample `31.3ms`가 예열 후
  `0.5ms`로 내려갔으며 후속 7회는 `0.3~~0.5ms`였다.

## 검증 결과

### 정적/단위

- Builder-local Vitest: 3 files / 39 tests PASS.
- N-tier `50/500/5,000`: compact sequence element 수 `2`, command 수 `<10`, full
  stream보다 작음.
- dirty subtree ID 수집: global span-map iteration `0`.
- hit bounds 밖으로 shadow를 그리는 sibling이 있으면 compact sequence를 반환하지
  않고 full fallback을 요구하며, subtree patch 뒤 unsafe ID Set도 원자 교체된다.
- static guard: damage path의 `targetCanvas.clear`, old snapshot 전면 draw,
  `contentNode.renderSkia` 호출 재도입 금지 + region 예열 유지.

### 실제 Builder paint/damage

258 active node fixture의 patch/full pixel oracle:

- small `80 × 80`: patch visits `1`, full build `0`, sparse commands `119`,
  full stream commands `1,533`, fallback `0`.
- large `240 × 240` visible damage: sparse commands `209`, full stream commands
  `1,533`, fallback `0`.
- patch 직후와 reload full rebuild backing buffer `1440 × 852`: differing pixels
  `0`, max/mean channel delta `0`, console error/warning `0/0`.

실제 foreground Chrome의 동일 Button size-tier 8회씩:

| Size        |   area ratio | duration p50 / p95 | sparse command | fallback |
| ----------- | -----------: | -----------------: | -------------: | -------: |
| `80 × 40`   | `0.00017149` |      `0.4 / 0.5ms` |       `11 × 8` |      `0` |
| `240 × 240` | `0.00276234` |      `0.4 / 0.5ms` |       `11 × 8` |      `0` |

면적은 `16.1×` 증가했지만 작은 fixture의 wall-clock은 timer 해상도와 고정 GPU
비용이 지배했다. 따라서 area ratio를 duration ratio로 바꾸어 쓰지 않는다. 실제
duration은 그대로 보존하고, HC1은 command dispatch의 N 분리와 GPU region 경계,
HC2는 pixel oracle로 각각 판정한다.

### 신규 structure node cross-check

- Chrome dashboard에서 새 프로젝트를 만들고 Component panel의 `button`을 실제로
  클릭해 body 아래 `Button`을 추가했다.
- Preview DOM: visible role button `1`, `80 × 40`, text `Button`, green fill,
  radius `6px`.
- Skia: 그 신규 Button에 selection outline, `80 × 40` bounds badge, 같은 text/fill.

## 최종 Gate

- G5-1 global span/command scan 0: PASS.
- G5-2 N-tier sparse command 수 상수: PASS.
- G5-3 actual duration 기록 + cold first-commit 제거: PASS.
- G5-4 신규 structure affected-output DOM↔Skia draw/hit: PASS.
- G5-5 patch/full pixel diff 0: PASS.
- G5-6 hit bounds 밖 paint 장면 sparse 진입 차단: PASS.

Round 2 pending은 0이며 ADR-189의 Implemented 판정을 유지한다.
