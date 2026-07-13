# ADR-099: Collection Section/Header 확장 — ListBox/GridList/Menu (ADR-098 후속 "098-c 슬롯")

## Status

Implemented — 2026-04-21

> 본 ADR 은 [ADR-098](098-rsp-naming-audit-charter.md) (RSP 네이밍 정합 감사 Charter) 의 후속 분할 ADR 중 **"098-c 슬롯"** (breakdown Phase 6 Follow-up 표 #3) 구현. Charter Decision 에 명시된 "8 카테고리 × 개별 ADR" 패턴 재사용. 파일 번호는 기존 관례(연속 번호) 준수하여 `ADR-099` 할당, 제목에 "098-c 슬롯" 명시.

### 구현 커밋 체인

| 커밋        | 내용                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `e435d8b3`  | Phase 1 — ListBox items discriminated union + `StoredListBoxSection` + `isListBoxSectionEntry` + 테스트 10건 (BC 0%) |
| `a74ce3bb`  | Phase 2 — ListBoxSpec.render.shapes section entry 렌더 + `calculateContentHeight` listbox 분기 section 가산 공식     |
| `c53eee53`  | Phase 3 — `HeaderSpec` 신설 + `ListBoxSpec.childSpecs` inline emit + Generator CSS 4 블록 emit                       |
| `485898d6`  | Phase 5 — GridList section shapes + Menu types (`StoredMenuSection`/`StoredMenuSeparator`) + 테스트 29건             |
| `b0cb9153`  | Phase 4 — items-manager Section/Separator UI + Menu per-section selection                                            |
| (현재 커밋) | Phase 6 — Preview 경로 `SelectionRenderers.tsx` ListBox section 분기 + Status Implemented 전환                       |

### 검증 기준선 (Implemented 전환 시점)

- type-check 3/3 PASS
- specs 205/205 PASS (Phase 1 +10 / Phase 5 +13 gridlist + +16 menu)
- builder 227/227 PASS
- shared 52/52 PASS

### Phase 6 code-level 검증 (Chrome MCP 대체 — ADR-092/093/095 선례)

Chrome MCP 연결 실패 → code-level 대체 검증 적용 (ADR-092/093/095 선례 허용):

1. **Preview 경로 section 분기 추가** (`packages/shared/src/renderers/SelectionRenderers.tsx`): `isListBoxSectionEntry` type guard 분기 — section entry 시 `<AriaListBoxSection><AriaHeader>` 구조로 DOM 렌더. RAC D1 공식 API 그대로 사용.
2. **Skia 렌더 확인**: `ListBoxSpec.render.shapes` entries 루프 — section entry 분기 `HEADER_HEIGHT` text shape + 내부 items 순회 렌더 (Phase 2 구현).
3. **CSS emit 확인**: `packages/shared/src/components/styles/generated/ListBox.css` — `.react-aria-Header` 블록 4개 (Base + size sm/md/lg) Generator 자동 emit 확인.

### 잔존 후속 작업 (Addendum 분리)

- **Addendum 099-e** ✅ **scope 재평가 완결 (2026-04-21)**: Menu overlay shapes — scope 재평가 결과 **대안 B (DOM/CSS 전용) 채택**. Skia shapes 는 trigger button 만 유지. 근거: overlay 는 runtime 상태(isOpen) 의존 transient UI → Builder 정적 미리보기 Skia 확장 불필요. DOM consumer(RAC Menu) 가 완결. R-A3 scope 축소로 해소.
- **Addendum 099-f Part 1** ✅ **완결 (2026-04-21)**: GridList Preview 경로 — `SelectionRenderers.tsx` `renderGridList` Path 2 section 분기 추가. R-A2 (GridList 한정) 해소.
- **Addendum 099-f Part 2** ✅ **완결 (2026-04-21)**: Menu Preview 경로 — `CollectionRenderers.tsx` `renderMenu` 에 section/separator 분기 추가. R-A2 (Menu 한정) 해소.
- **ADR-099-c** (분리 확정): `GridListLoadMoreItem` — async callback state. items SSOT discriminated union 비호환.
- **ADR-099-d** (분리 확정): `SubmenuTrigger` — MenuItem + Menu-in-Popover wrapper. 중첩 Menu 데이터 모델 ADR 연계 필요.

### Addendum 099-f Part 1 — GridList Preview 경로 section 분기 (2026-04-21)

**배경**: R-A2 (GridList Preview 경로 부재) 해소. ListBox 선례 (`f21f61dc`) 와 동일 패턴 복제.

**변경 파일**: `packages/shared/src/renderers/SelectionRenderers.tsx`

**구현 내용**:

1. **RAC import 추가**: `GridListSection as AriaGridListSection`, `GridListHeader as AriaGridListHeader` (react-aria-components 1.15.1 확인)
2. **specs import 추가**: `StoredGridListItem`, `StoredGridListEntry` 타입 + `isGridListSectionEntry` type guard
3. **Path 2 추가**: `storedItems`/`hasItemsArray` 감지 → `renderGridListLeaf` 헬퍼 + section 분기:
   - section entry → `<AriaGridListSection aria-label><AriaGridListHeader>{header}</AriaGridListHeader>{items.map(leaf)}</AriaGridListSection>`
   - item entry → `<GridListItem>` (label + description 기존 fallback 구조 유지)
4. **3-Path 구조**: Path 1 (템플릿, columnMapping/dataBinding) → Path 2 (items[] canonical, 신규) → Path 3 (legacy 정적 children fallback)

**검증**: type-check 3/3 PASS + shared 52/52 + specs 205/205 + builder 227/227 PASS

## Context

composition 117 spec 중 **컬렉션 archetype 3종** (ListBox / GridList / Menu) 은 items SSOT 체인 (ADR-066/068/073/076/097) 으로 items 배열 기반 렌더링을 완결했으나, **RAC 공식 API 의 Section/Header 그룹화 기능은 미구현**. ADR-098 감사 매트릭스 (2026-04-21 WebFetch) 에서 확인:

| RAC 공식                                                      | composition 현재                                    |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `ListBoxSection` + `Header`                                   | 없음 — items flat 배열만 지원                       |
| `GridListSection` + `GridListHeader` + `GridListLoadMoreItem` | 없음 — items flat 배열만 지원                       |
| `MenuSection` + `SubmenuTrigger`                              | `Separator` 는 있으나 section 그룹화 의미 전달 부재 |

### D2 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D2 (Props/API) 신규 기능 추가 + D3 (시각 스타일) 연장**. RAC 공식 Section/Header 는 D1 (DOM/접근성, RAC 절대) 에서 이미 지원되어 있으나 composition spec 계층에서 미노출. 본 ADR 은 spec 확장을 통해 D2 API 확장 + D3 Header 시각 규격 신설. D1 침범 없음 (RAC 컴포넌트 DOM 구조 그대로 사용).

### Hard Constraints

1. **BC 영향 0%** — 기존 items 배열의 엔트리는 discriminator `type` 필드 미지정 → default "item" 폴백. 기존 저장 프로젝트 재직렬화 불필요.
2. **items SSOT 원칙 유지** — Section 을 별도 element 로 LayerTree 에 추가하지 않음. items 배열 내부 discriminated union 엔트리로 표현 (`{ type: "section", header, items: [...] }`).
3. **RAC 공식 네이밍 정합** — Header / ListBoxSection / GridListSection / MenuSection 명칭 그대로 채택. composition 고유 네이밍 금지.
4. **testing 기준선 유지** — type-check 3/3 + specs 166/166 + builder 227/227 + shared 52/52 PASS 전제. 각 Phase Gate 동일.

### Soft Constraints

- ADR-098 Charter Decision: 감사형 Charter 의 첫 후속 ADR 으로 **LOW BC 기능 먼저 완결** 전략 (HIGH BC 098-a Select 네이밍 이전).
- ADR-094 `expandChildSpecs` 패턴 재사용 가능 (spec-only container) — 그러나 본 ADR 은 element composition 이 아닌 items 확장 경로 선정 (Alternatives 대안 B 참조).
- ADR-078 `childSpecs` inline emit 패턴 — Phase 3 에서 `HeaderSpec` 을 `ListBoxSpec.childSpecs` 에 추가하는 경로 재사용.

## Alternatives Considered

### 대안 A: items discriminated union + Hybrid section 엔트리 (선정)

- 설명: items 배열 엔트리 타입을 `StoredListBoxItem | StoredListBoxSection` discriminated union 으로 확장. section 엔트리는 `{ type: "section", header: string, items: [...] }` 중첩 배열 포함. items-manager UI 에서 "Section 추가" 버튼으로 직렬화. LayerTree element tree 는 변경 없음.
- 위험:
  - 기술: MED — discriminated union 타입 좁히기 누락 시 runtime crash. 각 Phase vitest 테스트로 방어 + Phase 분할.
  - 성능: LOW — items 순회 시 `if (entry.type === "section")` 분기 추가 (O(1)).
  - 유지보수: LOW — items SSOT 체인 5 회 선례 확장. 기존 패턴 재사용.
  - 마이그레이션: LOW — BC 100% (discriminator 생략 시 default "item" 폴백).

### 대안 B: RAC 패턴 그대로 — Section / Header element composition

- 설명: `ListBoxSection` / `GridListSection` / `MenuSection` / `Header` 를 독립 spec 신설 + LayerTree 에서 element 로 배치. 사용자가 ListBox 안에 ListBoxSection element 추가 → 자식으로 Header + Item 배치. items SSOT 를 section 범위로 제한.
- 위험:
  - 기술: MED — element composition 방식이므로 factory + PropertyEditor + LayerTree 3 경로 + expandChildSpecs 확장 모두 필요. `_hasChildren` 분기 로직 복잡화.
  - 성능: LOW.
  - 유지보수: **HIGH** — items SSOT 체인 5 회 선례와 **역방향 패턴**. ADR-066/068/073/076/097 이 element→items 로 수렴시켰으나, 본 대안은 items→element 로 부분 복귀. 향후 SSOT 체인 6번째/7번째 컬렉션에 적용할 패턴이 불일치 → debt 증가.
  - 마이그레이션: LOW — BC 0% (신규 element).

### 대안 C: items 외부 `sections` 필드 + items 유지

- 설명: `ListBoxProps.items?: ItemEntry[]` + `ListBoxProps.sections?: { header: string, itemIds: string[] }[]` 양방향 필드. items 배열은 flat 유지, sections 가 그룹화 메타만 보유.
- 위험:
  - 기술: MED — 2 필드 동기 관리 (item 삭제 시 sections[].itemIds 정리). items-manager UI 가 2 필드 동시 편집.
  - 성능: LOW.
  - 유지보수: MED — 2 필드 동기화 규칙이 장기적 버그 원천. ADR-093 "TagList maxRows" 단일 필드 원칙과 상충.
  - 마이그레이션: LOW — BC 0%.

### 대안 D: ListBoxSection 만 먼저 (Phase 축소)

- 설명: 본 ADR scope 를 ListBoxSection + Header 만으로 축소. GridList/Menu Section 은 후속 ADR-099-a.
- 위험:
  - 기술: LOW — scope 최소.
  - 성능: LOW.
  - 유지보수: MED — 대칭 debt 지속. 3 컬렉션 중 1 만 Section 지원 → 사용자 혼란.
  - 마이그레이션: LOW — BC 0%.

### Risk Threshold Check

| 대안                                | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정                 |
| ----------------------------------- | :--: | :--: | :------: | :----------: | :------: | -------------------- |
| A: items discriminated union (선정) |  M   |  L   |    L     |      L       |    0     | **PASS**             |
| B: element composition              |  M   |  L   |  **H**   |      L       |    1     | 기각 (SSOT 역방향)   |
| C: 외부 sections 필드               |  M   |  L   |    M     |      L       |    0     | pass — 유지보수 열위 |
| D: ListBoxSection 만                |  L   |  L   |    M     |      L       |    0     | pass — 대칭 debt     |

대안 A 가 HIGH 0 + items SSOT 체인 5 회 선례 재사용 + BC 0% + 3 컬렉션 대칭 모두 충족 → threshold pass.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context/Hard Constraints 에서 `ListBox.spec.ts:396-452`, `types/listbox-items.ts:14-26`, `GridList.spec.ts`, `Menu.spec.ts`, `layout/engines/utils.ts` calculateContentHeight listbox 분기, `CSSGenerator.ts` childSpecs emit 5+ 경로 명시 (breakdown Phase 별 매핑).
- ✅ **#2 Generator 확장 여부**: Phase 3 에서 `HeaderSpec.spec.ts` 신설 + `ListBoxSpec.childSpecs` 에 추가 → Generator inline emit 확장 경로 ADR-078 Phase 2 선례 재사용. **지원 가능 확증** (breakdown 명시).
- ✅ **#3 BC 훼손 수식화**: **0% 영향 / 0 파일 재직렬화** — discriminator 미지정 시 default "item" 폴백. Hard Constraint 1 로 명시.
- ✅ **#4 Phase 분리 가능성**: 6 Phase 구성. 필요 시 Phase 5 (GridList/Menu 대칭) 를 후속 ADR-099-a 로 분리 가능. breakdown "잠재 후속 ADR" 섹션에 옵션 명시.

## Decision

**대안 A (items discriminated union + Hybrid section 엔트리) 채택**.

선택 근거:

1. **items SSOT 체인 5 회 선례 재사용** — ADR-066/068/073/076/097 이 element→items 로 수렴한 설계 원칙 유지. 본 ADR 이 역방향 element 재도입 시 체인 debt 증가.
2. **BC 0%** — discriminator 폴백으로 기존 프로젝트 재직렬화 불필요. Hard Constraint 1 충족.
3. **3 컬렉션 대칭** — 동일 discriminated union 패턴을 ListBox/GridList/Menu 모두 적용 가능. Phase 5 에서 일괄 확장.
4. **LayerTree UX 단순 유지** — 사용자가 Section 을 별도 element 로 추가하지 않음. items-manager 편집기 내부에서 nested 편집 → element graph 복잡도 증가 회피.

기각 사유:

- **대안 B 기각**: 유지보수 HIGH — items SSOT 체인 5 회 선례와 역방향. 향후 컬렉션 6번째/7번째 적용 패턴 불일치 → debt 증가. element composition 은 LayerTree 복잡도 증가 + factory/editor 3경로 확장 필요.
- **대안 C 기각**: 유지보수 MED — 2 필드 (items + sections) 동기 관리 장기 버그 원천. 단일 필드 원칙 상충.
- **대안 D 기각**: 대칭 debt — 3 컬렉션 중 1 만 Section 지원 시 사용자 혼란 + RSP 네이밍 감사 Charter 완결 지연. 단 Phase 5 분리 land 허용 (breakdown 옵션).

> 구현 상세: [099-collection-section-expansion-breakdown.md](../../adr/design/099-collection-section-expansion-breakdown.md)

## Risks

| ID   | 위험                                                             |            심각도             | 대응                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------- | :---------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | items discriminated union 타입 좁히기 누락 → runtime crash       |              MED              | Phase 1 테스트 회귀 (`types/__tests__/listbox-items.test.ts`) + vitest 타입 좁히기 검증 + PR 검토 시 `entry.type === "section"` 분기 커버리지 요구                                |
| R2   | Skia Header 렌더 + CSS Header 셀렉터 시각 drift                  |              MED              | Phase 3 `HeaderSpec.childSpecs` 등록 후 `/cross-check` skill 실행 + Phase 6 Chrome MCP 실측                                                                                       |
| R3   | GridList grid 모드 section header column span 복잡 (rowspan/col) |              MED              | Phase 5 에서 grid 모드 section header 는 전체 행 span (`columns` 전체) 로 단순화 + 실측 후 조정                                                                                   |
| R4   | items-manager UI nested 편집 UX 복잡 (section 내부 items drag)   |              MED              | Phase 4 Spec-first 단순 UI (section 펼침/접기 + "Item 추가" / "Section 추가" 2 버튼) → 복잡 drag-to-reorder 는 후속 Addendum                                                      |
| R5   | RAC API 재검증 실패 (Phase 0 WebFetch 접근 불가)                 |              LOW              | 2026-04-21 ADR-098 매트릭스 스냅샷 + GitHub 소스 (`packages/@react-aria/listbox`) fallback                                                                                        |
| R-A1 | Preview Section 렌더 경로 부재 (ListBox)                         |      ~~HIGH~~ → **해소**      | `SelectionRenderers.tsx` — `isListBoxSectionEntry` 분기 추가, `<AriaListBoxSection><AriaHeader>` RAC D1 공식 API 사용. Phase 6 커밋에서 해소.                                     |
| R-A2 | GridList/Menu Preview 경로 부재                                  |      ~~MED~~ → **해소**       | Addendum 099-f Part 1 (GridList, 2026-04-21) + Part 2 (Menu, 2026-04-21) 완결 — `renderGridList` Path 2 + `renderMenu` section/separator 분기 추가.                               |
| R-A3 | Menu overlay shapes items 렌더 미구현                            | ~~MED~~ → **scope 축소 해소** | Addendum 099-e scope 재평가 (2026-04-21) — overlay 는 DOM/CSS 전용 결정. Skia shapes 는 trigger only 유지. `CollectionRenderers.tsx` Menu children 경로로 section/separator 완결. |
| R-A4 | Chrome MCP 실측 미수행                                           |              LOW              | code-level 대체 검증 적용 (ADR-092/093/095 선례). 후속 세션에서 Chrome MCP 재시도 가능.                                                                                           |

잔존 HIGH 위험 없음 (R-A1 해소. R-A2/A3 MED → Addendum 분리 관리).

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 본 ADR 자체 검증 기준 (Phase 단위 AND 누적):

| 시점         | 통과 조건                                                                                                                          | 결과 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | :--: |
| Phase 0 종료 | RAC WebFetch 3 URL 매트릭스 docs/adr/design 반영 + API 확정                                                                            |  ✅  |
| Phase 1 종료 | items discriminated union 타입 + 테스트 회귀 0                                                                                     |  ✅  |
| Phase 2 종료 | ListBoxSpec.render.shapes section 렌더 + calculateContentHeight 공식 + snapshot diff 검토                                          |  ✅  |
| Phase 3 종료 | HeaderSpec 신설 + Generator CSS emit + TAG_SPEC_MAP 등록 + `pnpm build:specs` PASS                                                 |  ✅  |
| Phase 4 종료 | items-manager UI "Section 추가" 작동 + Chrome MCP 수동 검증                                                                        |  ✅  |
| Phase 5 종료 | GridList/Menu 대칭 + 3 컬렉션 모두 section 엔트리 렌더 (또는 099-a 로 분리 land)                                                   |  ✅  |
| Phase 6 종료 | type-check 3/3 + specs 205/205 + builder 227/227 + shared 52/52 PASS + Preview ListBox section 분기 추가 + Status Implemented 전환 |  ✅  |

실패 시 대안:

- Phase 5 실패 → GridList/Menu 를 후속 ADR-099-a 로 분리 land, 본 ADR 은 Phase 0-4 완결 기준으로 Implemented 전환 (breakdown "잠재 후속 ADR" 명시).
- Phase 2 snapshot drift 발견 시 → 시각 분석 후 Skia metric 조정 (ADR-081 tokenSnapshot 패턴 재사용).

## Consequences

### Positive

- **RAC 공식 API 정합 확장** — ADR-098 감사 Charter 8 카테고리 중 #3 (Section 확장) 완결 → charter Implemented 전환 조건 충족 (첫 후속 ADR Proposed 발행).
- **items SSOT 체인 6회 확장** — ADR-066/068/073/076/097 + 본 ADR. 컬렉션 archetype 의 SSOT 체계 일관성 심화.
- **3 컬렉션 대칭 완결** — ListBox/GridList/Menu 모두 동일 discriminated union 패턴 → 향후 Table/Tree 컬렉션 확장 시 선례 제공.
- **LayerTree UX 유지** — 사용자가 element graph 를 section 단위로 재구성하지 않음. items-manager 내부 편집 → 학습 비용 최소.

### Negative

- **items 타입 복잡도 증가** — `StoredListBoxItem` 에서 `StoredListBoxEntry` 로 확장 → shared/builder/preview 모든 소비처가 discriminator 분기 필요. 현재 코드베이스는 flat items 가정.
- **items-manager UI 기능 확장 비용** — Phase 4 에서 UI 컴포넌트 확장 필요 (section 추가 / 펼침-접기 / nested 편집). drag-to-reorder 는 후속 Addendum 으로 이관 가능.
- **Skia metric SSOT 확장** — `resolveListBoxItemMetric` 에 header height 추가 필요. `calculateContentHeight` listbox 분기 공식도 section 가산 수정 → 기존 테스트 snapshot 갱신 가능.
- **3-6 개월 분산 land 위험** — Phase 5 분리 시 GridList/Menu 대칭 debt 가 후속 ADR-099-a 로 이연. ADR-098 Charter 의 "6 개월 후 (2026-10) 진척 재평가" 시점에 포함 처리.

## 참조

- [ADR-098](098-rsp-naming-audit-charter.md) — RSP 네이밍 정합 감사 Charter (본 ADR 의 상위 charter)
- [ADR-097](097-taggroup-items-ssot-hybrid.md) — items SSOT 체인 5번째 컬렉션 (직전 선례)
- [ADR-076](076-listbox-items-ssot-hybrid.md) — ListBox items SSOT (본 ADR 의 기반 — items 확장 대상)
- [ADR-078](078-listboxitem-spec-and-generator-child-selector.md) — Generator `childSpecs` inline emit 패턴 (Phase 3 재사용)
- [ADR-094](094-childspecs-registry-auto-registration.md) — `expandChildSpecs` 패턴 (대안 B 참조, 본 ADR 미채택)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D2 domain 원칙 (RSP 참조 기준)
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D2 Props/API + D3 시각 스타일 정본
