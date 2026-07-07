# Layout Engine — 구현 상세

> 규칙 요약은 [layout-engine.md](../../../rules/layout-engine.md) 참조

## Label size delegation 상세

### 주입 조건 (CRITICAL)

`labelStyle.lineHeight == null` 기준으로 주입 여부 결정한다.

`fontSize == null` 조건 사용 금지. factory에서 `fontSize: 14`를 미리 지정한 경우, fontSize 조건은 통과하지 못해 lineHeight 주입이 스킵된다. lineHeight 미주입 시 `fontSize * 1.5` fallback 적용 → CSS Preview(`--text-sm--line-height` = 20px)와 불일치.

동일 이유로 `getChildElements` 래퍼의 스킵 조건도 `cs.lineHeight != null` 기준 사용 (`cs.fontSize != null` 금지).

### lastDelegationAncestor 패턴

최초 발견된 DELEGATION 부모를 기억하고, 상위에 size 소유자가 있으면 갱신:

- standalone Checkbox(size 없음) → `lastDelegationAncestor = Checkbox` → 기본값 "md"
- CheckboxGroup 내 → Checkbox(래퍼) → CheckboxItems(래퍼) → CheckboxGroup(size 소유) → 해당 size 사용

### LABEL_WRAPPER_TAGS

`Checkbox, Radio, CheckboxItems, RadioItems` — size 없이 상위로 통과.

### LABEL_DELEGATION_PARENT_TAGS

모든 size-delegation 컨테이너. DatePicker, DateRangePicker 포함 필수. 누락 시 Label height가 24px(fallback fontSize=16 × 1.5)로 오계산.

### LABEL_SIZE_STYLE

`fullTreeLayout.ts` 정의 xs~xl 매핑 (fontSize + lineHeight "px" 단위) — `packages/specs/src/primitives/typography.ts` 의 `FONT_SIZE_TO_LINE_HEIGHT`/`getLabelLineHeight` 와 동일 소스이며, Label 시각 정본은 catalog `COMPONENT_RULES_TABLE.Label`. lineHeight는 반드시 `"20px"` 문자열로 전달 (숫자는 `parseLineHeight`가 배율로 해석).

### batch height override

`fullTreeLayout.ts` Step 4.5 — `Math.ceil(childFs * 1.5)` 대신 LABEL_SIZE_STYLE에서 size별 lineHeight 값을 읽어 override. CSS Preview 정합성 보장.

### CSS 근거

`--text-sm` = 14px, `--text-sm--line-height` = calc(1.25/0.875) ≈ 1.42857 → 14 × 1.42857 = 20px.

---

## Select/ComboBox 부모 높이 추정 상세

`utils.ts`의 `effectiveHeight` 계산:

1. `parseLineHeight(lineHeight, fontSize)` 값이 있으면 우선 적용
2. lineHeight가 null이면 `Math.ceil(fontSize * 1.5)` fallback (기존 동작 유지)

목적: LABEL_SIZE_STYLE lineHeight가 CSS `--text-sm--line-height`(20px)와 일치하도록 보장.

---

## processedElementsMap vs elementsMap (2-Pass 상세)

Step 4.5 (2-pass height 교정)에서 element를 조회할 때 processedElementsMap을 우선 사용해야 하는 이유:

- **Label**: DFS injection으로 `fontSize: 14, lineHeight: "20px"` 주입 → store 원본에는 없음 → fallback fontSize=16, lineHeight=24 → 텍스트 줄바꿈 → height 48px (기대 20px)
- **ComboBoxTrigger**: implicit styles로 `width: 18, height: 18` 주입 → store 원본 style=`{}` → fallback height=24

조회 패턴: `processedElementsMap.get(id) ?? elementsMap.get(id)`

merge 규칙: Step 3.6에서 부모 implicit styles를 자식에 적용할 때, 기존 `processedElementsMap`의 DFS injection 값을 base로 implicit styles를 merge (단순 덮어쓰기 금지).

---

## PersistentTaffyTree display/grid 전환 감지 상세

증분 갱신 주체는 자체 Rust 레이아웃 엔진 (`packages/composition-engine`, ADR-916 — Taffy 완전 제거. `persistentTaffyTree.ts`/`TaffyFlexEngine` 등 JS 어댑터 심볼명은 보존). full rebuild 규칙 정본: `.claude/rules/layout-engine.md`.

### display 전환

`fullTreeLayout.ts` 에서 `prevDisplay !== curDisplay` 비교로 display 전환 감지 → full rebuild 트리거. `implicitStyles`가 주입하는 display 변경(GridList `layout` prop 등)은 증분 갱신으로 처리 불가.

### full rebuild 강제 조건 (요약 — 정본: layout-engine.md)

- **신규 grid container** (`!prevJson` + display가 grid/inline-grid): `addNode` 증분 추가는 gridTemplate 이 auto-placement 로 degrade → full rebuild 강제
- **신규 컨테이너 (자식 서브트리 보유)** (`!prevJson && filteredChildIdsMap.get(id)?.length > 0`): 증분 추가 시 자식 layout undefined + (0,0) 겹침 → grid 아니어도 full rebuild 강제
- **기존 grid container 의 layout-영향 20-key 변경**: `GRID_REBUILD_TRIGGER_KEYS` (`fullTreeLayout.ts`) — gridTemplate 계열 + padding 계열 + gap 계열 + width/height/min·max 계열. `updateStyleRaw` 는 grid track/placement 캐시 invalidation 실패 → full rebuild. 비-grid 는 증분 유지

### affectedNodeIds 필터

있으면 해당 노드만 검사(성능 최적화), 없으면 전체 배치 노드 검사. 필터 적용 시 `undefined` 조건 누락 금지 — 캐시 미스 시 `undefined`로 전달될 수 있음.

위반 시: display 전환(flex↔grid↔block), gridTemplate/padding/gap/dimension 변경이 새로고침 전까지 캔버스에 반영 안 됨.

---

## Grid 트랙 폭 사전 계산 + 2-Pass 안전망 상세

CSS 브라우저는 폭 결정 → 텍스트 줄바꿈 → auto height를 한 번에 처리하지만, Taffy는 enrichment에서 `availableWidth` 기준으로 height 계산.

### 1차 사전 계산

`estimateChildAvailableSize` 후 grid 컨테이너이면 `childAvail.width = (contentWidth - totalGap) / numCols`로 조정. 1차 enrichment에서 올바른 height 계산 보장.

### 2-Pass 안전망 (Step 4.5)

`computeLayout` 후 모든 노드의 실제 width vs enrichment width 비교 → 차이 시 re-enrich + dirty 마킹 + computeLayout 재호출.

### 충돌 금지

2-pass에서 batch style 수정 후 `buildFull(batch)` 호출 금지 — 불일치 발생. `updateNodeStyle` + `markDirty` + `computeLayout`만 사용.

### patchBatchStyleFromImplicit

`Array.isArray(val)` 조건 필수 — gridTemplateColumns 배열 패치.

---

## Block-child normalization guard 상세

fullTreeLayout의 block-child 정규화(`width: 100%` 주입)에서 `enrichWithIntrinsicSize`가 이미 계산한 numeric/px 폭이 있으면 덮어쓰지 않음.

가드 조건: `typeof existingW === "number"` 또는 `existingW !== "auto" && existingW !== "100%"` 시 skip.

---

## Checkbox/Radio → CheckboxGroup/RadioGroup size 주입 상세

Checkbox/Radio DFS 진입 시 부모 탐색 경로: Checkbox → CheckboxItems → CheckboxGroup.

`implicitStyles.ts`가 `containerProps.size`로 indicator marginLeft를 계산하므로 size 주입이 필수. Store에 size가 없는 자식에만 적용 (이미 size가 있으면 스킵).

---

## Collection Item font 주입 상세 (ListBoxItem/GridListItem)

구 TextSprite/ElementSprite selector 경로는 폐기됨 (심볼 소멸). 현행 3경로:

- **CSS**: 부모에 font-size/weight 설정 → 자식 상속 + description override
- **implicitStyles (Taffy 높이 계산)**: `injectCollectionItemFontStyles()` (`implicitStyles.ts`) — GridListItem/ListBoxItem 컨테이너 분기에서 자식 Text(fontSize 14 / fontWeight 600 / width 100%), Description(fontSize 12 / width 100%) 주입
- **Skia**: catalog 기반 — item 시각은 `COMPONENT_RULES_TABLE` 의 GridListItem/ListBoxItem rule 로 렌더 (ADR-912 catalog cutover), 별도 selector 주입 없음

item 컨테이너 base-axis(display/flexDirection/minWidth 등)는 catalog `structure.containerStyles` 단일 source — `resolveCatalogCollectionBase()` (`implicitStyles.ts`) 경유. GridListItem `minWidth: 0` 도 이 경로 (CSS `minmax(0, 1fr)` 동기화).

새 collection 컴포넌트 추가 시 `implicitStyles.ts` 의 해당 containerTag 분기에 `injectCollectionItemFontStyles()` 적용 추가 필수.
