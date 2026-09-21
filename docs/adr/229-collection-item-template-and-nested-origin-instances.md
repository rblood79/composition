# ADR-229: TagGroup item template origin + 저작 조합층의 origin 안 instance — RAC 재사용 조합을 Components 페이지에 그대로

## Status

Accepted — 2026-09-21 (Proposed 2026-09-21 → 사용자 `/execute-adr 229` 착수 · Phase 0 G0 통과 · Phase 1 G1 통과 · Phase 2 G1 통과 · Phase 3 G2·G3 통과)

리뷰 round 1의 h1/m2/m3/l4 설계 보완 완료 (round 2). **Phase 0 (2026-09-21) 완료** — 일반 origin-child ref 실체화를 builder Skia 축 (`resolveCanonicalRefTree` 일반 source-child 경로) 과 Preview 축 (`resolveCanonicalDocument` mode A patch 가 닿은 ref 자식) 양쪽에 구현, proposed Form nested-ref fixture 를 실제 builder 에서 편집→저장→reload→Undo/Redo 로 실측 (headed live 12/12). **Phase 1 (2026-09-21) 완료** — Tag chip item template origin 2 + `component-taggroup` TagList `slot` + chip read-through 두 leg (headed live 8/8). **Phase 2 (2026-09-21) 완료** — 조합 origin 의 reusable-type 자식을 origin instance 로 (규칙 하나 `toOriginChildSeed` · 2단 seed · 생성 경로) + synthetic 자식 (`<instance>/<path>`) 의 Properties/Styles 표면 (F15, 쓰기는 바깥 instance descendants) · headed live 9/9 · 잡은 결함 3 (Preview segment id≠name · descendants 쓰기 재레이아웃 · segment 안 `/`). Phase 3~4 는 진행 중 — 기록은 [breakdown §7](design/229-collection-item-template-and-nested-origin-instances-breakdown.md). **Phase 3 (2026-09-21) 완료** — 두 leg 동시 Δ live (`adr229-two-leg-parity-live.mjs` 7/7: Tag item origin icon `fontSize` · label `fontWeight` · root padding → TagGroup instance Skia rect + 픽셀 + Preview computed · `component-button` 편집 → Form/Toolbar instance 안 Button 두 leg · 중첩 편집 → reload) + ADR-228 parity 56 pair 회귀 0 (58/58 — Phase 2 직후 FAIL 11 은 하니스 plain arm 이 ref 자식을 못 옮긴 것, F29) + G3 `scene.build` A/B (Form 100 instance 7회 median p95 +0.7 · TagGroup 100×8 −0.2/−1.2). live 가 잡은 결함 F28 (chip 박스 폭 · 접힘 측정이 template slot 크기 · fontWeight 를 안 읽음) 수리. 남은 Phase 4 = BC (G4) · 문서 · 종결.

설계 요청: 사용자 (2026-09-21) — ① "TagList 는 ListBox 처럼 반복되는 slot 영역인데 Tag chip 이 Components 페이지에 없다." ② "RAC 레퍼런스 구조만 봐도 Button · Input · Label 같은 기본 요소를 재사용 조합하는 개념인데, 동일하게 origin/instance 로 할 수 있지 않나." 범위 판정은 사용자 AskUserQuestion confirm (2026-09-21): **(a) 저작 조합층만 먼저** — RAC 내부 sub-part (TextField 의 Label/Input, Select 트리거 Button …) 는 parent rule delegation 유지 (ADR-923 P5 판정 승계). ADR-228 (Implemented 09-21) 은 inventory freeze (R 57 + item template 4) 안에서 TagGroup 을 generic origin 으로 심었으므로 둘 다 228 범위 밖 = 이 ADR (ADR-148 계열).

## Context

**SSOT 3-domain 관계**: **D3 의 조합 축** (ADR-142 "조합 = canonical reusable 문서" · ADR-912 HC#5 "조합 = 데이터" · ADR-147/148 collection item template) 의 적용 범위 확장. D1 무관 — chip 과 Button 은 RAC primitive 그대로 실체화되고, RAC 가 self-compose 하는 sub-part (D1 소유 DOM) 는 손대지 않는다. D2 는 읽기만 (origin propsSchema 파생, kind/값 무변경). canonical 타입 변경 0 — `type:"ref"` · `slot: [itemOriginId]` · `metadata.slotRole` 전부 ADR-147/148/161 의 모양.

### 문제

1. **TagGroup 의 chip 은 template origin 이 없다.** ListBox/GridList/Menu 는 Components 페이지의 item template origin (`component-listbox-item-default` 등, slot 자식 `{icon}`/`{label}`/`{description}`) 을 행 projection 이 `templateOriginId` 로 읽어 slot 구성·스타일을 주입한다 (F1·F2). TagGroup 은 ADR-097 Addendum 1 (Tag 요소 18개 → `items[]` SSOT) 뒤 ADR-147/148 모델이 오지 않아 `appendTagRowProjection` 이 `templateOriginId: null` 로 Tag catalog rule + items 데이터만으로 chip 을 합성한다 (F3). 그래서 chip 의 조합 (leading icon/avatar · label · remove) 과 스타일은 Components 페이지에서 편집할 자리가 없고, 2026-09-21 의 chip 상자 결함도 rule 값으로만 고칠 수 있었다 (`7c1cb78e3`). 같은 처지: Tabs · Breadcrumbs · Tree · Table/TableView · CardView · ToggleButtonGroup · Nav · Pagination (이 ADR 범위 밖 — Consequences).
2. **조합 origin 의 자식이 plain 노드다.** RAC 레퍼런스 (`packages/react-aria-starter`) 의 Form = TextField×n + Button, Toolbar = Button×n + Separator, ButtonGroup = Button×n 처럼 같은 primitive 의 재사용 조합인데, seed 는 `component-form__action-1` 을 `type:"Button"` 으로 심는다 (F4). 그래서 사용자가 Components 페이지에서 Button origin 을 고쳐도 Form/Toolbar 안 Button 은 안 따라온다 — ADR-228 이 만든 "origin 전집 + 테마 한 세트" 가 조합 한 겹 안쪽에서 끊긴다. 현재 중첩 ref 해소는 override.children 삽입 경로에만 있다. 일반 origin.children의 ref는 바깥 instance에서 미해소 상태로 남는 반례가 확인됐다 (F5, 리뷰 h1). seed 변경에 앞서 이 경로의 실체화와 2단 편집 소유권을 구현해야 한다.

### 코드 사실 (2026-09-21, main `7c1cb78e3`)

요약 — 전문은 breakdown §2 (F1~~F12, 경로:라인).

- item template 모델: origin `slot: [itemOriginId]` → `resolveListBoxTemplateOriginId` / `resolveGridListTemplateOriginId` (`canvasSceneNode.ts:640-651, 857-867, 1285-1300`) → slot composition + origin style 을 행에 주입. Preview 는 `App.tsx:286-397` 이 문서 1회 계산해 renderContext (`listBox/gridList/menuItem`) 로 넘긴다.
- TagGroup: `appendTagRowProjection` (`canvasSceneNode.ts:2044-2150`) 이 `projection.templateOriginId: null` · chip props = `{children: row.label, icon, avatar, allowsRemoving, _isSelected}` · type `"Tag"`. DOM 은 `renderTagGroup` (`CollectionRenderers.tsx:239-410`) 이 items 로 `<Tag>` 를 그리고 `renderTagLeadingSlot` 이 icon/avatar 를 붙인다.
- 조합 origin 의 primitive 자식: Form `__action-{n}` Button · `__field-{n}` TextField (`formTemplateOrigins.ts:80-160`) · Toolbar Button/Separator (`toolbarTemplateOrigins.ts:36-76`) · ADR-228 generic seed 의 ButtonGroup/Pagination Button 자식 (`DisplayComponents.ts:177-195` · `NavigationComponents.ts:152-195`).
- 중첩 ref 해소: `canonicalRefResolution.ts:546-563`의 master 재바인딩은 `materializeOverrideChildren` 전용이다. 일반 source child 경로 (`:682-737`)는 ref를 그대로 합성하고 outer loop (`:786`)는 input만 순회한다. Toolbar origin 자식 Button ref의 합성 결과가 `type:"ref"`인 진단 RED를 확인했다. 두 leg의 공용 해소 경로 확장이 필요하다.
- 공용 slot vocabulary: `packages/shared/src/catalog/slotRoles.ts:26-45`에는 avatar가 없어 `resolveSlotComposition`이 해당 자식을 버린다. avatar role을 additive 확장하고 양 consumer에 배선한다.
- origin 보충: `ensureTemplateOrigins.ts:84-108`의 `originIds`는 수집·배치 대상이다. 실제 생성 대상은 repair callback 반환값이며 dependency 생성/순서 보장은 없다.
- sub-part 판정 (범위 밖 근거): field 가족 Label/Input/FieldError · picker SelectTrigger/DateInput 은 read-only sub-part — DOM 은 parent props self-compose, 시각은 parent rule delegation (`.claude/rules/ssot-hierarchy.md` §D3 read-only sub-part, ADR-923 P5).

### Hard constraints

- **두 leg 대칭**: (i) Tag item origin 의 slot 자식 style (icon fontSize · label fontWeight) 과 origin root style 을 바꾸면 Skia chip 과 Preview chip 이 같이 바뀐다 — ADR-198 하니스 instance arm 픽셀 Δ 0. (ii) Form/Toolbar instance 안 Button 이 `component-button` 의 props 변경을 두 leg 에서 같이 받는다.
- **사용자 체감 무변화**: instance 안의 중첩 instance (Form 안 Button) 를 선택·편집하는 표면은 plain 자식과 같다 — Properties 필드 · drag · 복제. 신규 InspectorFieldKind 0.
- **BC**: migration 0. 기존 문서의 plain 노드 · 기존 origin 의 plain 자식은 그대로 유효 (ADR-228 결정 ③ 공존). seed 의 자식 형태 변경은 **해당 origin ID가 없는 경우에만** 새 모양으로 시드하고, 있는 origin 은 repair 가 자식을 보존한다 (F8) — 사용자가 origin 을 손질했을 수 있다. 롤백은 신규 ref seed만 원복하고 일반 중첩 ref 해소기는 유지한다 (기존에 저장한 ref 자식의 읽기 호환). 최초 template 보충량과 기존 저작 내용 불변, 두 번째 hydration 증가량을 분리한다.
- **성능**: 600 요소 문서에서 중첩 ref 가 더하는 `scene.build` p95 ≤ +1 ms (ADR-228 G4 의 `PERF_LABEL.SCENE_BUILD` 직접 계측, 같은 세션 A/B) · TagGroup 100 개 × chip 8 의 projection ≤ +1 ms.
- **등록 단일성**: "1 컴포넌트 = 1 등록" (148 HC#2) — Tag item origin 은 팔레트 항목이 아니다 (ListBoxItem 과 같은 template origin, `PALETTE_ORDER` 무변경). D2 경계: catalog binding · PropContract kind/값 무변경.

### Soft constraints

- RAC 내부 sub-part 는 이 ADR 에서 origin 화하지 않는다 (사용자 판정 (a)). 넣으려면 D3 SSOT 경계 재판정 (결정 지점 ③) 을 다시 거친다.
- Label/Input/Text 등 primitive 8 은 origin 이 없다 (228 결정 ②) — 조합 origin 의 그런 자식은 plain 으로 남는다. ref 화 대상은 **origin 이 있는 타입** (Button · TextField · ToggleButton · Badge …) 뿐.
- 다른 collection (Tabs/Breadcrumbs/Tree/Table …) 의 item template 은 후속 — 행 모델이 달라 (Table 컬럼 · Tree 재귀) 별도 inventory 가 필요하다.

## Alternatives Considered

### 대안 A: TagGroup 만 — item template origin (ListBox 모델 복제), 조합 자식은 현행 plain

- 설명: `component-tag-item-default` (+ `-selected`) origin + TagGroup origin `slot` + projection/Preview read-through. 사용자 지적 ② 는 다루지 않는다.
- 근거: ADR-148 Phase 4 가 GridList/Menu 를 같은 방식으로 붙였다 (선례 2).
- 위험: 기술(L) / 성능(L) / 유지보수(**M** — Form/Toolbar 안 Button 은 여전히 origin 과 무관, "한 세트" 가 조합 안쪽에서 끊긴 채) / 마이그레이션(L)

### 대안 B: TagGroup item template + 저작 조합층 자식의 ref 화 (origin 안 instance) — sub-part 제외

- 설명: A + 조합 origin seed (Form/Toolbar/ADR-228 generic 의 ButtonGroup·Pagination 등) 의 **origin 이 있는 타입 자식** 을 `type:"ref"` 로 심고, 생성 경로 (`useElementCreator` 의 complex definition → canonical subtree) 도 같은 규칙. 일반 origin-child ref를 해소하도록 `resolveCanonicalRefTree`를 확장한 뒤 seed를 전환한다. RAC 내부 sub-part 는 그대로.
- 근거: Figma 의 nested instance (컴포넌트 안에 다른 컴포넌트의 instance, 상위가 override 보유) · Pen/Pencil 의 origin/instance 가 중첩 허용 · RAC starter 의 Form/Toolbar 예제가 primitive 재사용 조합. composition의 override.children 중첩 해소는 재사용 가능한 선례지만 일반 origin-child 경로는 별도 구현 대상이다 (F5).
- 위험: 기술(**H** — 중첩 instance 의 override 경로 (instance → 조합 origin 자식 path → 그 자식의 origin) 와 값-diff 소유권 (`diffRefPropsAgainstMaster`) 이 2단에서 검증된 적 없고 일반 자식 ref 실체화는 진단 RED → G0/G1) / 성능(**M** — 중첩마다 merge 1회 추가, ADR-228 유보 (+0.5~~+2.5 ms/600) 위에 쌓인다 → G3) / 유지보수(M — seed 가 origin id 를 참조하므로 ensurer 순서 의존 (Button origin 이 먼저 있어야) → G1 불변식) / 마이그레이션(L — 기존 origin 자식 보존 · 없는 origin만 새 모양)

### 대안 C: B + RAC 내부 sub-part 까지 primitive origin (Label/Input/Button sub-part origin 신설)

- 설명: TextField 의 Label/Input, Select 트리거 Button 도 origin 의 instance 로 — DOM 이 그 origin 을 읽도록 parent rule delegation 채널을 재설계.
- 위험: 기술(**H** — DOM 은 RAC self-compose 라 canonical 자식을 읽지 않는다 (ADR-923 P5); 읽게 하려면 delegation → origin props 채널 신설 = D3 SSOT 경계 재판정) / 성능(M) / 유지보수(**H** — sub-part origin 은 팔레트 밖 집합, 228 결정 ② 와 충돌) / 마이그레이션(**H** — 모든 field 가족 문서의 자식 형태)

### 대안 D: 현행 유지 + Tag chip 스타일을 catalog rule 편집 UI 로

- 설명: Components 페이지 대신 Tag rule 값 (padding/weight) 을 Theme/Styles 표면에서 편집.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — chip 조합 (slot 존재·순서) 은 rule 로 표현 못 함 · ListBox 와 다른 두 번째 모델) / 마이그레이션(L)

### Risk Threshold Check

| 대안  | HIGH+                                | 판정                                                   |
| ----- | ------------------------------------ | ------------------------------------------------------ |
| A     | 0                                    | 사용자 지적 ② 미해결 — "한 세트" 계약 미달             |
| **B** | 기술 H 1                             | 채택 — H 는 G0 (2단 override 실측) + G1 (unit) 로 관리 |
| C     | 기술 H · 유지보수 H · 마이그레이션 H | 기각 — 사용자 판정 (a) 밖, SSOT 경계 재판정 선행       |
| D     | 유지보수 H                           | 기각 — 조합을 rule 로 표현 불가                        |

루프 1회: B의 기술 H에는 **일반 origin-child ref 실체화 구현**과 2단 override 소유권 검증이 포함된다. G0에서 제안 모양의 nested-ref fixture로 선행 경로를 수리·검증한다. 공통 해소기가 실패하면 Form/Toolbar도 같은 경로이므로 ref seed 전환 전체를 보류한다. 해소기가 통과하고 generic 고유 변환만 실패한 경우에만 Form/Toolbar 2종으로 축소한다.

## Decision

**대안 B.** TagGroup 에 ListBox 와 같은 item template origin 을 붙이고, 저작 조합층 origin 의 "origin 이 있는 타입" 자식을 그 origin 의 instance (`type:"ref"`) 로 심는다. RAC 내부 sub-part 는 parent rule delegation 그대로 (사용자 판정 (a)).

- **TagGroup**: `component-tag-item-default` (slot 자식 Icon `{icon}` optional · Avatar `{avatar}` optional · Text label `{label}`) + `component-tag-item-selected` (ListBox selected 동형 — selected chip 은 별도 variant 이므로) · `component-taggroup` 의 TagList 자식이 `slot: [default, selected]` · `appendTagRowProjection` 이 `templateOriginId` 로 slot composition + origin style 을 chip 에 주입 (`resolveListBoxTemplateOriginId` 동형 resolver) · Preview 는 `App.tsx` 의 `templateSlotCompositions` 에 `tag` 축 추가 → `renderTagGroup` 이 chip 에 적용. 공용 `avatar` slot role을 추가하며 leading은 활성 slot과 데이터가 있는 후보 중 avatar > icon으로 하나를 고른다. icon slot 부재가 avatar를 숨기지 않는다. 선택된 leading과 label의 배치는 origin slot 순서를 따른다. remove X 는 render-time (SelectionIndicator 판정 승계).
- **조합 자식 ref 화**: seed 의 자식 노드 중 `getReusableCompositeOriginId(type)` 이 있는 타입 (Button · TextField · ToggleButton …) 은 `{ type:"ref", ref: originId, props: <origin 과 다른 키만> }` — ADR-228 의 instance 계약 (명시 initialProps = origin 과 다른 키) 을 자식에도 그대로. 생성 경로의 complex definition → canonical subtree 변환 (`useElementCreator` / `catalogOrigins.ts` 의 `flattenDefinitionChildren`) 도 같은 규칙 하나를 쓴다.
- **seed 순서**: 원본 seed/기존 문서의 유효 origin index를 먼저 완성하고, 이번 호출 전에 없었던 조합 origin의 자식만 공용 ref 변환한다. diff는 완성된 index를 읽는다. `originIds`를 dependency seeder로 사용하지 않고 origin별 repair 소유자는 하나로 유지한다.
- **BC**: 기존 origin의 자식·순서·편집은 보존한다. 최초 누락 template root/자식/shell의 예상 Δnode·Δbyte만 허용하며 재hydration Δnode·Δbyte는 0이다.

위험 수용 근거: override.children 경로의 선례를 재사용하되 일반 origin-child 실체화는 명시 구현 대상으로 둔다. G0에서 proposed fixture의 타입·상속·경로·편집 저장 위치를 확인하기 전에는 ref seed를 활성화하지 않는다. 공통 경로 실패 시 모든 조합 ref 전환을 보류하므로 미해소 노드가 신규 문서에 퍼지지 않는다. 기각 사유: A 는 사용자 지적 ② 를 남긴다 · C 는 D1 경계 (RAC self-compose) 를 넘고 사용자 판정 밖 · D 는 조합을 표현하지 못한다.

> 구현 상세: [229-collection-item-template-and-nested-origin-instances-breakdown.md](design/229-collection-item-template-and-nested-origin-instances-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                               |  심각도  | 대응                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | --------------------------------------------------------------------------------------------- |
| R1  | 일반 origin-child ref 미해소 (진단 RED) 및 2단 override — Form instance 에서 안쪽 Button 을 편집한 값이 (instance → 조합 origin 자식 path → Button origin) 어느 층에 저장되고 어느 층이 이기는지 검증 0. 잘못되면 편집이 사라지거나 origin 을 오염 | **HIGH** | G0 일반 자식 ref 해소 수리 + proposed fixture 편집/저장/reload, G1 path·바인딩·순환·diff 회귀 |
| R2  | Preview 가 Tag template 을 안 읽으면 Skia 만 바뀐다 (chip slot style) — 두 leg 비대칭                                                                                                                                                              | **HIGH** | G2 parity (origin slot style 변경 → Skia rect/픽셀 · DOM computed 동시 Δ)                     |
| R3  | 중첩 ref 가 `scene.build` 에 merge 를 더한다 — ADR-228 유보분 위에 누적                                                                                                                                                                            |   MED    | G3 A/B (같은 세션 · SCENE_BUILD 직접 계측)                                                    |
| R4  | seed 순서 — 조합 origin 이 참조하는 Button origin 이 아직 없으면 ref 가 dangling                                                                                                                                                                   |   MED    | G1 2단 seed/index → 신규 origin 자식 변환; diff 시 참조 존재·단일 repair 소유·순서 독립       |
| R5  | 기존 origin repair 가 자식을 갈아치우면 사용자가 손질한 origin 이 되돌아간다 (ADR-228 h2 재발)                                                                                                                                                     |   MED    | G4 기존 저작 subtree 불변 + 최초 보충 예상 증가량 + 재hydration Δ0                            |
| R6  | selected chip origin 이 없으면 selected chip 이 default 템플릿으로 그려진다                                                                                                                                                                        |   LOW    | ListBox 와 같은 fallback (`slot[1]` → 상수)                                                   |

## Gates

| Gate | 시점           | 통과 조건                                                                                                                                                                                                                     | 실패 시 대안                                                                   |
| ---- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| G0   | Phase 0 (착수) | inventory 확정 + 일반 origin-child ref 해소 RED→GREEN + proposed Form/Toolbar nested-ref fixture 편집→저장→reload (타입·상속·두 leg 값·저장 위치)                                                                             | 공통 해소 실패면 조합 ref 전환 전체 보류; generic 고유 실패만 손 seed 2종 축소 |
| G1   | Phase 1·2      | unit: avatar vocabulary/reader·leading 선택·slot 순서·양 consumer, 2단 seed/index·신규 origin만 변환·기존 자식 보존, 일반/override 자식 ref의 깊은 path·바인딩·순환·diff 소유권 — 원복 RED                                    | 해당 phase 롤백                                                                |
| G2   | Phase 3        | live parity: Tag item origin slot style/composition 변경 → TagGroup instance Skia rect+픽셀 · Preview computed Δ 동시 · Form/Toolbar instance 안 Button ← `component-button` 변경 두 leg 동시 · ADR-228 parity 56 pair 회귀 0 | 비대칭 leg 수리, 못 하면 그 축 origin 화 보류                                  |
| G3   | Phase 3        | 600 요소 A/B: `scene.build` p95 ≤ +1 ms · TagGroup 100×8 projection ≤ +1 ms                                                                                                                                                   | 중첩 merge 캐시 (ADR-228 유보와 같은 가설) 또는 축소                           |
| G4   | Phase 4        | BC: 기존 저작 subtree/순서 불변 · 최초 누락 root/자식/shell 예상 Δnode·Δbyte 일치 · 두 번째 hydration Δnode·Δbyte 0 · ref seed 원복/해소기 유지 후 문서 열림                                                                  | migration 0 유지 못 하면 중단                                                  |

## Consequences

### Positive

- TagGroup chip 이 ListBox/GridList/Menu 와 같은 모델 — Components 페이지에서 chip 조합·스타일을 한 번 정하면 모든 TagGroup 이 따른다. chip 상자 같은 결함을 rule 값이 아니라 origin 으로 다룰 수 있다.
- Form/Toolbar/ButtonGroup 안 Button 이 `component-button` 의 instance — ADR-228 "origin 전집 + 테마 한 세트" 가 조합 안쪽까지 이어진다. RAC 레퍼런스의 "재사용 조합" 이 canonical 문서 모양과 일치.
- 후속 collection (Tabs/Breadcrumbs/Tree/Table/CardView/ToggleButtonGroup/Nav/Pagination) 의 item template 은 이 ADR 의 resolver/주입 패턴을 그대로 복제 — 후속 후보 목록으로만 남긴다.

### Negative

- 조합 origin 의 자식이 ref 라 Components 페이지에서 Form origin 을 펼치면 안쪽 Button 이 "instance" 로 보인다 — 사용자 체감은 plain 과 같아야 하나 (HC), Navigator 표시는 instance 배지가 한 겹 더 생긴다.
- 중첩 merge 비용 (R3) · seed 순서 의존 (R4) 이 생긴다.
- RAC 내부 sub-part 는 여전히 rule delegation — "Select 의 트리거 Button 도 Button origin 을 따라야 하지 않나" 는 이 ADR 이 답하지 않는다 (사용자 판정 (a); 재개 조건 = 결정 지점 ③ 재질문).
