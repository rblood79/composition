# ADR-233: Tabs 의 Tab 항목 템플릿 origin + Radio origin — 반복 항목의 origin/instance 확장

## Status

Implemented — 2026-09-23 (`/execute-adr 233` Phase 0~~4 / G0~~G4 같은 날 종결 — [구현 기록](../design/233-tab-item-template-and-radio-origin-breakdown.md#6-실행-기록)) · Accepted — 2026-09-23 (사용자 `/execute-adr 233` "완료까지 모든 phase") · [리뷰](../reviews/233.md) round 1 (HIGH 1 · MEDIUM 1 · LOW 1) 설계 수리 → round 2 수리 검증 **pending 0 · 설계 승인 가능** (같은 날) — 독립 Radio origin 의 Preview render-only RadioGroup 호스트 계약 (h1) · 기존 시스템 root 의 허용 보충 필드 분리 (m2) · G3 측정 조건 (l3). 구현 검증 round 3 (HIGH 1 · MEDIUM 1 · LOW 1) 수리 — 같은 날: Radio 채움 = 선택 표시 색 (두 leg 같은 영역) · Preview Tabs 마다 자기 slot · placeable 문구 정정 ([breakdown §6 round 3](../design/233-tab-item-template-and-radio-origin-breakdown.md#round-3-수리)).

> **[ADR-234](234-variant-instances-and-slot-filled-collections.md) 가 일부 대체 (2026-09-23)**: Tab 항목 템플릿 origin 은 선택 상태가 origin · 휴지 = `--unselected` ref 변형 (`-selected` 복제본 제거) · Tabs slot 은 root → TabList · 정적 Tab 은 `items` 가 아니라 TabList 의 Tab instance 자식. `INDICATOR_FILL_CSS_VAR` (Radio 선택 표시 색) 와 독립 Radio 호스트 계약은 그대로.

설계 요청: 사용자 (2026-09-23) — "컴퍼넌트 origin, instance, slot 작업 이어서 진행" → 후속 후보 코드 실측 보고의 권장안 ("1 + 2 를 한 ADR 로") 뒤 `/create-adr`. ADR-229 §후속 후보 (다른 collection 의 item template) 와 ADR-230 보류 (Radio/Tab base origin) 의 교집합이다.

## Context

**SSOT 3-domain 관계**: **D3 의 조합 축** (ADR-142 "조합 = canonical reusable 문서" · ADR-147/148 item template · ADR-228 reusable origin · ADR-230 상태 변형 origin) 의 적용 범위 확장. D1 무관 — Tab 과 Radio 는 RAC primitive 그대로 그려지고 DOM 구조를 바꾸지 않는다. D2 는 읽기만 — catalog binding · PropContract kind/값 무변경 (Radio reusable 등록은 `componentCatalog.ts` 의 목록 한 줄). canonical 타입 변경 0 — `slot` · `metadata.variant` · `type:"ref"` · `<origin>--<state>` 전부 228~230 의 모양.

### 문제

1. **Tab 은 Components 페이지에서 편집할 자리가 없다.** ADR-066 뒤 Tab 은 `items [{id,title}]` 데이터로만 만들어지고, 행 projection 이 `templateOriginId: null` 로 Tab catalog rule + items 만으로 Tab 을 합성한다 (F2). 229 이전 TagGroup 과 같은 상태다 — Tab 의 조합·스타일 (padding · 글자 굵기 · 선택된 탭 배경) 은 rule 값으로만 바뀐다. Preview 는 `<Tab id>{item.title}</Tab>` 로 plain 텍스트만 그린다 (F5).
2. **Radio 는 origin 이 없다.** RadioGroup 은 canonical 자식 Radio 를 직접 가진다 (F9) — Checkbox/CheckboxGroup 과 같은 구조인데, Checkbox 는 228 로 origin 이 생겨 229 규칙 (`toOriginChildSeed`) 이 CheckboxGroup 자식을 ref 로 바꾸지만 Radio 는 reusable origin 이 없어 plain 으로 남는다 (F10 · F11). 그래서 ADR-230 이 Radio 에 상태 변형 (Selected · Disabled …) 을 걸지 못했다 (F14).

### 코드 사실 (2026-09-23, main `3f50bcf6c`)

요약 — 전문은 breakdown §2 (F1~F20, 경로:라인).

- 항목 템플릿 origin 은 ListBox · GridList · Menu · Tag 4개뿐 (F1). Tag 선례의 read-through = `resolveTagTemplateOriginIds` / `resolveTagItemTemplateStyle` (`canvasSceneNode.ts:674-727`) + chip 주입 (`:2161-2181`) + Preview `templateSlotCompositions.tag` (`App.tsx:300`, `:893-898`) (F4 · F6).
- Tab 행: `appendTabRowProjection` (`canvasSceneNode.ts:2486-2585`) 의 rows group · 각 Tab 모두 `templateOriginId: null`, 선택 판정은 `selectedKey ?? defaultSelectedKey` (`:2505-2511`, Tag 와 다름) (F2 · F3). Preview `renderTabs` (`LayoutRenderers.tsx:118`, `:197`) 는 템플릿 · 항목별 disabled 를 안 읽는다 (F5).
- Radio: catalog primitive (`componentCatalog.ts:595`) · reusable 목록 (`:1228-1296`) · 팔레트 (`paletteItems.ts:186`) 어디에도 origin 이 없다 (F10). 팔레트 밖 reusable 선례 = Modal `placeable:false` (`:1316-1338`) (F13).
- 2단 seed 는 이번 호출 전에 없던 origin 의 자식만 ref 로 바꾼다 (`originChildRefs.ts:384-420`) — 기존 문서의 `component-radiogroup` 자식은 plain 으로 남는다 (F12).
- Skia Radio 선택 = 조상 RadioGroup `value` 우선 (`buildSpecNodeData.ts:1154-1170`) · Preview RadioGroup 은 `child.type === "Radio"` 로 자식을 거른다 (`FormRenderers.tsx:901-920`) — ref 자식은 해소기가 master type 으로 실체화한 뒤라야 두 leg 가 Radio 로 읽는다 (F15 · F16).
- Preview 는 Radio 를 catalog RAC primitive 로 직접 그리고 (`CanonicalNodeRenderer.tsx:574-644`), 고아 collection 항목만 최소 RAC 호스트로 감싼다 (`ORPHAN_ITEM_HOST` `:134-140` — listboxitem · gridlistitem · menuitem · tag · treeitem, Radio 없음). `renderRadio` 의 그룹 fallback (`FormRenderers.tsx:868`) 은 이 경로에서 호출되지 않는다 → Components body 의 독립 Radio 는 `TypeError: … reading 'isDisabled'` 로 Preview 를 죽인다 (리뷰 h1 진단 RED · 독립 Tab 은 통과). selected 변형은 Preview 에서 `isSelected: true` 만 켠다 (`:467`) — RAC Radio 는 그룹 `value` 로만 선택된다 (F18 · F19).
- 기존 시스템 root 의 slot 보충 선례: Tag 는 `component-taggroup` 에 slot 이 없을 때만 채운다 (`tagGroupTemplateOrigins.ts:163-165`) — 기존 노드의 JSON 은 이 필드 하나만큼 바뀐다 (F20).

### Hard constraints

- **두 leg 대칭**: Tab 항목 origin 의 root style · label slot style · selected 변형을 바꾸면 Skia Tab 과 Preview Tab 이 같이 바뀐다. `component-radio` · `Radio/Selected` 편집은 RadioGroup instance 안 Radio 에 두 leg 로 같이 닿는다.
- **ADR-066 유지**: Tab 은 계속 `items` SSOT 다 — Tab element 를 canonical 에 되살리지 않는다. TabPanel `itemId` 페어링 무변경.
- **등록 단일성**: Tab 항목 origin 은 팔레트 항목이 아니다 (ListBoxItem · Tag item 과 같은 template origin). Radio origin 은 reusable 로 등록하되 팔레트 노출 0 — `PALETTE_ORDER` 무변경 (노출 정본). `placeable` 은 팔레트 노출이 아니라 AI 등의 삽입 가능 여부라 reusable 쪽 true · 같은 이름 primitive false (실행 중 정정 — breakdown §6 Phase 2).
- **BC**: migration 0. 불변 대상과 허용 보충을 나눈다 — (i) **불변**: 사용자 저작 노드 전부 · 기존 origin 의 자식·순서·props · 사용자가 둔 `slot` (있으면 보존) · 기존 `component-radiogroup` 의 plain 자식. (ii) **허용 보충 (시스템 root 필드 1)**: `component-tabs.slot` 이 **없을 때만** `[default, selected]` 를 채운다 (Tag F20 과 같은 정책). (iii) **추가 노드**: Tab 항목 origin 2 (+ label 자식 2) · `component-radio` 1 (+ Label 1) · Radio 상태 변형 5 (+ Label 5) = 16. Δbyte 는 추정 ≈ 3.3 KB 이고 G0 에서 실제 직렬화로 확정한다. 재hydration Δnode · Δfield · Δbyte 0.
- **성능**: 같은 세션 A/B 로 `scene.build` p95 ≤ +1 ms — Tabs 100 × Tab 5 projection · RadioGroup 100 × Radio 3 ref.

### Soft constraints

- 범위 밖 (후속 후보로만 기록): Tab 항목의 disabled/hover/pressed 변형 (ListBoxItem/Tag `--disabled` 와 같은 줄) · Breadcrumbs 항목 템플릿 · Select/ComboBox 팝업의 ListBoxItem 템플릿 소비 · 기존 문서 plain 자식의 ref 이관 · Table/Tree.
- Preview iframe 실측은 지금 열지 않는다 (사용자 지시 2026-09-22 ×3) — Preview 축은 renderer unit 으로 고정하고 사용자 확인 대상으로 보고한다. 지시가 해제되면 live 로 올린다.
- 기존 비대칭 F5 (Skia Tab 은 `row.isDisabled` 를 읽고 Preview 는 안 읽음) 는 이 ADR 이 만든 것이 아니다 — Phase 0 에서 재현만 기록하고 수리는 범위 판정 후.

## Alternatives Considered

### 대안 A: 229/230 모델 적용 — Tab 항목 템플릿 origin (Default/Selected) + Radio reusable origin (팔레트 밖) + Radio 상태 변형

- 설명: `component-tab-item-default/-selected` (자식 Text `{label}`) + `component-tabs` root `slot` + Tab 행 projection · Preview `renderTabs` read-through (Tag 선례 복제). Radio 를 reusable 로 등록 (`placeable:false`) → `component-radio` seed · 새 RadioGroup origin/생성 경로의 Radio 자식이 229 규칙으로 ref · `STATE_VARIANT_BASE_TYPES` 에 Radio 추가 (230 경로 그대로).
- 근거: 선례 3 — ListBox → GridList/Menu (ADR-148 P4) · TagGroup (ADR-229) · 기본 요소 5 (ADR-230). Figma 의 nested instance + variant property, RAC 의 `Tab`/`Radio` 가 각각 Tabs/RadioGroup 안 재사용 primitive 인 구조와 같다.
- 위험: 기술(**H** — 독립 Radio origin (default · 상태 변형) 은 RadioGroup 문맥이 없어 Preview 가 크래시한다 (F18, 리뷰 h1 진단 RED) · 그 밖에 Preview Tabs 템플릿 주입 채널 신설 · Tab 폭 측정 층 (229 F28 선례) · Radio ref 자식의 두 leg 실체화 (F15 · F16) 미실측) / 성능(M — Tab 행마다 template style 1회 · Radio instance merge) / 유지보수(L — 기존 해소기 재사용, 새 경로 0) / 마이그레이션(L — 기존 문서 불변, 보충만)

### 대안 B: Tab 을 canonical 자식 (Tab element) 으로 되돌리고 Tab 도 reusable origin

- 설명: ADR-066 을 되돌려 TabList 가 Tab 자식을 가지게 하고, Tab 을 Radio 처럼 origin/instance 로.
- 위험: 기술(M) / 성능(L) / 유지보수(**H** — ADR-066 items SSOT · propagation (Tabs → TabList.items) · TabPanel 페어링 · 데이터 바인딩 (`useCollectionData`) 전부 재설계) / 마이그레이션(**H** — 모든 Tabs 문서의 자식 형태 변경)

### 대안 C: Radio 를 RadioGroup `items` 로 옮겨 Tag 처럼 항목 템플릿

- 설명: Radio 자식을 없애고 RadioGroup `items` + Radio 항목 템플릿 origin.
- 위험: 기술(M) / 성능(L) / 유지보수(**H** — CheckboxGroup (canonical 자식 + Checkbox origin) 과 모델이 갈린다 · ADR-912 starter 구조 역행) / 마이그레이션(**H** — RadioGroup 문서 전부)

### 대안 D: 현행 유지 + Tab/Radio rule 값 편집 UI

- 설명: Components 페이지 대신 Theme/Styles 표면에서 Tab/Radio rule 을 편집.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 조합 (slot) 과 상태 변형을 rule 로 표현 못 함, 229/230 과 다른 두 번째 모델) / 마이그레이션(L)

### Risk Threshold Check

| 대안  | HIGH+               | 판정                                                  |
| ----- | ------------------- | ----------------------------------------------------- |
| **A** | 기술 H 1            | 채택 — H 는 render-only 호스트 계약 + G0 · G1 로 관리 |
| B     | 유지보수 H · 이관 H | 기각 — ADR-066 역전, 사용자 요청 범위 밖              |
| C     | 유지보수 H · 이관 H | 기각 — CheckboxGroup 과 비대칭                        |
| D     | 유지보수 H          | 기각 — 229 D · 230 D 와 같은 사유                     |

루프 1회: 기술 H 는 모델이 아니라 Preview 렌더 경계 (고아 Radio 호스트) 의 누락이다 — `ORPHAN_ITEM_HOST` 와 같은 자리의 renderer 수리로 닫히고 B·C·D 는 이 위험을 없애지 않으면서 H 를 더한다 (B·C 도 Components 에 Radio/Tab origin 을 두면 같은 호스트가 필요). 대안 추가 없이 A 유지.

## Decision

**대안 A.** Tabs 에 TagGroup 과 같은 항목 템플릿 origin (Default · Selected) 을 붙이고, Radio 를 팔레트 밖 reusable origin 으로 등록해 RadioGroup 자식 ref 화와 상태 변형을 230 경로로 연다.

- **Tab 항목 템플릿**: `component-tab-item-default` · `component-tab-item-selected` (`metadata.variant: "selected"`), 자식 Text `{label}` (`slotRole: "label"`). slot 보유자는 `component-tabs` root (229 F27 — Tag 와 같은 자리). Skia 는 Tag 선례와 같은 resolver 모양 (`slot[0]` default · `metadata.variant` selected · 상수 안전망) 으로 style/fills/slot 을 Tab 행에 주입하고 선택 판정 (F3) 은 그대로 둔다. Preview 는 Tabs 마다 같은 slot 규칙 (ref instance = master slot · 문서 Tabs = 자기 slot · 없으면 상수 — round 3 m2) 으로 고른 template 을 `renderTabs` 가 같은 shared 함수 (`resolveItemTemplateChipStyle`) 로 적용한다. 폭·높이 측정 층도 같은 템플릿을 읽는다.
- **Radio origin**: reusable 등록 (팔레트 밖 = `PALETTE_ORDER` 미등재 · reusable `placeable` true · 같은 이름 primitive `placeable:false` — 설계 초안의 "Modal 선례 둘 다 false" 는 AI Radio 삽입 경로를 끊어 실행 중 정정) · seed = `buildCatalogOrigin("Radio")` (factory 와 같은 트리). 새 `component-radiogroup` origin 과 생성 경로의 Radio 자식은 229 규칙이 자동으로 ref 로 바꾼다. 기존 문서 origin 자식은 plain 유지.
- **독립 Radio 의 Preview 호스트 (render-only)**: Components body 의 `component-radio` 와 상태 변형처럼 RadioGroup 조상이 없는 Radio 는 Preview 가 최소 RAC `RadioGroup` (`display: contents`, aria-label) 으로 감싼다 — `ORPHAN_ITEM_HOST` 와 같은 자리의 renderer 경계 수리이고 canonical 트리 · binding 은 바꾸지 않는다. 호스트 `value` = 유효 selected (자기 `isSelected` 또는 selected 변형) 일 때 그 Radio 의 `value`, 아니면 `null` — selected 표현을 자식 `isSelected` 가 아니라 RAC 계약 (그룹 value) 으로 연결한다. `isDisabled` 는 Radio 에 그대로. RadioGroup 조상이 있으면 (ref 자식 포함) 호스트를 만들지 않는다 (조상 추적 `collectionAncestor` 에 `radiogroup` 추가). Skia 는 조상이 없으면 이미 자기 상태로 그린다 (F15) — 두 leg 가 같은 유효 상태를 읽는다.
- **Radio 채움 (fills) = 선택 표시 색 (round 3 h1)**: catalog 정본은 Radio `fill.default.selected` 를 선택 표시 색으로 두고 Skia `radio` primitive 도 root 배경색을 선택 점에만 칠한다 (행 배경 없음). DOM 은 같은 색을 RAC 행 배경이 아니라 Radio.css 가 선택 표시를 그리는 `--radio-color` 로 보낸다 — instance inline (`CanonicalNodeRenderer`) 과 상태 변형 CSS (`collectStateVariantCss`) 두 경로 모두 shared 표 `INDICATOR_FILL_CSS_VAR` 하나를 읽는다. 표 밖 타입 (Checkbox 등) 은 종전대로.
- **Radio 상태 변형**: `STATE_VARIANT_BASE_TYPES.Radio = [selected, disabled, hover, pressed, focus-visible]` — seed · 두 leg 해소는 230 경로 무변경, Skia 유효 selected 는 RadioGroup `value` 투영 뒤.

위험 수용 근거: 기술 H (독립 Radio Preview 크래시) 는 canonical · binding 을 건드리지 않는 render-only 호스트로 닫고, G0 에서 production catalog 경로 RED 를 먼저 고정한 뒤 G1 에서 GREEN 으로 확인한다 — 호스트가 두 leg 유효 상태를 못 맞추면 Radio 절을 보류한다. 그 밖에는 새 해소 경로를 만들지 않는다 — Tab 은 Tag read-through 복제, Radio 는 229 조합 자식 규칙과 230 상태 변형의 입력 (base origin) 만 채운다. MED 기술 위험 두 곳 (Preview Tabs 주입 · Radio ref 두 leg 실체화) 은 G0 에서 진단 RED 로 먼저 고정하고, Radio 쪽이 base 해소기 계약 변경을 요구하면 Radio 절만 보류한다 (breakdown §5). 기각 사유: B·C 는 이미 확정된 SSOT 모델 (ADR-066 · ADR-912 starter 구조) 을 역전하고 모든 해당 문서를 바꾼다 · D 는 조합과 상태를 표현하지 못한다.

> 구현 상세: [233-tab-item-template-and-radio-origin-breakdown.md](../design/233-tab-item-template-and-radio-origin-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                               |  심각도  | 대응                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Preview `renderTabs` 가 템플릿을 안 읽으면 Skia Tab 만 바뀐다 (F5 · F6) — 두 leg 비대칭                                                                                                            |   MED    | G1 renderer unit (템플릿 입력 → Tab DOM style) · G2 Skia live + 사용자 확인                                                                           |
| R2  | Radio ref 자식이 Preview 에서 `type:"ref"` 로 남으면 `child.type === "Radio"` 필터가 버린다 · Skia 는 RadioGroup 조상 탐색 (깊이 3) 이 ref 층에서 끊길 수 있다 (F15 · F16)                         |   MED    | G0 손 fixture 두 leg RED/GREEN — base 해소기 계약 변경이 필요하면 Radio 절 보류                                                                       |
| R3  | Tab 폭·높이 측정이 템플릿 style (padding · fontWeight) 을 안 읽으면 그리기와 배치가 어긋난다 (229 F28 chip 폭 선례)                                                                                |   MED    | Phase 0 측정 층 확정 · G2 Skia rect = 텍스트 폭 + 템플릿 padding                                                                                      |
| R4  | Radio 를 `PALETTE_REUSABLE_ORIGIN_TYPES` 에 넣으면 이름과 뜻 (팔레트) 이 어긋나고 등록 ratchet test 가 흔들린다                                                                                    |   LOW    | Phase 2 에서 test 영향으로 판정 — 필요하면 별도 상수로 분리                                                                                           |
| R5  | 기존 문서는 `component-radiogroup` 자식이 plain 이라 `component-radio` 편집이 Components 의 RadioGroup origin 에 안 닿는다 (F12) — 새 문서와 동작이 갈린다                                         |   LOW    | 228 R6 과 같은 공존 · Consequences 에 기록 · 이관은 후속 후보                                                                                         |
| R6  | 중첩 ref · 행별 템플릿 주입이 `scene.build` 에 누적 (228 잔여 (a) 위)                                                                                                                              |   MED    | G3 A/B                                                                                                                                                |
| R7  | 독립 Radio origin (default · 상태 변형 5) 이 Components 페이지 Preview 를 크래시시킨다 — RadioGroup 문맥 부재 (F18, 리뷰 h1 진단 RED) · selected 변형이 그룹 value 없이는 선택으로 안 보인다 (F19) | **HIGH** | render-only RadioGroup 호스트 계약 (Decision) · G0 RED 고정 · G1 production catalog 경로 독립 default/selected/disabled + 그룹 안 ref (호스트 중복 0) |

잔존 HIGH 1 (R7) — G0 · G1 에 1:1 대응. **해소 (2026-09-23)**: G0 RED 5 (`TypeError … isDisabled`) → catalog 경로 `hostOrphanRadio` 뒤 GREEN 6 (default · isSelected · Selected 변형 · Disabled 변형 · display:contents · 그룹 안 호스트 0). R2 는 G0 ② GREEN (두 해소기가 이미 Radio 로 실체화) 으로 해소. R4 는 별도 상수 `NESTED_REUSABLE_ORIGIN_TYPES` 로 해소 (등록 모양은 다른 reusable 과 같다 — breakdown §6 Phase 2 정정).

## Gates

| Gate | 시점      | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 실패 시 대안                                              |
| ---- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| G0   | Phase 0   | F1~F20 재grep 일치 · 미확정 3건 확정 (Tab 항목 추가 경로 · Tab 측정 층 · Radio ref 실체화) · 진단 RED 3 고정 (Tab 템플릿 미소비 · Radio ref fixture 두 leg · **독립 Radio production catalog 렌더 크래시**) · 추가 origin 노드 16 의 실제 Δbyte 측정                                                                                                                                                                                                        | Radio ref 가 base 계약 변경 요구 → Radio 절 보류          |
| G1   | Phase 1·2 | unit (원복 RED): Tab resolver (slot/variant/상수) · 행 주입 · 선택 판정 불변 · renderTabs 템플릿 적용 · Radio 등록 (팔레트 노출 0 · 같은 이름 primitive placeable false) · 새 origin 자식만 ref · 기존 자식 보존 · Radio 상태 변형 seed · 유효 selected · **Preview production catalog 경로 (`getCatalogCutoverTypes`) 에서 독립 Radio default/selected/disabled 렌더 성공 + selected 만 `data-selected` · 그룹 안 ref Radio 는 호스트 0 (RadioGroup 1개)** | 해당 phase 롤백                                           |
| G2   | Phase 3   | Skia live: Tab 항목 origin 편집 → Tabs instance Tab rect + 픽셀 동시 Δ · `component-radio` / `Radio/Selected` → 새 RadioGroup instance Radio 두 상태 · Preview 는 renderer unit + 사용자 확인 대상                                                                                                                                                                                                                                                          | 비대칭 leg 수리, 못 하면 그 축 보류                       |
| G3   | Phase 3   | 같은 세션 headed A/B, fixture 쌍 (plain arm = 템플릿 origin 없음 · Radio plain / ref arm = 233 모양) · 조작 3 (정적 편집 · **항목 origin 편집 (Tab 항목 padding · `component-radio` fills — 전 instance 무효화)** · breakpoint 전환) · warm-up 3 · 페이지 1개만 보이게 · DPR 고정 · `SCENE_BUILD` 라벨 7회 p95 median ≤ +1 ms (Tabs 100×5 · RadioGroup 100×3)                                                                                               | resolved instance identity 캐시 (228 잔여 가설) 또는 축소 |
| G4   | Phase 4   | BC: 사용자 저작 · 기존 origin 자식/순서/props · 사용자 slot 불변 · 허용 보충 = `component-tabs.slot` (부재 시만) 필드 1 · 추가 노드 16 · Δbyte = G0 실측 · 재hydration Δnode/Δfield/Δbyte 0 · 기존 RadioGroup origin plain 자식 유지 (unit + IndexedDB 저장 층 live)                                                                                                                                                                                        | migration 0 유지 못 하면 중단                             |

### Live Exercise

2026-09-23 · 실제 builder (dev 5173) · headed Playwright · Skia 캔버스 · store · IndexedDB 저장 층. Compare Mode / Preview iframe 은 사용자 지시 (2026-09-22 ×3) 로 열지 않았다 — Preview 축은 renderer unit (`tabsItemTemplate` · `CanonicalNodeRenderer.standaloneRadio`) 으로 고정했고 **사용자 확인 대상**이다.

- **G2 `adr233-tab-radio-live.mjs` 10/10**: 새 프로젝트 seed (Tab/Default·Tab/Selected + label · `component-tabs.slot` · `component-radio` + Label · Radio 변형 5 · 새 RadioGroup origin 의 Radio 자식 ref) → Tabs instance · RadioGroup instance 를 사용자 페이지에 두고 — Tab/Default padding 24/10 → Tab 행 폭 +24 · 높이 40 · TabList 40 · 선택 TabPanel +11 (겹침 0) · label fontWeight 700 · Tab/Selected fills → 선택 Tab 만 픽셀 · `component-radio` opacity → instance Radio 전부 픽셀 · `component-radio` paddingLeft 8 → instance Radio rect +8 · Radio/Selected → 선택 Radio 만 픽셀 · reload 보존 · Components body 순서 Δ0 · page error 0.
- **G4 `adr233-bc-live.mjs` 6/6**: 저장 층에서 233 이전 모양으로 되돌린 문서를 reload — 추가 노드 16 · `component-tabs.slot` 보충 · 기존 RadioGroup origin 의 plain Radio 자식 유지 · 사용자 저작 그대로 · Skia 에 옛 RadioGroup instance Radio 2 · plain Tabs 행 2 · 재reload Δnode/Δbyte 0.
- **G3 `adr233-g3-perf-ab.mjs`**: `scene.build` p95 pair median Δ ≤ +0.7 ms (6 조작) — [evidence](../evidence/233-g3-perf-ab.md) (로컬).
- **round 3 수리 (2026-09-23)**: Radio 채움 영역 · Preview Tabs 사용자 slot 은 둘 다 **Preview (DOM) 쪽만** 바뀌어 live 는 위 지시대로 열지 않았다 — `adr233Round3.fillAndTabSlot` unit (Skia draw data · 상태 CSS · production catalog 렌더 · Canvas scene 과 DOM 을 같은 문서로 대조, 원복 RED 3) 으로 고정했고 **사용자 확인 대상**이다. G2 의 L7 은 fills 대신 opacity 로 돌았다 — fills 계약은 이 unit 이 맡는다.
- live 가 잡은 결함 2 (unit 통과): Tab 높이 두 leg 비대칭 (생성 CSS 고정 높이) · TabList 고정 높이 + Tab 테두리 기본값 1px — 둘 다 수리 (breakdown §6 Phase 3).

## Consequences

### Positive

- Tabs 가 ListBox · GridList · Menu · TagGroup 과 같은 항목 템플릿 모델 — Components 페이지에서 Tab 모양을 한 번 정하면 모든 Tabs 가 따른다.
- Radio 가 Checkbox 와 같은 origin/instance 자리 — 새 RadioGroup 안 Radio 가 `component-radio` 를 따르고, ADR-230 의 상태 변형 (Selected · Disabled · Hover …) 이 Radio 에도 열린다.
- 새 해소 경로 0 — 229/230 의 resolver · 자식 ref 규칙 · 상태 해소를 그대로 쓴다.

### Negative

- 기존 문서의 RadioGroup origin 자식은 plain 으로 남아 새 문서와 동작이 갈린다 (R5) — 기존 문서 이관은 후속 후보.
- Tabs origin Slot 절의 "+" 는 삽입 없음 — Tab 추가 (items + TabPanel 쌍) 경로가 제품에 없다. 탭 추가 UI 는 후속 후보.
- Radio 는 채움을 선택 표시 색으로 정했지만 (round 3 h1) Checkbox 등 다른 선택 컨트롤은 여전히 두 leg 뜻이 다르다 (Skia 표시 상자 · DOM 행 배경) — `INDICATOR_FILL_CSS_VAR` 에 넣으면 같은 경로를 타며 후속 후보. 선택 표시 모양 자체 (Skia 얇은 테 + 점 · DOM 두꺼운 테 + 흰 가운데) 의 차이도 233 이전부터의 것으로 범위 밖.
- Preview 축 검증은 unit + 사용자 확인으로 남는다 (Compare Mode 보류 지시).
- Components 페이지 노드 +16 (Tab 항목 origin 2 · Radio origin 1 · Radio 변형 5, 각 자식 포함).
- 후속 후보 (이 ADR 밖): Tab 항목 disabled/interaction 변형 · Breadcrumbs 항목 템플릿 · Select/ComboBox 팝업의 ListBoxItem 템플릿 소비 · 기존 문서 plain 자식 ref 이관 · Table/Tree.
