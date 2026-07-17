# Reusable·Slot 시스템 전체 설계도 — 전면 reusable entry 모델

> 2026-07-07. **비실행 설계 참조** — 본 문서는 목표 구조와 전환 경로를 확정하는 설계도이며,
> 각 Wave 착수는 후속 결정(필요 시 ADR 작성은 사용자 명시 요청 경유)이다.
>
> **공식 결정: [ADR-148](../../adr/completed/148-reusable-slot-system-unification.md)** (Proposed 2026-07-08) —
> 본 설계도의 Wave 0~4 는 ADR-148 Phase 0~4 로 승계됐다. 결정·위험·Gate 는 ADR-148 이 정본,
> 본 문서는 아키텍처 상세(스키마 계약·인덱스·렌더 계약·패턴) reference 로 유지된다.
> ADR-147 은 ADR-148 로 Superseded (2026-07-08).
>
> 근거 실측: [audits/2026-07-07-reusable-slot-landscape.md](../audits/2026-07-07-reusable-slot-landscape.md).
> 상위 결정 승계: ADR-142(대안 E — 조합=canonical reusable 문서, Implemented) /
> ADR-912(R-5 조합=데이터 proof, Implemented) / ADR-146·147(ListBox slot 실증) /
> ADR-138(origin-instance·fork UX, Implemented).
>
> **등록 구조 결정 (사용자 confirm 2026-07-07): 전면 reusable entry** — 모든 조합 컴포넌트를
> catalog `kind:"reusable"` entry 로 통일. 동명 type 충돌은 kind-분리 인덱스 + placeable 단일성으로
> 해소(아래 §3). landscape §7 의 선택지 중 B.

---

## 1. 목표 상태 (End State)

**"조합 컴포넌트는 데이터(canonical reusable origin 문서)이고, 그 등록은 catalog
`kind:"reusable"` entry 하나이며, slot 은 origin 의 조합 자식(`metadata.slotRole`)으로
선언되고, 인스턴스는 `type:"ref"` + `descendants` override 로 편집된다."**

```
componentCatalog (등록 SSOT — 1 컴포넌트 = 1 entry)
├─ kind:"primitive"  ─ binding(accepts/toRacProps/skiaPrimitive) ─→ leaf 렌더·편집
├─ kind:"native"     ─ frame / Slot (metadata-only)
└─ kind:"reusable"   ─ reusableId ──→ Components page origin 문서 (데이터)
                                        ├─ reusable:true 루트 (조합 root)
                                        ├─ 조합 자식 + metadata.slotRole  ← slot 이름 축
                                        ├─ slot: string[] (삽입 추천 목록) ← allow-list 축
                                        └─ x-composition.propsSchema      ← D2 편집 축
palette-add ─→ type:"ref" instance ─→ resolver(origin + descendants 3-mode)
            ─→ DOM(RAC slot emit) ∥ Skia(독립 노드 / projection 주입)   — D3 대칭
```

도달 시 성립하는 불변식:

- **I1**: 신규 조합 추가 = origin seed 모듈 1개 + catalog entry 1개. factory 코드 변경 0
  (ADR-912 HC#5 승계 — 현행 "origin 모듈 + 맵 1줄"의 맵을 catalog 로 흡수).
- **I2**: 같은 type 문자열에 primitive entry 와 reusable entry 가 공존할 수 있으나,
  `panel.placeable === true` 는 **한쪽만** 가진다 (palette 소유권 단일성).
- **I3**: canonical schema 는 변경하지 않는다 (ADR-142 HC#4). slot 관련 신규 표현은 전부
  `metadata.*` 와 `x-composition` extension 에만 실린다.
- **I4**: origin seed 모듈은 데이터 리터럴 + 멱등 삽입만 담는다 — 시각·변형·렌더 로직 금지
  (ADR-142 HC#3 "컴포넌트당 정의 파일 금지"와의 경계: seed 는 정의가 아니라 문서 부트스트랩).

## 2. 스키마 계약 — 4개 축의 직교 유지 (변경 없음)

| 축                    | 위치                                    | 의미                                                                     | 오용 금지                                                                                    |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **slot 이름**         | child `metadata.slotRole`               | 조합 자식의 slot 식별 (`icon`/`label`/`description`/`header`/...)        | `CanonicalNode.slot` 에 slot 이름 배열을 넣지 않는다 — pencil semantics 위반                 |
| **slot allow-list**   | `CanonicalNode.slot: false \| string[]` | 이 자리에 삽입 가능한 **reusable component ID 추천 목록** (pencil 공식)  | 강제 차단 아님 — resolver 는 non-blocking 경고 유지 (`resolvers/canonical/index.ts:385-404`) |
| **instance override** | `RefNode.descendants`                   | 3-mode (patch / node replace / children replace), key = stable id path   | projected/render ID 를 key 로 쓰지 않는다 (canonical id path 만)                             |
| **D2 편집 스키마**    | origin 의 `x-composition.propsSchema`   | `Record<string, PropContract>` — primitive `accepts` 와 동일 타입 재사용 | canonical core 필드로 승격하지 않는다 (ADR-116 extension 직교 layer)                         |

### 2-1. slotRole 공용 vocabulary (신규 — shared 컨벤션 모듈)

현행 `LISTBOX_ITEM_SLOT_ROLES` 는 builder-local 상수다. 이를 shared 로 승격하되,
**컴포넌트별 enum 이 아니라 공용 vocabulary + generic reader** 로 둔다 (ADR-142
no-classification 정합 — 컴포넌트별 코드 분기 대신 origin 데이터가 조합을 말한다).

```ts
// packages/shared/src/catalog/slotRoles.ts (신규)
export const SLOT_ROLES = [
  "icon",
  "label",
  "description", // P2 collection item (ADR-147 가동분)
  "header",
  "content",
  "footer",
  "preview", // P3 named-region (Card/Dialog 계열)
  "action", // P3 액션 영역 (DialogFooter/CardFooter 자식)
  "value",
  "track", // P4 value-compound (Meter/ProgressBar)
  "trigger",
  "panel", // P5 trigger/panel (Disclosure/Select 계열)
] as const;
export type SlotRole = (typeof SLOT_ROLES)[number];
export function getSlotRole(node: unknown): SlotRole | null; // metadata.slotRole 판독
```

- 어느 컴포넌트가 어떤 slot 을 갖는지는 **origin 문서의 자식 구성이 SSOT** — 코드에
  컴포넌트별 allow-set 을 두지 않는다.
- 자식 metadata 부가 규약 (ADR-147 승계): `systemOwned: true`(시스템 소유 slot 자식),
  `optional: true`(데이터 없으면 미렌더), 템플릿 바인딩 `{propKey}`(instance props /
  row projection 이 치환).
- 상태 기반 시각(SelectionIndicator 체크마크 등)은 slot 자식이 아니라 **render-time
  concern** — ADR-147 구현 판정 승계.
- 도입 시점: 첫 소비 Wave 와 동시 (Wave 0 에서 ListBox 상수 re-home, 선축 금지 정합).
- **layout slot 과 직교**: frame/`Slot` native + page frame(header/content/footer/custom,
  ADR-135)은 별도 시스템이다. 본 설계의 slotRole 과 혼동 금지.

## 3. 등록 아키텍처 — 전면 reusable entry

### 3-1. entry 형태

```ts
// componentCatalog.ts — reusable entry 헬퍼 (신규)
function reusableEntry(
  type: string, // palette-facing 식별자 (인스턴스 canonical type 은 "ref")
  family: ComponentFamily,
  reusableId: string, // Components page origin 문서 id
  panel: { category: string; label: string; icon: string },
): Extract<ComponentCatalogEntry, { kind: "reusable" }>;
```

- 기존 union 그대로 사용 — **catalog types 변경 없음**. `cutover` 는 `"catalog"` 고정
  (신경로 태생. `CATALOG_CUTOVER_TYPES` 에 포함되지만 인스턴스는 `type:"ref"` 라 게이트
  실질 무영향 — 동명 primitive 와 Set 중복은 무해, 주석으로 명시).
- 등록 대상 (Wave 별): Toolbar·Form (기존 R-5 이관) → IconButton·IconToggleButton (신규)
  → Toast/InlineAlert/IllustratedMessage·Card (재판정 통과 시) → 후속.

### 3-2. 동명 type 충돌 해소 — kind-분리 인덱스 + placeable 단일성

Toolbar/Form 은 origin root 가 RAC primitive type 그 자체다. primitive entry(binding —
origin 내부 leaf 렌더에 계속 필요)와 reusable entry(생성·팔레트)가 같은 type 문자열을
가지므로, 단일 `CATALOG_BY_TYPE` Map 에 함께 넣으면 덮어쓴다. 해소:

```ts
// 인덱스 2원화 (componentCatalog.ts)
CATALOG_BY_TYPE; // kind !== "reusable" 만 — 렌더·binding·defaultProps 소비자 전용 (현행 시그니처 유지)
REUSABLE_BY_TYPE; // kind === "reusable" 만 — 생성·팔레트·entryUniverse facet 소비자 전용
getCatalogEntry(type); // 현행 유지 (primitive/native)
getReusableEntry(type); // 신규
getReusableOriginId(type); // = getReusableEntry(type)?.reusableId ?? null
```

- **placeable 단일성 (I2)**: reusable entry 가 있는 type 의 primitive entry 는
  `panel.placeable: false` 로 내린다 (Toolbar/Form). palette 는 reusable entry 만 노출.
- 인스턴스 canonical type 은 `"ref"` 이므로 렌더 경로는 reusable entry 를 조회할 일이
  없다 — 렌더는 resolve 된 origin 자식(primitive type)으로 `getCatalogEntry` 를 탄다.
  즉 인덱스 분리는 소비자 경계와 정확히 일치한다.
- type 명 재배치(rename)는 하지 않는다 — palette type 은 식별자일 뿐이고 rename 은 BC
  부담만 추가한다.

### 3-3. 기존 레지스트리의 catalog 파생 대체

| 현행                                                               | 목표                                                                                                                                                               | 소비자                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `REUSABLE_COMPOSITE_ORIGINS` 맵 (`reusableCompositeOrigins.ts:24`) | `getReusableOriginId(type)` catalog 파생                                                                                                                           | `useElementCreator.ts:158` (ref instance 생성 분기 — 로직 무변경, 조회처만 교체) |
| `isReusableCompositeType`                                          | `getReusableEntry(type) !== undefined`                                                                                                                             | `entryUniverse.ts:259` facet `"reusableOrigin"` (양방향 정합 주석 동시 갱신)     |
| `ensureReusableCompositeOrigins` 하드코딩 순회                     | `REUSABLE_ORIGIN_ENSURERS: Record<reusableId, (doc) => doc>` — catalog 의 reusable entry 를 순회하며 ensurer 적용. **catalog entry ↔ ensurer 누락은 test 가 강제** | bootstrap 2진입점 (createInitialProjectDocument + hydration) — 현행 유지         |
| `PALETTE_ORDER` 의 Toolbar/Form 항목 (catalog source)              | reusable entry 의 `getPanelMeta` 파생으로 자동 승계 (paletteItems.ts 는 type 키만 참조 — REUSABLE_BY_TYPE 폴백 1줄)                                                | ComponentList                                                                    |

- origin seed 모듈(`{toolbar,form}TemplateOrigins.ts`)은 **잔존** — catalog 는 id 를 알고,
  문서 리터럴과 멱등 repair 는 seed 모듈이 담는다 (I4).
- `componentRegistrationContract.test.ts` 확장: (신규 불변식) reusable entry 마다
  ① ensurer 존재 ② 동명 primitive 의 placeable=false ③ reusableId 형식
  (`component-<kebab>`) ④ placeable 인 reusable entry 는 PALETTE_ORDER 포함.

### 3-4. 생성 경로 (변경 최소)

`useElementCreator` 의 R-5 분기(`:155-185`)는 이미 목표 형태다 — `type:"ref"` +
`ref: originId` + componentRole mirror `"instance"` + `componentName: type`. 변경은
조회 함수 교체 1줄. paste/duplicate 경로의 instance shape 와 동일함도 현행 그대로.

## 4. D2 편집 계약 — propsSchema

### 4-1. 선언 (origin 문서)

```jsonc
// origin 루트 노드 (Components page) — 예: IconButton origin
{
  "id": "component-icon-button",
  "type": "Button", // origin root 는 RAC primitive
  "reusable": true,
  "props": { "variant": "default", "size": "md" },
  "children": [
    {
      "type": "Icon",
      "props": { "slot": "icon", "iconName": "{icon}" },
      "metadata": { "slotRole": "icon", "systemOwned": true, "optional": true },
    },
    {
      "type": "Text",
      "props": { "slot": "label", "children": "{label}" },
      "metadata": { "slotRole": "label", "systemOwned": true },
    },
  ],
  // x-composition extension (ADR-116 직교 layer) — D2 편집 SSOT
  "x-composition": {
    "propsSchema": {
      "label": { "kind": "string", "section": "content", "default": "Button" },
      "icon": { "kind": "icon", "section": "content" },
      "variant": { "kind": "variant", "section": "appearance" },
      "size": { "kind": "size", "section": "appearance" },
    },
  },
}
```

- `PropContract` 타입 재사용 (catalog `types.ts:190` — primitive `accepts` 와 동일).
  신규 `InspectorFieldKind` 도입 없음 (있다면 사용자 surface — ADR-915 HC#3 승계).
- 템플릿 바인딩 규약: propsSchema 키 ↔ 자식 props 의 `{키}` 1:1. resolver 가
  instance `props.<키>` 값으로 치환한다. **propagation registry(~147 손등록) 의 대체
  방향** — Card 의 title→Heading 라우팅 같은 코드 등록을 origin 데이터로 흡수한다.

### 4-2. 소비 (Inspector)

- `resolveEditContract` 확장: 선택 노드가 `type:"ref"` 이면 origin 의
  `x-composition.propsSchema` 를 편집 필드 source 로 사용 (ADR-142 Decision #14).
- 편집 기록 위치: ① propsSchema 키 편집 → **instance root `props` override**
  ② slot 자식 개별 조준(고급) → `descendants[<stable-id-path>]` patch mode.
- fork UX 승계 (ADR-138): 배열형 prop(items 류) shallow override 시 fork —
  `InstanceForkBadge` + [Reset to origin].
- origin 선택 시(Components page)는 origin 자체를 직접 편집 — 모든 instance 에 전파
  (override 하지 않은 속성만, descendants 3-mode 의미론 그대로).

## 5. D1/D3 렌더 계약

| 경로          | 계약                                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **resolve**   | `resolveCanonicalDocument()` 가 ref → origin children + descendants override + 템플릿 바인딩 치환을 렌더 입력 전에 완료 (ADR-142 HC#8). Toolbar/Form proof 로 2단 중첩까지 검증 완료 — 변경 없음                        |
| **DOM (D1)**  | resolved 자식이 각자 primitive binding 경로로 렌더. RAC slot 은 자식 `props.slot` 통과로 emit (`<Text slot="label">` — ADR-147 Phase 3 패턴). RAC 이 slot 을 지원하지 않는 조합(예: div 조합)은 일반 children 순서 렌더 |
| **Skia (D3)** | resolved 자식 = 독립 Skia 노드 (조합 자식 경로) — buildCatalogShapes + binding.skiaPrimitive escape 잔존. collection item 은 projection 주입 경로 유지 (ADR-146/147 — canonical 노드 폭증 금지)                         |
| **대칭 검증** | slot 추가·변경 시 `/cross-check` 3축 (DOM/Skia/Style Panel) + slotRole 별 시각 확인. 완료 선언 전 live behavior 1회 exercise (CLAUDE.md 완료 기준)                                                                      |

Slot 삽입점 패턴별 적용 규칙 (landscape §4 의 5+1 패턴):

| 패턴                          | 본 설계에서의 처리                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| P1 field 보조 텍스트          | RAC 권위 그대로 — 설계 개입 없음 (D1)                                                                                    |
| P2 collection item multi-slot | ADR-147 모델이 정본. 타 collection 이식은 origin+slotRole+projection 주입 복제 (Wave 4)                                  |
| P3 named-region               | **reusable origin 의 기본 골격.** header/content/footer/preview/action slotRole + 자식 컨테이너 (Card/Dialog/Toast 계열) |
| P4 value-compound             | value/track slotRole — Meter·ProgressBar 동형군. DELEGATING 재판정 후보                                                  |
| P5 trigger/panel              | trigger/panel slotRole — Disclosure 계열. DELEGATING 재판정 후보                                                         |

## 6. 실행 로드맵 (Wave)

각 Wave 는 독립 검증 가능한 수직 슬라이스이며, **착수는 개별 확인 게이트**를 거친다.

| Wave  | 내용                                                                                                                                                                                                                                                                                                  | 선행 조건                      | 완료 게이트                                                                                    |
| :---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| **0** | **ADR-147 closure** — 본문 stale 3건 amend(escape 경로/SelectionIndicator/slot semantics) + `/cross-check` ListBoxItem 3축 + live exercise → 승격 여부 사용자 확인. 이때 `LISTBOX_ITEM_SLOT_ROLES` 를 shared `slotRoles.ts` 로 re-home (첫 소비 동시 도입)                                            | 없음                           | cross-check PASS + live 1회 + README/CHANGELOG 동기                                            |
| **1** | **등록 전환** — `reusableEntry` 헬퍼 + Toolbar/Form reusable entry 2건 + 인덱스 2원화(§3-2) + 파생 대체 3건(§3-3) + primitive placeable:false + registrationContract 불변식 4종                                                                                                                       | Wave 0 무관 (병행 가능)        | 기존 R-5 테스트 green + palette 스냅샷 무변 + live palette-add(Toolbar/Form) ref instance 확인 |
| **2** | **IconButton 첫 신규 reusable** — entry(`kind:"reusable"`, type:"IconButton") + origin seed(Button>Icon+Text, slotRole icon/label, §4-1 예시) + **propsSchema 첫 소비**(resolveEditContract ref 분기) + palette 노출. IconToggleButton 동형 후속                                                      | Wave 1 (entry 인프라)          | Inspector 에서 label/icon/variant/size 편집 → instance 반영 + origin 수정 전파 + cross-check   |
| **3** | **factory-대체군 확대** — Toast/InlineAlert/IllustratedMessage(상태 메시지 3종 동형) + Card 4-region. 각각 **DELEGATING/어댑터 재판정 게이트** 선통과 필수 (renderToast·INTERNAL_RENDERERS 어댑터가 origin 자식 재귀로 환원 가능한지). Card 는 propagation(title→Header 등)의 템플릿 바인딩 대체 포함 | Wave 2 (propsSchema 소비 경로) | 컴포넌트별 kill criteria: factory definition fallback 0 + live parity                          |
| **4** | **collection item slot 이식** — GridListItem(label/description) → MenuItem(icon/label/shortcut/description, itemSchema 8키 정합). ADR-147 패턴 복제                                                                                                                                                   | Wave 0 (정본 확정)             | 각 collection cross-check + row projection 주입 검증                                           |
| **5** | (장기) rendererMap #4 DELEGATING generic 흡수 종속 잔여 — 본 설계 범위 밖, 경계만 기록                                                                                                                                                                                                                | #4 축 별도 진행                | —                                                                                              |

**순서 원리**: 소비 경로가 이미 있는 전환(Wave 1)과 정본 문서 정합(Wave 0)을 먼저,
신규 표면(propsSchema 소비)은 첫 소비자(Wave 2)와 동시 도입 — 선축 차단 원칙과 정합.

## 7. 위험과 대응

| ID  | 위험                                                                                  | 심각도 | 대응                                                                                                                                |
| --- | ------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 인덱스 2원화 후 소비자가 잘못된 인덱스를 조회 (렌더 경로가 reusable entry 를 받는 류) |  MED   | 소비자 경계 = 인덱스 경계 (§3-2). `getCatalogEntry` 시그니처 무변경 + registrationContract 불변식 + type-check                      |
| R2  | propsSchema 와 origin 자식 템플릿 바인딩 `{키}` 불일치 (편집해도 무반응)              |  MED   | Wave 2 게이트에 키 1:1 정적 검증 test (origin 순회 → `{키}` 추출 ↔ propsSchema 키 대조)                                             |
| R3  | Wave 3 대상의 DELEGATING 렌더러가 origin 자식 재귀로 환원 불가 → 이관 실패            |  MED   | 컴포넌트별 재판정 **선행** 게이트 — 부적격이면 해당 컴포넌트만 보류 (ADR-912 판정 기준 승계). Toolbar/Form 선례상 실패 시 격리 용이 |
| R4  | propagation registry 대체(Card) 중 기존 사용자 문서의 라우팅 회귀                     |  MED   | 개발 단계 BC 최소 원칙 유지하되, hydration 멱등 repair (repairOrigin 패턴) + round-trip fixture                                     |
| R5  | slotRole vocabulary 조기 고정 → 실사용과 어긋남                                       |  LOW   | vocabulary 는 additive (string union 확장만). 컴포넌트별 allow-set 을 코드에 안 두므로 확장 비용 = 상수 1줄                         |
| R6  | reusable entry 의 `cutover` 필드 semantics 혼선                                       |  LOW   | `"catalog"` 고정 + 주석 — instance 는 `type:"ref"` 라 cutover 게이트 무영향 명시 (§3-1)                                             |

잔존 HIGH 위험 없음 — 전 Wave 가 기존 검증된 메커니즘(R-5 생성 경로 / ADR-147 slot 모델 /
ADR-138 fork UX)의 확장이며, 유일한 신규 표면(propsSchema 소비)은 Wave 2 단일 슬라이스로 격리된다.

## 8. 검증 전략

- **정적**: `componentRegistrationContract.test.ts` 불변식 4종 확장(§3-3) + propsSchema↔
  템플릿 바인딩 키 대조 test (R2) + type-check baseline 무증가.
- **fixture**: `canonicalPreviewRefSlot`(기존 — resolved tree reusable/ref/descendants/slot
  → DOM) 에 reusable entry 경유 생성 시나리오 추가. Toolbar/Form origin 테스트 6종 green 유지.
- **시각 대칭**: slot 추가·변경 Wave 마다 `/cross-check` 3축.
- **live behavior 게이트**: 각 Wave 완료 선언 전 실제 builder 에서 palette-add → 편집 →
  origin 전파를 1회 exercise (test/type-check PASS 단독 종결 금지 — CLAUDE.md 완료 기준).

## 9. 미결정 (후속 확인 대상)

1. **propsSchema 저장 필드의 정확한 자리** — origin 노드 `x-composition.propsSchema`(본
   설계 기본안, ADR-116 extension 직교) vs `metadata` 산하. export/import adapter 의
   extension field 처리 경로 확인 후 확정 (Wave 2 착수 시).
2. **IconButton 명명** — palette 항목명은 D2 prop 이 아니므로 RSP 미규정 금지 조항과
   직교하나, RSP ActionButton/Button+icon 관례 대조 후 확정.
3. **Wave 3 Card 의 CardPreview 이미지 경로** — 자식 Image self-compose 잔존 여부 재판정.
4. **ADR 작성 단위** — Wave 1+2 를 하나의 ADR 로 묶을지, 등록 전환(1)과 첫 신규(2)를
   분리할지. 사용자 결정.

## 10. 파일 좌표 (Wave 1~2 기준)

| 구분 | 파일                                                                          | 변경                                                                                              |
| ---- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 신규 | `packages/shared/src/catalog/slotRoles.ts`                                    | SLOT_ROLES vocabulary + getSlotRole                                                               |
| 수정 | `packages/shared/src/catalog/componentCatalog.ts`                             | reusableEntry 헬퍼 + 인덱스 2원화 + Toolbar/Form/IconButton entry + primitive placeable:false 2건 |
| 수정 | `apps/builder/src/builder/components/reusableCompositeOrigins.ts`             | 맵 삭제 → catalog 파생 re-export + `REUSABLE_ORIGIN_ENSURERS`                                     |
| 신규 | `apps/builder/src/builder/components/iconbutton/iconButtonTemplateOrigins.ts` | origin seed (toolbarTemplateOrigins 패턴 동형)                                                    |
| 수정 | `apps/builder/src/builder/hooks/useElementCreator.ts:158`                     | 조회 함수 교체 1줄                                                                                |
| 수정 | `apps/builder/src/builder/factories/entryUniverse.ts:259`                     | facet 판정 catalog 파생 교체                                                                      |
| 수정 | `apps/builder/src/builder/panels/components/paletteItems.ts`                  | REUSABLE_BY_TYPE 폴백 + IconButton 항목                                                           |
| 수정 | Inspector `resolveEditContract` 경로                                          | ref instance → origin propsSchema 분기 (Wave 2)                                                   |
| 수정 | `componentRegistrationContract.test.ts` 외                                    | §8 정적 검증                                                                                      |
| 이동 | `listBoxTemplateOrigins.ts` 의 slotRole 상수                                  | shared `slotRoles.ts` re-home (Wave 0)                                                            |
