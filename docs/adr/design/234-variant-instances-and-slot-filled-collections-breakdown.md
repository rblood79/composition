# ADR-234 구현 상세 — 상태 변형 = origin 의 instance · 목록 = slot 을 채운 instance 자식

> 본문: [ADR-234](../234-variant-instances-and-slot-filled-collections.md)

## 1. 전제 확정 기록 (fork 4 질문 · 사용자 confirm)

사용자 confirm 2026-09-23 (AskUserQuestion 3문항 — 범위 · 기존 items · 숨기기):

1. **base / 응용**: 234 는 origin · instance · slot 의 **뜻** (base) 을 정한다. 229 (Tag 항목 템플릿) · 230 (상태 변형) · 233 (Tab 항목 템플릿 · Radio) 은 그 응용이며, 이들이 쌓은 "템플릿 read-through + 상태 overlay" 모델을 234 가 대체한다.
2. **schema 직교성**: 새 저장 필드는 canonical 노드의 `enabled?: false` 하나다 (Pencil format 과 같은 이름). 변형 노드는 기존 `type: "ref"` + `reusable: true` 조합 — 새 노드 종류 없음.
3. **선행 전제 역전 검증**: ADR-066 (Tabs `items` 가 정본) 은 **작성자가 채우는 목록에 한해** 역전된다 (사용자 선택 "데이터 바인딩만 items 유지"). 데이터 바인딩 목록은 RAC 의 `items` + render 함수 경로 그대로 — 그 경로에서만 항목 origin 이 템플릿이다.
4. **범위**: "전부, Phase 로 나눔" (사용자 선택) — ref 체인 → 변형 전환 → 목록 컨테이너 → 검증 · 이관.

## 2. 레퍼런스 실측 — Pencil `pencil-shadcn.pen` (2026-09-23)

| ID  | 사실                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `Tab Item/Active` (coMmv) = reusable frame (배경 · 그림자 · padding 6/12 · label). `Tab Item/Inactive` (QY0Ka) = `type: "ref"`, `ref: coMmv`, `reusable: true`, 덮어쓰기 `fill: []` · `effect: []` · label `fill`.          |
| P2  | `Tabs` (PbofX) = reusable frame, `slot: [coMmv, QY0Ka]`, **자식 0** (빈 틀). RAC 의 **TabList** 에 해당 (사용자 지적 — TabPanels 층은 Pencil 에 없다).                                                                      |
| P3  | `Tabs` instance (omDwd) = `ref: PbofX` + 자식 4 = Tab Item instance (Active 1 · Inactive 3), label 은 항목마다 `descendants` 로 덮어씀.                                                                                     |
| P4  | 변형 = 완성된 상태 origin 의 ref 가 문서 전체 규칙: Pagination Item/Default → Active · Sidebar Item/Default → Active · Radio/Unselected → Selected (`descendants: {점: {enabled: false}}`) · List Item/Unchecked → Checked. |
| P5  | 컨테이너 안쪽 slot 도 같은 방식: Card Action · Dialog 는 Card instance 가 `descendants: {slot 틀 id: {children: [...]}}` 로 Header/Content/Actions 를 채운다.                                                               |

## 3. 코드 사실 (2026-09-23, main `823b1757a`)

| ID  | 사실                                                                                                                                                                                                                                                                         | 위치                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 상태 변형 origin 은 default origin 의 **복제본** (자식도 복제, style/fills 비움) + `metadata.variant`/`variantOf`. seed 된 변형 31 중 `type: "ref"` 0 (seed 전수 실측).                                                                                                      | `apps/builder/src/builder/components/stateVariantOrigins.ts:126-165`                                                                                 |
| F2  | 변형 대상 = Button · ToggleButton · Link · Checkbox · Switch · Radio.                                                                                                                                                                                                        | `stateVariantOrigins.ts:45-55`                                                                                                                       |
| F3  | 변형이 두 leg 에 닿는 값은 root 의 관리 키 4 (`backgroundColor` · `color` · `borderColor` · `opacity`) 뿐 — padding · 자식 (label) 편집은 무시.                                                                                                                              | `apps/builder/src/builder/components/stateVariantResolution.ts:42-47,178-216`                                                                        |
| F4  | Preview 상태 채널 = 문서 `<style>` 의 `[data-state-origin][data-selected]…` 규칙 + `--co-*` 변수 inline.                                                                                                                                                                     | `stateVariantResolution.ts:304-350,352-`                                                                                                             |
| F5  | 항목 변형 (Tab/ListBoxItem/Tag Selected) 도 복제본. slot 은 "첫 칸 기본 · 둘째 선택" 역할 표로 쓰이고 root 에 있다 (tabs · taggroup root, listbox · gridlist root).                                                                                                          | `components/tabs/tabsTemplateOrigins.ts` · `components/taggroup/tagGroupTemplateOrigins.ts:163-165` · `components/listbox/listBoxTemplateOrigins.ts` |
| F6  | 목록 행은 `items` 데이터에서 만든 projection 가상 행 (Tab · Tag · ListBox).                                                                                                                                                                                                  | `workspace/canvas/scene/canvasSceneNode.ts:957,2183,2527`                                                                                            |
| F7  | Preview Tabs 는 `items` 로만 Tab 을 만든다.                                                                                                                                                                                                                                  | `packages/shared/src/renderers/LayoutRenderers.tsx:146` · `packages/shared/src/components/Tabs.tsx:290`                                              |
| F8  | Slot "+" = `items` 행 추가 (`collection-item`) 또는 Tabs 는 숨김 (`none`).                                                                                                                                                                                                   | `components/slotHostPolicy.ts:188-209`                                                                                                               |
| F9  | **ref → reusable ref 체인이 두 leg 모두 끊긴다** — 변형 자신 (ref → origin 1단) 은 해석되지만 그 변형을 가리키는 instance 는 `type: "ref"` 로 남고 origin props 소실 (probe 2026-09-23). Preview: master 가 ref 여도 그대로 씀. Canvas: `masterType !== "ref"` 로 명시 제외. | `apps/builder/src/resolvers/canonical/index.ts:144,170-178` · `canvasSceneNode.ts:2905-2918`                                                         |
| F10 | canonical 노드에 요소 숨김 필드 없음 (Pencil `enabled` 대응 0).                                                                                                                                                                                                              | `packages/shared/src/types/composition-document.types.ts:834`                                                                                        |
| F11 | descendants 덮어쓰기 3-mode (A props patch · B 교체 · C children 교체) — `enabled` patch 는 mode A 로 실을 수 있다.                                                                                                                                                          | `resolvers/canonical/index.ts:254-257,389-440`                                                                                                       |
| F12 | 조합 자식 ref 화 규칙 (229) · origin 대비 props diff 유틸이 이미 있다 — 변형 이관 diff 에 재사용.                                                                                                                                                                            | `components/originChildRefs.ts:69,396`                                                                                                               |
| F13 | RadioGroup origin 자식은 이미 `ref → component-radio` (233) — 목록 = instance 자식 모델의 기존 사례.                                                                                                                                                                         | `components/originChildRefs.ts:396` (seed 결과)                                                                                                      |

## 4. Phase

### Phase 0 — inventory freeze (G0)

- F1~F13 재grep 일치 확인.
- 진단 RED 4 고정: (a) instance → 변형 ref 체인 두 leg (F9) · (b) 변형의 padding / label 색 편집이 두 leg 에 안 닿음 (F3) · (c) TabList instance 에 Tab instance 자식을 두면 두 leg 가 무시 (F6/F7) · (d) `enabled: false` 무시 (F10).
- 목록을 만드는 쓰기 경로 전수: 팔레트 · factory · AI tool (`items` 작성) · Pencil import · 데이터 바인딩 · 붙여넣기. 각 경로가 "정적 목록 → 자식" / "바인딩 → items" 중 어디로 가는지 표로 확정.
- 이관 대상 수식 확정: 문서당 변형 31 노드 재직렬화 + 정적 목록 `n` 항목 → ref 자식 `n` (항목당 추정 150~250 B) + slot 필드 이동 4.
- 이관 입력 실측 (review round 1 h1 · h2): (e) 변형마다 **이관 전 유효값** — default origin 유효값 + 230 관리 키 overlay 결과, 두 leg 각각 (관리 키 밖 raw 값은 목록으로만 남긴다 — 이관에서 버림) · (f) 변형 노드를 **직접** ref 한 사용자 노드 수 (root ref · 중첩 ref · descendants 안 ref) 와 그 `descendants` 키 · (g) 옛 변형 자식 id → origin 자식 id 대응표 (구조 경로 · `metadata.slotRole`) 와 대응 없는 경로 목록.
- 진단 RED 2 추가: (h) origin `{style:{color,padding}}` · 변형 `{style:{}}` 를 `diffPropsAgainstOrigin` 으로 옮기면 병합 후 color · padding 이 새로 나타남 · (i) 변형 자식 id 로 편집한 `descendants` 가 master 선해소 후 base 자식 id 에 안 닿음 (review round 1 반증 2건).

### Phase 1 — ref 체인 · `enabled` (G1)

- 두 해석기가 master 가 `type: "ref"` 면 그 master 를 먼저 해석한 결과를 master 로 쓴다 (깊이 상한 · 순환 감지 → broken ref 와 같은 경고 경로). Preview resolver 캐시 키에 체인 master 의 버전을 포함.
- `enabled?: boolean` — schema · 두 leg (Canvas scene 제외 · Preview 미렌더) · 레이아웃 제외 · descendants mode A patch · publish 렌더러도 존중 (publish 는 기능 링크 방침 — 필드 존중만). 값: 부재 = 상속 (체인 끝까지 부재면 표시) · `false` = 숨김 · `true` = 상속된 숨김을 풀고 표시. 조상 숨김은 자식 `true` 로 못 푼다 (subtree 전체 제외). ref 병합 `{...master, ...ref}` 가 부재를 상속으로 두므로 병합 규칙은 그대로이고, 판정 함수 하나 (`isNodeEnabled` — 체인 해석 결과의 `enabled !== false`) 를 소비자가 같이 읽는다 (review round 1 m3).
- patch 삭제 표기: props · style · descendants patch 의 값 `null` = 그 키 제거 (catalog 기본값으로 돌아감), `fills: []` = 채움 없음 명시, 키 부재 = 상속. 병합을 **두 연산으로 나눈다** (review round 2 h1): (1) `composePatches(earlier, later)` — patch 끼리 합칠 때. `null` 을 **보존**한다 (later 의 `null` 이 earlier 의 값을 덮고, later 의 값이 earlier 의 `null` 을 덮는다). descendants patch 스택 사전 합성 (Preview `resolvers/canonical/index.ts:349-359` · Canvas `canonicalRefResolution.ts:329-340` `getStackedDescendantPatch`) 과 상태 patch 겹침이 이쪽. (2) `applyPatch(resolvedBase, patch)` — 해석이 끝난 값 (origin 또는 체인 master 해석 결과) 에 적용할 때. `null` 키를 **제거**하고, 결과에 `null` 이 남지 않는다. root ref 병합 · descendants 최종 적용 (Canvas `canonicalRefResolution.ts:440-454` · Preview `index.ts:368` 이후) 이 이쪽. `mergePropsWithStyleDeep` (`adapters/canonical/instanceResolver.ts:35`) 는 두 연산으로 갈라 호출처마다 어느 쪽인지 정한다 — 한 함수에 null 정리를 넣지 않는다. 소비자 (Skia · DOM · layout) 는 `applyPatch` 결과만 받으므로 `null` 을 보지 않는다.
- BC: 필드 부재 = 표시 · 기존 문서에 `null` patch 값 0 (Phase 0 에서 확인, 있으면 의미 충돌이라 이 표기를 다른 sentinel 로 바꾼다) → 기존 문서 Δ0.

### Phase 2 — 상태 변형 = origin 의 instance (G2)

- 규칙: **origin = 가장 완성된 상태** (선택 가능한 항목 · 선택 컨트롤 = 선택 상태, 선택 상태가 없는 Button · Link = 기본 상태). 나머지 상태 = origin 의 `reusable` ref + 덮어쓰기 (props · style · fills · descendants · `enabled` 전부 — 관리 키 4 제한 폐지).
- 상태 → 변형 연결: 변형의 `metadata.variant` (상태 이름) 유지, `variantOf` 는 `ref` 로 대체. 선택 가능한 가족은 휴지 상태 변형 `unselected` 추가.
- 겹침 순서: RAC 는 상태가 동시에 켜진다 — 휴지(`unselected`) → selected → focus-visible → hover → pressed → disabled (뒤가 이김, 230 CSS 순서 계승).
- 전체 층 (root · descendants 같은 규칙, review round 1 m4): **origin → 직접 ref 한 변형 patch (있으면, 상속 층) → 실행 중 상태 변형 patch (위 순서) → instance 자기 patch**. "instance 자기 patch" = instance 노드에 저장된 키 (root props · style · fills · `enabled` · 자기 `descendants` 항목) — 체인 중간에서 상속된 값은 포함하지 않는다. 230 `stateVariantResolution.ts:182-197` 의 `instanceOwned` 판정을 이 정의로 바꿔 두 leg 가 같이 읽는다 (Canvas scene · Preview render props 함수). 작성자가 직접 ref 한 변형은 실행 중 상태에 진다 (RAC 계약).
- Canvas: 유효 상태 (selected · disabled — hover/pressed/focus 는 Preview 소관, ADR-150 A1 철회 판정) 로 변형 덮어쓰기를 scene 에 겹친다.
- Preview: RAC render props (`style` · `className` 함수 + children 함수로 상태 context 를 자손에 전달) 로 같은 덮어쓰기를 겹친다. 230 의 `<style>` 규칙 + `--co-*` 변수 채널과 `INDICATOR_FILL_CSS_VAR` 우회 (233 round 3) 는 대체 대상 — 대체 전후 결과 대조 후 제거.
- 이관 (시각 결과 보존, review round 1 h1 · h2):
  - diff = **유효값 차분** `diffEffective(target, originEffective)` — target = Phase 0 (e) 의 이관 전 유효값. 다른 키는 target 값, origin 에만 있는 키는 `null`, fills 가 target 에 없고 origin 에 있으면 `[]`. F12 `diffPropsAgainstOrigin` 은 "복제본에 있는 키만" 비교하므로 재사용하지 않는다 (h 반증).
  - origin id 고정: 선택 가능한 가족은 **기존 default origin 노드 (사용자 instance 가 ref 하는 id) 를 그대로 두고 내용만** 선택 상태 (기존 default + selected overlay 유효값) 로 다시 쓴다. 자식 id 도 유지 → 기존 instance `descendants` 키 Δ0. 기존 default 모양은 새 `unselected` 변형 (ref → origin + 유효값 diff) 이 가진다. 옛 `--selected` 복제본은 origin 과 같은 상태가 되므로 제거하고, 그것을 직접 ref 한 노드는 origin 으로 대상 교체.
  - 변형 자식 id: 옛 복제본 자식 id (`${variantId}__n`) → origin 자식 id 대응표 (Phase 0 (g)) 로 변형을 직접 ref 한 노드의 `descendants` 키 (root ref · 중첩 ref · descendants 안 ref) 를 옮긴다. 대응 없는 경로가 하나라도 있으면 그 가족 전체 보류 (부분 이관 없음).
  - 관리 키 밖 raw 값 (230 이 무시하던 변형 padding 등) 은 target 에 없으므로 diff 에 들어가지 않는다 — 이관이 새 모양을 켜지 않는다.

### Phase 3 — 목록 = slot 을 채운 instance 자식 (G3)

- slot 위치: 항목을 직접 담는 목록 틀 — TabList · TagList · ListBox · GridList · Menu. 값 = 항목 origin (추천 목록 — 역할 표 아님).
- 컨테이너 instance 의 목록 틀 자식 = 항목 origin 의 instance (label 등은 descendants). Slot "+" = 항목 instance 삽입. Tabs 는 Tab `id` 로 TabPanel 을 짝지어 함께 만든다 (RAC `id` 짝 규칙).
- Canvas: 정적 목록은 실제 자식 노드를 그린다 (projection 가상 행은 바인딩 목록 전용으로 축소). Preview: RAC static children (`<TabList><Tab id>`) 로 렌더.
- 바인딩 목록: `items` + 항목 origin 템플릿 (RAC `items` + render 함수) 그대로 — 행마다 상태 변형 규칙은 Phase 2 와 같다.
- 이관: 정적 `items` → 항목 instance 자식 1회 (hydration) · 바인딩 목록 무변경 · slot root → 목록 틀 이동.
- 쓰기 경로 (Phase 0 표) 를 새 모델로 — AI tool 의 정적 목록 작성 포함.

### Phase 4 — live · 성능 · BC · 문서 (G4 · G5)

- live (Skia · store · IndexedDB): Components 페이지에서 origin 편집 → 변형 노드 · 문서 instance 동시 반영, 변형의 padding/label 편집 → 해당 상태 항목만, TabList instance "+" → Tab + TabPanel, reload 보존. Preview 는 사용자 지시가 풀리기 전까지 renderer unit + 사용자 확인.
- 성능 A/B (233 G3 조건 계승): 정적 목록 자식 노드화의 `scene.build` · Preview 상태 전환 (hover) 재렌더 비용.
- BC: 이관 전후 Canvas 픽셀 동일 (변형 · 목록) · 재hydration Δ0.
- 문서: 066 · 148 · 229 · 230 · 233 에 "일부 결정은 ADR-234 가 대체" 안내 · README · CHANGELOG.

## 5. 파일 경계 (예상)

| 영역              | 파일                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| schema            | `packages/shared/src/types/composition-document.types.ts`                                                           |
| ref 체인          | `apps/builder/src/resolvers/canonical/index.ts` · `workspace/canvas/scene/canvasSceneNode.ts`                       |
| 변형 seed · 이관  | `components/stateVariantOrigins.ts` · `stateVariantResolution.ts` · `originChildRefs.ts` · 항목 template origin 3종 |
| Preview 상태 채널 | `preview/components/CanonicalNodeRenderer.tsx` · shared wrapper (Tabs · TagGroup · ListBox · GridList · Menu)       |
| 목록 · slot       | `components/slotHostPolicy.ts` · `FrameSlotSection.tsx` · `canvasSceneNode.ts` projection · `LayoutRenderers.tsx`   |
| 쓰기 경로         | factory · AI tool · Pencil import (Phase 0 표 확정)                                                                 |

## 6. 중단 기준

- ref 체인 해석이 두 leg 중 한쪽에서 캐시 무효화 계약을 깨면 (편집이 체인 끝 instance 에 안 닿음) Phase 1 에서 중단 · 보고.
- 이관 전후 Canvas 픽셀이 다르면 해당 가족 이관 보류.
- 자식 id 대응표에 대응 없는 경로가 있으면 해당 가족 이관 보류 (부분 이관 금지).
- 기존 문서에 patch 값 `null` 이 이미 있으면 삭제 표기를 다른 sentinel 로 바꾸고 본문 개정 (Phase 1 착수 전).
- RAC render props 가 특정 wrapper (internal renderer) 에서 상태를 자손에 못 넘기면 그 컴포넌트는 Phase 2 보류 (230 채널 유지) · 보고.
- `scene.build` p95 +1 ms 초과 → 자식 노드화 캐시 가설 재측정, 못 닫으면 보고.

## 7. 실행 기록

### Phase 0 — G0 inventory freeze (2026-09-23, 기준 `66480f5e0`)

- **F1~F13 재grep**: 일치. 라인 이동만 있음 (F6 TabList projection `canvasSceneNode.ts:2519` · F9 Canvas 제외 `:2905`). 정정 2건:
  - **F6 정정** — Canvas 는 TabList 의 ref 자식 (`Tab` instance) 을 **이미 일반 scene 자식으로 실체화**한다 (진단 (c) Canvas GREEN — `adr234Diagnostics.test.tsx` 기준선). Preview 만 `items` 로만 그린다. 그림 모양 (Tab 행 규칙 · 선택 표시) 은 Phase 3 G3.
  - **F9 보강** — Canvas 는 1단 체인 (instance → 변형 → origin) 의 **root props 는** scene visit 의 ADR-228 merge 덕에 받지만 **자식은 잃는다** (`sceneChildrenByParent(instance) = []`). Preview 는 root 부터 `type: "ref"` 로 남는다.
- **seed 전수 probe** (`ensureReusableCompositeOrigins`, 로컬 evidence `docs/adr/evidence/234-g0-inventory-probe.json`):
  - 변형 **31 = 230 상태 변형 28** (Button · Link = disabled/hover/pressed/focus-visible 4 · ToggleButton · Checkbox · Switch · Radio = selected 포함 5) **+ 항목 템플릿 selected 3** (Tab · ListBoxItem · Tag). 항목 템플릿 default 4 (Tab · ListBoxItem · GridListItem · Tag) 는 origin 쪽. `type: "ref"` 0.
  - 230 변형 28 = 관리 키 값 0 · fills 0 · 관리 키 밖 style 키 0 · 자식 구조 경로 = default 와 전부 일치 (복제). 항목 템플릿 selected 는 독립 노드 — Tab · Tag = `_isSelected: true` 만 다름, ListBoxItem selected = `backgroundColor: var(--accent-subtle)`.
  - 변형을 **직접 ref 한 노드 0** · 저장된 patch 값 `null` **0** (props · descendants).
  - slot 보유자 4 = 전부 root (`component-tabs` · `component-listbox` · `component-gridlist` · `component-taggroup`).
  - 정적 `items` 보유 (seed origin): Tabs + TabList (2) · TagGroup + TagList (4) · ListBox (3) · GridList (3) · Menu (3) — 234 범위. 범위 밖 Breadcrumbs · Select · ComboBox · Table 은 유지.
  - 항목 instance 자식 직렬화 실측 **170 B (Tab) · 174 B (Tag)** — 추정 150~250 B 안.
- **`null` 뜻 판정**: 소비자 (React style · `readOwnedManagedKeys` · Skia `?? 기본값`) 는 이미 `null` 을 "값 없음" 으로 읽는다 → `applyPropsPatch` 가 `null` 을 지워도 기존 렌더 결과 Δ0. 새 뜻은 patch 합성 경로에서만 생긴다 (§6 sentinel 교체 불필요).
- **진단 RED 6**: (a) 체인 Preview `type 'ref'` · Canvas 자식 0 · (b) 변형 paddingLeft 30 → projection `undefined` · (c) Preview DOM Tab 0 (Canvas 는 GREEN) · (d) 두 leg 숨김 무시 · (h) `diffPropsAgainstOrigin({style:{}}, {style:{color:red,padding:24}})` = `{}` → 병합 후 red/24 되살아남 (probe 재현) · (i) 변형 자식 id descendants 유실 (Codex round 1 probe `/private/tmp/adr234-review-probe.log` 재현 기록 — h2 수리 계약 "origin id 고정" 이 대상).
- **목록 쓰기 경로 표** (정적 `items` 를 쓰는 곳 — 바인딩 경로는 `props.dataBinding` 만 쓰고 `items` 는 읽기 전용):

| 경로                     | 위치                                                                                                                                                                                                                                                               | 대상            | Phase 3 처리                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------- |
| origin seed · repair     | `catalogOrigins.ts:140,253,345` · `tabsTemplateOrigins.ts:130` · `tagGroupTemplateOrigins.ts:200` · `listBoxTemplateOrigins.ts:187` · `gridListTemplateOrigins.ts:113` · factory `LayoutComponents.ts:8` · `GroupComponents.ts:277` · `NavigationComponents.ts:11` | 5종 origin      | origin 목록 틀에 항목 instance 자식 seed                          |
| 전파 복사                | `propagationRegistry.ts:653,1040` (Tabs → TabList · TagGroup → TagList `override:true`)                                                                                                                                                                            | Tabs · TagGroup | 정적 목록은 자식이 정본 — 복사 대상에서 제외                      |
| 배치 (팔레트 · AI)       | `useElementCreator.ts:188` `buildReusableInstanceProps` → ref `props = {}`                                                                                                                                                                                         | 5종             | instance 는 origin 자식을 상속 (+ 는 instance 자식 추가)          |
| Properties items-manager | `ItemsManager.tsx:421-503` → `stores/elements.ts:2291-2450` (resolved props 를 읽어 instance override 로 fork) · binding `ListBox:34 · GridList:22 · TagGroup:23 · Menu:22` (Tabs 없음)                                                                            | 4종             | 정적 목록은 자식 편집으로 — items-manager 는 바인딩 목록 전용     |
| Slot "+"                 | `FrameSlotSection.tsx:187-217` + `slotHostPolicy.ts:188-209` (TagGroup `collection-item` · Tabs `none`)                                                                                                                                                            | TagGroup · Tabs | 항목 instance 삽입 (Tabs 는 TabPanel 짝)                          |
| detach · reset           | `instanceActions.ts:759,912`                                                                                                                                                                                                                                       | 5종             | 자식 실체화 규칙 그대로                                           |
| 붙여넣기 · 복제          | `multiElementCopy.ts:299,354,409` (plain 은 `items` 그대로 · 같은 item id)                                                                                                                                                                                         | 5종             | 자식 복제는 id 재발급 (TabPanel 짝 id 는 항목 `props.id` 라 유지) |
| AI tool                  | `toolValidation.ts:10` → `manifest.ts:83-97` — `items-manager` 필드 `unsupported-field` (AI 는 `items` 를 못 쓴다) · `bindCollection` = `dataBinding` 만                                                                                                           | —               | 변경 없음 (정적 항목 작성 tool 은 범위 밖으로 기록)               |
| Pencil import            | `pencil-adapter.types.ts:263` 일반 매핑 (전용 경로 없음)                                                                                                                                                                                                           | —               | 자식 모양이 그대로 들어온다                                       |
| hydration                | `mainDocumentNormalization.ts:30-40` · `createInitialProjectDocument.ts:31` (seed/repair 호출) · `migrateCollectionItems.ts` (테스트 전용)                                                                                                                         | 5종             | Phase 3 이관 지점                                                 |

조사 부산물 (Phase 3 에서 확인): FrameSlotSection "+" 가 raw canonical props 로 `items` 를 읽어 TagGroup **ref instance** 에서 상속 목록을 버릴 수 있다 (store `addItem` 은 `elements.ts:530` 에서 resolved 로 수리된 같은 계열 — runtime 미확인) · Tabs `items` 는 seed 뒤 편집 경로 0 · items-manager 가 TagList/TabList 복사본을 갱신하지 않는다.

### Phase 1 — ref 체인 · `enabled` · patch 두 연산 (G1, 2026-09-23)

- patch 두 연산 (`adapters/canonical/instanceResolver.ts`): `composePropsPatches` (= 종전 merge, `null` 보존 — descendants 스택 `canonicalRefResolution.ts` `getStackedDescendantPatch` · 자식 ref 자기 patch 합성 · Preview `resolveNestedRefChild` · inspector 쓰기) / `applyPropsPatch` (merge 후 `null` 키 제거 — resolver root · descendants 최종 적용 · scene visit · 패널 유효값 · detach · origin 자식 ref 판정 · presentation commit · publish export).
- ref 체인: Preview `resolveChainMaster` (master 가 ref 면 먼저 해석 · 템플릿 치환은 체인 끝 · `_resolvedFrom` = 직접 master · metadata 는 체인 끝 origin 위 변형) · Canvas scene visit `resolveSceneRefChain` (type = 체인 끝 · props 접기) + `resolveCanonicalRefTree` `resolveRefElementChain` (자식 = 체인 끝 origin 자식, patch 소유자 스택 `[instance, 변형, …]`) · publish `resolveRefChainMaster`. 깊이 상한 8 · 순환 → broken ref 경로 (Preview 경고).
- `enabled?: boolean` (schema · Pencil import/export 필드): Preview resolver 가 자식 배열에서 뺀다 · Canvas scene 은 노드를 남겨 해석한 뒤 `pruneDisabledSceneNodes` (scene model 마지막 — layout · hit test 입력) · publish render model · descendants mode A patch 는 노드 필드로 (두 leg).
- unit: `adr234Phase1.refChainEnabled.test.ts` 11 + 진단 (a)(d) 4 GREEN · (b)(c) Preview `it.fails` 유지 (Phase 2 · 3). 원복 RED 11종 전부 RED (preview 체인 4 · canvas 소유자 스택 1 · scene 접기 2 · compose 가 null 제거 2 · apply 가 null 유지 4 · preview enabled 2 · canvas prune 2 · publish enabled 1 · publish 체인 1 · patch enabled 두 leg 각 1).
- 회귀: builder 7,170 pass / 5 fail (착수 전부터: adr113DescendantsGrepGate · factoryInlineDirtyBaseline · historyActions.static · AI componentCatalog · propertyFieldIcons.static) · shared 1,398 / 2 fail (착수 전부터: Modal placeable · generatedCssLoadInventory). 정적 게이트 2 갱신 (g6ParityCompletion `_resolvedFrom: directMaster.id` · instanceActions detach `applyPropsPatch`). type-check PASS.
- live: Phase 1 은 저장 모양을 바꾸지 않고 (변형은 아직 복제본 · `enabled` 저작 UI 없음) 해석 규칙만 넓혔다 — 사용자 경로가 이 규칙을 처음 밟는 Phase 2 (변형 = ref) 와 함께 Skia · store live 로 확인한다 (§4 Phase 4 live 항목).

### Phase 2 — 상태 변형 = origin 의 instance (G2, 2026-09-23)

- **층 모듈 하나 (두 leg 공용)** `builder/components/stateVariantLayers.ts`: 층 순서 `unselected → selected → focus-visible → hover → pressed → disabled` · ref 변형 = 자기 patch 전부 (props · style · fills · descendants · `enabled`) · 이관 전 복제본 = 230 관리 키 + fills (보류 가족도 같은 경로) · 층 합성 = `composePropsPatches` · instance 자기 patch 키 표 (`readInstanceOwnedKeys` / `omitOwnedKeys`) · 강제 상태 (`metadata.variant` — 변형 노드 · 선택 상태 origin).
- **Canvas**: `resolveCanonicalRefTree` 가 유효 상태 (selected = 강제 → 자기 `isSelected`/`_isSelected` → 조상 RadioGroup value → 조상 Tabs selectedKey · disabled = 강제 → 자기 → 조상 그룹 3단계) 로 켜진 층을 해석이 끝난 props · fills 에 얹고 (instance 소유 키 제외 — scene 노드는 origin 을 접어 둔 props 라 원본 `sourceNode` 로 판정), 자손 층은 patch 소유자 스택 (instance 다음) 으로. paint 단계 230 overlay (`buildSpecNodeData`) 제거 — geometry 키가 layout 입력 (scene props) 에 닿는다 (R9, layout 캐시 서명 unit).
- **Preview**: resolver 가 `_stateLayers` (층 집합 + instance 소유 키) · catalog RAC 경로 = `style` 함수 + 자손 층은 `children` 함수 → context · 위임 렌더러 (Checkbox · Switch · ToggleButton) 는 `PreviewElement.stateStyle` 로 같은 함수 · RAC 밖 경로는 선언적 상태로 정적 적용. 230 의 문서 `<style>` 규칙 · `--co-*` 변수 · `data-state-origin` · `_stateVariants` 제거 (R7). `INDICATOR_FILL_CSS_VAR` 는 **유지** — Radio `fill` = 선택 표시 색은 catalog 뜻이라 230 채널과 무관하게 필요 (대체 전후 대조: `adr233Round3` Radio 테스트가 새 경로로 GREEN).
- **R2 실측**: 위임 Checkbox 렌더러가 `style` 을 아예 넘기지 않아 (230 은 CSS selector 로 우회) 채널 제거 직후 선택 모양이 사라졌다 → 렌더러가 인스턴스 style + 상태 층 함수를 넘기게 수리 (Switch · ToggleButton 은 이미 style 을 넘겼다 — Checkbox 만 Canvas 와 갈리던 결손 동반 수리, CHANGELOG).
- **이관** `stateVariantMigration.ts` (hydration `ensureReusableCompositeOrigins` 끝, 멱등): 230 가족 = 복제본 → ref + 그 상태가 바꾸던 키만 · 선택 가능한 가족 origin (id · 자식 id 고정) = 휴지 + selected 층 → 선택 상태 (`metadata.variant: "selected"`) · `--unselected` = 휴지 − origin 유효값 차분 (다른 키 = 휴지 값 · origin 전용 키 = `null` · fills 차이 = 휴지 fills 또는 `[]`) · `--selected` 제거 + 직접 ref 대상 origin 으로 · 복제본 자식 id → origin 자식 id 대응표로 직접 ref 노드 descendants 이동 (구조 불일치면 가족 보류 + 경고). 항목 템플릿 (Tab · Tag · ListBoxItem) = default id 가 origin (default ⊕ selected overlay · fills selected 우선 · 자식은 역할로 짝지어 default id + selected 내용) · `--unselected` = ref + 차분 (descendants 포함) · `-selected` 제거 · slot = `[휴지, origin]` — 소비처 규칙 "slot[0] = 기본 · variant selected = 선택" 을 그대로 쓴다. Canvas 소비처 7곳은 `resolveTemplateOriginNode` (ref 변형을 펼친 노드), Preview 는 resolved 트리 (체인 해석) 로 같은 결과.
  - **실행 판단 (계약 해석)**: 선택 외 상태 변형의 patch 는 "origin 과의 전체 차분" 이 아니라 **그 상태가 바꾸던 키만**. 전체 차분이면 disabled patch 에 휴지 모양이 들어가 선택+disabled 가 휴지 배경으로 그려진다 — 층 겹침 (휴지 → 상태) 이 이관 전 유효값을 그대로 내므로 h1 계약 (이관 전 유효값 보존) 은 유지된다 (G2 unit: 휴지 · 선택 · 선택+disabled · 휴지+disabled · instance 소유 키 5 조합이 이관 전 · 후 두 leg 동일).
  - 재hydration Δ0 수리: seed repair 가 이관 결과를 되돌렸다 — ListBox repair 가 slot · 이름 · fills 를, Tag repair 가 이름을 seed 값으로 덮어 매 hydration 이관이 다시 돌았다 → 보존. 이관을 지난 origin 이 있으면 `ensureStateVariantOrigins` 는 `--selected` 복제본 대신 ref 변형 (`unselected` 포함) 을, 템플릿 ensurer 는 `-selected` 를 다시 만들지 않는다.
  - 옛 BC 테스트: 229 · 233 BC 는 이관 직전 파이프라인 (`ensureReusableCompositeOriginsBeforeVariantMigration`, 테스트 전용 진입점) 으로 각자의 증분만 재고, 230 BC 는 새 파이프라인 기준 (Δnode 28 = ref 변형 root · 선택 가능한 origin 표식 1 필드) 으로 고쳤다.
- unit: `adr234Phase2.migration.test.tsx` 11 (230 가족 모양 · h1 null · h2 descendants 이동 · 두 leg 이관 전후 동일 · 멱등 · 항목 템플릿 3종 · R9 layout 서명 · RAC focus-visible 실행 중 상태) + 진단 (b) 두 leg GREEN · 230/233 계약 테스트 새 경로 이관. 원복 RED 9/9 (canvas 층 11 · canvas 원본 소유 판정 2 · unselected 층 3 · preview RAC style 함수 1 · Checkbox style 1 · 이관 selected fills 3 · 이관 null 차분 2 · canvas 템플릿 펼치기 2).
- 회귀: builder 7,184 pass / 5 fail (착수 전부터 5 — textAxisGate.static 은 전체 실행에서만 1회 실패, 단독 GREEN · 전후 코드 무관) · shared 1,398 / 2 fail (착수 전부터). type-check PASS.
- live smoke (headless Playwright · 새 프로젝트 · dev 서버, `48b786927`): hydration 이관 모양 = origin `variant: "selected"` · `--unselected` / `--disabled` / `--hover` = `type: "ref"` · `--selected` · `tab-item-selected` 0 · slot `[--unselected, origin]` (Tabs · ListBox) · ListBox 휴지 변형 `backgroundColor: null` · Components 노드 246 → reload 후 246, 노드 모양 동일 (IndexedDB 재hydration Δ0) · 콘솔 오류 0 · Skia layout rect (Components 페이지로 viewport 이동 후): checkbox origin · `--unselected` · `--disabled` 94×20 · button `--hover` 69×30 · tab origin · `--unselected` 69×29 · listbox 휴지 변형 115×76 — 변형 노드가 체인 해석으로 캔버스에 그려진다 (스크린샷 확인: 선택 표시 · 휴지 쌍).
- live 남은 항목: Phase 4 에서 (Components 페이지 origin 편집 → 변형 노드 · instance 동시 반영 · 변형 padding · label 편집 → 해당 상태만).

### Phase 3a — Tabs: 목록 = TabList 의 Tab instance 자식 (G3 일부, 2026-09-23)

- **이관** `staticCollectionMigration.ts` (hydration 끝, 변형 이관 다음, 멱등): 바인딩 없는 Tabs 의 `items` 행 → TabList 의 Tab instance 자식 (`type: "ref"` → 항목 origin (선택 상태) · `props.id` = 행 id = TabPanel `itemId` 짝 · label = `descendants["Label"]` segment 키) · Tabs/TabList `items` 제거 · slot 을 root → TabList 로. 바인딩 Tabs 는 그대로. ref instance 의 `items` override → TabList 경로 descendants mode C (그 경로에 다른 patch 가 있으면 보류 + 경고). 재hydration 유지: `repairCatalogOrigin` 은 이관된 origin (자식 배열 있음 · `items` 없음) 에 seed `items` 를 되살리지 않고, Tabs ensurer 는 TabList 에 slot 이 있으면 root slot 을 다시 얹지 않는다.
- **Preview**: `renderTabs` 가 TabList 의 Tab 자식을 RAC static children 으로 (`items` 경로는 바인딩 · 이관 전). canonical 경로는 `renderCollectionItem` → CanonicalNodeRenderer → catalog internal `tab` (shared `Tab` = RAC Tab, render props 로 상태 층 · key = `resolveStaticItemKey`) · legacy 경로는 `renderTabs` 가 RAC Tab 을 합성. 컬렉션 밖 단독 Tab (Components 페이지 origin · 변형) 은 종전 경로 (RAC Tabs 는 빈 선택을 허용하지 않아 단독 호스트 불가). 진단 (c) Preview `it.fails` → `it`.
- **Canvas**: 실제 Tab 노드 (projection 없음) · 선택 = 조상 Tabs `selectedKey ?? defaultSelectedKey` 와 key 매칭을 origin 에서 상속한 `_isSelected` 보다 먼저 · layout 의 Tabs 빈 판정 · panel 짝 · 높이가 Tab 자식 key 를 읽는다 (`resolveTabsItemKeys`). bound Tabs 템플릿 slot 은 TabList 우선 (두 leg).
- **live 에서 잡은 결함 4** (unit 이 못 봄 → unit 추가):
  1. `resolveCanonicalRefTree` 가 plain ref 를 해석한 뒤 map 만 바꾸고 부모 자식 목록 (`sceneChildrenByParent`) 은 해석 전 객체 — Phase 2 부터 잠재. 부모 목록도 같은 객체로.
  2. Skia 페인트 (`StoreRenderBridge.buildNodeForElement`) 가 **해석된** scene 노드를 master 로 다시 해석해 층이 지운 키 (휴지 Tab `_isSelected`) 를 origin 값으로 되살림 → 두 Tab 모두 선택 표시. 해석 완료 표식 (symbol) 으로 재해석 생략.
  3. scene 접기 (`resolveSceneRefChain`) 가 ref 자기 `null` 을 소비한 뒤 해석이 master 값을 되살림 (`--unselected` 변형 노드 `_isSelected: true`) → 해석 뒤 ref 자기 삭제 표기를 한 번 더.
  4. **엔진**: max-content 측정 모드 available 센티넬 (−3) 을 `%` 의 기준으로 써서 label `width: 100%` (Text B22) 가 −3 = `MIN_CONTENT` 센티넬이 됨 → fit-content Tab 이 min-content 폭 (label 두 줄 "Tab / 1"). 키워드는 문자열로 판정 · 키워드 아닌 음수는 순환 백분율 = auto (CSS-SIZING-3 §5.2.1c). Rust 회귀 테스트 `percent_width_text_in_fit_content_flex_item_reports_max_content` (RED 48 → GREEN 64).
  - 동반: Phase 2 이관의 항목 템플릿 descendants 키를 id → segment (Canvas 는 segment 만 읽는다) · mode C 로 채운 Tab 도 상태 층.
- **Slot "+"**: TabList 가 slot host (`tab-item`) — plain 은 Tab ref + 짝 TabPanel 자식 2 (`addElement` × 2), instance (synthetic TabList) 는 바깥 instance 의 descendants mode C (origin 목록 복제 + 새 항목, TabPanels 도). 항목은 slot 항목이 아니라 **체인 끝 origin** 을 가리킨다 (휴지 변형을 직접 ref 하면 실행 중 선택이 그 patch 를 못 이긴다).
- unit: `adr234Phase3.staticCollections.test.tsx` 13 + 진단 (c) GREEN. 원복 RED 16/16 (이관 · repair items · owner key 우선 · 자식 목록 동기 · renderTabs 정적 · Tab internal renderer · Tab key · segment 키 ×2 · layout key · 템플릿 slot · TabList host · 체인 끝 · 해석 표식 · 삭제 재적용 · mode C 층). `forcedSource` 변경은 원복 GREEN 이라 되돌림 (instance 는 두 leg 모두 origin 의 `variant` 를 상속하지 않음 — probe 확인). Rust 432 + 1.
- 회귀: builder 7,204 pass / 5 fail · shared 1,398 / 2 fail (전부 착수 전부터). parity (browser): `tabsPanelWrapper` 가 legacy 렌더 경로에서 빈 TabList → `renderCollectionItem` 폴백으로 GREEN · 남은 4 (DC-6 팔레트 facet 집합 · HC2 Tag display · Dialog fixed) 는 엔진 수정 원복 wasm 에서도 같은 실패 — 이번 변경 밖 영역. type-check PASS.
- live (headless · 새 프로젝트): Components 페이지 Tabs origin = Tab ref 2 + slot TabList · Skia rect Tab 62×29 · label 38×24 (한 줄) · 선택 표시 Tab 1 만 · TabList 선택 → Properties Slot "Insert Tab/Default" → Tab 3 + TabPanel 짝 · reload 후 같음 · 콘솔 오류 0 (스크린샷 확인).
- 남은 Phase 3: TagGroup (TagList) · ListBox · GridList · Menu · items-manager 를 바인딩 전용으로 · 전파 규칙 정리.

### Phase 3b — TagGroup: 목록 = TagList 의 Tag instance 자식 (G3 일부, 2026-09-23)

- **이관 일반화**: `staticCollectionMigration` 이 가족 표 (`STATIC_COLLECTION_FAMILIES` — owner · 목록 틀 · 항목 type · 기본 origin · 행 → props/descendants) 로 Tabs · TagGroup 을 같은 코드로 옮긴다. Tag 행 → `props.id` · `Label` descendants · leading slot (`Icon` · `Avatar`) 은 행 값이 있으면 `iconName` / `src`, 없으면 `enabled: false` (projection 의 슬롯 존재 gating 과 같은 결과 — Phase 1 `enabled` 의 첫 production 사용) · `isDisabled` · `allowsRemoving`. slot 은 root → TagList (ADR-229 의 root 규칙 역전 — seed 는 root 에 두고 이관이 매 hydration 옮긴다: TagList 보존 분기를 따로 두는 변경은 원복 GREEN 이라 넣지 않음).
- **Canvas 선택**: 항목 type → 선택 owner 표 (`Tab → Tabs` · `Tag → TagGroup`), `selectedKeys ?? defaultSelectedKeys` (배열 · `"all"`) 또는 `selectedKey ?? defaultSelectedKey`.
- **Preview**: `renderTagGroup` 정적 분기 → shared `TagGroup` 새 prop `staticItems` (이미 RAC Tag 인 노드 + maxRows 미러 글자) · catalog internal `tag` (shared `Tag`, children 함수 지원) · 컬렉션 밖 단독 Tag 는 종전 경로.
- **Slot "+"**: TagList host → 행동 `list-item` (Tabs 와 공용으로 이름 일반화) · 계획 함수도 가족 표.
- **items 편집기**: 정적 목록 owner (`isStaticCollectionOwner` — origin · instance) 에서는 Properties items-manager 를 숨긴다 (바인딩 목록 전용 — 정적 목록에 `items` 를 쓰면 두 목록이 겹친다).
- unit 19 (3a 13 + 3b 6) · 원복 RED 7/7 (가족 표 · leading gating · Tag owner 선택 · renderTagGroup 정적 · Tag renderer · TagList host · owner 판정). Phase 2 seed 테스트 slot 위치 갱신.
- 회귀: builder 7,209 pass / 5 fail · shared 1,398 / 2 fail (전부 착수 전부터). parity 파일 단위 실패는 개별 재실행 GREEN (브라우저 세션 flaky) · 남은 3 은 착수 전부터 (HC2 판정표의 Tag canvas 캡처 값만 `inline-block` → `flex` 로 이동 — Tag instance 가 origin style `display:flex` 를 싣는다) .
- live (headless · 새 프로젝트): Components 페이지 TagGroup = TagList Tag ref 4 · slot TagList · `items` 0 · TagList 선택 → Slot "Insert Tag/Default" → Tag 5 (chip 5 한 줄, rect 99/58/106/73/67) · reload 같음 · 오류 0.
- **남은 BC 차이 (다음 단계 3c)**: 항목 label 이 `Text` 라 두 leg 모두 Text 기본 글자 (16 · 400 · `--fg`) 로 그린다 — 대칭이지만 이관 전 행 (Tab: text-sm · 500 · muted / Tag: text-sm · 선택 시 on-accent) 과 다르다. DOM 은 `.react-aria-Text` 가 font-size · color 를 스스로 선언해 item 글자를 상속하지 않는다. 해결 방향: item rule 의 delegation (`.react-aria-Text` → inherit) + Canvas resolver 가 같은 값을 label 에 주입 (InlineAlert · FieldError 선례).

### Phase 3c — 항목 label 은 항목 글자 상속 (BC, 2026-09-23)

- 3a·3b 의 남은 BC 차이 수리: 항목 (Tab · Tag) 안 label Text 가 Text 기본 글자 (16 · 400 · `--fg`) 로 그려져 이관 전 행 (항목 rule 글자) 과 달랐다.
- **DOM**: `TabsIndicator.css` · `TagGroup.css` (수동 — Tab/Tag 는 selected · chip 규칙이 이미 수동) 에 `.react-aria-Tab/Tag .react-aria-Text.react-aria-Text { font-size · font-weight · line-height · color: inherit }` — `.react-aria-Text` 가 자기 값을 선언해 끊긴 상속을 되살린다 (Button `.button-base > *` 선례). 인라인 (작성자 값) 은 여전히 이긴다.
- **Canvas**: `skia/itemLabelInheritance.ts` 하나를 Skia (`buildSpecNodeData`) 와 layout (`fullTreeLayout` — 글자 크기 · 줄 높이 = 측정 폭 · 높이) 이 같이 읽는다. 값 = 항목 rule size (항목 `size` → owner `size` → 기본) 의 글자 크기 · 굵기, 줄 높이 = rule `lineHeight` (Tag) 또는 root 비율 1.5 (Tab, `"<px>px"` 문자열), 색 = Tab 은 선택 시 `{color.neutral}` (TabsIndicator `[data-selected] --fg`) · 아니면 rule text / Tag 는 chip 이 그리는 변형의 text. label 자기 style 에 있는 키는 건드리지 않는다.
  - Tag 의 선택 색은 Canvas 가 rule `selected` 변형 (accent 배경) 을 고르지 않는 기존 비대칭 때문에 chip 변형 색으로 둔다 — 처음엔 on-accent 로 두어 Components 페이지 단독 Tag origin (선택 상태) 의 label 이 흰 배경 위 흰 글자로 사라졌다 (live 스크린샷에서 발견 · 수리). **기록**: Canvas 는 선택 Tag chip 에 accent 배경을 그리지 않는다 (DOM 은 그린다) — ADR-234 이전부터의 비대칭, Phase 4 BC 판정과 별개 후속.
- parity 하니스 (`adr923PreviewLeg`) 에 선택적 canonical 폴백 (rendererMap 에 없는 type 을 CanonicalNodeRenderer 로) — 기본 off, `tabsPanelWrapper` 만 켠다. 새 판정: Tab instance 폭 DOM = layout (Δ ≤ 1) — 원복 RED 2/2 (DOM CSS off: DOM 62/64 vs 59/60 · layout 주입 off: 58/60 vs 62/64).
- unit 21 (resolver 1 · 배선 static 1 추가) · builder 7,211 pass / 5 fail · shared 1,398 / 2 fail (착수 전부터) · type-check PASS.
- live: Tab label 34×21 / 36×21 (14px · 한 줄) · 선택 Tab 진한 색 · 비선택 muted · Tag chip 90/54 폭 (14px) · 단독 Tag origin label 보임 · reload 같음 · 오류 0.

### Phase 3d — ListBox: 목록 = ListBox 자기의 ListBoxItem instance 자식 (G3 일부, 2026-09-23)

- **이관**: 가족 표에 `LISTBOX_STATIC_FAMILY` (목록 틀 = owner 자신, `listType: null`). 행 → `props.id` · `Icon` / `Label` / `Description` descendants (icon · description 은 행 값이 없으면 `enabled: false`) · `isDisabled` · `href`. section 행 (`type: "section"`) 이 있는 목록은 평면 항목 자식으로 옮길 수 없어 그대로 둔다. `columnMapping` 도 바인딩 목록으로 본다.
  - **instance 의 `items` override**: descendants 는 자손 경로만 바꾸므로 root 자식을 교체할 수 없다 → origin 항목을 `enabled: false` 로 숨기고 행을 instance **자기 자식** 으로 싣는다 (Pencil Ref 의 root 속성 override — 두 leg 모두 origin 자식 뒤에 덧붙는 의미). instance 이관이 이관을 마친 origin 을 읽도록 이관을 두 단계 (plain owner → instance) 로 나눴다.
- **바인딩 instance 결함 수리 (3b 포함)**: origin 이 정적 항목 자식을 갖게 된 뒤 바인딩 instance (ListBox · TagGroup) 가 데이터 행과 origin 정적 항목을 **함께** 그렸다 (Canvas: projection 행 + synthetic 항목). 공용 표 `STATIC_LIST_FAMILY_BY_OWNER` + `isBoundListOwnerProps` (`@composition/shared` slotRoles) 를 두 resolver (Canvas `resolveCanonicalRefTree` · Preview resolver) 가 읽어 바인딩 owner 에서 origin 정적 항목을 펼치지 않는다. Tabs 바인딩은 Canvas projection 이 원래 없던 경로라 (Preview 만 데이터 행) 같은 규칙에 둔다.
- **Canvas**: 선택 owner 표에 `ListBoxItem → ListBox` · `GridListItem → GridList`. `listbox_item` shell 이 체크를 `isSelected` 로 그리므로 owner 안 정적 항목에 `isSelected` 를 싣는다 (`withItemSelectionFlag` — root · 중첩 · mode C 세 지점). instance 자기 자식은 origin 자식 **뒤** (종전 앞 — Preview resolver 와 반대였다).
- **Canvas layout — `ListBox.css` slot 규칙과 같은 상자** (`implicitStyles` `resolveListBoxItemSlotLayout`): `[slot="icon"]` absolute (left 12 · top 50% · marginTop −크기/2 · 16×16) + 그릴 수 있는 icon 이 있으면 항목 paddingLeft 34 (`{icon}` 자리표시는 DOM 이 안 그려 여백 없음) · 선택 항목 paddingRight 34 (체크 자리) · label 600 (크기는 Text 기본 16 — 종전 14 폴백은 layout 만 14 로 잰 값) · description 12 / 줄 16. 부모가 준 명시 height 는 fontSize 변경 재측정 (fs×1.5) 이 덮지 않는다 (`fullTreeLayout` 3.6).
- **엔진 결함 수리 — absolute 의 containing block = padding box** (`place_absolute_children`): 원점을 content box (padding+border) 로, 크기를 content 로 잡아 padding 있는 부모의 inset 이 padding 만큼 밀렸다 (icon `left: 12` 가 46). 또 auto 축 컨테이너는 solver 반환 (content-box) 을 border-box 로 보고 padding 을 한 번 더 뺐다 (`top: 50%` 가 13, Chrome 17). 원점 = border 안쪽 · 크기 = border-box − border, 호출부가 auto/키워드 축에 padding/border 를 더해 넘긴다. 기존 테스트 `absolute_child_inside_padded_parent_uses_padding_box` 의 기대값 (20, 15) 은 content 원점이었다 — Chrome `offsetLeft/Top` 0 · 0 실측으로 (0, 0) 정정. Rust RED 2 (48 → 14 · 13 → 17).
- **Canvas Skia**: 3c resolver 에 ListBoxItem slot 자식 — description 12 · 줄 16 · `{color.neutral-subdued}`, icon glyph 16.
- **Preview**: catalog internal `listboxitem` = shared `ListBoxItem` (ListBox 안에서만 — 밖의 Components 페이지 단독 origin 은 종전 경로) · RAC key = `props.id` · 목록 항목 (ListBox · GridList · Menu) 안 slot 자식은 DOM `slot` 속성 (Icon 도 통과) · 선택 시 우측 체크 (`ListBoxItemSelectionCheck` — 조합 자식이 아닌 render-time 표시, ADR-147) · `ListBox.css` icon 상자 안 svg 가 상자를 채운다.
- **Slot "+"**: ListBox host → `list-item`. plain (origin · 문서 ListBox) 은 자식, instance 는 자기 자식으로 덧붙는다 (번호 = origin 항목 + 자기 자식 수).
- unit 29 (3d 8 추가) · 원복 RED 21/21 (unit 18 · parity 3) + Rust 2. `slotHostPolicy` (ListBox "+" = `list-item`) · `collectionItemFontSize` (label 14 폴백 제거) 기대값 갱신.
- parity: 새 `staticListBoxItems` — production Preview 경로 (트리 전체 CanonicalNodeRenderer, 하니스 `mountProductionRoot(…, canonicalTree)`) vs `calculateFullTreeLayout`: 항목 50 · icon (12, 17, 16×16) · label (34, 4, h24) · description (34, 30, h16) 전부 Δ0, svg 16×16. ADR-204 · DC-6 게이트 3 개의 "ListBox = 행 투영 · 자식 0 · 주입 높이 164" 전제 갱신 — 높이는 실제 자식으로 같은 164 / 80 (matrix ListBox 행은 canonical DOM 으로 재어 DOM = pipeline).
- 회귀: builder 7,219 pass / 5 fail · shared 1,398 / 2 · parity 1,487 / 4 (전부 착수 전부터) · type-check PASS · 엔진 434.
- live (headless · 새 프로젝트): Components 페이지 ListBox = ListBoxItem ref 3 · `items` 0 · slot ListBox · 행 모양 = 이관 전 (왼쪽 icon · 굵은 label · muted description) · Slot "Insert ListBoxItem/Default" → 항목 4 (label 만 — 왼쪽 여백 12, 행 32) · reload 같음 · 오류 0.
- 남은 Phase 3: GridList · Menu · 전파 규칙 정리. **기록**: 문서의 plain owner 를 이관한 뒤 바인딩하면 정적 자식과 데이터 행이 같이 보인다 (ref instance 만 거른다 — Components 페이지는 바인딩 없음 판정).

### Phase 3e — GridList: 목록 = GridList 자기의 GridListItem instance 자식 (G3 일부, 2026-09-23)

- **이관**: 가족 표에 `GRIDLIST_STATIC_FAMILY` (목록 틀 = owner 자신). 행 → `props.id` · `Label` · `Description` (값 없으면 `enabled: false`) · `isDisabled`. 바인딩 제외 표 (`STATIC_LIST_FAMILY_BY_OWNER`) 에도 GridList.
- **Canvas layout**: 정적 카드가 있는 GridList 는 OWNER 자신이 grid (shared `GridList` inline 과 같은 `repeat(columns, minmax(0, 1fr))` · gap 12) 이고 카드는 `justify-content: flex-start` (`GridList.css [data-layout="grid"]`). projection 경로는 행 묶음이 grid 를 맡으므로 OWNER flex column 그대로. 카드 slot 자식: label 600 (크기 Text 기본 16) · description 크기 그대로 (종전 14 · 600 주입은 `GridList.css` 와 달랐다). 선택 카드 = border 2 · padding −1 (`[data-selected]`). Skia: description `{color.neutral-subdued}`.
- **Preview**: internal `gridlistitem` = shared `GridListItem` (GridList 안에서만) · key = `props.id`. shared `GridListItem` 의 함수 children 지원은 원복 GREEN (GridListItem 에 상태 층 자손 patch 가 없어 production 이 닿지 않음) 이라 넣지 않았다.
- **Slot "+"**: GridList host → `list-item` (ListBox 와 같은 계획 — instance 는 자기 자식).
- unit 34 (3e 5) · 원복 RED 10/10 (unit 9 · parity 1) + 원복 GREEN 1 (위 함수 children — 제거).
- parity: 새 `staticGridListItems` — 카드의 GridList 기준 x · y · 폭 · 높이 (2열) + 카드 안 label (17, 13, h24) · description (17, 39, h24) DOM = layout. ADR-204 · DC-6 게이트의 GridList 전제 (행 투영 · 주입 높이 164 · 높이 definite) 갱신 — 높이는 실제 자식으로 같은 164 / 80, matrix GridList 행도 production DOM 경로로 DOM = pipeline. `legacyListBoxTemplateMigration` 의 GridList 찾기를 사용자 노드로 좁힘 (origin 이 자식을 갖게 됨).
- 회귀: builder 7,224 pass / 5 fail · shared 1,398 / 2 · parity 1,490 / 4 (전부 착수 전부터) · type-check PASS.
- live: Components 페이지 GridList = GridListItem ref 3 · `items` 0 · 카드 2열 (930 폭 · 행 간격 12) · Slot "Insert GridListItem/Default" → 카드 4 (label 만, 위에서 시작 y 13) · reload 같음 · 오류 0.
- 남은 Phase 3: Menu · 전파 규칙 정리.
