# ADR-261: 컴포넌트 API — instance 교체 · slot 추천 · 사용자 컴포넌트 속성 (pen.dev · Figma)

## Status

Implemented — 2026-10-15 (Phase 0 ~ 6 · G0 ~ G5 종결 — main `871357986` · `e09a78030` · `b4e64d41f` · `79b881192` · `108306c71` · `ba7d6021c`, pre-push perf ratchet pass (등급 A 초과 0) · 사용자 G5 「직접확인했다」 · 아래 Live Exercise). Accepted — 2026-10-15

> **Phase 6 종료 · Implemented (2026-10-15)** — G5 사용자 Builder 확인 「직접확인했다」. 확인 직전 사용자 보고 1 (Create component 로 만든 컴포넌트의 instance 에서 일부 속성이 바뀌지 않거나 다른 조작 뒤에야 반영) 을 같은 날 수리 (`ba7d6021c` — Canvas 증분 step 이 template 바인딩 판정을 노드 자신의 정의로만 해 사용자 컴포넌트 정의 `accepts: {}` 에 막힘 → record 가 접은 층의 정의 전부로 판정, 팔레트 전 항목 probe 65 → 0 경로). G4: type-check 6/6 · shared 1693 · builder catalogRuntime 2198 · ratchet 등급 A 초과 0. LOW deferred (별도 수리): Disclosure `size` → 제목 Text fontSize 증분 미반영 (원본에서도 재현 — part rule 도달 범위) · ratchet B 경고 6 (비차단).

- **Accepted 근거 (2026-10-15)**: 사용자 `/execute-adr 261` 호출 + [리뷰 기록](../reviews/261.md) Round 2 — pending 0 · HIGH 전부 fixed (Round 2 h1 은 r2 수리, 확인은 Phase 2 G2).
- **사용자 결정 답 (2026-10-15 AskUserQuestion)**: 1 = 바로 뒤 형제로 꺼냄 · 2 = 거부 (slot 에만) · 3 = 전체 검색 + 맨 위 「관련」 · 4 = text · boolean 먼저 (instance 교체 속성은 Phase 5) · 5 = 허용 · 6 = 지우고 알림에 셈 — 6건 모두 답.

> **Phase 0 · 1 완료 (2026-10-15)** — G0: live 재현 RED 3 (instance slot 자식의 ArrowDown · ⌘V 가 원본 slot 노드에 씀 · layout page 내용의 ArrowDown 이 layout template 에 씀), 주소 보유 필드 4종 · `replace` 지원 표 · oracle 표 (breakdown §1). G1: Canvas drop · Alt 복제 · 절대 배치 복제 · Layers drop 은 record 의 EditTarget (`catalogInsertParent` — 소유 노드 · slot 선언 자리 = instance `fillSlot`, 프로젝트 컴포넌트 · layout instance 는 루트 slot 만), 선택 뒤 붙여넣기 · z-order · 화살표 순서는 노드가 놓인 자리 (`catalogParentOfNode`). 원본에서 투영된 자리는 옮기지 않는다. unit 9 (원복 RED 전량) · builder 279 파일 · type-check 6 · live 5/5 (drag · ⌘V · ArrowDown · layout) · perf ratchet 등급 A 초과 0 (작업 트리 측정 `--judge`). 판독 1회 HIGH 1 · MEDIUM 1 (instance 루트가 비-slot drop 을 받음 · Layers 의 빈 slot index) → 수리 검증 RED 2/2 — 닫힘.

> **Phase 2 완료 (2026-10-15)** — `swapInstance` (`commands/swap.ts`): 노드 id · 자리 · 루트 own 필드 유지, 이름 경로 (`name ?? type` + 같은 키 형제 순번) 유일 매칭으로 override · interaction · `showWhen` 상태 소유자 · 이 노드를 지나는 다른 instance 주소를 한 step 에 옮긴다. 못 맞춘 slot 내용 · replacement 는 바로 뒤 형제로 (결정 1), 못 맞춘 쓰기 · interaction · 조건은 지우고 센다 (결정 6). Builder: Component 절 이름 칩 = 교체 목록 (검색 · 관련 먼저 — 결정 3, 기본 원본 포함 — 결정 5, 그 자리에 놓을 수 있는 것만) · Canvas 오른쪽 클릭 「Swap instance」 · 알림 (유지 · 버림 · 밖으로) + undo. G2: unit 9 + 무작위 500 단계 하니스에 swap (수락 26) · 원복 RED 전량 · live 10/10 · Round 2 h2 (`showWhen` 유지) 확인. 판독 1회 HIGH 1 · MEDIUM 1 (교체가 nesting 검사를 건너뜀 — ListBox 항목 → Button · ListBox → GridList 의 항목 / 값 타입이 다른 같은 이름 prop 이 교체 전체를 거부 — 기본 원본 전수 교체 probe 107건) → 수리 검증: 원복 RED 3 · probe 재실행 (적용 거부 0 · 놓을 수 없는 교체는 계획 단계 `NESTING_NOT_ALLOWED`) — 닫힘. LOW deferred: holder 밖 instance 의 `showWhen` 주소 (작성 경로 0) · `ancestor.nodeId` 조건의 상태 키 소실 알림.

> **Phase 3 완료 (2026-10-15)** — `NodeEntry.slot.suggested` (선택 필드, 사용자 컴포넌트 slot 만): 검증 (정의 id · 중복) · 참조 색인 + `DANGLING_DEFINITION` · 정의 삭제 시 정리 (같은 명령이 만든 detach 사본 포함) · 다른 프로젝트 붙여넣기에서 대상에 없는 project 추천 제거 (library 유지 — 리뷰 m1). Builder: 원본 slot 섹션의 「추천 컴포넌트」 목록 · 「추천 추가」 (자기 컴포넌트 제외), instance slot 섹션은 추천을 버튼으로 맨 위에 — 누르면 채움, 넣기 목록에서도 맨 위 (제한 아님). G2: shared 5 · builder 1 · live 4/4 (추가 → 저장 · instance 버튼 · 눌러 채움 · 원본 무변경). 판독 1회 MEDIUM 1 (자기 컴포넌트를 추천하는 slot 사본이 같은 명령의 detach 로 생기면 dissolve 가 `DANGLING_DEFINITION`) → `removeWithReferrers` 가 이 명령이 쓴 노드도 정리 · 수리 검증 RED 1/1 — 닫힘. LOW deferred: 항목만 받는 slot 에 넣은 project 추천은 instance 에 안 보임 (UX) · slot 선언 원본 선택 중 step 마다 추천 선택지 계산 (원본 선택 시에만).

> **Phase 4 완료 (2026-10-15)** — `DefinitionEntry.properties` (text · boolean, 대상 `{id, prop?}` — text 는 그 레이어의 글자 prop 을 기록한다): 검증 (모양 · 대상이 원본 서브트리 안 · text prop 계약 · boolean 은 루트 아님 · 키가 루트 계약과 겹치지 않음 · 중첩 instance 의 속성 키는 대상 아님) · 계약 = `instanceContract` 가 속성 표에서 파생 · resolver 는 composite 자리의 instance 경로별로 속성 쓰기를 모아 원본 노드 투영에 쓴다 (그 자리의 직접 쓰기가 이김, 루트 prop 으로 넘기지 않음 — R3) · 패널 값 (fieldSource `property` 층) · detach · 첫 구조 편집 사본은 값을 굳힘 · 대상 삭제 · 원본 밖 이동 · Swap 으로 대상 제거, 0 이면 속성 삭제 + 모든 instance 값 삭제 · 값 쓰기는 Canvas 증분 갱신에서 루트 재평탄화. Builder: 원본 레이어의 「Component properties」 (만들기 · 적용 · 이름 · 떼기 · 삭제) · instance Property 탭 필드 (text 입력 · boolean 「Show」 칩) · instance 안 driven 레이어 인라인 편집 = 속성 값. G3: shared 14 · builder 4 · 무작위 하니스 (property 17 · propertyValue 3 수락) · 원복 RED 14 · live 14/14 (Compare Mode — Canvas record = Preview DOM, 원본 무변경, DOM 속성 attribute 0, 인라인 편집, undo, detach) · ratchet 등급 A 초과 0. 판독 1회 MEDIUM 3 (중첩 instance Swap 이 속성 대상 때문에 거부 · 중첩 instance 의 속성 키를 대상으로 잡은 뒤 안쪽 속성 삭제 시 문서 무효 · 첫 구조 편집 뒤 패널 필드가 닿지 않는 값을 보임) → Swap 이 대상 정리 · 검증 금지 · 닿을 레이어가 없는 필드 숨김 — 수리 검증 원복 RED 3/3, 닫힘. LOW deferred 1: 원본 패널 섹션이 step 단위 구독 (owner 깊이 비용).

> **Phase 5 완료 (2026-10-15)** — instance 교체 속성 (Figma instance swap property): `ComponentPropertyKind` 에 `instance` · 속성의 `preferred?` (Figma preferred values — 제한 아님). 값 = instance 의 그 자리 `replace` override (`commands/instanceProperty.ts` `setInstanceProperty`) — 처음 고르면 그 자리를 소유 노드로 복사 (`createMaterializer` — instance 의 그 자리 쓰기 · 안쪽 override · slot 내용이 따라감) 하고 Phase 2 `planSwapInstance` 로 고른 컴포넌트에 맞춘다 (같은 stage 위 — `stageOver`). 기본값 = 원본 컴포넌트로 다시 교체 + instance 의 override 로 되접기. 주소 (interaction · `showWhen` · 원본 안 instance 를 지나는 다른 instance 주소 · 그 경로 중간의 slot 내용) 는 같은 step 에 옮긴다. 검증: instance 대상은 루트 아님 · text 속성과 같은 레이어 금지 (`PROPERTY_TARGET_SWAPPED`) · preferred 는 instance 종류만 · 존재 (`DANGLING_DEFINITION`) · 참조 색인. 값은 루트 prop 이 아니다 (계약 밖). resolver 는 바뀐 자리에도 같은 레이어의 표시 속성을 적용한다 (instance 의 직접 표시 · 숨김이 먼저). 원본 레이어 삭제 · 추천 컴포넌트 해체 정리. Builder: 원본 레이어 「인스턴스 교체 속성」 · 추천 목록, instance Component 절의 속성 picker (추천 → 관련 → Local · Library, 지금 값 제외) · 되돌리기 · Overrides 목록 교체 행 (`resetReplacement`). G3: shared 18 · builder 2 · 무작위 하니스 (instance 값 — 속성 없으면 같은 step 에 만듦) · 원복 RED 11 · live 15/15 (Compare Mode — Canvas record = Preview DOM, 원본 무변경, reset · undo · 새로고침) · ratchet 등급 A 초과 0 · initial JS gzip 1,332,540 B. 판독 1회 HIGH 1 · MEDIUM 2 (표시 속성 값이 교체 노드에 복사돼 되돌리기 뒤 patch 로 남고 직접 쓰기보다 앞섬 / 바깥 instance 가 원본 안 instance 자신의 쓰기를 잃음 / 경로 중간 slot 내용 주소가 안 따라와 `TEMPLATE_STEP_NOT_OWNED`) → 복사 노드엔 instance 의 직접 표시만 · resolver 순서 = 직접 → 속성 → 원본 / 그 경우 `PROPERTY_VALUE_INHERITED` 로 거부 / 경로에 교체 노드를 끼우고 뺌 — 수리 검증 원복 RED 5/5, 닫힘. LOW deferred: 한 속성의 대상 둘이 겹칠 때 (B 가 A 의 slot 내용 안) 두 번째 교체가 닿지 않을 수 있음 (미실행 가설) · 바깥 instance 값이 원본 안 instance 의 자기 쓰기 위에 겹치는 경우는 거부 (범위 밖) · Phase 2 Swap 이 숨긴 slot 항목을 page 루트로 꺼내는 경우 하니스 resolve 가 `NODE_DISABLED` (seed 8, HEAD 에서도 재현).

> **Codex 착수 완료 검토 (2026-10-15, 사용자 요청)** — HIGH 0 · MEDIUM 4 (실행 재현) 모두 수리: 교체 레이어 detach 시 표시 속성 숨김 소실 · 부모와 slot 자식을 같은 교체 속성 대상으로 둠 (→ `PROPERTY_TARGET_NESTED` 로 거부) · 교체 값이 있는 원본 레이어를 원본 밖으로 이동 시 거부 (→ 그 자리를 지나는 instance override 정리) · Swap 이름 경로 구분자 충돌 (→ 단계 배열 키). 수리 검증 원복 RED 4/4. 상세: [breakdown §8](../design/261-component-api-breakdown.md) · [리뷰 기록](../reviews/261.md).

- 사용자 요청: `/create-adr` (2026-10-15) — 「ADR-260 후속 A — 컴포넌트 API (instance 교체 · slot 추천 · 사용자 컴포넌트 속성 · drag/paste slot 채우기 · Phase 0 의심 확인)」.
- 방향을 정한 사용자 원문: 「origin - instance, slot 은 pen.dev 와 pigma(Figma) 참조 모델이다」 (2026-10-14) · 「260 종료 후 설계」 (2026-10-14, ADR-260 후속 4 기능). 동작 판단이 갈리면 「pen.dev / Figma 에 같은 기능이 있다면 그 방식으로」 (2026-10-14, ADR-260 결정 4 · 5 답).
- **분리 confirm (결정 지점 ①, 2026-10-15 AskUserQuestion 답)**: 후속 4 기능을 ADR 2개로 — 이 ADR (컴포넌트 API: instance 교체 → slot 추천 → 사용자 컴포넌트 속성) 과 [ADR-262](../262-instance-override-push-and-reset-all.md) (override 정리: 원본에 반영 · Reset all changes). 근거는 직교성이다 — Figma 의 instance swap 속성 = 교체 명령 + preferred values (= pen.dev slot 추천) 라 셋이 묶이고, 반영 · 되돌리기는 override 만 다룬다. 같은 답에서 추가 범위 3건을 모두 포함: drag · paste 로 slot 채우기 · ADR-260 Phase 0 의심 1건 확인 (이 ADR), Reset all changes (ADR-262).
- 사용자가 이미 답한 확인 항목: 기본 (library) 원본의 slot 은 코드가 정한 그대로 — 편집 가능한 slot 지정은 사용자 컴포넌트 전용 (2026-10-14) · 놓은 instance 의 slot 내용은 instance 의 것 (2026-10-14) · 옛 문서 전환 코드 금지 (2026-10-14, 개발 단계).
- **Codex 설계 리뷰 Round 1 (2026-10-15)**: HIGH 4 · MEDIUM 1 — 모두 실행 재현 (h3 · h4 는 기반 경로 실행). 같은 날 r1 에서 설계를 고쳤다. h1 화살표 순서가 원본 자식을 instance 로 빼 옴 → Decision 1 출발지 판정. h2 교체가 interaction · 바깥 override 주소를 끊음 → Decision 2 주소 보유자 재매핑 · 사용자 결정 6. h3 · h4 instance 속성을 resolver 에서만 바꾸면 의존성 · 자리 열거가 옛 정의 → Decision 4 `replace` 소유 노드. m1 다른 프로젝트 붙여넣기의 추천 → 대상에 없는 추천 제거. **Codex 수리 검증 Round 2 (같은 날)**: h1 · h3 · h4 · m1 닫힘 (실행 확인 — `replace` 직접 · 중첩의 투영 · 자리 열거 · 주소 · 편집 · detach · 영향 추적 · snapshot). h2 는 `showWhen` 상태 소유자 주소가 목록에서 빠져 남았다. r2 에서 Decision 2 의 대상을 「template 자리를 가리키는 모든 주소 필드 (Phase 0 전수)」 로 넓히고 `showWhen` 을 넣었다. 판독 상한에 닿아, 이 수리의 확인은 Phase 2 G2 가 맡는다. 상세: [리뷰 기록](../reviews/261.md).
- 범위 밖: variant (Figma component set) · 라이브러리 간 공유 · 원본에 반영과 Reset all changes ([ADR-262](../262-instance-override-push-and-reset-all.md)) · 중첩 instance 의 속성 노출 (Figma 「expose nested instances」).

## Context

### 도메인

- **문서 모델 (ADR-248 catalog 문서) + Builder 편집 UI**.
  - D1 무변경 — instance 는 원본의 type 그대로 그려진다.
  - D2 — 사용자 컴포넌트 속성은 **프로젝트 문서의 데이터** 다. Figma component property 처럼 사용자가 자기 컴포넌트에 정의한다. catalog binding 의 `accepts` (S2 정렬 게이트 `d2S2Alignment` 의 대상) 가 아니라서 새 catalog prop 은 0 이다.
  - D3 무변경 — 속성 값은 이미 있는 node 필드 (글자 prop · `enabled` · 중첩 instance 의 정의) 로 투영되고, Canvas 와 Preview 는 같은 resolved record 를 읽는다.
- 참조 모델 (외부 근거, 2026-10-15 조회):
  - **pen.dev Slots** (`docs.pencil.dev/core-concepts/slots`):
    - 「Slots are designated areas within a component where elements can be dropped in」.
    - 「Only empty frames in component origins can be turned into slots」.
    - 「Other components in the same .pen file can be marked as 'suggested slot components'」 — 원본의 slot 레이어를 고르고 Slot 옆 「+」 로 표시한다.
    - 채우기: 「Drag and drop or copy and paste an element into the slot」, 또는 「select the slot in an instance and click one of its suggested components in the properties panel」.
    - 「Suggestions do not restrict the slot to those components. Content you add belongs to that instance」.
  - **pen.dev Components**: 「Layers inherited from an origin cannot be freely reparented inside the instance」.
  - **Figma component properties** (`help.figma.com` Explore component properties):
    - boolean — 레이어 보이기에만 묶인다.
    - text — 글자 레이어에 묶인다.
    - instance swap — 중첩 instance 에 묶이고, preferred values 가 교체 메뉴 맨 위에 뜬다. 제한이 아니라 추천이다.
    - variant — component set 전용이라 범위 밖이다.
    - 기본값은 속성마다 있다. 속성은 레이어에 「apply」 한다 — 한 속성을 여러 레이어에 붙일 수 있다.
  - **Figma Swap instance** (`help.figma.com` Swap components and instances):
    - 진입은 Instance 메뉴 · 오른쪽 클릭 「Swap instance」 · Assets 에서 modifier drag.
    - override 는 「Figma will try to preserve any overrides」 — 레이어 이름이 같아야 이어진다 (「rename the layers so they're unique」).
    - Assets 패널로 교체하면 글자 override 만 남는다.

### 현재 (실측 2026-10-15, main `15b847d5b`)

1. **사용자 컴포넌트에 속성이 없다** — `createComponent` 가 `accepts: {}` · `defaults: {}` 로 만든다 (`packages/shared/src/catalog/commands/components.ts:127-139`). `ValueType` 은 타입 태그뿐이다 (`document/types.ts:191-207`) — 이름 · 편집 종류 · 대상 레이어가 없다.
2. **패널은 사용자 컴포넌트 instance 에 루트 type 의 계약만 보인다** — `catalogSemanticContracts` (`apps/builder/src/builder/catalogRuntime/editContract.ts:67-80`) 는 library 원본이면 `REUSABLE_PROPS_SCHEMAS` (`components/reusablePropsSchemas.ts:240`), 아니면 루트 type 의 binding 계약을 쓴다 (`definitionTypeName` — `commands/context.ts:92-114`). `DefinitionEntry.accepts` 는 필드가 되지 않는다.
3. **library 의 바인딩 방식** — template 노드 prop 에 `"{key}"` 를 쓰고 resolver 가 instance 값 (없으면 `defaults`) 으로 바꾼다.
   - 위치: `bindTemplateValue` (`resolution/resolver.ts:350-365`) · `templateBindings` (`:807-823`).
   - 중첩 composite 는 바깥 바인딩을 보지 않는다 (`:805`).
   - `enabled` 는 prop 이 아니어서 바인딩이 닿지 않는다 (`types.ts:745`).
   - 사용자 template 노드의 `{key}` 는 검증하지 않는다.
   - ADR-260 이후에는 원본이 page 의 보통 노드라, 원본 노드에 `"{label}"` 을 쓰면 원본 자신이 그 글자를 그린다 (ADR-260 breakdown §1 「page 위 원본의 `{key}` 표시값 규칙만 그때 정한다」).
4. **instance 교체 명령이 없다**.
   - 정의를 바꾸는 명령은 page body 의 `applyLayout` (`commands/project.ts:433-500`, entry `put`) 하나뿐이다. `setNodeField` 는 `definitionId` 를 바꾸지 못한다 (`transactions/transaction.ts:91-109`).
   - override 주소는 정의 안 template id 경로다 (`types.ts:454-459`) — 정의가 바뀌면 그 경로가 가리킬 노드가 없다.
   - 지금 쓰는 override 종류는 `patch` · `fillSlot` 이다. `replace` 는 만드는 명령이 없다 (`types.ts:477-489`, 테스트에만 있다).
5. **slot 선언은 `{name, required}` 뿐이다** (`types.ts:741`, 검증 `document/validation.ts:1198-1203`). slot 섹션의 넣기 목록은 그 자리의 type 으로 계산한다 (`catalogRuntime/slots.ts:286` `catalogSlotInsertOptions`) — slot 마다의 추천은 없다.
6. **slot 을 채우는 길**:
   - 채울 수 있는 길: 팔레트 · slot 섹션 · layout body 붙여넣기.
     - 팔레트는 선택 대상이 `descendant` 이면 그 자리에 넣는다 (`catalogRuntime/paletteInsert.ts:150-210` → `commands/context.ts:291-329` `setChildList` 가 `fillSlot` 을 쓴다).
     - slot 섹션 (`slots.ts:138-227`) 과 layout body 붙여넣기 (`canvasMenu.ts:189-216`) 도 같은 길이다.
   - 채울 수 없는 길: Canvas drop (`catalogRuntime/canvasGesture.ts:1228-1291`) · 「선택 뒤 붙여넣기」 (`canvasMenu.ts:309-325`) · z-order (`:337-347`) · 화살표 순서 (`shortcuts.ts:426-444`).
     - 이 넷은 부모를 record 의 `sourceId` 로 `{kind: "node"}` 를 만든다 — `descendant` 부모를 만들지 않는다.
   - Layers drop (`catalogRuntime/layerTree.ts:427-468`) 은 EditTarget 을 쓰지만 `node` 부모만 받는다. 그래서 slot 에 넣지 못하고, slot 에 든 자식의 순서도 바꾸지 못한다.
7. **ADR-260 Phase 0 의심 — 코드 판독으로 확정 (실행 전)**.
   - 원인:
     - template 자리의 `sourceId` 는 template 노드 id 다 (`resolution/positions.ts:226-235`).
     - 사용자 컴포넌트의 template 노드는 `project:node:` 라 `isNodeSource` (`canvasGesture.ts:77`) 를 통과한다.
     - 그래서 6 의 Canvas 네 경로가 instance 안 자리를 부모로 삼으면 **원본 노드의 `children` 에 쓴다**. `originRef: true` 면 page 의 원본에, 아니면 정의의 template 에 쓴다.
     - slot 에 든 자식을 같은 slot 안에서 옮겨도 instance 의 `fillSlot` 에서 빠져 원본으로 간다.
   - 검증이 막지 않는다:
     - `TEMPLATE_ROOT_FIXED` · `REPLACEMENT_NOT_MOVABLE` 은 출발 자리만 본다 (`commands/context.ts:335-362`).
     - `moveNodes` 는 자기 안 이동 · nesting 만 본다 (`commands/structure.ts:829-894`).
     - 소유 검증은 원본 노드가 유효한 소유자라 통과한다.
   - 남는 신호는 사후의 「N개 instance 영향」 확인 대화상자뿐이다 (`catalogRuntime/componentConfirm.ts:117-190`). 그런데 이 대화상자는 layout 을 건너뛴다. 그래서 layout 을 적용한 page 의 내용 (body `fillSlot` 의 자식 — `commands/project.ts:463-496`) 에서 같은 길이 **layout template 에 묻지 않고 쓴다** (코드 추론).
   - 지금 main 에 있는 결함이다.
8. **slot 이 아닌 자리도 `fillSlot` 을 받는다** — `TARGET_NOT_SLOT` (`document/graph.ts:861-864`) 은 slot 선언도 없고 leaf type 인 자리만 거부한다. container 자리는 첫 구조 편집 때 `ensureChildList` (`commands/materialize.ts:572`) 가 template 자식을 복사해 `fillSlot` 을 만든다 (pen.dev 는 slot 에만 넣는다).

### 제약

- **Hard**: 아래 불변식 · 하니스는 그대로 통과해야 한다.
  - 소유 불변식 (`DUPLICATE_OWNERSHIP` · `UNOWNED_NODE` · `OWNERSHIP_CYCLE`).
  - 정의 순환 금지 (`DEFINITION_CYCLE`).
  - 무작위 명령 500 단계 하니스 (ADR-248 4b G2).
- **Hard**: 옛 문서 무변경 — 새 필드는 모두 선택 필드이고 전환 코드는 0 이다. 속성 · 추천이 없는 정의는 지금과 같다.
- **Hard**: 기본 (library) 원본의 slot · template 은 코드 정의 그대로 둔다 (사용자 2026-10-14). 추천 · 속성은 사용자 컴포넌트에만 둔다.
- **Hard**: D3 대칭 — Canvas 와 Preview 가 같은 resolved record 를 읽는다. 성능 · 번들 상한도 지킨다: pre-push perf ratchet (ADR-246) 과 initial 번들 상한 (ADR-201 재승인 값 — 그때의 상한).
- **Soft**: pen.dev · Figma 에 같은 기능이 있으면 그 방식을 따른다.

### 생성기 질문 (반복 패턴 #2)

해당 없음 — rule · CSS · library template 은 바뀌지 않는다. `LIBRARY_CONTRACT_VERSION` 은 그대로 둔다.

## Alternatives Considered

이 ADR 은 결정 축 셋 (속성 바인딩 · 교체 시 override · drop 부모) 을 갖는다. 축마다 대안을 비교한다. slot 추천은 대안이 갈리지 않는다 — pen.dev 그대로 slot 선언에 추천 목록을 두고 제한하지 않는다. 그래서 Decision 에만 적는다.

### 축 1 — 사용자 컴포넌트 속성의 바인딩

#### 대안 1A: library 방식 그대로 — 원본 노드 prop 에 `"{key}"` + 정의 `accepts` · `defaults`

- 설명: 사용자가 속성을 만들면 대상 노드의 prop 을 `"{key}"` 로 바꾸고 기본값을 정의 `defaults` 에 둔다.
- 위험: 기술 **HIGH** / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 LOW.
  - 기술 HIGH 의 이유 셋:
    - 원본이 page 의 보통 노드라 `"{label}"` 을 그대로 그린다 (현재 3).
    - 원본 글자를 인라인 편집하면 바인딩이 지워진다 (`catalogRuntime/textBinding.ts` 는 바인딩된 글자를 부모 prop 에 쓴다).
    - boolean (`enabled`) · instance swap (중첩 instance 의 정의) 은 prop 이 아니라 문자열 바인딩이 닿지 않는다.

#### 대안 1B: Figma 방식 — 정의의 속성 표가 원본 레이어를 가리킨다

- 설명:
  - 정의에 `properties` (키 · 이름 · 종류 text / boolean / instance · 대상 노드 목록 · instance 종류는 preferred 목록) 를 둔다.
  - **기본값은 대상 원본 노드의 지금 값** 이다. Figma 에서 main component 의 글자가 곧 기본값인 것과 같다. 기본값을 따로 저장하지 않아 값이 두 곳에 생기지 않는다.
  - instance 는 루트에 속성 값을 쓴다. resolver 는 template 자리를 투영할 때 그 자리를 가리키는 속성의 instance 값을 쓴다. text 는 대상 prop, boolean 은 `enabled`, instance 는 중첩 instance 의 정의를 바꾼다.
  - 원본은 자기 값을 그대로 그리고, 원본 편집이 곧 기본값 편집이다.
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 LOW.
  - 기술 MEDIUM: resolver 에 투영 단계가 하나 생긴다. 속성 값이 루트 record prop 으로 새어 DOM 에 가면 안 된다 (R3).
  - 유지보수 MEDIUM: library `"{key}"` 와 사용자 속성 표, 두 길이 공존한다.

#### 대안 1C: 속성 없이 override 로 충분하다

- 설명: 지금도 instance 는 자리마다 글자 · 숨김 (`patch.enabled`) 을 override 한다. 속성은 만들지 않는다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW.
- 문제: 사용자 요구를 채우지 못한다. 원본이 「바꿔도 되는 자리」 를 선언하지 못하고, instance 마다 Layers 깊이 들어가 자리를 찾아야 한다. 승인된 범위 (속성) 와도 맞지 않는다.

### 축 2 — instance 교체 때의 override

#### 대안 2A: 모두 버린다 — 새 계약이 받는 루트 prop 만 남긴다

- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW.
- 사용자 손실이 크다 — slot 내용 (instance 의 것) 이 사라진다.

#### 대안 2B: Figma 방식 — 같은 자리로 옮긴다

- 설명:
  - 옛 주소의 template 경로를 「이름 (없으면 type) + 같은 이름 형제 중 순서」 의 경로로 읽는다. 새 정의에서 **하나만 맞는** 자리로 override 를 옮긴다.
  - slot 내용은 같은 slot name 의 자리로 옮긴다.
  - 못 맞춘 것은 버리고, 결과를 알린다 (「변경 N개 유지 · M개 버림」 + undo).
  - 루트 prop 은 새 계약이 받는 것만 남긴다.
- 위험: 기술 **HIGH** / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 LOW.
  - 기술 HIGH: 이름이 같은 다른 노드에 override 가 붙을 수 있다. 유일 매칭만 허용하고 결과를 알려 줄인다 (R2).

#### 대안 2C: 교체 = 새 instance 넣기 + 옛 것 지우기

- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** / 마이그레이션 LOW.
  - 유지보수 HIGH: id 가 바뀌어 interaction 대상 · 상태 소유 · 데이터 바인딩 참조가 끊긴다.

### 축 3 — Canvas · Layers 의 drop · 붙여넣기 부모

#### 대안 3A: record 의 EditTarget 을 부모로

- 설명:
  - 부모를 `sourceId` 대신 그 record 의 편집 대상 (`workspace.itemOfRecord(id).target`) 으로 정한다. 팔레트가 이미 이렇게 한다.
  - 대상이 `descendant` 면 명령이 `fillSlot` 을 쓴다 (`setChildList`). instance 안 자리에 넣는 것이 곧 slot 채우기다 — 의심 결함 수리와 drag · paste 채우기가 한 수리다.
  - Layers 도 `descendant` 부모를 받는다.
- 위험: 기술 MEDIUM (네 경로 + Layers, 순서 계산이 `fillSlot` 자식 목록 기준) / 성능 LOW / 유지보수 LOW (경로 하나로 모인다) / 마이그레이션 LOW.

#### 대안 3B: template 자리면 drop 을 막기만

- 설명: `sourceId` 가 정의 template 노드면 그 record 를 건너뛴다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 LOW.
- 결함은 막지만 drag · paste 로 slot 을 채우는 승인된 범위를 채우지 못한다. instance 안 drop 이 조용히 바깥 부모로 간다.

### Risk Threshold Check

| 축  | 대안 | HIGH+                 | 판정                                                                        |
| --- | ---- | --------------------- | --------------------------------------------------------------------------- |
| 1   | 1A   | 기술 HIGH             | 기각 — page 원본이 바인딩 문자를 그린다 · prop 아닌 대상에 닿지 않는다      |
| 1   | 1B   | 없음                  | **채택**                                                                    |
| 1   | 1C   | 없음 (요구 미충족)    | 기각 — 승인된 범위                                                          |
| 2   | 2A   | 없음 (slot 내용 손실) | 기각 — 사용자 10-14 「slot 내용 = instance 의 것」 과 어긋난다              |
| 2   | 2B   | 기술 HIGH             | **채택** — HIGH 를 유일 매칭 · 결과 알림 · undo 한 번으로 줄이고 G2 가 잰다 |
| 2   | 2C   | 유지보수 HIGH         | 기각 — 참조 끊김                                                            |
| 3   | 3A   | 없음                  | **채택**                                                                    |
| 3   | 3B   | 없음 (요구 미충족)    | 기각 — slot 채우기 범위                                                     |

루프 1회: 축 2 의 HIGH 를 피하는 대안은 2A (손실) 와 2C (참조 끊김) 뿐이다. 2B 의 HIGH 는 「잘못 붙음」 하나로 좁고, 유일 매칭 규칙과 결과 알림으로 사용자가 바로 본다 — 수용 (R2 · G2).

## Decision

**1B + 2B + 3A, 그리고 slot 추천은 pen.dev 그대로.** 순서: drop 부모 수리 → instance 교체 → slot 추천 → 속성 (text · boolean) → instance 교체 속성.

1. **drop · 붙여넣기 부모 = EditTarget (3A)**.
   - 적용 경로: Canvas drop · Alt 복제 drop · 「선택 뒤 붙여넣기」 · z-order · 화살표 순서 · Layers drop.
   - 부모는 record 의 편집 대상이다. instance 안 자리면 `descendant` 부모로 그 instance 의 `fillSlot` 에 쓴다. 원본 · layout template 노드에는 어떤 경로도 쓰지 않는다.
   - **출발지도 편집 대상으로 판정한다** (리뷰 Round 1 h1). 옮길 노드는 `sourceId` 가 아니라 편집 대상이 `node` 인 record 의 id 다. 원본에서 투영된 자리 (`descendant`) 는 옮기지 않는다 — pen.dev 「Layers inherited from an origin cannot be freely reparented inside the instance」. instance 소유 노드 (slot 에 든 자식 · 놓은 노드) 만 옮긴다.
     - 이유: 부모만 바꾸면, 원본 자식 A 가 투영된 자리에서 화살표 순서를 바꿀 때 `moveNodes({ids: [A]})` 가 A 를 원본에서 instance 의 `fillSlot` 으로 빼 온다. Codex 실행 결과 원본 `children` 이 비고 `ownerOf(A)` 가 instance 가 됐다 (`shortcuts.ts:438`).
   - slot 이 아닌 container 자리에 넣는 것은 사용자 결정 2.
2. **instance 교체 명령 `swapInstance({id, definitionId})` (2B)**.
   - 노드 id 와 `placement` · 루트 own 필드 (`sizing` · `layout` · 루트 `visual`) 를 유지하고 `definitionId` 만 바꾼다. `applyLayout` 처럼 entry 를 다시 쓴다.
   - 루트 prop 은 새 계약 (`instanceContract`) 이 받는 것만 남긴다.
   - `descendantOverrides` 는 이름 경로로 옮긴다 (유일 매칭만).
   - `fillSlot` 은 같은 slot name 으로 옮긴다. 못 맞춘 slot 내용은 사용자 결정 1.
   - **instance 바깥의 주소 보유자도 같은 transaction 에서 옮긴다** (리뷰 h2). 대상은 **교체되는 instance 의 template 자리를 가리키는 모든 주소 필드** 다. 닫힌 목록이 아니다 — Phase 0 이 `InstanceAddress` · template id 경로를 갖는 필드를 grep 으로 전수 확정한다. 지금 확인된 것은 셋이다:
     - 그 instance 를 주소로 가리키는 interaction (`InteractionEntry.address` — `document/types.ts:801`, 검증 `graph.ts:936-941`).
     - 교체되는 노드가 원본 안 중첩 instance 일 때, 바깥 instance 들의 `descendantOverrides` 중 이 노드를 지나는 주소.
     - 조건부 표시의 상태 소유자 (`showWhen.from` · `all[].from` 의 `ancestor.address` · `ancestor.local` — `types.ts:698-726`, 판정 `runtime/presence.ts`). Round 2 실행: slot 자식 X 의 `isSelected` 조건이 A 루트 주소를 든 채 B 로 교체하면, transaction 은 통과하지만 표시가 true 에서 false 로 꺼지고 소유자 검사는 `STATE_OWNER_UNLINKED` 를 낸다. 주소를 옮기면 복구된다.
     - 규칙은 override 와 같은 이름 경로 유일 매칭이다. 못 맞춘 보유자는 사용자 결정 6.
     - 이유: 노드 id 를 유지해도 주소는 유지되지 않는다. Codex 실행 결과, 옛 주소를 든 interaction 하나 때문에 교체가 `TEMPLATE_ROOT_MISMATCH` 로 거부됐다. 주소를 갖는 entry 종류 전부는 Phase 0 inventory 가 센다.
   - 정의 순환 (`DEFINITION_CYCLE`) 은 그래프 검증이 그대로 막는다.
   - 교체 후보: 사용자 컴포넌트 (Local) + 기본 원본 (Library), 사용자 결정 3 · 5.
   - 진입: Design 패널 Component 절의 이름 (Figma Instance 메뉴) · Canvas 오른쪽 클릭 「Swap instance」. 한 단계라 undo 한 번으로 되돌린다.
3. **slot 추천** — `slot` 선언에 선택 필드 `suggested?: DefinitionId[]` (사용자 컴포넌트 · 기본 원본의 정의 id) 를 둔다.
   - 원본의 slot 섹션에서 Slot 옆 「+」 로 추가 · 제거한다 (pen.dev).
   - instance 의 slot 섹션은 추천을 맨 위에 보이고, 누르면 그 자리에 넣는다 (`catalogSlotCommands.fill`). 제한이 아니다 — 지금의 넣기 목록 · 팔레트 · drag · paste 는 그대로 받는다.
   - 기본 원본의 slot 에는 두지 않는다 (사용자 2026-10-14).
   - 참조 종류가 하나 늘어난다. 그래프 존재 검증 (`DANGLING_DEFINITION`) 과 해체 · 삭제 시 정리에 넣는다.
   - **다른 프로젝트 붙여넣기에서는 대상 프로젝트에 없는 추천을 뺀다** (리뷰 m1). ADR-260 의 다른 프로젝트 붙여넣기는 정의를 가져오지 않고 instance 를 보통 노드로 굳힌다 (`commands/structure.ts:1393-1437` · `materialize.ts:353`). 그래서 snapshot 에 넣어도 추천 정의는 대상에 없다. 추천은 내용이 아니라 안내라서 빼도 잃는 내용이 없다. library 정의 id 추천은 남긴다. 같은 프로젝트 안 붙여넣기는 그대로 둔다.
4. **사용자 컴포넌트 속성 (1B)** — `DefinitionEntry.properties?` (선택 필드).
   - 각 속성: `{key, name, kind: "text" | "boolean" | "instance", targets: NodeId[], preferred?: DefinitionId[]}`.
     - `key` 는 생성 id 이고, 이름은 바꿀 수 있다.
     - `targets` 는 그 정의의 원본 서브트리 안 노드다. text 는 대상의 글자 prop, boolean 은 `enabled`, instance 는 대상 중첩 instance 노드다.
   - 기본값 = 대상 원본 노드의 지금 값 (저장 0).
   - **text · boolean**: instance 값을 instance 루트에 속성 키로 쓰고, 계약 (`accepts`) 은 속성 표에서 파생한다. resolver 는 template 자리를 투영할 때 가장 바깥 instance 의 값을 그 자리 필드에 쓴다. 루트 record prop 으로는 넘기지 않는다 — composite 의 루트 prop 전달 (`resolver.ts:1597-1600`) 에서 속성 키를 뺀다.
   - **instance 종류는 resolver 에서 정의만 바꾸지 않는다** (리뷰 h3 · h4). resolver 만 바꾸면 두 군데가 깨진다.
     - 의존성 모델이 그 정의를 모른다: 영향 추적 (`graph.ts:129`) · clipboard snapshot · 순환 검사. Codex 실행 결과 B 원본을 편집해도 I 가 영향 목록에 없었고, I 의 snapshot 에도 B 가 빠졌다.
     - 자리 열거 (`positions.ts:338`) · 주소 검증 (`address.ts`) · 편집 계약이 옛 정의를 따른다. 그려진 B 안의 자리 주소가 `TEMPLATE_ROOT_MISMATCH` 로 거부됐다.
   - instance 종류의 값을 바꾸는 것은 그 자리의 **`replace` override** 를 쓰는 명령이다.
     - `replace` 는 이미 있는 종류다 (`types.ts:477-489` — 만드는 명령은 0, 검증 · 투영은 있다). instance 가 소유한 새 instance 노드 (정의 B) 가 template 자리 T 를 대신한다. T 안쪽의 override 는 Decision 2 규칙으로 그 새 노드에 옮긴다.
     - 그 노드는 보통 소유 노드라 의존성 · clipboard · 순환 (ADR-260 Decision 12 — 소유 자식 전부를 걷는다) · Layers · 선택 · 주소가 기존 경로 그대로 동작한다.
     - 속성 값 = 그 replace 노드의 `definitionId` 다. 따로 저장하지 않아 값이 한 곳이다. 값을 기본으로 되돌리면 replace 를 지운다.
     - `replace` 의 투영 · 자리 열거 · materialize 가 실제로 다 되는지는 Phase 0 이 확인한다. 테스트에만 쓰였기 때문이다.
   - 원본은 자기 값을 그대로 그린다.
   - 해체 (detach) 는 값을 사본 노드에 굳힌다 (`materialize.ts` `detachInto`).
   - 대상 노드 삭제 · 원본 서브트리 밖으로 이동 → 그 대상을 속성에서 뺀다. 대상이 0 이면 속성을 지운다. 속성 삭제는 모든 instance 의 그 값을 한 트랜잭션에 지운다.
   - UI:
     - 원본 Component 절에 「Properties」 목록. 선택한 레이어에서 「속성 만들기」 — Figma 의 레이어 「Apply property」 와 같다.
     - instance Design 패널의 Property 탭에 속성 필드. text 는 입력, boolean 은 스위치, instance 는 컴포넌트 고르기 — preferred 맨 위, slot 추천과 같은 picker.
   - 첫 Phase 는 text · boolean, instance 종류는 교체 명령 뒤 (사용자 결정 4).

**위험 수용 근거**: 축 2 의 HIGH (잘못 붙음) 는 유일 매칭만 옮기고 결과를 알린다. 교체가 한 단계라 undo 한 번으로 되돌린다. 나머지는 MEDIUM 이하다. 결함 수리 (1) 가 맨 앞이라 지금 main 의 HIGH 결함 (현재 7) 을 먼저 닫는다.

**기각 사유**: 1A — page 원본이 바인딩 문자를 그리고, prop 이 아닌 대상에 닿지 않는다. 1C · 3B — 승인된 범위를 채우지 못한다. 2A — slot 내용 손실. 2C — id 가 바뀌어 참조가 끊긴다.

### 사용자 결정 (execute 때 그 Phase 에서 묻는다)

1. 교체에서 맞는 slot name 이 없는 slot 내용 — (기본안) instance 바로 뒤 형제로 꺼낸다 (손실 0) / 버린다 (Figma 처럼) / 교체를 거부한다.
2. slot 선언이 없는 container 자리에 drop · paste — (기본안) pen.dev 대로 거부 (slot 에만) / 지금 명령 규칙대로 허용 (`ensureChildList`).
3. 교체 후보 목록 — (기본안) 전체 검색 + 맨 위에 「관련」 (같은 루트 type · 그 자리 slot 추천) / 사용자 컴포넌트만.
4. 속성 Phase 순서 — (기본안) text · boolean 먼저, instance 종류는 교체 명령 뒤 / 셋을 한 Phase.
5. 기본 원본 instance (Button ↔ IconButton) 교체 허용 — (기본안) 허용 / 사용자 컴포넌트끼리만.
6. 교체에서 못 맞춘 주소 보유자 — interaction · 바깥 override · `showWhen` 상태 소유자 (리뷰 h2) — (기본안) 지우고 결과 알림에 셈 (override 와 같게) / 교체를 거부한다.

> 구현 상세: [261-component-api-breakdown.md](../design/261-component-api-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                         | 심각도 | 대응                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------- |
| R1  | drop · 붙여넣기 · 순서 경로가 원본 · layout template 에 쓴다 (지금 main — 현재 7). 부모만 고치면 원본 자식을 instance 로 빼 온다 (리뷰 h1)   |  HIGH  | Decision 1 을 첫 Phase 로 · 부모와 출발지 모두 EditTarget · 원본 · layout template 무변경 단언 (G1) |
| R2  | 교체 재매핑이 이름만 같은 다른 자리에 override 를 붙인다                                                                                     |  HIGH  | 유일 매칭만 · 결과 알림 (유지 · 버림 수) · undo 한 번 · 무작위 하니스에 교체 추가 (G2)              |
| R3  | 속성 키가 루트 record prop 으로 새어 Preview DOM 에 미선언 attribute 로 간다 (메모리 `feedback-accepts-undeclared-prop-breaks-dom-leg-only`) |  MED   | resolver 에서 속성 키를 루트 전달에서 뺀다 · Preview DOM 단언 (G3)                                  |
| R4  | 속성 대상 · 추천 정의가 지워져 dangling                                                                                                      |  MED   | 그래프 검증 + 삭제 · 해체 명령이 정리 (G2 · G3 unit)                                                |
| R5  | 다른 프로젝트 붙여넣기에서 추천 정의가 대상에 없다 (리뷰 m1)                                                                                 |  MED   | 대상에 없는 추천은 뺀다 (안내라 내용 손실 0) · instance 속성은 `replace` 노드라 기존 굳히기 경로    |
| R8  | 교체 · instance 속성이 instance 밖 주소 보유자 (interaction · 바깥 override) 를 끊어 transaction 이 거부된다 (리뷰 h2)                       |  HIGH  | 같은 transaction 에서 주소 보유자 전부 재매핑 · Phase 0 이 주소 보유 entry 종류를 센다 (G2)         |
| R9  | instance 속성의 정의가 의존성 · 자리 열거에 안 보인다 (리뷰 h3 · h4)                                                                         |  HIGH  | resolver 투영이 아니라 `replace` 소유 노드로 — 기존 의존성 · 주소 경로 (G3)                         |
| R6  | resolver 투영 단계 추가로 선택 · 편집 카운트 상승                                                                                            |  LOW   | 속성 조회는 정의별 Map · pre-push ratchet (G4)                                                      |
| R7  | drop 수리 뒤 instance 안 편집이 원본 편집 확인 대화상자를 더 이상 띄우지 않는데, 사용자가 원본에 넣고 싶을 때 길이 없다                      |  LOW   | 원본에 넣기는 원본 (page · Local page) 에서 — pen.dev 와 같다. 「Go to component」 가 길            |

## Gates

측정 대상은 사람이 만든 문서 (사용자 컴포넌트 · layout page) 이고, oracle 은 외부 동작 (pen.dev · Figma 문서의 규칙 · Preview DOM) 이다.

| Gate | 시점      | 통과 조건                                                                                                                                                                                                                                                                         | 실패 시 대안                           |
| ---- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| G0   | Phase 0   | ① live 재현: instance slot 에 Canvas drop → 원본 노드 `children` 이 바뀜 (RED). ② layout page 내용 순서 바꾸기 → layout template 이 바뀜 (RED). 재현되지 않으면 그 행을 기록하고 1 을 경로 통일로만 진행. ③ 파일 inventory · oracle 표 (pen.dev · Figma 규칙별 composition 결과). | 재현 실패 원인을 breakdown 에 기록     |
| G1   | Phase 1   | 경로 6개 (drop · Alt drop · 붙여넣기 · z-order · 화살표 · Layers) 가 instance 자리에 쓰면 `fillSlot` 이 바뀌고 원본 · layout template entry 는 바이트 동일 (unit · 원복 RED). live — slot 에 drag · paste 로 채우기 · slot 안 순서 바꾸기 · 원본 무변경 · layout page 내용 이동.  | 경로별 수리 행 추가                    |
| G2   | Phase 2·3 | 교체: 재매핑 표 unit (유일 매칭 · 중복 이름 · slot name · 루트 계약 · 순환 거부) · 무작위 명령 500 단계 하니스에 `swapInstance` 추가 통과 · live (Component 절 · Canvas 메뉴 · undo). 추천: dangling 거부 · clipboard 왕복 · instance 패널에서 추천 클릭 = 채움.                  | 매칭 규칙을 좁힌다 (이름 + type 둘 다) |
| G3   | Phase 4·5 | 속성: Canvas resolved record = Preview DOM 값 (text · boolean · instance, Compare Mode live) · 원본은 자기 값 · Preview DOM 루트에 속성 키 attribute 0 · detach 가 값을 굳힘 · 대상 삭제 정리.                                                                                    | 투영 지점을 resolver 한 곳으로 좁힌다  |
| G4   | 각 Phase  | type-check · shared · builder 스위트 (기존 제외 `resolveContainerStylesFallback`) · pre-push perf ratchet 등급 A 통과 (초과면 원인 수리, 한도 올리기 금지) · initial 번들 상한 안.                                                                                                | 원인 수리                              |
| G5   | 종료      | 사용자 Builder 확인 (Implemented 조건).                                                                                                                                                                                                                                           | 보고 결함 수리 후 재확인               |

### Live Exercise

- 2026-10-15 실행자 (headed Chrome, Playwright, 저장된 인증 세션 · dev 5173) — Phase 1 `apps/builder/scripts/adr261-drop-parent-live.mjs` 5/5 (instance slot 에 drag · ⌘V 로 채움 · slot 안 ArrowDown · layout page 내용 이동 — 원본 · layout template 무변경). Phase 2 · 3 `adr261-swap-live.mjs` 10/10 (Component 절 이름 칩 · Canvas 오른쪽 클릭 「Swap instance」 · 알림 유지 · 버림 · 밖으로 · undo) + slot 추천 4/4 (추천 추가 → 저장 · instance 의 추천 버튼 · 눌러 채움 · 원본 무변경). Phase 4 `adr261-properties-live.mjs` 14/14 (Compare Mode — 속성 값 Canvas record = Preview DOM · 원본 무변경 · DOM 루트에 속성 attribute 0 · 인라인 편집 · undo · detach). Phase 5 `adr261-instance-property-live.mjs` 16 검사 통과 (원본 레이어 「Instance swap property」 · 추천 Heart · instance picker 추천 맨 위 · 현재 값 제외 · Canvas = Preview DOM · reset · undo · 새로고침) — 직접 테스트에서 233px 패널의 버튼 잘림 1 수리 (`79b881192`).
- 2026-10-15 사용자 보고 「create 한 컴포넌트의 instance 컴포넌트의 프러퍼티중 일부는 변경이 안되고 일부는 변경후 화면의 상태 변경이 일어나야 반영」 → 수리 (`ba7d6021c`) 뒤 실행자 live `adr261-bound-props-live.mjs` **8/8 · page error 0**: TextField 를 Create component → 복제 instance 의 Design 패널에 Label · Placeholder · Description 입력 직후 Canvas record 와 Preview DOM 이 같은 값 (다른 조작 없이) · undo 2 · Checkbox instance 글자 · 원본 무변경.
- 2026-10-15 **G5 사용자 확인 「직접확인했다」** (Builder).

## Consequences

### Positive

- 사용자 컴포넌트가 pen.dev · Figma 의 컴포넌트 API (교체 · slot 추천 · 속성) 를 갖는다. 원본이 「바꿔도 되는 자리」 를 선언한다.
- drop · 붙여넣기 · 순서의 부모 결정이 팔레트와 같은 한 길 (EditTarget) 로 모인다. 원본 · layout template 에 몰래 쓰는 지금 결함이 닫힌다.
- 속성 기본값이 원본 노드 값 하나라 원본 편집이 곧 기본값 편집이다 (값 두 곳 0).

### Negative

- 바인딩이 두 길이 된다 — library 는 template `"{key}"`, 사용자 컴포넌트는 속성 표. resolver 가 둘 다 읽는다.
- 문서 schema 에 선택 필드 둘 (`DefinitionEntry.properties` · `slot.suggested`) 이 생긴다. 참조 종류가 둘 늘어 clipboard · 검증 · 정리 경로가 넓어진다.
- 교체 재매핑은 이름에 기댄다 — 이름이 겹치는 원본은 override 를 덜 유지한다 (Figma 와 같은 한계).
