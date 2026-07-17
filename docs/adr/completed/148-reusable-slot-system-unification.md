# ADR-148: Reusable·Slot 시스템 단일화 — 전면 reusable entry 등록 + slot 모델 일반화

## Status

Implemented — 2026-07-17 (Proposed 2026-07-08, Accepted 2026-07-17)

진행 로그:

- 2026-07-07 — landscape 전수 실측 ([audits/2026-07-07-reusable-slot-landscape.md](../../reference/audits/2026-07-07-reusable-slot-landscape.md)) + 등록 구조 사용자 explicit confirm (**전면 reusable entry**) + 전체 설계도 작성 ([REUSABLE_SLOT_DESIGN.md](../../reference/components/REUSABLE_SLOT_DESIGN.md)).
- 2026-07-08 — 사용자 명시 요청("관련 미진행 ADR 폐기 + 신규 단일 ADR")으로 본 ADR 작성. 폐기 범위 explicit confirm: **ADR-147 만 Superseded by 본 ADR** (144/920 은 기존 Superseded, 910/911 은 비실행 참조 위상 존속). fork 4질문 + 통합 동기 분류(b류 — 가시 효과 큰 단일 영역 closure)는 breakdown §1 lock-in.
- 2026-07-17 — 사용자 재제기("slot 개념만 적용되었을 뿐 정상 동작 아님") + 코드 실측으로 **승계 전제 정정**: ADR-147 반영 완료분의 slot 조합 자식은 렌더·편집·projection 어디서도 소비되지 않는 미배선 구조로 확인 (Context 승계 표 #4, breakdown §2-1 실측 표). Phase 0 을 검증-only 에서 **승계 정정(배선) + 검증** phase 로 확장, R8 추가.
- 2026-07-17 — **Accepted 승격** (execute-adr 착수 절차): 리뷰 round 1(2026-07-07)·round 2(2026-07-14) 이슈 3건 전부 `fixed`, pending 0 — 종결 계약 성립. README 테이블 동시 갱신.
- 2026-07-17 — **Phase 0 Implemented (G1 통과)**: slot 자식 배선 정정 완료 — shared `slotRoles.ts` 신설(공용 vocabulary + `resolveSlotComposition`, builder-local 상수 re-home) + projection `_slots` 주입 + 소비 3경로(Skia `listbox_item` escape / DOM emit / layout 높이) 배선 + 편집기 양방향 동기 + stale 주석 정리. 검증: 신규 테스트 23건(slotRoles 12 + escape 9 + scene 2) + 관련 스위트 green(type-check 0) + **live 왕복 exercise**(adr148-p0-verify 프로젝트 — origin description slot 자식 제거→양축 미렌더·행 높이 50→32, label slot style 편집→origin 카드·instance 행·DOM inline 반영, 복원→원상). cross-check 중 발견 3건(layout Layer D 미배선 HIGH / anchor-less DOM 접근 불가 MED / icon 크기 CSS 비대칭 MED) 즉시 수정. 잔존: origin 패널의 편집 계약 표면은 Phase 2(propsSchema) 영역, Components 페이지 origin 카드 box 높이는 layout 이 flat props 기준(사용자 문서 무영향).
- 2026-07-17 — **Phase 1 Implemented (G2 통과)**: 등록 전환 — catalog `kind:"reusable"` entry 2건(Toolbar/Form, `reusableEntry()` 헬퍼) + 인덱스 2원화(`CATALOG_BY_TYPE` kind≠reusable / `REUSABLE_BY_TYPE` 신설 + `getReusableEntry`/`getReusableOriginId`/`getReusableEntries`) + 동명 primitive `placeable:false`(placeable 단일성 HC#3). `REUSABLE_COMPOSITE_ORIGINS` 하드코딩 맵 → catalog 파생 대체(`REUSABLE_ORIGIN_ENSURERS` 신설, ensure 는 catalog entry 순회), entryUniverse facet·palette 소비자 주석/파생 동시 갱신. registrationContract 불변식 R①~R④ 추가 + 전역 type 유일성 test 를 (kind,type) 복합 유일성으로 개정(리뷰 round 2 m1 해소). 검증: shared 618 + builder factories/components/palette green + type-check 0 + **live palette-add exercise**(Toolbar/Form 검색·클릭 → `type:"ref"` instance 생성 + origin resolve 렌더 양축 확인). 기존 실패 1건(factoryOwnership grid props — stash 왕복으로 본 phase 무관 확인) 별도 보고.
- 2026-07-17 — **Decision 4 확정 (Phase 2 진입 선행)**: propsSchema 저장 위치 = **`metadata.propsSchema`** 채택. `x-composition.propsSchema` 는 `CompositionExtension` 타입 확장이 필요하고 해당 namespace 는 ADR-131 이 축소 방향으로 판정 — 정합 정당화가 서지 않아 기각. `metadata` 는 CanonicalNode 명시 Extensibility hook 이라 **타입 변경 0**. 판독은 shared `readPropsSchema()`(방어적 — shape 어긋나면 null = gate off) 단일 진입.
- 2026-07-17 — **Phase 2 Implemented (G3 통과)**: IconButton 첫 신규 reusable 수직 슬라이스 + propsSchema 첫 소비. ① origin seed `iconButtonTemplateOrigins.ts`(root=Button primitive — Button.binding 파일럿 "아이콘 붙은 Button 은 reusable 조합 문서" 실현; 자식 Icon(slotRole:icon, optional)+Text(slotRole:label), 바인딩 `{icon}`/`{label}`; RSP 대조: 동명 컴포넌트 없음 → placeable 단일성 조치 불필요) ② **템플릿 바인딩 `{키}` 치환 엔진 신설** — shared `templateBinding.ts`(추출/판독/바인딩 산출/치환, **propsSchema gate**: 미선언 origin 의 placeholder 는 원형 보존 — ListBox row-data 바인딩 공존 계약) + resolve **양축 배선**(flat synthetic: `canonicalRefResolution.ts` / nested children: ADR-903 `resolvers/canonical` `_resolveRefNodeUncached` — 중첩 reusable 은 `_resolvedFrom` 에서 재귀 중단) ③ Inspector 소비 — `resolveEditContract` (A′) 분기: raw ref instance + doc → origin propsSchema → generic semantic 필드(dirty 판정 = instance 자체 props 보유, variant/size 옵션은 origin root type 의 theme rule 파생) ④ catalog entry + palette(PALETTE_ORDER/ICON_MAP/oracle). 검증: 신규 테스트 27건(templateBinding 11 + resolve 치환 5 + origin·키 1:1·Inspector 6 + 불변식 자동 확장) + shared 629 green + type-check 0 + **live G3 exercise**(palette-add → 양축 star+"Button" default 렌더 → Label "Save"/Icon heart/Variant negative 편집 → 양축 즉시 반영 + Overrides dirty·Reset 표시 → origin size xl 편집 → override 없는 instance 전파(data-size=xl) + override 우선(variant negative 유지) → md 원복). cross-check 중 **CSS↔Skia 발산 1건(HIGH) 발견·즉시 수정**: 치환을 flat 축만 배선하면 Preview(nested children consumer)가 placeholder 원형 렌더 — nested 축 배선으로 대칭 복원. 참고: Button 자식 시각 순서는 양축 공유 기존 규칙(Text 앞/Icon 뒤)이 origin 자식 순서보다 우선 — 발산 아님, 순서 소비는 Phase 3 검토 대상. 기존 실패 2건(factoryOwnership grid props / importRegistry G6-4 정적 가드 — stash 왕복으로 본 phase 무관 확인) 별도 보고.

- 2026-07-17 — **Phase 3 Implemented (G4 통과 — 적격 2종 / 보류 2종)**: factory-대체군 재판정 선행 (breakdown §3 재판정 표) — **InlineAlert/Card 적격** (DOM 자식 재귀 + catalog box shell + escape 없음) / **Toast 보류** (생성 진입점 0 — palette 비노출 "imperative 알림" 설계 기록 + AI 미참조. 전환 시 소비처 0 dormant 또는 palette 노출 제품 결정 강요) / **IllustratedMessage 부적격** (DOM `INTERNAL_RENDERERS` + Skia `illustrated_message` escape 모두 flat props self-compose — ADR-912 진로 1번 의도 설계, 환원에 재작성 필요). 적격 2종은 Phase 2 패턴 조립: origin seed 2건 (InlineAlert 2-slot `{title}`/`{description}` / Card 4-region — 바인딩 depth-2 자식, 구 propagation title/description 라우팅을 템플릿 바인딩이 대체) + propsSchema + catalog `reusableEntry` 2건 + 동명 primitive `placeable:false` + ensurer 2줄 + **factory seam 삭제** (`createInlineAlertDefinition`/`createCardDefinition` + method/creators + COMPLEX 2항목 — Toolbar/Form 선례, kill criteria "definition fallback 0" 충족). 검증: 신규 테스트 12건 (origin 2×5~6 + resolve depth-2 치환 1) + 계약 스위트 green (creators 54→52 / COMPLEX 48→46 인벤토리 정정, InlineAlert rendererMap exception 루프 제외) + type-check 0 + **live G4 exercise** (reload hydration seed 자동 합류 → palette-add 2종 → `type:"ref"` instance + 양축 default 치환 렌더 (Card 는 depth-2) → InlineAlert Title "Payment failed" 편집 → 양축 즉시 반영 + Overrides dirty/Reset → Card Variant secondary 편집 + 원복 → 실시간 전파·persist 왕복 확인). cross-check 중 **CSS↔Skia 발산 1건 (HIGH) 발견·즉시 수정**: `renderCard` 가 variant prop 을 shared Card 에 미전달 — DOM `data-variant` 가 항상 default "primary" 로 고정 (ADR-912 R6 S2 variant 전환 잔존 결함, legacy flat Card 포함 전 경로) → 전달 1줄×2분기 정정으로 대칭 복원. 부수 관찰 (scope 외 기록): ref instance 의 자식으로 다른 ref 를 넣은 중첩 시나리오에서 origin 자식 ↔ instance 자식 혼합 순서가 CSS (origin 먼저) / Skia (instance 먼저) 로 상이 — instance 자식 병합 순서의 기존 영역 (ADR-138 승계), Phase 4 진입 시 재실측 대상.
- 2026-07-17 — **Phase 4 Implemented (G4 통과 — 마지막 phase, Status 승격)**: collection item slot 이식 — GridListItem(label/description) + MenuItem(icon/label/shortcut/description, itemSchema 8키 중 시각 slot 4키 — 잔여 value/href/isDisabled/onActionId 는 데이터·동작 축이라 slot 대상 아님 판정). **선행 관문**: ADR-150 A2/A3 land 상태 재실측 — docs-only (코드 land 0, `COLLECTION_ROW_PROJECTION_WINDOW_LIMIT=100` 정적 cap 존속) → breakdown 조정 조항의 "역순" 분기 (150 G-A2/G-A3 이 본 결과 위에서 검증). ADR-147 모델 복제: ① origin seed 2건 (`gridListTemplateOrigins.ts`/`menuTemplateOrigins.ts` — anchor-less 단일 origin 리터럴, 멱등 repair) + hydration 3곳 체인 (createInitialProjectDocument/adapters·canonical/usePageManager — REUSABLE_ORIGIN_ENSURERS 아님: catalog reusableEntry 순회 기반이라 palette 비노출 origin 에 부적합) ② shared `SLOT_ROLES` += "shortcut" (R5 additive 1줄) ③ **projection `_slots` 주입** — `appendGridListRowProjection` 에 origin resolve + owner/카드 주입 + origin style overlay + `templateOriginId` 채움 + visit slot-자식 접힘 3타입 확장 (ListBoxItem→+GridListItem/MenuItem) ④ Skia `gridlist_card` escape 소비 (gating/스타일 overlay/스택 순서 — listbox_item 동형 stackEntries) + layout §1.55b2/§1.55c description gating (Layer D 대칭) ⑤ DOM emit 소비 — `renderGridList` 3단 fallback + `renderMenuItemSlotParts` 공용 helper (Menu.tsx MenuButton 내부 3곳 + CollectionRenderers 구조화 경로) + Preview provider 확장 (`templateSlotCompositions` 통합 계산 — gridList/menuItem 키 추가). Menu 는 Skia 에 trigger 만 렌더 (catalog rule, projection 없음) — 소비 표면 DOM 단일 축 기록. 검증: 신규 테스트 12건 (origin seed 2×2~4 + scene projection 1 — 구성·origin style·owner 주입·이중 렌더 차단) + specs 581/shared renderers 67/builder canvas 670 green + type-check 0 + **live G4 exercise** (reload hydration seed 자동 합류 (기존 프로젝트) → GridList/Menu 추가 + items 주입 → Skia 카드 label/description 2줄 렌더 → origin label slot style.color 편집 → 양 카드 즉시 전파 + persist 왕복 → **origin description slot 자식 삭제 → Skia 카드 1줄 (그리기+layout 높이) + Preview DOM description 미 emit (데이터 존재에도)** → Menu popover 4-slot emit → origin shortcut slot 삭제 → reload 후 shortcut 미 emit → origin 삭제 → ensure 신품 재시드 (멱등 repair 왕복)). scope 외 관찰 3건 기록: (a) **publish 앱 미소비** — apps/publish 는 registry 로 shared 컴포넌트 직접 렌더 (renderer/context 미경유) 라 slot 구성이 닿지 않음, Phase 0 ListBox 때부터의 기존 gap (잔존 위험 R9 로 아래 추가) (b) preview 실시간 전파 — origin slot 자식 삭제가 열린 preview 에 즉시 push 안 됨 (reload 후 반영, preview sync 채널 기존 특성) (c) 검증 중 잘못된 API 호출 (`updateSelectedStyle` 객체 인자) 이 origin children 재배열을 남김 — 정상 편집 경로는 순서 보존 확인, 시각은 canonical 순서를 정확히 소비.

## Context

reusable/slot 축의 결정과 구현이 4곳에 분산되어 있다: ADR-142(조합=canonical reusable 문서 — 상위 결정, Implemented) / ADR-912 R-5(조합=데이터 proof 2건, Implemented — 단 `REUSABLE_COMPOSITE_ORIGINS` 라는 catalog 밖 별도 레지스트리로 등록) / ADR-147(ListBoxItem slot 조합 — Proposed 인데 Phase 1~5 코드는 반영 완료, 본문 전제 3건 stale) / 설계도(2026-07-07). 그 결과 catalog `kind:"reusable"` entry 는 0건이고, "1 컴포넌트 = 1 등록"(ADR-912 사용자 1순위 목표)이 reusable 축에서만 미완이다.

**3-domain 분류 (ADR-063)**: D2(reusable 의 편집 계약 `propsSchema`) + D3(slot 자식의 Skia↔CSS 시각 대칭 — symmetric consumer) 중심. **D1 무관** — RAC slot(`<Text slot="label">`)은 RAC 권위를 그대로 소비하며 DOM/ARIA 재작성 없음. 등록 메커니즘(catalog)은 domain 횡단 인프라로 ADR-142 catalog 축의 연장이다.

**Generator 선차단 선언**: 본 ADR 은 CSS Generator/spec 확장이 **없다** — reusable instance 는 resolve 후 primitive 자식으로 기존 catalog 렌더 경로(DOM generic + buildCatalogShapes/escape)를 소비한다. 신규 selector/variant emit 없음.

**ADR-147 승계 + 정정 lock-in** (자동 승계 아님 — 2026-07-07 실측 정정):

|  #  | ADR-147 본문                                                 | 본 ADR 이 확정하는 정본 (= 현 구현)                                                                                                                                                                                                                                       |
| :-: | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | Skia 는 `ListBoxItem.spec render.shapes` 가 4-slot paint     | catalog rule + `listbox_item` skiaPrimitive(replace) — ADR-912 가 spec 물리 삭제 (`53da62b6a`→`d139a445b`)                                                                                                                                                                |
|  2  | SelectionIndicator 를 조합 자식 노드로 구조화                | render-time concern (ComponentTag 비멤버) — slot 자식은 icon/label/description 3종                                                                                                                                                                                        |
|  3  | `slot` 필드에 slot 이름 배열                                 | `slot` = pencil 공식 semantics(삽입 가능 reusable ID 추천 목록, resolver non-blocking 경고), slot 이름은 child `metadata.slotRole` — 두 축 직교                                                                                                                           |
|  4  | slot 조합 자식이 "authoring 구조 + slot 스타일 SSOT" 로 기능 | **2026-07-17 실측 — 미배선**: slot 자식(`slotRole`)의 소비처는 정의부 + Skia scene 제외 판정 2곳뿐, 렌더(DOM/Skia)·편집기·projection 전 경로가 flat props 를 읽음. "반영 완료" = 코드 커밋 완료이지 동작 검증 아님 (147 Phase 7 live 검증 미실행) — 좌표는 breakdown §2-1 |

**Hard Constraints**:

1. canonical schema 필드 변경 0 (ADR-142 HC#4). 신규 표현은 catalog entry / `metadata.slotRole` / origin extension 메타(propsSchema — 위치는 Decision 4)에만.
2. 신규 조합 추가 = origin seed 모듈 1개 + catalog entry 1개, factory 코드 변경 0 (ADR-912 HC#5 — Toolbar/Form proof 로 실측 검증된 계약 승계).
3. **placeable 단일성**: 같은 type 에 primitive entry 와 reusable entry 공존 시 `panel.placeable === true` 는 한쪽만 (`componentRegistrationContract.test.ts` 불변식으로 강제).
4. type-check baseline 무증가 + 기존 registrationContract 10 it green 유지.
5. slot 자식 시각은 `/cross-check` 3축(DOM/Skia/Style Panel) 대칭 + 60fps — canonical 노드 폭증 없음 (collection 은 ADR-146/147 projection 재사용).
6. `PropContract` 재사용 — 신규 `InspectorFieldKind` 도입은 scope 확장으로 금지, 필요 시 사용자 surface (ADR-915 HC#3 동형).

**Soft Constraints**: 개발 단계 — BC migration 코드 없음. 기존 사용자 문서 영향 수식화: **재직렬화 0 파일 / 영향 instance 0건** (Toolbar/Form instance 는 이미 `type:"ref"` 로 저장되고 있어 등록 경로 교체가 문서 payload 를 건드리지 않음).

## Alternatives Considered

### 대안 A: 단일 통합 ADR — 등록 단일화 + slot 일반화 + propsSchema 를 한 결정, 실행은 Phase 게이트 분리

- 설명: 전면 reusable entry(kind-분리 인덱스 + placeable 단일성 + `REUSABLE_COMPOSITE_ORIGINS` catalog 파생 대체) + slotRole 공용 vocabulary shared 승격 + origin extension 메타 propsSchema D2 계약을 단일 ADR 로 확정. Phase 0(ADR-147 승계 정합)~4(확대)는 독립 게이트.
- 근거: pencil 공식 format(reusable/ref/descendants/slot)과 RAC slot 모델이라는 두 외부 검증 자산의 접합 — ADR-142 대안 E 와 동일 계보. 등록·origin·propsSchema·slot 자식은 상호 결합 체인(entry→origin→propsSchema→slot 자식)이라 자연 그루핑상 단일 영역 (breakdown §1 직교성 분석).
- 위험: 기술 M — propsSchema 소비가 유일한 신규 표면(Inspector generic 분기), 단일 슬라이스(Phase 2)로 격리 / 성능 L — 생성·렌더 경로는 기존 검증분 재사용 / 유지보수 L — 정본 1개, 파생 test 로 등록 drift 차단 / 마이그레이션 L — 개발 단계, 문서 영향 0 수식화.

### 대안 B: 축별 3 ADR 분리 (등록 / slot vocabulary / propsSchema)

- 설명: 등록 전환 ADR + slot 일반화 ADR + D2 계약 ADR 로 분할.
- 근거: ADR 당 scope 최소화.
- 위험: 기술 L / 성능 L / **유지보수 H** — 세 결정이 상호 의존(등록 entry 가 origin 을 가리키고 origin 이 propsSchema·slot 자식을 담음)이라 문서 3개가 cross-gate 로 얽혀 stale 재발 — ADR-146→147 체인에서 선언·실현 분리가 낳은 stale(landscape §6)과 동형 / 마이그레이션 L.

### 대안 C: 결정 문서 없이 설계도 기반 개별 슬라이스 진행 (등록 이원화 잠정 유지)

- 설명: REUSABLE_SLOT_DESIGN.md 를 비공식 지침으로만 두고 슬라이스별 커밋 진행.
- 근거: 문서 작업 최소화.
- 위험: 기술 L / 성능 L / **유지보수 H** — 등록 이원화(catalog ↔ 별도 레지스트리) 영구화 + "1 컴포넌트=1 등록" 미완 고착 + 결정 비추적(미래 개발자가 "왜 reusable 만 catalog 밖인가"를 물을 곳 없음) / 마이그레이션 L.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    L     |      L       |     0      |
| B    |  L   |  L   |  **H**   |      L       |     1      |
| C    |  L   |  L   |  **H**   |      L       |     1      |

루프 판정: 대안 A 가 HIGH 0 으로 threshold 통과 — 추가 대안 루프 불요. 본 통합은 부담 절약(a류)이 아니라 단일 결합 영역 closure(b류)임을 breakdown §1 에서 차단 메모리(`feedback-adr-consolidation-burden-not-essence`) 2질문으로 확인했다.

## Decision

**대안 A: 단일 통합 ADR**을 선택한다.

세부 결정:

1. **전면 reusable entry** (사용자 confirm 2026-07-07): 모든 조합 컴포넌트는 catalog `kind:"reusable"` entry 로 등록한다. 동명 type 충돌(Toolbar/Form — origin root 가 RAC primitive type)은 **kind-분리 인덱스**(`CATALOG_BY_TYPE` = kind≠reusable 렌더·binding 소비 전용 / `REUSABLE_BY_TYPE` = 생성·팔레트 전용)와 **placeable 단일성**(HC#3)으로 해소한다. type 명 재배치는 하지 않는다 — 인스턴스 canonical type 은 `"ref"` 라 palette type 은 식별자일 뿐이다.
2. `REUSABLE_COMPOSITE_ORIGINS` 맵 / `entryUniverse` facet 판정 / palette 항목을 **catalog 파생으로 대체**한다. origin seed 모듈은 문서 부트스트랩 전용으로 잔존(`REUSABLE_ORIGIN_ENSURERS`), entry↔ensurer 누락은 test 로 강제한다.
3. **slot 2축 직교 유지**: slot 이름 = child `metadata.slotRole`(공용 vocabulary — shared `slotRoles.ts` 신설, ADR-147 의 ListBox 전용 상수 re-home), 삽입 추천 목록 = `CanonicalNode.slot`(pencil semantics, resolver non-blocking 경고 유지). 컴포넌트별 slot 구성의 SSOT 는 코드 상수가 아니라 origin 문서의 자식 구성이다. **단, 2026-07-17 실측 기준 이 명제는 목표 상태다** — 현 구현은 slot 자식을 소비하는 경로가 없어(Context 승계 표 #4) flat props 가 실질 데이터원이며, ListBoxItem 에서 이 gap 을 정정(배선)하는 것이 Phase 0 범위다. 배선 없이는 Phase 2(propsSchema)·Phase 4(모델 복제)가 미작동 모델 위에 쌓인다.
4. **D2 편집 계약**: origin 의 extension 메타 `propsSchema`(`PropContract` 재사용)가 reusable 편집 SSOT (ADR-142 Decision #14 실현). **저장 위치 확정 (2026-07-17, Phase 2 진입 시)**: **`metadata.propsSchema`** 채택 — `x-composition.propsSchema` 는 `CompositionExtension` 타입 확장이 필요하고 해당 namespace 는 ADR-131 이 events/actions 를 root collection 으로 이전하며 축소 방향으로 판정했으므로(`composition-document.types.ts:899-920`) 기각, `metadata` 는 CanonicalNode 명시 Extensibility hook(동 파일 :630)이라 타입 변경 0. 판독은 shared `readPropsSchema()` 단일 진입(방어적 — shape 어긋나면 null). Inspector `resolveEditContract` 가 ref instance 선택 시 이를 소비하고, 편집은 root props override(1차) / `descendants` 3-mode(자식 조준)로 기록한다. 템플릿 바인딩 `{키}` ↔ propsSchema 키 1:1 — propagation 손등록의 데이터 대체 방향 (placeholder 축은 resolve 치환, variant/size 는 origin root props passthrough — 두 축 모두 정적 test 로 강제).
5. **ADR-147 을 Superseded by 본 ADR 로 종결**한다. 코드 반영 완료분(Phase 1~5)과 정정 4건(Context 표 — #4 는 2026-07-17 실측 추가)은 본 ADR 이 정본으로 승계하고, 147 이 대기하던 cross-check/live 검증은 Phase 0 이 흡수한다. 승계는 "코드 커밋 완료" 승계이지 동작 보증 승계가 아니다 — slot 자식 미배선(표 #4)의 정정이 Phase 0 에 포함된다.
6. 실행은 Phase 0(승계 정정 — slot 자식 배선 + 검증) → 1(등록 전환) → 2(IconButton 첫 신규 reusable + propsSchema 첫 소비) → 3/4(확대 — 컴포넌트별 DELEGATING 재판정 게이트 선통과 조건부). 신규 표면은 첫 소비자와 동시 도입 (`feedback-no-dormant-foundation-ahead-of-flip` 정합 — 소비처 없는 선축 금지).

기각 사유:

- **대안 B 기각**: 상호 결합 체인을 3문서로 나누면 cross-gate drift — ADR-146(선언)→147(실현) 분리가 낳은 본문 stale 과 동형 재발. 유지보수 HIGH.
- **대안 C 기각**: 등록 이원화 영구화 + 결정 비추적. "1 컴포넌트=1 등록" 목표(ADR-912) 미완 고착. 유지보수 HIGH.

> 구현 상세: [148-reusable-slot-system-unification-breakdown.md](../design/148-reusable-slot-system-unification-breakdown.md)
> 아키텍처 상세(스키마 계약·인덱스·렌더 계약·패턴 5+1): [REUSABLE_SLOT_DESIGN.md](../../reference/components/REUSABLE_SLOT_DESIGN.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                            | 심각도 | 대응                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 인덱스 2원화 후 소비자 오조회 — 생성 분기(`useElementCreator.ts:158`)·facet(`entryUniverse.ts:259`)·팔레트(`paletteItems.ts`)가 잘못된 인덱스를 읽으면 ref 미생성/palette 누락                                                                                                                  |  MED   | 소비자 경계 = 인덱스 경계 설계(`getCatalogEntry` 시그니처 무변경). registrationContract 불변식 4종 + palette 스냅샷 test + G2 live palette-add           |
| R2  | propsSchema ↔ origin 템플릿 바인딩 `{키}` 불일치 — 편집해도 시각 무반응                                                                                                                                                                                                                         |  MED   | 키 1:1 정적 검증 test (origin 순회 대조) + G3 편집 왕복 live 확인                                                                                        |
| R3  | Phase 3 대상(Toast/Card 등)의 DELEGATING/어댑터 렌더러가 origin 자식 재귀로 환원 불가 → 이관 실패                                                                                                                                                                                               |  MED   | 컴포넌트별 재판정 게이트 **선통과 조건부** (ADR-912 R-5 적격 기준 승계 — 2026-06-16 판정에서 차기 적격 0 실측). 부적격은 개별 보류, phase 전체 차단 아님 |
| R4  | Card propagation(title→Header 라우팅) 을 템플릿 바인딩으로 대체 시 기존 문서 라우팅 회귀                                                                                                                                                                                                        |  MED   | hydration 멱등 repair(repairOrigin 패턴) + round-trip fixture. 개발 단계라 BC 코드 없음 — 영향 0 수식화(Soft Constraints)                                |
| R5  | slotRole vocabulary 조기 고정 → 실사용과 어긋남                                                                                                                                                                                                                                                 |  LOW   | additive string union — 확장 비용 상수 1줄. 컴포넌트별 allow-set 을 코드에 두지 않음                                                                     |
| R6  | reusable entry 의 `cutover` 필드 semantics 혼선 (`CATALOG_CUTOVER_TYPES` 포함)                                                                                                                                                                                                                  |  LOW   | `"catalog"` 고정 + 주석 — 인스턴스는 `type:"ref"` 라 cutover 게이트 실질 무영향 명시                                                                     |
| R7  | 단일 ADR 다축 통합 — 한 phase 실패 시 원인 분리 곤란                                                                                                                                                                                                                                            |  MED   | Phase = 독립 검증·revert 단위 (breakdown §3). Gate 실패는 해당 phase 만 보류, 선행 phase 산출물 유지                                                     |
| R8  | **ADR-147 승계분 slot 자식 미배선 확정** (2026-07-17 실측 — Context 표 #4): Phase 0 이 검증-only 가 아니라 정정 phase 가 되며, 배선 범위가 DOM emit·Skia escape·projection·편집기 4개 층으로 확대될 수 있음. 미정정 시 Phase 2(propsSchema)·Phase 4(모델 복제)가 미작동 모델을 복제해 결함 확산 |  HIGH  | G1 을 배선 정정 게이트로 확장(배선 완료 후 cross-check 3축 + live). Phase 2/4 는 G1 선통과 조건. 배선 좌표·범위는 breakdown §2-1/§3 Phase 0              |

| R9 | **publish 앱 slot 구성 미소비** (Phase 4 live 실측, 2026-07-17): `apps/publish` 는 registry 로 shared 컴포넌트를 직접 렌더 (shared renderer/RenderContext 미경유) 라 slot 구성 provider 가 닿지 않음 — origin 에서 slot 자식을 지워도 publish 출력은 flat-props BC 동작 유지. Phase 0 ListBox 배선 때부터의 기존 gap (신규 회귀 아님) | MED | 기록 + 후속 분리 — publish 는 published 문서만 로드하며 Components 페이지가 publishExcluded 라 origin 접근 자체가 별도 설계 필요 (publish 시점 구성 snapshot 동봉 등). builder Skia/Preview 양축 대칭은 G1/G4 로 검증 완료 |

잔존 HIGH 위험은 R8 1건 — G1 이 1:1 대응한다 (Phase 0 에서 정정·검증 후에만 후속 phase 진입). 그 외 phase 는 검증된 기존 메커니즘(R-5 생성 경로 / ADR-138 fork UX)의 확장이며, 유일한 신규 표면(propsSchema 소비)은 Phase 2 단일 슬라이스로 격리된다. R9 (publish) 는 Implemented 시점 잔존 MED — 후속 분리 기록.

## Gates

| Gate | 시점              | 통과 조건                                                                                                                                                                                                                | 실패 시 대안                                                               |
| ---- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| G1   | Phase 0           | **slot 자식 배선 정정 완료** (소비 4개 층 좌표별 — breakdown §3 Phase 0) 후 `/cross-check` ListBoxItem 3축 PASS + live 1회 (slot 자식 편집→시각 반영 왕복 포함) + slotRoles shared re-home 후 type-check baseline 무증가 | 배선 방향 사용자 재확정 (역할 격하=자식 제거 포함) 전 후속 phase 진입 금지 |
| G2   | Phase 1           | 기존 R-5 테스트 green + registrationContract 신규 불변식 4종 + palette 스냅샷 무변 + live palette-add(Toolbar/Form) ref instance·origin resolve 확인                                                                     | 등록 전환 revert — 현행 레지스트리 유지                                    |
| G3   | Phase 2           | propsSchema 편집 왕복(Inspector→instance 반영→origin 전파) live 확인 + 키 1:1 test + cross-check IconButton                                                                                                              | propsSchema 소비 보류 — entry/origin 만 유지                               |
| G4   | Phase 3/4 각 대상 | 대상별 DELEGATING 재판정 선통과 + factory definition fallback 0 + live parity                                                                                                                                            | 해당 컴포넌트만 보류 (phase 전체 차단 아님)                                |
| G5   | closure           | ADR-147 Superseded 체인 링크 정합 + README/CHANGELOG 동기 + **live behavior 게이트**(builder 에서 palette-add→편집→전파 1회 exercise 명시)                                                                               | Proposed 유지, Implemented 승격 금지                                       |

## Consequences

### Positive

- catalog "1 컴포넌트 = 1 등록"이 reusable 축까지 완성 — 등록 이원화(`REUSABLE_COMPOSITE_ORIGINS`) 해소.
- reusable/slot 결정 정본이 1개(본 ADR + 설계도)로 통합 — ADR-147 stale 3건 정정 승계.
- 첫 신규 조합(IconButton)이 "origin seed + entry 1개" 계약의 신규-type 실증이 되어 후속 조합 저작 경로 확립.
- propsSchema 소비로 ADR-142 Decision #14(generic Inspector의 reusable 축)가 실현.

### Negative

- Phase 3/4 는 재판정 조건부라 factory-대체군 확대 속도가 rendererMap #4 축(DELEGATING generic 흡수)에 종속 — 전 조합의 데이터화 완결은 본 ADR 범위 밖.
- 인덱스 2원화로 catalog 조회 API 가 2벌(`getCatalogEntry`/`getReusableEntry`) — 소비자 경계 주석·test 유지 비용.
- ADR-910/911 등 아키텍처 전환 기록과의 관계는 참조로만 유지 — 문서 지형 정리는 부분적.

## References

- [ADR-142](142-starter-spec-component-system-cutover.md) — base (조합=canonical reusable 문서, Implemented)
- [ADR-912](912-rac-pencil-rebuild-cutover.md) — R-5 proof + 6 registry collapse (Implemented)
- [ADR-147](147-listboxitem-slot-composition.md) — **Superseded by 본 ADR** (slot 모델 실증 승계)
- [ADR-146](146-listboxitem-ref-template-row-projection.md) / [ADR-138](138-component-palette-reusable.md) — projection·fork UX 승계 (변경 0, 138 흡수 사용자 confirm 2026-07-08)
- [ADR-144](144-collection-template-element-ssot.md) — 기 Superseded (by ADR-145) — 145→146→147 계보 경유로 잔여 collection item slot 확산은 본 ADR Phase 4 가 흡수 (2026-07-08 확인)
- [REUSABLE_SLOT_DESIGN.md](../../reference/components/REUSABLE_SLOT_DESIGN.md) / [landscape 실측](../../reference/audits/2026-07-07-reusable-slot-landscape.md)
