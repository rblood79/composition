# ADR-161: GridList ref 기반 재사용 composite 전환

## Status

Accepted — 2026-07-23 (리뷰 round 1 승인 — `docs/adr/reviews/161.md`, HIGH/MED 이슈 0, LOW 3 전부 종결)

### 진행 로그

- 2026-07-23 — **Accepted**: review-adr round 1 승인 가능(구조 7/7 PASS, 코드 11/11 VERIFIED, 누락 위험 0). execute-adr 착수. Phase 4(Skia projection)·Phase 5(migration)는 HIGH 라 auto 에서도 사용자 surface.
- 2026-07-23 — **Phase 1 반영**(커밋 `35d84ed87`): 컨테이너 origin `component-gridlist` 등록.
- 2026-07-23 — **Phase 2 + Phase 4 근본 수정**: factory standalone→ref + scene node type ref→master 해석(per-gate patch 대신 단일 지점 정본 수정, 사용자 지시). live 검증 — 신규 GridList=ref Instance + Skia 카드 projection 발화 + grid 카드 라벨 정상 렌더.
- 2026-07-23 — **scope 추가 (Phase 7)**: 사용자가 GridList 인스턴스 프로퍼티 패널 slot 표시 부재 발견 → authoring parity(slotHostPolicy 일반화 + GridListItemEditor slot 전환) Phase 7 로 추가, R6/G5 신설. 사용자 승인 하 scope 확장.
- 2026-07-23 — **Phase 7 반영 (G5 통과)**: `slotHostPolicy` 에 `isGridListHost`/`isGridListItemTemplateVariant` 추가 → `FrameSlotSection`(`isSlotHostElement` 게이트)이 GridList origin 에 Slot 섹션 표시(`GridListItem/Default`, ListBox 대칭). **task 2(GridListItemEditor 전환)는 moot** — per-type 편집기는 `useEditContract`(catalog)로 대체된 dead 코드, ListBoxItem/GridListItem item 편집기 이미 동일. live 검증 + slotHostPolicy.test 4건 + type-check PASS.
- 2026-07-23 — **Phase 3 반영 (G3 통과)**: preview + Skia **대칭 배선** — 컨테이너 origin `component-gridlist`.slot[0] 을 소비하도록 전환(리터럴 하드코딩 제거). Skia `resolveGridListTemplateOriginId`(`resolveListBoxTemplateOriginId` 대칭) 신규 export + preview `App.tsx` inline master 해석(`component-listbox` `:263` 동형). slot[0]==리터럴이라 시각 결과 불변(BC), 컨테이너 origin authoritative. live 검증 — ref GridList(grid 3-item) Skia 카드 ≡ CSS preview, Component 패널 Role=Instance, 콘솔 에러 0. canvasSceneNode.test 40건(4 신규) + type-check PASS.
- 2026-07-23 — **Phase 5 scope 확정 + 반영 (G2 통과)**: 코드 증거상 ListBox `migrateLegacyListBoxTemplatesToOrigins` 는 standalone `type:"ListBox"` 를 ref 로 **변환하지 않고** anchor strip + scroll 보강만 하며 standalone 은 type gate 로 렌더한다. 사용자 결정(AskUserQuestion) — GridList 도 **타입 미변환** ListBox-parity 채택 → R2 HIGH→LOW(데이터 손실 위험 소멸). Phase 5 는 신규 production 코드 0: 컨테이너 origin bootstrap 은 `ensureGridListTemplateOrigins`(hydration 3곳 기배선, Phase 1) 가 이미 담당, standalone 은 `isGridListSceneSource` line 1 type gate 로 렌더(Phase 4 root fix 로 ref 도 동일 gate 통과). 검증 — gridListTemplateOrigins.test 컨테이너 origin bootstrap 2건 신규(legacy 문서 추가 + 멱등/편집보존) + live(현 프로젝트 `component-gridlist` origin 존재 probe + ref GridList 카드 렌더 = type gate 통과). type-check PASS.

## Context

GridList 는 collection family 컴포넌트 중 유일하게 **재사용 composite 배선이 미완성**이다. ListBox 는 ADR-147/148 로 완전한 ref 기반 composite 가 됐다 — components 페이지에 컨테이너 origin(`component-listbox`)이 등록되고, 인스턴스는 그 master 를 `ref` 로 참조하며(`SelectionComponents.ts:249-250`), master 의 `slot` 배열이 item origin(`component-listbox-item-default/selected`)을 가리킨다. GridList 는 item origin(`component-gridlist-item-default`, ADR-148 Phase 4)만 있고 **컨테이너 origin 이 없으며, 인스턴스는 standalone `type:"GridList"` 직접 props**(`SelectionComponents.ts:327-338`)다.

이 비대칭의 실질 결과: 사용자가 components 페이지에서 GridList master 를 커스터마이즈(레이아웃/아이템 템플릿 height·padding)하고 인스턴스가 상속하는 ListBox 의 reuse 워크플로가 GridList 에는 없다. 최근 GridList slot 크래시(커밋 `c51e0d1d2` → 수정 `9c28eef6f`)도 "ListBoxItem 동형" 을 목표로 slot emit 만 복제하고 composite 층은 복제하지 않은 부분 이식의 부작용이었다.

**3-Domain 판정**: 본 결정은 주로 **D3(시각 스타일/구조)** — 재사용 origin·slot 은 catalog·canonical 구조 SSOT 층. 단 **factory 인스턴스 생성 경로(standalone→ref)** 변경은 canonical schema 소비 방식에 영향(D3 내부 authoring 층). D1(RAC DOM)·D2(props)는 무변경 — RAC GridList/GridListItem 계약 그대로.

**Hard Constraints**:

1. **BC — 기존 프로젝트 GridList 무손실**: 기존 canonical 문서의 standalone `type:"GridList"` 인스턴스가 새 ref 모델로 전환돼도 카드 데이터(items/label/description)·시각 결과 손실 0. 새로고침 후 정합.
2. **시각 결과 불변**: 전환 후 GridList 카드 렌더(bg+border+label+description)가 Skia 카드 76px / DOM 76px parity 유지 — ref-composite 는 authoring 층 추가일 뿐 렌더 결과 무변경.
3. **projection 무회귀**: GridList Skia projection 은 이미 data-direct 로 작동(ADR-912 C1, 커밋 `2818c6bf0`) — row projection `rowProps.children=row.label` 직접 소비. 본 전환이 이 경로를 깨면 안 됨.
4. **성능**: 60fps canvas / 초기 로드 <3초 유지 — ref 해석(master→slot)이 pointer hot path 에 O(n) 순회 추가 금지.

**Soft Constraints**:

- GridList 는 Skia 에서 ListBox 와 **isomorphic 하지 않음**(`project-collection-skia-flip-not-listbox-isomorphic` 실측) — projection 경로가 다르므로 ListBox composite 배선을 verbatim 복제 불가, GridList projection 특성에 맞춘 조정 필요.
- ADR-912 C1 이 origin 을 "optional enhancement, 1차 전환 불필요, 후행" 으로 판정 — 본 ADR 은 그 후행을 착수하는 것. 선행 판정과 모순 아님(당시 projection 우선, composite 후행 합의).

## Alternatives Considered

### 대안 A: 전체 ref 기반 composite 전환 (ListBox 동형)

- 설명: 컨테이너 origin(`component-gridlist`) 생성 + factory ref 전환 + preview/Skia projection 배선 + 기존 인스턴스 migration. ListBox 의 6-축 완성 경로(§breakdown §0)를 GridList projection 특성에 맞춰 이식.
- 근거: React Spectrum/RAC 의 collection 컴포넌트는 동일 reuse 모델(master template + item 참조)을 공유 — ListBox·GridList·Table 이 같은 authoring 패러다임을 갖는 것이 업계 표준(Adobe Spectrum collection). composition 내부 ListBox 가 이미 검증된 참조 구현.
- 위험:
  - 기술: **HIGH** — Skia scene ref→master 해석(`canvasSceneNode.ts:751` 동형 추가)이 GridList non-isomorphic projection(`appendGridListRowProjection`)과 충돌 가능. `sceneVersion` signature(ADR-136) 동반 갱신 필요. 5-축 배선 각각 검증 대상.
  - 성능: **LOW** — ref 해석은 `buildSceneStructureSnapshot` 시점(hot path 아님), master slot 은 문서당 1회 캐시(ListBox 실측).
  - 유지보수: **MED** — ListBox 와 동형 구조로 수렴하면 collection 공통 헬퍼 추출 여지(향후 Table 도 동일) → 장기 유지비 감소. 단 전환 중 2모델(standalone+ref) 병존 기간 관리.
  - 마이그레이션: **HIGH** — 기존 standalone GridList 인스턴스 → ref 전환(`legacyGridListTemplateMigration` 신규). 오류 시 기존 프로젝트 카드 손상. idempotent + 원본 props 보존 필수.

### 대안 B: 현행 standalone 유지 (item origin 만)

- 설명: 컨테이너 origin·ref 전환 없이 현재 구조 유지. 크래시는 이미 수정됨(`9c28eef6f`). item origin 은 slot 스타일 상속용으로만 존속.
- 근거: ADR-912 C1 이 "projection 은 origin 없이 작동, origin 은 optional" 로 판정 — GridList 는 projection 만으로 렌더 완결. YAGNI: reuse 워크플로 실사용 요구가 확인되기 전 composite 배선 보류.
- 위험:
  - 기술: **LOW** — 변경 없음, 현행 검증된 상태.
  - 성능: **LOW** — 변경 없음.
  - 유지보수: **MED** — ListBox 와 영구 비대칭 유지 → collection family 이해 비용 지속(왜 ListBox 만 ref?). 크래시 재발 시 "부분 이식" 함정 반복 위험.
  - 마이그레이션: **LOW** — 없음.

### 대안 C: 컨테이너 origin 등록만 (factory ref 전환 없이)

- 설명: `component-gridlist` origin 을 components 페이지에 등록하되 factory 는 standalone 유지. 인스턴스가 master 를 ref 하지 않음.
- 근거: 부분 진행으로 "components 페이지에 GridList 표시" 만 충족.
- 위험:
  - 기술: **MED** — 아무도 ref 하지 않는 orphan origin → resolveCanonicalRefTree/projection 이 소비 경로 없음. 죽은 데이터.
  - 성능: **LOW**.
  - 유지보수: **HIGH** — orphan origin 은 "왜 있는데 안 쓰이나" 혼란 영구화 + 향후 정리 부채. ListBox 와도 다른 제3 상태(등록됐으나 미참조).
  - 마이그레이션: **LOW**.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  H   |  L   |    M     |      H       |     2      |
| B    |  L   |  L   |    M     |      L       |     0      |
| C    |  M   |  L   |    H     |      L       |     1      |

루프 판정: 대안 A 가 HIGH 2개(기술·마이그레이션)이나, **B(무전환)는 비대칭 영구화·부분이식 함정 재발이라는 유지보수 부채를 남기고, C(orphan)는 죽은 데이터로 오히려 유지비 HIGH**. A 의 HIGH 2개는 회피형 새 대안으로 낮출 성질이 아니라(전환 자체의 본질 위험) Gate 로 관리 가능한 실행 위험 — Threshold 초과분은 §Gates 로 흡수. CRITICAL 0개이므로 근본적 다른 접근 추가 불요.

**HIGH+ Phase 별도 ADR 분리 검토 (adr-writing.md 선차단 체크)**: HIGH 위험 2개는 Phase 4(Skia projection, R1)·Phase 5(migration, R2)에 귀속된다. 두 Phase 를 별도 ADR 로 분리할 수 있는지 검토했으나 — Phase 1-5 는 "standalone→ref 전환" 이라는 **단일 불가분 목표의 순차 단계**(컨테이너 origin 없이는 ref 불가, ref 없이는 projection·migration 무의미)라 분리 시 각 ADR 이 미완성 중간 상태(orphan origin / 반쪽 ref)를 land 하게 되어 대안 C 의 함정을 재생산한다. 따라서 단일 ADR + Phase Gate 관리가 적합. **BC 영향 범위**: 마이그레이션(R2)은 canonical 문서에 standalone `type:"GridList"` 인스턴스를 보유한 **모든 기존 프로젝트**가 대상(dev 단계 단일 사용자 프로젝트 수 한정, `feedback-dev-stage-no-bc-migration` — 그러나 데이터 손실 0 은 hard constraint 라 migration 은 여전히 무손실 idempotent 필수).

> **[2026-07-23 amend — Phase 5 scope 확정]**: 실행 단계에서 ListBox `migrateLegacyListBoxTemplatesToOrigins` 를 확인한 결과 standalone `type:"ListBox"` 를 ref 로 **변환하지 않고** anchor strip + origin bootstrap 만 하며 standalone 은 type gate 로 렌더함이 드러났다. 사용자 결정(AskUserQuestion)으로 GridList 도 **타입 미변환** ListBox-parity 채택 → R2 를 HIGH→LOW 로 하향(타입 변환 데이터 손실 위험 소멸). Phase 5 는 별도 migration 코드 없이 `ensureGridListTemplateOrigins`(Phase 1 기배선) 의 컨테이너 origin bootstrap + standalone type gate 렌더로 충족. 상세: §진행 로그 Phase 5.

## Decision

**대안 A: 전체 ref 기반 composite 전환**을 선택한다.

선택 근거:

1. **비대칭 해소가 본질** — collection family 가 단일 reuse 패러다임(master+item ref)으로 수렴해야 향후 Table 전환·공통 헬퍼 추출이 가능하고, 부분 이식(slot emit 만 복제)이 유발한 크래시(`c51e0d1d2`) 류 재발을 차단한다. B(무전환)의 "LOW 위험" 은 지금 당장의 안전일 뿐 비대칭·부분이식 부채를 남긴다.
2. **HIGH 위험 2개는 회피 불가·관리 가능** — 기술(Skia non-isomorphic 충돌)·마이그레이션(기존 인스턴스 전환)은 전환의 본질 위험이라 다른 대안으로 회피되지 않는다. 대신 Phase 4/5 Gate(cross-check parity + 무손실 migration)로 통과 조건을 명시하고, 실패 시 롤백(양립 기간) 경로를 둔다.
3. **선행 판정과 정합** — ADR-912 C1 이 origin 을 "후행" 으로 명시 유예했으므로, 본 ADR 은 그 후행 착수이며 projection(이미 작동)을 깨지 않고 composite 층을 얹는다(Hard Constraint 3).

기각 사유:

- **대안 B 기각**: 크래시는 수정됐으나 ListBox 와의 영구 비대칭 + 부분이식 함정 재발 위험을 남긴다. 사용자가 reuse parity 를 명시 요구(2026-07-23).
- **대안 C 기각**: factory ref 전환 없는 컨테이너 origin 은 아무도 참조하지 않는 orphan 죽은 데이터로, 유지보수 위험이 오히려 A 보다 높다(HIGH). "부분 진행" 이 가장 나쁜 상태.

> 구현 상세: [161-gridlist-ref-composite-parity-breakdown.md](design/161-gridlist-ref-composite-parity-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                            | 심각도 | 대응                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Skia scene ref→master 해석이 GridList non-isomorphic projection(`appendGridListRowProjection`)과 충돌 → 카드 오렌더/데이터 소실                                                                                                                 |  HIGH  | Phase 4 Gate: `/cross-check` Skia↔DOM 카드 parity(76) + 데이터 소실 0. 실패 시 debugger 위임, ref 해석과 projection 경로 분리 재설계. `sceneVersion` signature 동반 갱신                                                                      |
| R2  | 기존 standalone GridList 인스턴스 처리 — **타입 미변환 확정(2026-07-23 사용자 결정, ListBox `migrateLegacyListBoxTemplatesToOrigins` 선례 동형)**: standalone→ref 타입 변환 대신 origin bootstrap 만 수행 → 타입 변환 데이터 손실 위험 **소멸** |  LOW   | Phase 5: `ensureGridListTemplateOrigins`(hydration 3곳 기배선, 멱등)가 컨테이너 origin bootstrap. standalone 은 type gate(`isGridListSceneSource` line 1 `type==="GridList"`)로 렌더 유지 — 원본 props/children 무침범. 타입 변환 코드 미작성 |
| R3  | 전환 중 2모델(standalone+ref) 병존 → 소비자(preview/Skia)가 한쪽만 처리해 렌더 분기 누락                                                                                                                                                        |  MED   | Phase 3/4 가 ref 경로 추가 시 standalone fallback 유지(migration 완료 전까지). 소비자별 `ref===GRIDLIST_ORIGIN_ID` 분기 + standalone 경로 양립 검증                                                                                           |
| R4  | ref override props(layout/columns/selectionMode) 이전 시 instance override 채널 누락 → 인스턴스 커스텀 무효                                                                                                                                     |  MED   | Phase 2: ListBox ref override props 소비 경로(`resolveCanonicalRefTree` override) 동형 확인. Gate: 인스턴스 layout 편집이 master 무침범 반영                                                                                                  |
| R5  | `component-gridlist` origin 이 publish 앱 slot 미소비(ADR-148 잔존 R9)와 동일 gap → publish 출력 불일치                                                                                                                                         |  LOW   | ADR-148 R9 와 동일 알려진 gap(publish 는 flat-props BC). 본 ADR scope 밖 — publish slot 소비는 ADR-148 R9 후속으로 분리 명시                                                                                                                  |
| R6  | authoring parity — slot 편집 UI 가 ListBox 전용(`slotHostPolicy`/`GridListItemEditor` flat-props)이라 GridList 인스턴스 프로퍼티에 slot 표시 부재 (2026-07-23 사용자 발견, scope 추가)                                                          |  MED   | Phase 7: `slotHostPolicy` 일반화(`isGridListHost`) + `GridListItemEditor` slot 구성 전환. Gate G5. 렌더 측(Phase 1/2/4)과 독립 표면이라 회귀 위험 격리                                                                                        |

## Gates

| Gate    | 시점              | 통과 조건                                                                                                                                                                                              | 실패 시 대안                                                              |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| G1 (R1) | Phase 4 종료      | `/cross-check` — ref GridList Skia 카드 ≡ DOM 카드 (76 parity), console 에러 0, 데이터 소실 0                                                                                                          | debugger 위임(systematic-debugging), ref 해석↔projection 경로 분리 재설계 |
| G2 (R2) | Phase 5 종료      | `ensureGridListTemplateOrigins` 가 legacy 문서(컨테이너 origin 부재)에 `component-gridlist`(slot→item origin) 추가 + 멱등/사용자편집 보존 (unit-test) + standalone GridList type gate 렌더 유지 (live) | 타입 변환 회귀 시 bootstrap-only 복귀                                     |
| G3 (R3) | Phase 3·4 각 종료 | ref 경로 추가가 standalone fallback 을 제거하지 않음 (migration 완료 전 2모델 병존 정상)                                                                                                               | fallback 복원 후 재진행                                                   |
| G4 (R4) | Phase 2 종료      | 팔레트 add → 인스턴스 `type:"ref"` + layout/selectionMode override 편집이 master 무침범 (live store probe)                                                                                             | ref override 채널 재배선                                                  |
| G5 (R6) | Phase 7 종료      | GridList 인스턴스 선택 → 프로퍼티 패널 slot 섹션 표시 + slot 자식(label/description) 편집이 origin/카드 반영 (live)                                                                                    | slotHostPolicy/GridListItemEditor 재검토                                  |

## Consequences

### Positive

- collection family(ListBox·GridList) 가 단일 ref-composite 패러다임으로 수렴 → components 페이지 GridList master 커스터마이즈 + 인스턴스 상속 워크플로 확보. 향후 Table 전환·collection 공통 헬퍼(`resolve*TemplateOriginId` 일반화) 기반 마련.
- 부분이식 함정(slot emit 만 복제 → 크래시) 구조적 차단 — GridList 가 ListBox 와 동형이면 이식이 verbatim 안전.
- 영향 파일: `gridListTemplateOrigins.ts`, `SelectionComponents.ts`, `preview/App.tsx`, `canvasSceneNode.ts`, `legacyGridListTemplateMigration.ts`(신규).

### Negative

- 전환 중 standalone+ref 2모델 병존 기간 — 소비자 분기 복잡도 일시 증가(R3).
- migration 코드 신규 유지 대상 추가(`legacyGridListTemplateMigration.ts`) — ListBox 와 동형이라 패턴 중복이나 collection별 origin id 상이로 별도 존속.
- publish 앱 slot 미소비 gap(R5)은 본 전환으로 해소되지 않음 — ADR-148 R9 와 동일 후속 대상.
