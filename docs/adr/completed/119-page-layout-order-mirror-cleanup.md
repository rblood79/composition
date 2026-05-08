# ADR-119: Page/Layout order mirror 제거 및 canonical source-order 통합

## Status

Implemented — 2026-05-08

## Context

ADR-116 이후 IndexedDB `documents` objectStore와 in-memory canonical store가
`CompositionDocument`를 project primary persistence로 사용한다. ADR-118은
Element sibling order를 parent `children[]` index로 전환하고 `Element.order_num`을
제거하는 방향을 확정했지만, page 생성 body payload에 `Element.order_num` residual이
남아 있는 것이 확인됐다. ADR-119는 page/layout order cleanup에 들어가기 전에 이
Element residual을 Phase 0에서 닫고, 남은 page/layout order compatibility 예외를
제거한다.

현재 `documents` objectStore 자체에는 `order_num` 컬럼이 없다. 중복은 다음 세
위치에서 발생한다.

1. `pages.order_num`과 IndexedDB `pages.order_num` index.
2. `layouts.order_num`과 IndexedDB `layouts.order_num` index.
3. canonical page/layout node `metadata.order_num`.

이 세 값은 모두 `CompositionDocument.children[]` source order에서 파생 가능하다.
특히 `metadata`는 adapter/debug/round-trip 전용이어야 하며 runtime consumer의
primary source가 되면 안 된다. 따라서 page/layout order도 Element order와 같은
원칙으로 canonical child index에 수렴시킨다.

**Hard Constraints**:

1. page order의 primary source는 `CompositionDocument.children[]` 안의 page-like
   presentation node source order다.
2. nested PageTree sibling order는 parent별 별도 order field가 아니라, document root
   page-like source order를 `parent_id` sibling subsequence로 projection한 결과다.
3. layout/reusable frame order의 primary source는 `CompositionDocument.children[]`
   안의 reusable frame node source order다.
4. `pages.order_num`, `layouts.order_num`, page/layout `metadata.order_num`은 runtime
   ordering decision의 primary key가 되면 안 된다.
5. Home/non-deletable page identity는 order position이 아니라 slug `/` 또는 explicit
   page identity로 판정한다.
6. DB/API compatibility가 필요한 동안에도 page/layout mirror order는 canonical source
   order에서 call-time 파생해야 하며 저장된 mirror를 다시 primary로 읽지 않는다.
7. 신규 Element 생성, page bootstrap, history/persistence path는 `Element.order_num`을
   다시 쓰면 안 된다. Phase 0에서 residual hit를 제거하거나 ADR-118 follow-up blocker로
   명시한다.
8. IndexedDB index 제거는 `DB_VERSION` bump와 metaStore test를 동반한다.
9. Supabase physical schema 컬럼 제거는 별도 migration 승인 없이는 수행하지 않는다.

**Soft Constraints**:

- ADR-118 직후의 Element order cleanup과 섞어 회귀 원인을 흐리지 않는다.
- PageTree/Frames tree UX는 한 번에 바꾸지 않고 read cutover 후 write cleanup으로 나눈다.
- project sync/cloud payload는 Supabase schema migration 전까지 compatibility field를
  파생해 보낼 수 있다.
- Table/collection component data의 `order_num`은 이 ADR 범위 밖이다.

## Alternatives Considered

### 대안 A: page/layout `order_num` 예외 유지

- 설명: ADR-118 상태를 유지하고 page/layout만 `order_num` mirror를 계속 저장한다.
- 근거: 변경량이 가장 작고 IndexedDB/API schema 변경이 없다.
- 위험:
  - 기술: M — canonical source order와 mirror order drift를 계속 방치한다.
  - 성능: L — 기존 sort/index 비용을 유지한다.
  - 유지보수: H — Element와 page/layout order 규칙이 갈라져 매번 예외를 설명해야 한다.
  - 마이그레이션: L — 기존 데이터와 가장 가깝다.

### 대안 B: `metadata.order_num`을 canonical primary로 승격

- 설명: `pages.order_num`/`layouts.order_num`은 제거하되, document 내부
  `metadata.order_num`을 page/layout order source로 사용한다.
- 근거: `documents` store 안에 이미 값이 있으므로 DB table duplication은 줄어든다.
- 위험:
  - 기술: H — `metadata`를 runtime source로 승격해 canonical format 규칙을 깨뜨린다.
  - 성능: L — metadata sort 자체는 작다.
  - 유지보수: H — `children[]`와 metadata 중 어느 쪽이 진짜 순서인지 다시 불명확해진다.
  - 마이그레이션: M — pages/layouts row migration은 줄지만 metadata cleanup debt가 남는다.

### 대안 C: `CompositionDocument.children[]` source order로 완전 수렴

- 설명: page/layout order read/write를 canonical children source order로 전환하고,
  `pages.order_num`, `layouts.order_num`, `metadata.order_num`을 compatibility boundary에서
  파생하다가 제거한다.
- 근거: ADR-116/118의 최종 SSOT 방향과 일치한다. Element/page/layout order 판단이
  모두 canonical child index로 통일된다.
- 위험:
  - 기술: M — PageTree, nested sibling projection, Frames tree, preview routing,
    project sync, DB adapter를 함께 정리해야 한다.
  - 성능: L — source order projection은 기존 sort/index보다 단순하다.
  - 유지보수: L — order 규칙이 하나로 줄어든다.
  - 마이그레이션: M — IndexedDB index 제거와 API compatibility boundary 정리가 필요하다.

### 대안 D: one-shot DB/API schema purge

- 설명: local IndexedDB와 Supabase physical schema에서 page/layout `order_num` 컬럼까지
  한 번에 제거한다.
- 근거: 최종 상태에 가장 빨리 도달한다.
- 위험:
  - 기술: H — cloud sync, existing projects, tests가 동시에 깨질 수 있다.
  - 성능: L — 최종 성능은 단순하다.
  - 유지보수: M — 완료 후에는 단순하지만 cutover 중 fallback이 부족하다.
  - 마이그레이션: H — Supabase migration과 배포 순서가 필요하다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | H        | L            |     1      |
| B    | H    | L    | H        | M            |     2      |
| C    | M    | L    | L        | M            |     0      |
| D    | H    | L    | M        | H            |     2      |

루프 판정: 대안 A/B/D는 HIGH 위험이 1개 이상이므로 primary path로 채택하지 않는다.
대안 C는 모든 축이 MEDIUM 이하이고, Supabase physical schema 제거를 별도 gate로
분리해 runtime cutover 위험을 낮춘다.

## Decision

**대안 C: `CompositionDocument.children[]` source order로 완전 수렴**을 선택한다.

선택 근거:

1. `documents` store가 canonical primary인 현재 구조와 일치한다.
2. `metadata.order_num`을 primary로 승격하지 않아 canonical format 규칙을 보존한다.
3. Element/page/layout order 판단을 모두 parent/root `children[]` index로 통일하고,
   nested page sibling order도 root page-like source order의 projection으로 고정한다.
4. Supabase schema 제거를 별도 migration decision으로 분리해 local runtime cleanup을
   먼저 안전하게 완료할 수 있다.

기각 사유:

- **대안 A 기각**: page/layout 예외를 계속 두면 ADR-118 이후에도 order drift 설명과
  allowlist 관리가 남는다.
- **대안 B 기각**: `metadata`를 primary로 읽는 순간 canonical source order가 다시
  mirror field와 경쟁한다.
- **대안 D 기각**: local IndexedDB cleanup과 cloud schema migration을 한 번에 묶어
  rollback surface를 불필요하게 키운다.

> 구현 상세: [119-page-layout-order-mirror-cleanup-breakdown.md](../design/119-page-layout-order-mirror-cleanup-breakdown.md)
> 구현 인벤토리:
> [119-page-layout-order-inventory.md](../design/119-page-layout-order-inventory.md)

## Implementation

2026-05-08에 G0-G6를 완료했다.

- PageTree read/write는 `orderNum` payload를 제거하고 ordered id list와
  `parentId`로 canonical root page source order를 갱신한다. nested sibling
  reorder는 parent별 sibling subsequence를 기존 root page source slots에
  merge한다.
- page create/bootstrap, AddPageDialog/PageParentSelector URL helper, Preview
  `RuntimePage`, shared render model에서 page `order_num` runtime payload를
  제거했다.
- reusable frame/layout projection과 invalidation fingerprint에서
  `layouts.order_num`을 제거하고 root reusable frame source order를 사용한다.
- page/layout canonical metadata 생성 경로에서 `metadata.order_num`을 제거하고
  기존 stale metadata도 update boundary에서 strip한다.
- IndexedDB `DB_VERSION`을 13으로 올리고 `pages.order_num`/`layouts.order_num`
  index 생성과 재생성을 제거했다. 기존 index는 upgrade에서 삭제하며, 기존
  `pages`/`layouts`/`elements` row와 `documents` canonical node metadata에
  남은 stale `order_num`/`orderNum` payload도 v13 upgrade에서 제거한다.
- Supabase physical column은 유지하되, `projectSync` cloud upload에서만 local
  page source index를 call-time derived compatibility field로 보낸다.
- `.agents` order 규칙은 page/layout 예외 유지가 아니라 adapter compatibility
  boundary로 갱신했다.

## Scope Clarification

ADR-119의 완료는 repo 전체에서 `order_num` 문자열을 0건으로 만드는 것이 아니라,
page/layout/Element runtime order source에서 `order_num` mirror를 제거하는 것이다.
잔존 `order_num` hit는 다음으로 한정한다.

- Supabase physical schema compatibility type 또는 call-time derived upload field.
- IndexedDB v13 stale value/index 제거 guard.
- page/layout metadata stale payload strip guard.
- legacy export fixture coverage.
- Table/collection component data model의 별도 order field.

2026-05-08 실제 Builder project
`394ad236-73cd-40c4-91f1-ee57bc699e41`에서 reload 후 확인한 IndexedDB 상태:
`composition` DB version 13, `pages` index `["project_id"]`, `layouts` index
`["name","project_id","slug"]`, `elements` index `["page_id","parent_id"]`,
`pages`/`layouts`/`elements` row의 `order_num` count 0, 해당 project
`documents` payload의 `order_num` hit 0.

## Residual Risks

- Supabase `pages.order_num` physical column은 이 ADR의 기본 implementation scope에서
  제거하지 않는다. 제거가 필요하면 별도 DB migration ADR 또는 migration plan이 필요하다.
- 기존 cloud sync가 `pages` row order에 의존하는 경우, document payload 없는 외부 consumer는
  canonical source order를 알 수 없다. 이 경우 compatibility export boundary에서만
  derived order를 제공한다.
- reusable frame catalog order와 page presentation order가 모두 document root
  `children[]`에 있으므로, selector가 page-like node와 reusable frame node를 명확히
  분리해야 한다.
- nested PageTree는 `parent_id`별 sibling subsequence projection을 사용해야 한다.
  구현이 global source order와 sibling-local order를 혼동하면 DnD 후 tree order가 흔들릴
  수 있다.
- legacy import/export fixture와 Table/collection component data의 `order_num`은
  ADR-119 runtime page/layout order 범위 밖으로 남는다.

## Gates

| Gate                         | 시점         | 통과 조건                                                                                                                                                                                                                        | 실패 시 대안                     |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| G0: inventory                | Phase 0 종료 | page/layout `order_num` read/write/index/API/test call site를 `runtime`, `adapter-boundary`, `schema`, `test` bucket으로 분류. page 생성 body payload의 `Element.order_num` residual과 bootstrap seed 경로를 별도 blocker로 분류 | 구현 착수 금지                   |
| G1: page read cutover        | Phase 1 종료 | PageTree, nested sibling projection, hydrate, preview routing, export render model이 stored `pages.order_num` 없이 canonical page source order를 사용                                                                            | page path만 rollback             |
| G2: layout read cutover      | Phase 2 종료 | Frames/layout list, `canonicalFrameStore`, layout invalidation이 stored `layouts.order_num` 없이 reusable frame source order를 사용                                                                                              | frame list path rollback         |
| G3: write cutover            | Phase 3 종료 | page/layout create, reorder, delete가 canonical root `children[]` splice를 먼저 수행하고 row mirror order를 쓰지 않음                                                                                                            | write path별 fallback            |
| G4: metadata cleanup         | Phase 4 종료 | page/layout canonical node `metadata.order_num` 생성/소비가 제거되고 metadata는 identity/slug/layout mirror만 보존                                                                                                               | metadata mirror read-only 격리   |
| G5: IndexedDB/API cleanup    | Phase 5 종료 | local IndexedDB `pages.order_num`/`layouts.order_num` index 제거, DB_VERSION bump, API payload는 필요 시 derived boundary로만 유지                                                                                               | API compatibility field 유지     |
| G6: verification + rule sync | Phase 6 종료 | refresh, PageTree DnD, Frames order, Preview route, project sync targeted tests와 `codex:preflight` 통과. `.agents` page/layout 예외 규칙 갱신                                                                                   | allowlist 재분류 후 phase 재시도 |

## Consequences

### Positive

- Element/page/layout order가 모두 canonical source order 하나로 설명된다.
- `pages.order_num`, `layouts.order_num`, `metadata.order_num` drift 가능성이 사라진다.
- IndexedDB page/layout order index가 제거되어 local schema가 `documents` primary 구조와
  더 잘 맞는다.

### Negative

- PageTree, Frames tree, preview routing, project sync, DB adapter를 함께 검증해야 한다.
- Supabase physical schema 제거는 별도 승인 전까지 완전히 닫히지 않는다.
- source order selector가 page-like node와 reusable frame catalog node를 잘못 섞으면 page
  navigation 또는 layout list order가 흔들릴 수 있다.
- nested PageTree projection이 parent별 sibling subsequence를 보존하지 않으면 root source
  order 전환이 UX regression으로 보일 수 있다.
