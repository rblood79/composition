# ADR-174 Design Breakdown — Paragraph 수명 retained 전환

> 본문: [174-paragraph-retained-lifetime.md](../174-paragraph-retained-lifetime.md)

## §1 전제 lock-in

- **신규 주제 ADR** (기존 ADR fork/분리 아님) — fork 4 질문 게이트 비해당.
- 사용자 confirm 기록: 2026-07-30 AskUserQuestion — "ADR 작성 후 구현 (권장)" 선택. 배경 지시: "단순한 눈가리기식 처리를 원하는게 아니다 완성도가 더 중요하다" (폐기 지연 단독안 기각, 구조 수리 채택).
- **ADR-173 재시도 선결 조건과의 관계**: §되돌림 기록의 선결 조건 3개는 전부 컬링 반경(Phase 1) 거래 대상. 본 ADR 은 반경 불변(200) 이므로 비해당. 선결 조건 3("가시 텍스트 수가 paragraph 캐시 상한을 넘는지 확인")은 본 ADR 이 상한 개념 자체를 제거해 구조적으로 해소한다.
- 문제 정의 정본: `docs/explanation/research/BUILDER_FRAME_DROP_BASELINE_5K.md` §8 (잠재 결함 — 문턱 변수/기제/실측 경계/현행 상태), Pen 대조 정본: `PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md` §3-4-1.

## Phase 0 — 메모리 축 실측 (inventory freeze, G1)

실측 항목:

1. 5,069 요소 / 23 페이지 문서의 **텍스트 draw 노드 총수** (페이지별 분포 포함) — walk 계측 또는 canonical 문서 텍스트 노드 집계.
2. **paragraph 1개당 WASM 힙 비용** — N개 생성 전후 heap delta / N. 대표 텍스트 3종 (짧은 라벨 / 문단 / 긴 목록 항목) 각각.
3. **retained 총량 프로젝션 2종**: (a) 전 페이지 보유 시 (b) 가시(walk) 페이지 한정 보유 시.
4. `nodePictureCache` 현행 수명 지도 — 동반 폐기 지연 대상 확인 (49d71dbd3 이 양쪽을 수정했던 계보).
5. **중복 계수** — 고유 paragraph 캐시 키 수 vs 텍스트 노드 수 (컬렉션 페이지 포함). 현행 캐시는 content 키 (`nodeRendererText.ts:130` — processedText+layoutMaxWidth+font 축, 노드 id 미포함) 라 동일 텍스트·스타일이 노드 간 **공유**된다 — per-node retained 는 이 dedup 을 소실하므로, 계수가 높으면 (프로젝션이 G1 상한 초과) Phase 2 에서 content-키 refcount 공유 variant 로 분기 (2026-07-31 리뷰 round 1 M1).
6. **프레임 중 delete 지점 전수** (Phase 1 큐 경유 대상 목록화, 2026-07-31 리뷰 round 1 M2): ① 퇴거 (`nodeRendererText.ts:82-86`) ② same-key 교체 시 `existing.delete()` (`nodeRendererText.ts:73-77`) ③ **fontMgr 변경 일괄 clear** — `renderText` 내부에서 즉시 delete (`nodeRendererText.ts:97-100` → `clearParagraphCache` 46-52). ③ 은 retained 전환 후에도 invalidation 축으로 남는다 (§Phase 2).

산출: G1 통과 수치 + 스코프 정책 확정 (§Phase 3). 추정 vs 실측 gap 발견 시 본 Phase 안에서 inventory 보강으로 흡수 (adr-writing M3 — fork 사유 금지).

### 실측 결과 (2026-07-31 — G1 통과)

계측 도구는 본 Phase 에서 신설했다: `nodeRendererText.ts` 가 `getCacheMetrics("paragraph")` 로 hit/miss/eviction/size 를 다른 캐시와 같은 `__composition_CACHE_METRICS__` 채널에 싣고, `__composition_PARAGRAPH_DEBUG__.census` 가 walk 당 draw 수 / 고유 캐시 키 수 / 고유 노드 수를 센다 (dev 전용). paragraph 는 유일하게 계측 채널이 없던 캐시였고, 그것이 상한 스래싱이 조용히 진행된 이유이기도 하다.

측정 대상은 기준선 §1 과 같은 문서 (5,069 요소 / 23 페이지). 측정 중 `window.__composition_NODE_PICTURE_CACHE__ = false` 로 picture replay 를 껐다 — **replay 는 record 된 Picture 안에서 텍스트를 재생하므로 `renderText` 를 지나지 않는다**. 이 토글 없이는 walk 수치가 실제보다 작게 잡힌다 (측정 함정).

| #   | 항목                  | 실측                                                                                                                 |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | 텍스트 draw 노드 총수 | **3,372** (10% 줌 walk = 23 중 ~20 페이지). 문서 전체 환산 ≈ **3,900**                                               |
| 5   | 고유 캐시 키          | **159** → **중복 계수 21.2×**                                                                                        |
| 2   | paragraph 단가        | 짧은 라벨 ≈ **20 KB** (5,000개 증분 기울기), 4문장 문단 ≈ 160 KB (600개 성장 이벤트 — allocator slack 포함 **상한**) |
| 3   | retained 프로젝션     | per-node: walk 3,372 × 20 KB ≈ **67 MB**, 문서 전체 ≈ **78 MB** / content-키: 159 × 20 KB ≈ **3.2 MB**               |
| 4   | nodePictureCache 수명 | delete 지점 4종 — 아래 표 (3종이 프레임 중)                                                                          |
| 6   | 프레임 중 delete      | paragraph 3 지점 + nodePicture 3 지점 — 아래 표                                                                      |

**소유 모델 확정 (M1 분기 판정)** — 중복 계수 21× 는 per-node retained 가 동시 보유 paragraph 를 20배로 늘린다는 뜻이다 (3.2 MB → 67 MB). Phase 2 는 **content-키 refcount 공유 variant** 로 간다. 수명 규율은 node-owned 안과 동일 — 참조 0 도달 + deferred 폐기, LRU·상한·프레임 중 퇴거 없음. 즉 본 ADR 이 없애는 것은 **상한과 프레임 중 폐기**이지 content 키 자체가 아니다.

**문턱은 요소 수가 아니라 텍스트 고유도** — 상한 1,000 을 넘으려면 고유 키가 1,000 종을 넘어야 하고, 텍스트 노드 ~3,900 기준 그 경계는 **중복 계수 3.9** 다. 관측된 두 극단: 컴포넌트 복제형 문서 **21.2** (경계 안쪽, 안전) ↔ bench 필러(고유 문자열) **≈ 1.0** (walk 1,416 draw 로 초과 — ADR Context 의 그 수치). 실사용 문서는 화면마다 카피가 달라 1~3 대에 놓이므로 **경계 바깥이 기본값**이다. 본 문서에서 퇴거가 0건인 것(159/1,000)은 위험 부재가 아니라 문서 형태 덕이다 — 이것이 ADR Context 의 "필러 문서 경계 수치는 실문서로 일반화 불가" 를 실측으로 확정한 형태다.

**프레임 중 `.delete()` 전수** (Phase 1 큐 경유 대상):

| 자원        | 지점                                                         |   시점    |
| ----------- | ------------------------------------------------------------ | :-------: |
| paragraph   | LRU 퇴거 `nodeRendererText.ts:174`                           | 프레임 중 |
| paragraph   | same-key 교체 `nodeRendererText.ts:161`                      | 프레임 중 |
| paragraph   | fontMgr 교체 일괄 clear `nodeRendererText.ts:189` → `:85`    | 프레임 중 |
| nodePicture | volatile 노드 폐기 `renderCommands.ts:1375`                  | 프레임 중 |
| nodePicture | fontMgr 세대 전량 폐기 `renderCommands.ts:904`               | 프레임 중 |
| nodePicture | LRU 퇴거 `storeNodePicture` → `evictLeastRecentlyUsed`       | 프레임 중 |
| nodePicture | register/unregister·registry clear `useSkiaNode.ts:47/54/75` | 프레임 밖 |

**부수 관측 — nodePicture 스래싱**: 세션 누적 스냅샷에서 hit 40,125 / miss 289,667 / **eviction 281,125** (상한 1,024, 적중률 12%). 텍스트 노드만 3,372 인 문서에서 1,024 상한은 구조적으로 부족하다. 상한 조정 자체는 본 ADR scope 밖 (변경하지 않음) 이지만, **프레임 중 폐기가 paragraph 와 같은 형태로 존재**하므로 Phase 1 의 지연 폐기는 두 자원을 함께 덮는다 (G3 계약 테스트도 양쪽).

**주의 — WASM 힙은 되돌아오지 않는다**: 측정 중 emscripten 힙이 1,139 → 1,331 MB 로 늘고 `.delete()` 후에도 줄지 않았다 (emscripten 은 페이지를 OS 에 반납하지 않는다). 따라서 G4 의 "메모리 live 증가분" 판정은 힙 크기 절대값이 아니라 **동시 보유 paragraph 수 × 단가** 기준으로 한다.

**측정 함정 3종** (재측정 시 반복 주의):

1. **hidden 탭 rAF 정지** — `document.hidden === true` 면 rAF 가 멈춰 스크립트로 페이지를 바꿔도 프레임이 0 이다. 실입력(스크롤/클릭)만 프레임을 낸다. 스크립트만으로 walk 을 유도하면 전 항목이 0 으로 나온다.
2. **HMR 모듈 중복** — 편집 직후 HMR 상태에서는 debug 전역과 렌더 경로가 다른 모듈 인스턴스를 잡아 수치가 어긋난다. 계측 코드 변경 후에는 **전체 새로고침**.
3. **picture replay 우회** — 위 토글 미적용 시 텍스트 draw 가 renderText 를 지나지 않는다.

## Phase 1 — 안전 폐기 프리미티브 (deferredDisposal)

- `deferredDisposal.ts` 재작성 (`49d71dbd3` 계보): 프레임 중 발생하는 모든 paragraph / nodePicture `.delete()` 를 큐 적립 → `SkiaRenderer.render()` finally 에서 drain (**flush 후**).
- 프레임 밖 삭제 (unmount / 명시 clear) 도 동일 단일 진입점 경유 — 호출 지점이 프레임 여부를 판단하지 않게.
- **hidden 탭 rAF 정지 대비** (`reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`): render finally 외에 unregister 일괄 경로에서도 drain — flush 가 오래 없어도 큐가 무한 적체하지 않게.
- 계약 테스트: 폐기 지연 5종 (원 커밋 계보 복원) + 큐 적체 상한 1종.

## Phase 2 — retained 소유 전환 (G2 RED→GREEN, G3)

- paragraph 소유를 전역 LRU → **skia node 단위**로: key = element id (registry entry), invalidate 신호 = `registerSkiaNode` 의 data identity 변경 (기존 registryVersion bump 과 동일 지점) → rebuild + 구 paragraph deferred delete.
- `nodeRendererText.ts` 조회 경로: 전역 cache lookup → node-owned lookup 교체. miss 시 생성 후 노드에 부착 (lazy — 현행과 동일하게 첫 draw 시 생성).
- **측정기 경로 불변**: `canvaskitTextMeasurer` 의 "WASM Paragraph 객체 캐싱 금지, 결과값 {width,height} 만 LRU" 계약 (canvas-rendering.md §3) 은 그대로 — 본 전환은 **렌더 측 paragraph 한정**.
- **invalidation 축은 둘**: ① 노드 data identity 변경 (텍스트/스타일 — `registerSkiaNode`) ② **fontMgr 변경** — retained paragraph 는 생성 시점 fontMgr 에 종속되므로 (`renderText` 의 `getLastParagraphFontMgr() !== fontMgr` 분기가 현행 전량 clear 근거), fontMgr 교체 시 전 노드 retained paragraph 를 일괄 무효화 + deferred 폐기. 프레임 중 즉시 clear (현행 `nodeRendererText.ts:97-100`) 재생산 금지 (2026-07-31 리뷰 round 1 M2).
- **소유 모델 — content-키 refcount 공유로 확정** (Phase 0 실측 중복 계수 **21.2×**, 2026-07-31): 저장소 키는 현행 content 키를 유지하고, 노드는 그 entry 를 **참조**한다. 참조 카운트가 0 이 되면 (노드 unregister / data identity 변경으로 다른 키로 이동) deferred 폐기. **LRU·상한·프레임 중 퇴거 없음** — 본 ADR 이 없애는 것은 상한과 프레임 중 폐기이지 content 키가 아니다. node-owned 안은 기각 (동시 보유 3.2 MB → 67 MB, 20배). 리뷰 round 1 M1 이 예고한 분기의 실측 확정.
- 따라서 §Phase 2 의 "key = element id" 는 **"key = content 키 + 노드별 참조 등록"** 으로 대체된다. invalidate 신호(`registerSkiaNode` data identity 변경)는 그대로 — 노드가 참조를 옮기는 계기로 쓰인다.
- 전역 LRU 는 본 Phase 동안 fallback 플래그로 공존 — cutover 검증(G2/G3/G5) 후 Phase 3 에서 제거.

### 소유 모델 정정 2건 (2026-07-31 Phase 1 종료 시점 코드 확인)

착수 전 확인에서 위 서술의 전제 두 개가 코드와 어긋났다. **Phase 2 는 아래를 반영해 설계한다.**

1. **소유는 1:1 이 아니라 1:N** — `specShapeConverter.ts:817` 이 spec shape 마다 `type:"text"` 노드를 만들고 **같은 `elementId` 를 공유**한다 (Card 제목+설명, ListBoxItem 라벨+설명 등). 따라서 소유 표현은 `elementId → key` 가 아니라 **`elementId → Set<key>` + `key → Set<elementId>`** 양방향이어야 하고, 해제는 "그 요소가 가진 키 전부" 를 대상으로 한다. 1:1 로 짜면 한 요소의 둘째 텍스트가 소유자 없이 남아 영구 보유되거나, 첫째 키를 덮어써 조기 폐기된다.

2. **즉시 해제는 드래그 churn 을 만든다** — invalidate 신호(`registerSkiaNode` data identity 변경)는 **이동/리사이즈에서도** 발생하지만 그때 텍스트 키는 그대로다. 신호 즉시 해제하면 매 드래그 프레임마다 같은 paragraph 를 폐기하고 다시 만든다 (현행 content 키 캐시는 이 경우 hit 이라 비용 0 — 즉 **회귀**). 따라서 해제는 **지연 판정**이다: 신호 시점에는 "해제 예정" 으로만 표시하고, 다음 walk 에서 같은 키를 다시 취득하면 취소, 끝까지 취득되지 않은 것만 폐기한다. 판정 시점은 프레임 경계(drain 지점)와 같은 곳에 둔다.
   - 주의: "이번 프레임에 안 그려졌다" 를 해제 근거로 쓰면 안 된다 — 컬링/페이지 이탈로 안 그려질 뿐 필요한 키가 죽는다. 해제 근거는 **invalidate 신호를 받았고 그 뒤 재취득이 없었다** 는 조합이어야 한다 (Phase 3 의 "전 페이지 보유" 와 정합).

- G2 절차: 전환 **전** `VITE_PARAGRAPH_CACHE_SIZE=50` + 줌 왕복으로 소실 RED 재현 기록 → 전환 후 동일 절차 GREEN.
  - **절차 정정 (Phase 1 반영)**: Phase 1 이 프레임 중 폐기(기제 ②)를 이미 제거해, HEAD 에서는 상한을 낮춰도 소실이 재현되지 않을 수 있다. 그때 RED 는 **Phase 1 이전 커밋**(`fed7e1838`)에서 잡아 기록하고, HEAD 의 무재현 자체를 Phase 1 의 효과 증거로 병기한다. 무재현을 이유로 절차를 생략하지 않는다 (G2 실패 분기).
  - `VITE_PARAGRAPH_CACHE_SIZE` 는 `import.meta.env` 라 서버 재시작이 필요하다. 사용자의 5173 dev 서버를 건드리지 말고 **별도 포트로 띄운다** (`VITE_PARAGRAPH_CACHE_SIZE=50 pnpm dev --port 5174`).

## Phase 3 — 스코프 정책 적용 + LRU 제거

- Phase 0 수치로 **"소" 확정** (2026-07-31): content-키 공유 보유의 프로젝션이 문서 전체 **≈ 3.2 MB** (고유 키 159 × 20 KB) 로 상한 대비 무시 가능 → **전 페이지 보유, 스코프 퇴거 no-op**. walk 스코프 퇴거 코드는 도입하지 않는다 (필요 없는 기제를 넣으면 그 자체가 새 수명 축이 된다).
  - 재개 조건: 고유 키 수가 페이지 이탈 후에도 계속 누적되어 동시 보유가 프로젝션을 크게 넘는 문서가 나오면 (G4 메모리 판정 실패) 그때 walk 스코프 도입 — 판정 기준은 힙 절대값이 아니라 동시 보유 키 수 × 단가.
- 전역 `paragraphCache` (상한 1,000) 제거 + `VITE_PARAGRAPH_CACHE_SIZE` env 제거 (`nodeRendererState.ts:14-21`).
- **규칙 갱신**: canvas-rendering.md §3 의 "WASM Paragraph 객체 캐싱 금지 (메모리 누수)" 문구를 "측정 경로 한정. 렌더 측은 노드 소유 retained + deferred 폐기 (ADR-174)" 로 정정 — 현행 문구는 측정기 맥락인데 렌더 측 전역 LRU 존재와 이미 불일치했다.

## Phase 4 — 검증 (G4/G5) + 종결

- G4 성능 비회귀: 기준선 문서 §1 경로 전부 (유휴 / 팬 집합 불변 / 팬 집합 변경 / 스크롤 / 줌 / 편집) frame gap 재측정. **불리 경로 + 프레임 총비용 의무 포함** — 기준선 §6 게이트 설계 제약 (`feedback-perf-gate-favorable-case-only-measurement` 3실패 재생산 금지).
- G5 live exercise: 실문서에서 ① 텍스트 편집 → 즉시 반영 (stale 0) ② 페이지 전환 왕복 ③ 줌 15%↔100% 왕복 ×2 — 전 텍스트 유지 스크린샷.
- 종결: CHANGELOG (Bug Fixes — Why 포함) + 기준선 문서 §8 상태 갱신 (잔존 → 수리) + README 승격.

## 파일 변경 (예상 — Phase 0 에서 freeze)

| 영역      | 파일                                                                                                                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skia 렌더 | `nodeRendererText.ts` (조회 경로), `nodeRendererState.ts` (상한 제거), `SkiaRenderer.ts` (drain 지점), `deferredDisposal.ts` (신규), `nodePictureCache.ts` (지연 폐기), `useSkiaNode.ts` (부착·invalidate 지점) |
| 테스트    | `deferredDisposal.test.ts` (신규 5+1종), `paragraphRetained.test.ts` (신규 — dirty rebuild / unregister 폐기 / stale 방지), 기존 skia 스위트 갱신                                                               |
| 규칙      | `.claude/rules/canvas-rendering.md` §3                                                                                                                                                                          |
| 문서      | `BUILDER_FRAME_DROP_BASELINE_5K.md` §8, `docs/CHANGELOG.md`, `docs/adr/README.md`                                                                                                                               |

## 선차단 체크리스트 대응 (adr-writing seed)

- **코드 경로 3+ 인용**: `nodeRendererText.ts:80-85` (퇴거 + 즉시 delete), `nodeRendererState.ts:14-21` (고정 상한 + env), `SkiaRenderer.render()` finally (drain 지점), `useSkiaNode.ts registerSkiaNode` (data identity 변경 = invalidate 신호).
- Generator/Spec 확장 아님 — 해당 없음 (D3 스키마 불변).
- BC 없음 — 렌더 내부 자원 수명. 스키마/props/저장 포맷 불변.
