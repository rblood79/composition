# ADR-097 구현 상세 — TagGroup items SSOT + TagList Hybrid Container

> ADR-097 본문: [097-taggroup-items-ssot-hybrid.md](../completed/097-taggroup-items-ssot-hybrid.md)
>
> 본 문서는 ADR-097 Decision (대안 A — TagList spec-only 유지 + TagGroup.items SSOT) 의 실행 상세를 담는다. ADR-066/068/073/076 items SSOT 패턴 5 번째 적용.

## 실측 — 현재 구조

### Spec 3 파일 (ADR-093 Phase 1 리프팅 반영)

| 파일                   | 핵심                                                                        | 비고                                                        |
| ---------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `TagGroup.spec.ts:261` | `items: ChildrenManagerField` (예약)                                        | 현재 미활용 — 본 ADR 에서 활성화                            |
| `TagGroup.spec.ts`     | `orientation` prop **없음** (HC#2)                                          | ADR-093 Hard Constraint 유지                                |
| `TagGroup.spec.ts:347` | `childSpecs: [TagListSpec]`                                                 | ADR-094 `expandChildSpecs` 자동 등록                        |
| `TagList.spec.ts:74`   | `containerStyles: { display:"flex", flexDirection:"row", flexWrap:"wrap" }` | ADR-093 Phase 1 리프팅 완료 — spec-only container 유지 가능 |
| `TagList.spec.ts:66`   | `skipCSSGeneration: true`                                                   | 부모 CSS 내 inline emit                                     |
| `Tag.spec.ts:25`       | `children: string`                                                          | Field 자식 불가 (ListBox 차이점 — migration 단순화)         |
| `Tag.spec.ts:26-28`    | `isDisabled / isSelected / allowsRemoving` boolean                          | items 필드로 포함 대상                                      |

### implicitStyles TagList 분기 (`implicitStyles.ts:555-610`, 55 줄)

| 라인    | 로직                                                     | 분류                | Phase 4 처리                                       |
| ------- | -------------------------------------------------------- | ------------------- | -------------------------------------------------- |
| 574-577 | `orientation==="vertical"` flexDirection column override | runtime defensive   | 유지 (spec 미커버)                                 |
| 578     | `gap: parentStyle.gap ?? 4`                              | ADR-093 리프팅 완료 | 유지 (spec 참조)                                   |
| 580     | `labelPosition==="side"` flex:1 / minWidth:0             | **runtime-only**    | 유지 (HC#4)                                        |
| 583-595 | Tag 자식 `whiteSpace:"nowrap"` injection (12 줄)         | **runtime-only**    | items runtime 기반 재구성 — Tag 생성 시 주입       |
| 599-633 | `maxRows > 0` 근사 계산 + Tag element 제거 (35 줄)       | **runtime-only**    | items 배열 기반 사전 계산 + virtual children slice |

**runtime-only 잔존**: ~40 줄. **items SSOT 후에도 필수** — spec 으로 이관 불가 (부모 폭/런타임 props 의존).

## 설계 결정 — Option A (TagList 유지)

Option A 와 Option B 비교 (ADR-097 Alternatives 에서 상세):

|                     |   Option A (TagList 유지)   |      Option B (TagList 소멸)      |
| ------------------- | :-------------------------: | :-------------------------------: |
| element tree 구조   | 3 단 (TagGroup→TagList→Tag) |        2 단 (TagGroup→Tag)        |
| factory 변경        |  최소 (TagList 자동 생성)   | 대폭 (TagList 로직 TagGroup 상향) |
| implicitStyles 상향 |           불필요            |     40 줄 TagGroup 레벨 상향      |
| migration 복잡도    |  **중간** (2단 이전 필요)   |   높음 (중간 컨테이너 삭제 DFS)   |
| Spec SSOT 일관성    |   TagList spec 역할 명확    |     TagList spec 무의미 삭제      |

**Option A 채택** — ADR-093 Phase 1 에서 TagList 를 spec-only container 로 이미 리프팅했고, spec 이 `containerStyles` 3 필드를 포함하면 TagList 는 "정당한 중간 컨테이너" 역할을 함. 소멸시키면 ADR-093 리프팅이 낭비됨.

## Phase 구성

### Phase 0 — 선례 재학습 (30 분, no code)

`docs/adr/076-listbox-items-ssot-hybrid.md` + `applyCollectionItemsMigration` 읽기. 읽을 파일:

- `docs/adr/076-listbox-items-ssot-hybrid.md` (P5 migration orchestrator 핵심 문장)
- `packages/shared/src/utils/migrateCollectionItems.ts:53` (`applyCollectionItemsMigration` 시그니처)
- `apps/builder/src/builder/panels/properties/editors/registry.ts:33-40` (`getCustomPreEditor`)
- `apps/builder/src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.ts:214-224` (virtual children ListBox 경로)

### Phase 1 — TagGroup.types 확장 (1 h)

**신규 파일**: `packages/specs/src/types/taggroup-items.ts`

```ts
/** 저장 포맷 — element tree 에서 items[] 로 직렬화 */
export interface StoredTagItem {
  id: string;
  label: string;
  isDisabled?: boolean;
  isSelected?: boolean;
  allowsRemoving?: boolean;
}

/** 런타임 — factory/renderer 소비 */
export interface RuntimeTagItem extends StoredTagItem {
  key: string;
}

export function toRuntimeTagItem(stored: StoredTagItem): RuntimeTagItem {
  return { ...stored, key: stored.id };
}
```

**TagGroupSpec 수정** — `items` 필드가 이미 children-manager 로 예약됨 → ItemsManagerField 타입으로 전환.

**packages/specs/src/index.ts** — Stored/Runtime 타입 + converter re-export.

### Phase 2 — Migration Orchestrator (2-3 h) — **복잡도 핵심**

**신규 파일**: `packages/shared/src/utils/migrateTagGroupItems.ts` 또는 기존 `migrateCollectionItems.ts` 확장 (ADR-076 applyCollectionItemsMigration 내부에 `collectTagGroupItems` 추가)

**알고리즘** (2 단 이전 — 핵심 차이점):

```
for each TagGroup parent in elements:
  tagLists = children(parent) where tag === "TagList"
  for each tagList in tagLists:   // 보통 1 개
    tags = children(tagList) where tag === "Tag"
    items = tags.map(toStoredTagItem)
    parent.props.items = items
    orphanIds += tags.map(id)         // Tag elements 고아화
    // TagList 는 유지 — 재생성 스펙 기반 자동 (ADR-094 expandChildSpecs)
return { elementsMap', orphanIds }
```

**ADR-076 과 차이점**:

- ListBox 는 `Field` 자식 감지 → 템플릿 모드 skip 분기 있음. Tag 는 Field 자식 불가 → **항상 정적 흡수** (더 단순)
- 2 단 이전 (TagGroup→TagList→Tag vs TagGroup→Tag) 이라 parentId resolution 추가 로직 필요
- TagList 자체는 **삭제하지 않음** (ListBox 는 자체 유지, 본 ADR 도 TagList 유지)

**orphan 처리**: Tag element 만 orphan. Tag 자식 subtree (현재 children: string 만) 는 텍스트 노드 → Tag element 삭제 시 자동 제거 (Element 기본 동작).

**테스트** (신규): `packages/shared/src/utils/__tests__/migrateTagGroupItems.test.ts` — 3 시나리오:

1. 기존 TagGroup > TagList > Tag[3] → TagGroup.items[3] 흡수
2. TagGroup > TagList (empty) → items: []
3. TagGroup > (no TagList, edge case) → 변경 없음

### Phase 3 — 3-path Routing (1 h)

| Path               | 파일                                                                                     | 작업                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Factory**        | `apps/builder/src/types/builder/unified.types.ts:1624-1660` `createDefaultTagGroupProps` | `items: []` 기본값 추가. TagList 자동 생성은 ADR-094 `expandChildSpecs` 가 처리 — 수정 최소                |
| **LayerTree**      | `apps/builder/src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.ts:214`           | ListBox 패턴 복사 — `if (tag === "TagGroup") return props.items.map(i => virtualChild(i))`                 |
| **PropertyEditor** | `apps/builder/src/builder/panels/properties/editors/registry.ts:33`                      | `getCustomPreEditor("TagGroup")` 신규 — items editor 분기. `TagGroupPropertyEditor.tsx` 신규 (optional P6) |

### Phase 4 — implicitStyles items 기반 재구성 (1 h)

**실제 변경은 최소**:

- `implicitStyles.ts:583-595` (Tag whiteSpace injection) → Tag element 대신 `TagGroup.props.items` 배열 runtime 생성 시 shapes 에 주입 (spec-first)
- `implicitStyles.ts:599-633` (maxRows 근사) → items.length × 평균 Tag 폭 기반 사전 계산 (기존 element.tag 반복 대체)
- 570-582 (containerStyles) — 변경 없음 (ADR-093 리프팅 유지)

### Phase 5 — TagList 중간 컨테이너 유지 확증 (30 분) ✅ Implemented

Decision section 근거 재확인 + 문서. 세션 5 (2026-04-21) 완료 — code-level 증거 수집.

**증거 1 — TagList.spec.ts:74-78 `containerStyles` 리프팅 유지**:

```ts
containerStyles: {
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
},
```

ADR-093 Phase 1 리프팅 결과 그대로 존재. ADR-097 Phase 4A/4B 에서 수정 없음. `resolveContainerStylesFallback` (`implicitStyles.ts:158`) 이 `LOWERCASE_TAG_SPEC_MAP.get("taglist")` → TagListSpec.containerStyles 자동 주입.

**증거 2 — `expandChildSpecs(TagGroupSpec.childSpecs)` 자동 등록**:

```
TagGroup.spec.ts:362:  childSpecs: [TagListSpec],
tagToElement.ts:234-251:  function expandChildSpecs(base) { ... }
tagToElement.ts:254:  const TAG_SPEC_MAP = expandChildSpecs(BASE_TAG_SPEC_MAP);
```

ADR-094 인프라가 TagList 를 `TAG_SPEC_MAP` / `LOWERCASE_TAG_SPEC_MAP` / `getElementForTag` 에 자동 등록 — factory `createTagGroupDefinition` 수정 없이 TagList element 참조 가능. 수동 `tagSpecMap.ts` 등록 항목 0.

**증거 3 — implicitStyles taglist 분기 최소 runtime fork**:

Phase 4B 후 잔존 14 LOC (implicitStyles.ts:568-586). 각 fork 가 spec 커버 불가 영역:

| Fork                                         | 근거                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `orientation === "vertical"` column override | TagGroup.spec 에 orientation prop 없음 (HC#2). 방어 코드. spec 이 소유하지 않는 속성이라 spec 레벨 이관 불가 |
| `gap: parentStyle.gap ?? 4`                  | 4 = `TagListSpec.sizes.md.gap`. 사용자 parentStyle.gap 편집 respect. spec default 와 동기                    |
| `labelPosition === "side"` flex:1/minWidth:0 | TagList spec 이 부모 TagGroup.labelPosition 을 알 수 없음 (spec isolation) → runtime-only 불가피             |

Spec SSOT 침범 없음 확증. runtime fork 최소성 충족 (HC#4).

### Phase 6 — Chrome MCP 실측 + 회귀 검증 (1 h)

연결 불안정 시 code-level 증거 허용 (ADR-092/093/095/096 선례).

**검증 항목**:

- type-check 3/3 PASS
- specs 166+ PASS (Tag/TagGroup/TagList snapshot 갱신 가능 — `pnpm exec vitest run --update`)
- builder 227+ PASS (migrateTagGroupItems 테스트 3 건 추가 → 230+)
- 기존 TagGroup 포함 프로젝트 로드 시 migration 자동 적용 + visual diff 0
- Chrome MCP 가능 시 "Primary / Secondary / Disabled" Tag 3 개가 정상 표시

## BC 영향 수식화

- **저장된 프로젝트 데이터 영향**: **0 %** (기존 3 단 구조 element tree 는 migration orchestrator 가 자동 items 로 흡수). 사용자 편집 없음 요구.
- **재직렬화 파일 수**: migration 시 TagGroup 포함 모든 project.json → items 배열 + Tag element 삭제. 저장 시 파일 크기 감소 추정.
- **렌더 결과 diff**: 0 (ADR-076 ListBox 선례 동일 — items runtime 생성 Tag virtual element 가 기존 element 와 동일 shapes 생성)
- **Style Panel 영향**: Tag element 가 Skia 트리에서 소멸 → Tag 개별 선택 불가. TagGroup 의 items 편집 UI 로 대체 (TagGroupPropertyEditor).

## Rollback 전략

Phase 2 migration orchestrator 가 실패 시:

1. `applyCollectionItemsMigration` TagGroup 분기 비활성 (`if (false)`)
2. 기존 Tag element 재생성 코드 (storage loading 단계에서 items → Tag element expand) 역방향 함수 준비. ADR-076 에는 없지만 본 ADR 에서는 추가 안전망 검토

## 후속 ADR 후보

- ADR-097 Addendum 1 (선택): Tag description slot 추가 (현재 label 만) — items.description?: string 필드 확장
- ADR-098 (별개): Tier 3 마지막 RSP 네이밍 묶음 ADR

## 검증 체크리스트

- [x] type-check 3/3 PASS (세션 3-5 지속)
- [x] specs 166+ PASS
- [x] shared 52+ PASS (Phase 2 migration 테스트 +6 건 = 52/52)
- [x] builder 227+ PASS
- [x] `rg "containerTag === \"taglist\"" implicitStyles.ts` — 유지 (runtime-only 14 LOC)
- [ ] Tag element 를 직접 편집하던 사용자 플로우 문서 업데이트 (TagGroupPropertyEditor.items 로 대체) — Phase 6 사용자 가이드 단계
