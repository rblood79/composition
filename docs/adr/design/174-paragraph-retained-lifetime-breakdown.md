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
- **소유 모델 분기 (Phase 0 중복 계수 판정)**: 계수가 낮으면 node-owned (기본), 높으면 content-키 refcount 공유 저장소 — 수명 규율은 동일 (참조 0 도달 + deferred 폐기, LRU/상한/프레임 중 퇴거 없음) (2026-07-31 리뷰 round 1 M1).
- 전역 LRU 는 본 Phase 동안 fallback 플래그로 공존 — cutover 검증(G2/G3/G5) 후 Phase 3 에서 제거.
- G2 절차: 전환 **전** `VITE_PARAGRAPH_CACHE_SIZE=50` + 줌 왕복으로 소실 RED 재현 기록 → 전환 후 동일 절차 GREEN.

## Phase 3 — 스코프 정책 적용 + LRU 제거

- Phase 0 수치로 확정:
  - retained 총량 **소** (프로젝션이 G1 상한 이내) → 전 페이지 보유, 스코프 퇴거 no-op.
  - retained 총량 **대** → walk 스코프: 가시 페이지 이탈 시 해당 페이지 노드 paragraph 일괄 deferred 폐기 (프레임 밖).
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
