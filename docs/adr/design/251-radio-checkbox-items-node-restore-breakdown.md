# ADR-251 breakdown — RadioItems · CheckboxItems 노드 복원

> 본문: [ADR-251](../251-radio-checkbox-items-node-restore.md). 대안 A 기준 (사용자 2026-10-03 「(a)로 진행」). 줄 번호는 main `db76cc301` 기준이며 G0 에서 다시 확인한다.

경로 약어: `S/` = `packages/shared/src/` · `D/` = `packages/shared/src/catalog/document/` · `R/` = `apps/builder/src/builder/catalogRuntime/` · `P/` = `apps/builder/src/builder/panels/`

## 1. 분리 점검 (fork 4 질문)

1. **base / 응용**: ADR-248 (catalog 문서 모델 · library contract) 이 base, ADR-251 (library 안의 두 template 구조 변경) 이 응용. 251 → 248 의존. 뒤따르는 Design 패널 통합 ADR 은 251 의 응용이다 (묶음 노드가 있어야 Direction 축이 갈린다).
2. **schema 직교성**: 문서 schema 변경 0 (`CATALOG_SCHEMA_VERSION` 그대로). 바뀌는 것은 library 내용과 `LIBRARY_CONTRACT_VERSION` 뿐이다.
3. **선행 전제 검증**: ADR-248 의 「보존할 프로젝트 0 · 구 포맷 거부 · 자동 재해석 금지」 를 그대로 쓴다 — 사용자가 2026-10-03 (a) 로 다시 확인했다. ADR-912 의 「starter 구조 채택」 전제는 승계하지 않는다 (starter 는 2026-09-29 저장소에서 제거, D1 정본 = 설치된 RAC).
4. **분리 confirm**: 사용자 `/create-adr RadioItems 노드 복원 (a)로 진행` (2026-10-03).

## 2. 직계 자식 가정 인벤토리 (G0 에서 고정)

「그룹의 직계 자식 = 항목」 또는 「묶음 상자 = 합성 part」 를 가정한 곳. G0 은 이 표를 grep 으로 다시 세고, 빠진 곳을 더한 뒤 고정한다.

| #   | 위치                                                                                                                                                                                                        | 현재 가정                                                                                                                               | 바꿀 모양                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `D/generated/reusableOriginLibrary.ts:3700` · `:3777`                                                                                                                                                       | template 자식 = Label · 항목 ×2                                                                                                         | Label · Items > 항목 ×2. 위치 id 재배정                                                                                                                                                                                                                |
| 2   | `D/rulePartRules.ts:1261-1330` `ITEMS_WRAPPERS` · `catalogItemsWrapper`                                                                                                                                     | 부모 rule 블록 → 합성 part style                                                                                                        | 같은 블록 → 부모 partRule (`childType: Items`, orientation · size 조건). 함수 · 표 삭제                                                                                                                                                                |
| 3   | `R/presence.ts:423-447` `catalogComposedParts`                                                                                                                                                              | 직계 항목을 `wraps` 로 모아 `::part:items` 생성                                                                                         | items 분기 삭제 (TreeItem chevron 분기는 유지)                                                                                                                                                                                                         |
| 4   | `R/compositionRoot.ts:326` · `:1192-1215` · `:2144-2178` · `:2431-2531`                                                                                                                                     | part 를 layout 트리에 끼우고 geometry 를 그룹 기준으로 접음                                                                             | 장치는 유지 (chevron). 그룹 두 종이 이 경로를 더 타지 않는지만 확인                                                                                                                                                                                    |
| 5   | `D/manualBoxRules.ts:158-190` `groupItemIndicatorParts`                                                                                                                                                     | `childType: 항목` (직계) · `childType: Label, via: 항목` (한 단)                                                                        | 항목 = `via: Items`. Label 은 두 단 — §3 P2 에서 방법 결정                                                                                                                                                                                             |
| 6   | `D/manualBoxRules.ts:546` `Radio: width fit-content`                                                                                                                                                        | 주석상 `.radio-items` column 안                                                                                                         | 값 그대로. 묶음이 실제 부모가 된 뒤에도 같은지 G2 로 확인                                                                                                                                                                                              |
| 7   | `D/sizePropagation.ts:13-14` · `resolution/resolver.ts:561-580` `applyOwnerSize`                                                                                                                            | `RadioGroup: ["Radio"]` · `CheckboxGroup: ["Checkbox"]`. owner = 구조상 직계 부모, 자식 definition 이 `accepts.size` 를 선언해야만 전달 | `RadioGroup: ["RadioItems"]` · `RadioItems: ["Radio"]` + 묶음 definition 이 `size` 를 선언 (`editorHidden` — 내부 운반 값). TagList 는 `accepts.size` 가 편집 필드로 있어 그대로는 동형이 아니다                                                       |
| 8   | `D/commands/collections.ts:92` `GROUP_ITEM_TYPES` · `:414` `insertGroupItem` (`:455-475` 고유 value · `:505-530` 형제 해제 + 그룹 value)                                                                    | 새 항목을 host 의 직속 자식으로 삽입. 형제 = host 의 직계 항목                                                                          | **그룹 전용 삽입 유지.** 삽입 위치 = 묶음 (template 위치면 `fillSlot`), 형제 집계 = 묶음의 자식. `COLLECTION_FAMILIES` 로 옮기지 않는다 — 그 경로 (`R/itemInsert.ts:255-275`) 는 항목에 `id` 를 써서 `PROP_NOT_ACCEPTED` 이고 value · 선택 규칙이 없다 |
| 9   | `R/itemInsert.ts:75-77`                                                                                                                                                                                     | group 은 `target.kind === "node"` 일 때만 「+」                                                                                         | 묶음 (template 위치) 에서도 「+」 가 나오는지 TagList 경로와 맞춤                                                                                                                                                                                      |
| 10  | `S/domain/componentTraits.ts:260-276`                                                                                                                                                                       | `RadioItems` · `CheckboxItems` 가 owner 만 있고 `container` 없음. 그룹 children 에 항목이 직접 허용                                     | 묶음에 `container: "collection"` + `children: [항목]`. 그룹 children 에서 항목 직접 허용 여부 결정                                                                                                                                                     |
| 11  | `D/graph.ts:780-790`                                                                                                                                                                                        | `fillSlot` 대상 = slot · `container` trait · tableItemHost                                                                              | #10 으로 충족                                                                                                                                                                                                                                          |
| 12  | `R/delegatedDom.tsx:987-1047` · `:1049-1110`                                                                                                                                                                | `ownsChild` = 항목 아닌 자식 · 직계 항목을 모아 `div` 생성                                                                              | 묶음 record 가 `div.radio-items` (`data-catalog-id` 부여). 항목은 묶음의 자식으로 렌더                                                                                                                                                                 |
| 13  | `S/components/RadioGroup.tsx:193` · `:219` · `:350` · `CheckboxGroup.tsx:361`                                                                                                                               | children 을 `div` 로 한 번 더 감쌈                                                                                                      | G0 ③ 결과에 따라 한쪽만 감싸게. `apps/publish` 출력 불변이 조건                                                                                                                                                                                        |
| 14  | `R/domBinding.tsx:823` · `:890` · `:939`                                                                                                                                                                    | `collectionAncestor` 가 조상에서 `radiogroup` 탐색                                                                                      | 조상 탐색이라 변경 없음 예상 — 확인만                                                                                                                                                                                                                  |
| 15  | `P/styles/utils/orientationDrivenTags.ts` · `hooks/useStyleActions.ts:183-200` · `hooks/useLayoutAuxiliary.ts:47-56` · `sections/LayoutSection.tsx:78` · `sections/ResponsiveSection.tsx:191`               | Direction 번역은 선택 요소 자신의 prop                                                                                                  | 묶음 type → owner prop 표 추가. 표시 · 쓰기 · Block 비활성 · 반응형 제외가 같은 표를 읽음                                                                                                                                                              |
| 16  | `P/styles/catalog/catalogStylesHost.ts:303-316` · `:432-444`                                                                                                                                                | prop 쓰기 대상 = selection targets                                                                                                      | owner target 에 쓰는 host 멤버 추가                                                                                                                                                                                                                    |
| 17  | `S/catalog/resolvers/resolveDelegatedChildFontSize.ts:115` · `:148` · `R/subpart.ts`                                                                                                                        | Label 은 그룹의 self-composed sub-part (직계 부모 판정)                                                                                 | Label 은 여전히 그룹의 직계 — 변경 없음 예상. 묶음 자신의 owner 안내 여부는 P4                                                                                                                                                                         |
| 18  | `D/types.ts:3-5` · `D/validation.ts:1330-1365` · `D/library.ts:117` · `:180` · `:480` · `D/codeCatalogLibrary.ts:761` · `:776` · `D/graph.ts:249` · `:1159` · `D/project.ts` · `storage.ts` · `exchange.ts` | contract version 리터럴 `1` 이 상수 밖에도 흩어져 있다                                                                                  | 전부 2 (가능하면 상수 참조로). 거부 테스트 추가                                                                                                                                                                                                        |
| 19  | `apps/builder/tests/adr248-g3/approvedDifferences.ts:206-223` · `:279-285` · `paletteBaseCanvas.browser.test.ts:1018-1121` · `propAxisCanvasDom.browser.test.ts:64-91`                                      | 옛 `_items` 를 펼쳐 새 부모의 자식과 짝지음 · orientation case 없음                                                                     | 옛 `_items` ↔ 새 묶음 노드 짝 · orientation case 추가                                                                                                                                                                                                  |
| 20  | 테스트: `codeCatalogLibrary.test.ts:501-510` · `phase4e11PreviewFollow.test.ts:256-295` · `phase4eItemInsert.test.ts:167-179` · `componentTraits.test.ts:257-292`                                           | 위치 id `component-radiogroup__2` = Radio · 항목 gap 은 그룹 기준                                                                       | 새 구조로 갱신                                                                                                                                                                                                                                         |

잔재 정리 대상 (동작 없음): `S/types/composition-vocabulary.ts:46,103` (이름 유지) · `S/renderers/FormRenderers.tsx:716-1009` (제품 import 0 — 이 ADR 에서 건드리지 않음) · rule 주석 `componentRulesTable.ts:2045-2049` (「DOM 전용」 은 현재 사실과 다름 — 고친다).

## 3. Phase

각 phase 끝은 type-check 통과 + 커밋 가능 상태다. **P1 ~ P4 는 worktree 에 phase 별로 커밋하고, G1 ~ G4 통과 뒤 main 에 1회 병합한다** (ADR-248 Phase 4e 방식). P1 만 main 에 있으면 DOM 렌더러가 그룹의 직계 항목만 모아 (`R/delegatedDom.tsx:993` · `:1054`) 항목이 사라지고, 「+」 도 옛 위치에 넣는다 — 중간 상태를 main 에 두지 않는다 (리뷰 round 1 h1).

### P0 — 인벤토리 · 현재 동작 고정 (G0)

- §2 표를 grep 으로 다시 세어 고정한다.
- TagList 실측: DOM 대응 (`delegatedDom` `absorbsChild`, `.tag-list-wrapper`, `display: contents`) · Layers 행 · 선택 · 삭제/이동 가능 여부 · Styles 편집 범위 · Properties 표시. 묶음 노드는 이 범위를 따른다 (R7).
- unit 1건: 현재 RadioGroup DOM 의 `.radio-items` 개수 (이중 여부) 기록.
- React Spectrum `RadioGroup` 의 group 상자 여부 확인 → 다르면 ADR 본문 외부 사례에서 그 줄을 지운다.
- 현재 값 기록 (원복 RED 기준): size 4 × orientation 2 × labelPosition 2 의 묶음 gap · 항목 rect.

### P1 — definition · template · traits · version (G1 구조)

- 묶음 definition 의 `accepts` 는 `size` 하나 (`editorHidden`, 내부 운반 값 — owner 가 항상 덮는다). 다른 prop 은 없다 (리뷰 round 1 h3).
- `RadioItems` · `CheckboxItems` 를 catalog type 으로 등록 (`registeredCatalogTypes()` 에 들어가는 최소 경로 — rule entry 또는 primitive. 자기 시각 값 없음. 생성 CSS 에 새 블록이 생기지 않는 쪽을 고른다).
- `reusableOriginLibrary.ts`: 두 template 에 묶음 노드를 넣고 항목을 그 자식으로 옮긴다. `descendantPatches` 의 `templatePath` 는 항목 template 내부 경로라 그대로다.
- `componentTraits.ts`: 묶음에 `container: "collection"` · `children`.
- `LIBRARY_CONTRACT_VERSION = 2`. contract 1 문서 거부 테스트.

### P2 — Canvas 값 전달 (G1 값 · G2)

- 부모 rule 의 `containerVariants.orientation[…].nested` `.radio-items` 블록과 size 변수를 **부모 partRule** 로 컴파일한다 (`childType: Items`, `when: {orientation}`, size 별 gap). `--radio-items-gap` 의 xl 블록이 없다 (`sizes` 에는 xl 20) — DOM 의 실제 값 (fallback `var(--spacing-md)`) 을 G0 에서 재고 Canvas 를 그 값에 맞춘다. rule 값 자체를 바꾸는 것은 범위 밖.
- `groupItemIndicatorParts`: 항목 `minHeight` = `via: Items`. `Label via 항목` 은 그룹에서 두 단이다. 방법 후보 — (가) 묶음을 거쳐 내려가는 size 로 항목 자신의 rule 이 Label margin 을 준다 (나) `via` 를 경로 배열로 넓힌다. TagGroup → TagList → Tag 가 같은 문제를 어떻게 풀었는지 P0 에서 확인하고 같은 방법을 쓴다.
- `sizePropagation.ts`: 그룹 → 묶음 → 항목.
- `catalogItemsWrapper` · `ITEMS_WRAPPERS` · `catalogComposedParts` 의 items 분기 삭제.

### P3 — DOM (G4 · G2)

- `delegatedDom`: 묶음 record 를 `div.radio-items` / `div.checkbox-items` 로 렌더 (`data-catalog-id`). 그룹 host 는 묶음을 children 으로 넘긴다.
- 이중 wrapper 정리: G0 ③ 결과가 이중이면 한쪽만 남긴다. shared 컴포넌트의 출력 (Publish) 은 그대로 — `apps/publish` diff 0.
- 생성 CSS diff 0 확인 (`pnpm` CSS 생성 후 `git diff --stat packages/shared/src/components/styles/generated`).

### P4 — 편집 (G3)

- Layers: 묶음 행 표시 · 선택 (template 위치 → `{kind: "descendant"}` target — 추가 작업 없음 예상, 확인).
- 항목 추가: `insertGroupItem` 을 유지하고 삽입 위치와 형제 집계만 묶음 기준으로 바꾼다 (§2 #8). 「+」 가 그룹 · 묶음 어느 쪽 선택에서 나오는지는 TagGroup 과 같게. 회귀 조건 — 연속 2회 삽입한 Radio 의 `value` 가 다름 (`option3` · `option4`) · 선택된 항목 삽입 시 형제 해제 + 그룹 `value` 갱신 (리뷰 round 1 h2).
- Styles Direction: 묶음 type → `{ownerType, prop: "orientation"}` 표. 표시 = owner 의 `orientation`, 쓰기 = owner target 에 `catalogSemanticPatchCommand`, Block 비활성, 반응형 override 제외.
- 묶음의 Properties 표시: TagList 와 같은 처리 (P0 실측).

### P5 — 하니스 재승인 · 문서 · live

- G3 하니스: 짝 매칭 갱신, orientation case 추가, `approvedDifferences` 의 두 그룹 항목 재검토 (항목 수 증가 0 이 조건).
- 규칙 문서: `.claude/rules/ssot-hierarchy.md` 의 sub-part 절에 묶음 노드 한 줄, 메모리 `feedback-intermediate-container-removal-cutover-wrapper-gap` 갱신.
- CHANGELOG (구조 변경 · contract 2 — 기존 개발용 프로젝트 열리지 않음).
- live (headed Playwright, 저장된 인증 세션으로 /dashboard 직행): 팔레트 RadioGroup · CheckboxGroup → Layers 묶음 선택 → Direction → undo → 「+」. Preview 는 사용자 확인.

## 4. 검증 명령

```bash
pnpm type-check
pnpm -F @composition/shared test
pnpm -F @composition/builder exec vitest run src/builder/catalogRuntime/__tests__
pnpm -F @composition/builder exec vitest run --config vitest.adr248-g3.browser.config.ts
```

## 5. 범위 밖

- Design 패널 통합 (뒤따르는 ADR).
- 그룹 Label 의 self-composed sub-part 처리 (`SELF_COMPOSED_LABEL_PARENTS`) — 현행 유지.
- rule 값 변경 (gap · indicator 크기) — 값은 그대로, 받는 상자만 바뀐다.
- `S/renderers/FormRenderers.tsx` 등 제품 import 0 인 레거시 파일 삭제.
- contract 1 문서 변환.

## 6. 실행 기록 (2026-10-03, worktree `adr251` → main 1회 병합)

### G0 — 인벤토리 · 현재 동작 고정

- ① 소비처 재집계: §2 표 20행과 거의 일치 (1.5배 미만). 추가 3 — `R/rulePaint.ts` `SHELL_ONLY_TYPES` (묶음은 rule 없이 `container` 바인딩이라 무관) · `S/catalog/resolvers/resolveEditContract.ts` `deriveRadioGroupValueOptions` (catalog 경로 `editContract.ts` 는 자식 없는 node 를 넘겨 이미 선택지 0 — 이 ADR 이전부터, 범위 밖) · 구 레이아웃 엔진 (`workspace/canvas/layout/engines/*`, 새 Builder 미도달). contract `1` 리터럴은 상수 밖 9곳 (`graph.ts:1159` · `library.ts:117/180/480` · `codeCatalogLibrary.ts` 2 · `project.ts:77` · `storage.ts:177/300/372`) + fixture 2.
- ② TagList 실측: 그룹 DOM 이 `absorbsChild` 로 흡수 (자기 DOM · `data-catalog-id` 없음), Layers 행 있음 · 선택 가능, instance 안 template 위치라 이동 · 복제 불가 · 삭제 = 숨김, Styles 전체 섹션 노출 (작성 style 은 DOM 에 닿지 않음 — Canvas 만). 「+」 는 TagList 선택에서만.
- ③ 현재 DOM 의 `.radio-items` = **2** (Builder `delegatedDom` 과 shared `RadioGroup.tsx:350` 이 각자 감쌈). CheckboxGroup 도 2.
- ④ React Spectrum v3 · S2 모두 항목 상자를 따로 둔다 (ADR 외부 사례 줄 유지 · 출처 기재).
- 현재 값 기록: 2 그룹 × size 4 × orientation 2 × labelPosition 2 × 폭 (300 · 150) = 64 case 의 항목 · Label · 그룹 geometry (unit, `nodeLayoutEngine`).

### P1 ~ P4 구현 (계획 대비 차이만)

- **묶음 정의**: `RadioItems` · `CheckboxItems` primitive 등록 (binding `accepts.size` `editorHidden`, palette 비노출 `placeable: false`). **rule 없음** — rule 없는 primitive 는 이번이 처음이다. 생성 CSS 블록 0.
- **값 전달**: 그룹 rule 의 `containerVariants.orientation[…].nested` `.radio-items` 블록을 `rulePartRules.ts` `itemsWrapperPartRules` 가 `childType: RadioItems`, `size` × `ownerProps.orientation` partRule 로 컴파일 (`catalogItemsWrapper` 를 대체 — 같은 파싱, 출력만 partRule). `CONTAINER_VARIANT_AXES` 에 orientation 축을 일반화하지 않았다 (다른 rule 로 번지지 않게). xl 은 `--radio-items-gap` 블록이 없어 root 의 12 — DOM 과 같다.
- **indicator**: `groupItemIndicatorParts` 의 항목 `minHeight` 는 `via: RadioItems` (그룹 → 묶음 → 항목, resolver 의 via 한 단 그대로). **항목 Label margin 그룹 규칙은 삭제** — 그룹 size 가 항목까지 내려가 (4e-11 `CATALOG_SIZE_PROPAGATION`) 항목 자신의 rule 이 같은 값을 준다. 원복 실험: Label 규칙 제거 → G1 32/32 GREEN (중복 확인), indicator 제거 → xl 8 case RED (필요). 그래서 §3 P2 의 (가) · (나) 둘 다 필요 없었다.
- **Canvas 바인딩**: `radioitems` · `checkboxitems` = `container` (칠 없음). DOM 의 shared `div` 가 작성 style 을 받지 않으므로 Canvas 도 칠하지 않는다.
- **DOM**: 그룹 `delegatedDom` 이 묶음을 `absorbsChild` 로 흡수하고 묶음의 자식을 항목으로 모은다. Builder 쪽 `div` 생성 삭제 → shared 컴포넌트의 상자 1개 (shared · `apps/publish` 변경 0).
- **「+」**: `insertGroupItem` 이 묶음을 컨테이너로 쓴다 (`GROUP_ITEMS_WRAPPER`). template 묶음에 넣으면 `ensureChildList` 가 template 항목을 instance 노드로 옮기므로, 선택 해제는 삽입 전 표시값으로 판정하고 옮겨진 노드 (template child index 로 짝) 에 직접 쓴다. 그룹 `value` 도 draft 에 쓴다 (materialize 가 쓴 host 를 덮지 않게). Builder `itemInsert` 는 묶음 선택에서도 「+」 를 낸다 (그룹 「+」 유지 — TagGroup 과 다름, 회귀 방지).
- **Direction**: `orientationDrivenTags` `OWNER_ORIENTATION_TAGS` (묶음 → `orientation`). catalog Styles host 가 묶음의 표시값을 owner 그룹에서 읽고, prop 쓰기를 owner target 으로 옮긴다 (`orientationOwnerTargetOf`). Block 비활성 · 반응형 제외는 기존 판정이 같은 표를 읽는다.
- **contract 2**: `LIBRARY_CONTRACT_VERSION = 2`, 리터럴은 상수 참조로. 테스트 fixture 의 `1` 은 `2` 로, g1 의 거부 case 는 이제 `1` 을 거부.
- compositionRoot 의 `wraps` (합성 part 가 자식을 감싸는 장치) 는 생산자가 없어졌지만 이번엔 두었다 — main 에 같은 파일의 다른 세션 미커밋 변경이 있어 충돌을 피했다. 후속 정리 대상.

### Gate 결과

| Gate | 결과 | 근거 |
| ---- | ---- | ---- |
| G0 | 통과 | 위 ① ~ ④ |
| G1 | 통과 | `adr251ItemsNode.test.ts` 32/32 (2 그룹 × size 4 × orientation 2 × labelPosition 2 — 항목 gap · 높이 · Label x · 묶음 위치가 G0 값과 같음, size 전달). 원복 RED: partRule 제거 32 RED · size 사슬 제거 12 RED · DOM 이중 감싸기 16 RED. contract 1 거부 = `g1.test.ts`. library 검증 = `buildCodeCatalogLibrary` 전 스위트 |
| G2 | 통과 | G3 하니스 base 64 type · axis 386 case — 두 그룹 전부 PASS, verdict 변화 0 (커밋된 증거 대비). 묶음 노드가 옛 `_items` 와 짝 (`oldSyntheticWrappers` 0). 승인 차이 **새 항목 0** — 기존 `group-items-old-size` (oldDefect) 의 노드 목록에 묶음 타입을 더함 (옛 앱이 lg 에서도 items gap 12 · md 항목을 쓰던 같은 원인). `propAxisCanvasDom` orientation case 8 추가 → 42/42 (묶음 ↔ `.checkbox-items` delta < 0.03 px). 과거 증거 JSON 은 원복 (R5), 이번 출력은 scratchpad 보관 |
| G3 | 통과 | unit: `phase4eItemInsert` (묶음 · 그룹 「+」 연속 → option1~4, 묶음 안) · `collections.test` (owned · instance, 선택된 Radio 삽입 → 형제 해제 + 그룹 value) · `codeLibraryItems` (code library instance) · `phase4eStylesDirection` (묶음 Direction → 그룹 orientation 1 step · undo, 그룹 Direction = labelPosition). 원복 RED: 삽입 위치 2 RED · owner 쓰기 2 RED. live: ADR 본문 §Live Exercise |
| G4 | 통과 | 그룹당 `.radio-items` / `.checkbox-items` 1개 (G1 테스트) · 생성 CSS 재생성 diff 0 · `apps/publish` diff 0 |

회귀: shared 1588 · builder unit 4566 · parity browser 1429 · G3 하니스 43 통과, type-check 0.

### 남은 것

- Preview (Compare Mode) 사용자 확인 → Implemented.
- 묶음에 작성한 layout · paint 는 DOM 의 shared `div` 에 닿지 않아 Canvas 에만 반영된다 (TagList 와 같은 편집 범위 — R7 대로 둠). 묶음의 Styles 를 Direction 만 남기는 정리는 Design 패널 통합 (ADR-252) 때 판단.
- compositionRoot `wraps` 장치 정리.
