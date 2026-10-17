# ADR-270 design breakdown — 이미지 로드 경로 (완료 → 소유 요소 splice · 치수 분리 · 메인 밖 디코딩)

> 본문: [../270-image-load-path-partial-update-off-thread-decode.md](../270-image-load-path-partial-update-off-thread-decode.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 와 `.agent/runs/` 는 로컬 전용이라 실측 결론은 여기 §기록에 둔다. 코드 인용은 HEAD `94c9a0d52`. Round 1 (codex, 2026-10-17) 반영 — Phase 1 이 「재등록 + damage」 에서 「dirty seed → splice」 로, Phase 3a 의 API 와 비용 모델, Phase 0 의 카운터 등급이 바뀌었다.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: 기존 ADR 의 분리가 아니다. ADR-153 (노드 picture 캐시 · R2 해제 순서) · ADR-174 (paragraph 수명 = 노드 수명) · ADR-235 (`asset:` 해석) · ADR-263/264 (commit-lane splice · damage) 가 base 이고, 이 ADR 은 **이미지 완료 처리** 가 그 기계들을 전부 버리는 경로 (`rebind("image-loaded")`) 를 splice 의 seed 하나로 바꾸고 디코딩 자리를 옮기는 응용이다. Pen.dev 비교의 확정 4 건 중 첫째 — 나머지 셋 (LOD · 작업 범위 제한 · 메모리 예산) 과는 파일이 겹치지 않는다 (`imageCache.ts` 는 메모리 예산 ADR 이 **상한 값**만 건드린다).
2. **schema**: 문서 · 저장 schema 변경 0. `SkiaNodeData.image` 가 `{ src, naturalWidth, naturalHeight, bitmap, content… }` 로 바뀐다 (Canvas 내부 타입). binding 에 `imageOwners: Map<url, Set<elementId>>` 가 는다. 하니스 `counts.render` · `caches` 에 이미지 필드가 늘고 `perf/ratchet.json` 에 run `app-pages-images` (· `-asset`) 가 는다.
3. **선행 전제 reverse 검증**: ADR-153 R2 「해제 순서 Picture → Image, `destroyCachedImage` 단일 경로」 는 그대로 — 이 ADR 은 **등록** 방향 (URL → 소유 요소) 을 더할 뿐 해제 경로를 만들지 않는다. ADR-174 「paragraph 는 노드가 소유」 도 그대로 — splice 가 소유 서브트리를 다시 기록할 때의 paragraph 처리는 편집과 같다. ADR-263/264 의 splice 계약 (`applyCommitSubtreeCommandPatch` · 거부 → 재바인드) 을 그대로 쓴다. ADR-266 L2 (재바인드 인계) 는 **미구현** 이고 이 ADR 이 그 자리를 대신하지 않는다.
4. **판독**: Round 1 (codex) 반영 완료. 수리 검증 round 는 사용자 요청 시 `/review-adr 270`. phase 당 1 + 수리 검증 1.

## 1. Phase 0 — 이미지 fixture · 카운트 (G0)

목적: F7 (이미지 로드가 하니스에 없다) 을 메우고 F3 · F4 · F5 의 몫을 등급 A 카운트로 고정한다. F4 는 코드로 확정이라 no-go 는 「fixture 가 결정적이지 않다」 뿐이다.

- **fixture** (`apps/builder/scripts/perfAppFixture.mjs` · `perf-baseline.mjs` `--fixture-kind`):
  - `app-pages-images`: `app-pages` 와 같은 22 페이지 · 같은 자리의 `P("Image")` 에 `src` 를 준다. 이미지는 하니스가 **생성한 PNG** (결정적 — 256 · 1,024 · 2,048 px 3 종, 반투명 1 종 포함). 공급은 Playwright `page.route` 가 **응답을 하니스 신호까지 붙든다** — 완료 시각 · 프레임 분산을 하니스가 정해야 카운트가 등급 A 다 (G0 실패 대안을 처음부터 쓴다).
  - `app-pages-images-asset` (사용자 결정 2 기본): 같은 PNG 를 ADR-235 `asset:` ref 로 IndexedDB 에 넣는 변형 — `resolveAssetUrlAsync` 경로까지 센다.
  - 부류 (`--classes`): **`load-edit`** (22 개 완료를 4 프레임 간격으로 풀면서 편집) · **`load-zoom`** · **`load-same-frame`** (완료 1 + 다른 노드 편집 1 을 같은 RAF 전에 — HC2 의 불리 케이스) 를 더한다.
- **카운터** (`renderCounters.ts` 필드 추가 · dev 전용 분기) — 등급을 적어 둔다:
  - A (before/after 같은 일): `rebindImageLoaded` (지금은 `rebindOther` 에 섞여 있다 — `canvasScene.ts:224` 사유 분기 한 줄) · `rebindReleasedPicturesImageLoaded` · `rebindReleasedParagraphsImageLoaded` (`beginRebindRelease(reason)` 이 이미 사유를 받는다) · `imageEncodedDecodeCalls` (`MakeImageFromEncoded` 호출 수) · `imageCompletions` (완료 통지 수 = 이미지 처리 횟수) · `imagePatchSplices` · `imagePatchCommandWrites` (Phase 1 뒤 — splice 가 쓴 명령 수, 기존 `commandWrites` 와 같은 자리) · `imagePatchFallbackRebind` (사유별) · 기존 hover · pan · pick · `rebind*` 총수.
  - B (Phase 0 에 없던 새 작업 — fixture 산식 상한): `imageTextureImages` (texture-backed 생성 수, 상한 = 이미지 수) · `imageReadbackBytes` (SW 폴백 — GPU 경로 0) · `imageSwFallbacks` · `imageLoadedPerFrameMax` (프레임당 완료 처리 수, 상한 N — 하니스가 완료를 제어하므로 결정적).
  - wall-clock (A 아님 — 하니스 `profile` 에 기록만, ratchet 등록 금지): `imageProcessFrameMs` (한 프레임 안 이미지 처리 합 · 최대).
  - 캐시: 하니스 `caches` 에 `imagesGlobal` (`SkiaRenderer.ts:328`) · `estimatedBytes` · `pending`.
- **시나리오** (dev 5173 · headless 60Hz · DPR 1 · WebGL (SwiftShader) · `--fixed-inputs --call-counts` 각 2 회 같은 값): `app-pages-images` `load-edit` · `load-zoom` · `load-same-frame` · `zoom` · `edit`, `app-pages-images-asset` `load-edit`. production 짝은 G4.
- **ratchet**: `perf-ratchet-gate.mjs --add-run 60:app-pages-images=<a.json>,<b.json>` · `--add-keys … --keys render.rebindImageLoaded,render.rebindReleased*ImageLoaded,render.imageEncodedDecodeCalls,render.imageCompletions,render.imageLoadedPerFrameMax`. B 키는 Phase 1 · 3 의 커밋에서 `--add-keys` 로 (Phase 0 값 0 을 상한으로 두지 않는다 — r1 M5). `imageProcessFrameMs` 는 등록하지 않는다.
- **go/no-go**: 카운트가 2 회 같으면 go. 다르면 완료 제어를 고친다 — 가설을 바꾸지 않는다.
- **5-질문 답을 §기록에**: Q1 합성물 · 규모 전용 / Q2 `load-edit` · `load-zoom` · `load-same-frame` / Q3 HEAD worktree / Q4 콜백 → seed → `scene.sync()` → splice → damage 배선은 G2 unit + G1 live / Q5 전체 재바인드 픽셀 · 옛 디코더 픽셀 · object-fit 손계산.

## 2. Phase 1 — `src` 보존 · URL → 소유 요소 맵 · 완료 = dirty seed (splice) (G1 · G2 · G3)

> r1 H1 · H2 · H3 반영. 명령 스트림은 registry 의 live view 가 아니라 파생 복사본이므로 (F5b) 노드 재등록으로는 DRAW 가 바뀌지 않는다 — 완료 처리는 **편집이 지나가는 경로** (`dirty` → `update()` → `patchSubtree`) 의 seed 가 된다.

- **`src` 보존** (`specShapeConverter.ts:1223 ~ 1229` · `nodeRendererTypes.ts:119 ~ 127` · `canvasBinding.ts:387` 의 rule 이미지 (`illustration`) 도 같은 변환): `image.src = shape.src` (cache key — `asset:` ref 그대로) 를 **로드 전후 모두** 남긴다. null `skImage` 와 content rect 만으로는 URL 을 복구할 수 없다 (F2b).
- **URL → 소유 요소 맵** (`canvasBinding.ts` — bind · `patchSubtree` 가 node data 를 만드는 자리):
  - `imageOwners: Map<url, Set<elementId>>`. 소유 요소 = 명령의 `ELEMENT_BEGIN` 을 가진 요소 — **내부 자식** (`elementId: ""`, `renderCommands.ts:1982` — rule 이미지 · owner-drawn part) 의 `src` 는 그 자식을 품은 요소 id 로 올린다.
  - 만드는 자리: `bind()` 전체 순회 · `patchSubtree(id)` 의 replacement 순회 (그 서브트리의 옛 항목을 먼저 지우고 새 항목을 넣는다). 지우는 자리: `dispose()` · `patchSubtree` 의 옛 서브트리 · page 전환 (`clearSkiaRegistry` 뒤 dispose) · `registerMovedSkiaNode` 는 id 불변이라 손대지 않는다. **캐시 핸들 (`imageIndex`) 로 대체하지 않는다** (미로딩은 핸들이 null).
- **완료 통지** (`imageCache.ts:43 ~ 56` → `CatalogCanvas.tsx:930 ~ 933`):
  - 콜백이 **URL** 을 넘긴다 (`(url) => void`). `CatalogCanvas` 는 `imagesStale: Set<url>` 에 모으고 `sceneStale = true` 를 **세운다** (지금처럼 지우지 않는다 — F4 · H3). 별도 `scene.imageLoaded()` 호출과 `renderer.invalidateContent()` (full) 은 **삭제**.
  - `syncScene` (`:771 ~ 802`): `imagesStale` 가 있으면 `scene.seedImageOwners(urls)` → `binding.seedImageOwners(urls)` 가 `imageOwners` 로 `dirty.add(owner)` (`canvasBinding.ts:2645` 와 같은 자리 — `imageDirty` 로 표시해 카운터 · 거부 사유를 가른다). 그 다음 기존 `scene.sync()` 가 **다른 pending 변경과 같은 트랜잭션**으로 `update()` → `patchSubtree(owner)` 를 돌린다 — node data 재구성 (이번엔 `getSkImage` hit) · DRAW self span 교체 · `registerSkiaNode` 경유 picture 무효 · damage 는 `catalogSyncDamage` 합집합. 편집 B 와 완료 A 가 같은 프레임이면 둘 다 `dirty` 에 있고 한 번의 `update()` 가 처리한다 (HC2).
  - 레이아웃: `patchSubtree` 는 `layoutMap` 을 그대로 쓴다 — 이미지는 자기 상자 안에 그려지므로 엔진 재실행 없음. object-fit 만 바뀐다 (F2).
  - 후퇴: `patchSubtree` 가 거부하면 (`subtree-context` · top-layer · drag 중) 기존 규칙대로 재바인드 — 사유 카운터 `imagePatchFallbackRebind`. **drag 중** 완료는 seed 를 보관했다가 drag 끝 (`top-layer` 해제) 에 넣는다 (R1 — drag 두 번 재바인드를 이미지가 늘리지 않게). 텍스트 편집 중 노드가 소유 요소면 편집 끝까지 보관.
  - 플래그 `__composition_RENDER_PATH_DEBUG__.setImagePartialOff` 가 켜지면 옛 `rebind("image-loaded")` 로 (G1 oracle · 롤백). `cacheGeneration` 이 바뀐 뒤 도착한 통지는 버린다 (I-H5 — `loadSkImage` 가 null 을 돌려주므로 통지 자체가 안 오지만 맵 쪽도 generation 을 본다).
- **epoch** (`imageCache.ts:131 ~ 140`): seed · splice 는 `beginImageEpoch` 를 부르지 않는다 (R5 — 의도). `getSkImage` 가 node data 재구성 때 `epoch` 를 찍으므로 사용 중 이미지는 핀 된다.
- **unit (G2, `apps/builder/src/builder/catalogRuntime/__tests__/`)** — 실제 `CatalogWorkspace` + 엔진 + `CatalogCanvasScene`, Image 노드 (src A · B) 를 넣고 캐시를 비운 상태로 묶은 뒤 (DRAW 의 `image.bitmap` null 확인): ① A 완료 → `sync()` 뒤 A 소유 요소 DRAW 의 `image.bitmap` non-null · 다른 노드 picture · paragraph 참조 동일 · `rebind*` 0 · ② **같은 프레임** 다른 노드 B 색 편집 + A 완료 → 명령 · `boundsMap` · `hitBoundsMap` · 픽셀 (SW surface 스냅샷) = 같은 상태의 fresh bind · ③ 같은 프레임 A 삭제 + 완료 → seed 0 · 누수 0 · ④ 같은 프레임 요소 스크롤 (ADR-269 `propertyChanged`) + 완료 → 스크롤 반영 + 이미지 반영 · ⑤ 두 노드 같은 URL → 둘 다 splice · ⑥ page 전환 중 완료 → seed 0 · registry 크기 불변 · ⑦ `clearImageCache` 뒤 완료 → 무시. **원복 RED**: `src` 보존을 떼면 ① · ⑤ RED · `sceneStale = true` 를 옛 `false` 로 되돌리면 ② · ④ RED · 맵 지우기를 떼면 ③ · ⑥ RED · splice 대신 `registerSkiaNode` 만 하면 ① 의 DRAW 검사가 RED (r1 H1 의 반례를 그대로 테스트로).
- **ratchet (G3)**: 같은 커밋에서 `rebindImageLoaded` 0 · `rebindReleased*ImageLoaded` 0 으로 상한을 내리고, `imagePatchSplices` ≤ `imageCompletions` · `imagePatchCommandWrites` ≤ 소유 서브트리 명령 합 (fixture 산식) 을 `--add-keys`. hover · pan · pick · 재바인드 총수는 Phase 0 이내.
- **live (G1-a)**: `apps/builder/scripts/adr270-image-load-live.mjs` (headed Playwright — `adr266-draw-cache-live.mjs` 비교 틀): 같은 문서 · 같은 완료 뒤 splice 경로 ↔ `setImagePartialOff` 전체 재바인드 스크린샷 0 px 차 — 배치 5 (clip 상자 안 · 요소 scroll 안 · sticky 헤더 아래 · 반경 상자 · 상자보다 큰 이미지 `object-fit: none`) × object-fit 5 × 반투명 PNG 1 + **편집 중 완료** (편집 결과가 남는지).

## 3. Phase 2 — 원본 치수 ↔ 표시 bitmap 분리 (G1-c)

- **타입** (`types.ts` `ImageFill` · `nodeRendererTypes.ts` `image`): `image: { src: string; bitmap: SkImage | null; naturalWidth: number; naturalHeight: number; content… }` — `specShapeConverter.ts:1201 ~ 1207` 의 `intrinsicW/H` 는 `naturalWidth/Height` 에서, 그리기 `srcRect` (`nodeRendererImage.ts:166 ~ 176`) 는 `bitmap.width()` 에서. 지금은 둘이 같은 값이라 **동작 변경 0** — 뒤의 C 등급 ADR 이 bitmap 을 줄여도 object-fit 가 흔들리지 않게 하는 자리다.
- `imageCache.ts` 의 `dimensionsCache` (`:150 ~ 183`) 가 `naturalWidth/Height` 의 출처 (디코딩 결과에서 1 회 — Phase 3 뒤에는 `ImageBitmap.width/height`). `getImageNaturalDimensions` 의 「레이아웃 엔진용」 주석은 사실대로 고친다 (소비자 = object-fit).
- 로드 **전** 동작 (intrinsic = 상자 크기 → placeholder) 은 그대로 (R3 · HC1).
- **검증**: object-fit 5 종 × (원본 가로 > 상자 · 세로 > 상자 · 둘 다 작음) 의 `computeImageFit` 손계산 1 건 (Q5 외부 oracle) + G1-a 재실행. 원복 RED: `naturalWidth` 를 `bitmap.width()` 로 되돌리고 bitmap 을 절반으로 줄인 **테스트 전용** fixture 에서 손계산 unit 이 RED.

## 4. Phase 3 — 디코딩을 메인 스레드 밖으로 (G1-b · G3)

> r1 M4 반영. 비용은 네 가지로 가른다 — **코덱** (디코딩) · **readback + WASM 복사** · **텍스처 생성** · 통지 처리. 지금 (`MakeImageFromEncoded`) 은 코덱이 **첫 그리기 프레임** 안에서 메인에 든다 (F3). 3a 는 코덱을 브라우저 (메인 밖) 로, 텍스처 생성은 첫 그리기에 남긴다 (lazy) — 0 이 아니라 **자리가 바뀐다**.

- **착수 조건 (사용자 2026-10-17 — ADR-273 결정 3)**: [ADR-273](../273-canvas-memory-budget-overscan-device-px-resource-cache.md) Phase 2 (GrContext 핸들 소유자 `createSurface.ts` · resize 는 산 context 만 재사용 · 소실 때 abandon → delete → `deleteContext` · 명시 한도) 가 닫힌 뒤. texture-backed 이미지는 처음부터 그 한도 · 수명 아래 들어간다. 진행 순서: 270 Phase 0 ~ 2 → 273 Phase 2 → 270 Phase 3a 이후 → 273 나머지 → 271 → 272.
- **3a** (`imageCache.ts:411 ~ 440` `fetchAndDecode`):
  - `response.blob()` → `createImageBitmap(blob, { premultiplyAlpha: "premultiply", colorSpaceConversion: "default" })` (R6 옵션 고정).
  - **GPU surface** (`createSurface.ts:29` `MakeWebGLCanvasSurface` 성공 — headless SwiftShader 포함): `ck.MakeLazyImageFromTextureSource(bitmap, { width, height, colorType: RGBA_8888, alphaType: Premul }, /* srcIsPremul */ true)` — texture-backed, **CanvasKit 이 bitmap 소유권을 가져간다 → `close()` 를 부르지 않는다** (R8). 카운터 `imageTextureImages`.
  - **SW surface** (`:33` 폴백): `ck.MakeImageFromCanvasImageSource(bitmap)` — canvas 에 그린 뒤 `getImageData` readback + `HEAPU8.set` (메인). 이 경로에서만 `bitmap.close()`. 카운터 `imageSwFallbacks` · `imageReadbackBytes`.
  - `createImageBitmap` 이 없는 환경 (jsdom) 은 `MakeImageFromEncoded` 그대로 (unit 환경) — production 에서 호출되면 `imageEncodedDecodeCalls` 가 0 이 아니라 G3 가 막는다.
  - `estimatedBytes` (`:271`) · `dimensionsCache` · `notifyImageLoaded(url)` 는 그대로. surface 종류는 `SkiaRenderer` 가 `imageCache` 에 알린다 (`setImageBackend("gpu" | "sw")`).
  - **완료 처리 상한** (B): 같은 프레임에 끝난 통지를 `imageLoadedPerFrameMax ≤ N` 으로 자르고 나머지는 다음 프레임으로 (`pending` 유지 · 통지 지연). N 은 Phase 0 분산으로 정한다 — Pen 의 ~5 ms 는 참고값일 뿐, ms 는 ratchet 에 넣지 않는다.
  - **context 소실 · 복원** (R8 · r2 H1 — 비우기만 하면 복원이 다시 받지 않는다: 지금 복원은 surface 만 재생성 (`CatalogCanvas.tsx:1551 ~ 1557` · `SkiaRenderer.ts:1389 ~ 1399`), DRAW 의 폐기 핸들은 placeholder (`nodeRendererImage.ts:54 ~ 130`), 재요청은 converter 재진입 때만):
    - 소실 (`watchContextLoss` onLost — `createSurface.ts:51`): backend 가 `gpu` 일 때만 `clearImageCache()` (generation ↑ — 소실 전 시작된 요청은 완료돼도 버려진다) + `suspendImageLoading(true)` — 소실 중 `loadSkImage` 는 fetch 없이 null (`pending` 에 넣지 않는다 — 복원 뒤 다시 부를 수 있게). SW backend 는 CPU 이미지라 손대지 않는다.
    - 복원 (onRestored): 기존 `renderer.resize(canvas)` 로 새 surface · GrContext 가 선 **뒤** `suspendImageLoading(false)` → `scene.rebind("context-restored")` **1 회** → `invalidateContent()`. 재바인드의 converter 재진입이 miss → `loadSkImage` → 완료 → seed → splice 로 이어진다 (편집 불필요). owner seed 대신 재바인드를 고른 이유: 드문 사건이고, `imageOwners` 밖에서 핸들을 쥔 곳 (drag 서브트리 picture · 미리 기록) 까지 한 번에 덮는다. `sceneStale = true` 만으로는 binding dirty 가 비어 있어 부족하다 (r2).
    - 카운터 `rebindContextRestored` (A — 하니스는 소실을 일으키지 않으므로 0). image-loaded 재바인드 0 과 별개 사유.
- **3b Worker** (사용자 결정 1 — 3a 뒤 메인 프로필에 코덱 · 리사이즈가 남을 때만): `imageDecodeWorker.ts` (lazy chunk · `new Worker(new URL(…, import.meta.url), { type: "module" })`) 가 `fetch` + `createImageBitmap` 을 돌리고 `ImageBitmap` 을 transfer → 메인은 텍스처 생성만. `asset:` 은 메인에서 `blob:` 로 해석한 뒤 넘긴다 (같은 origin). 동시 로딩 수는 B. HC6 번들 게이트 (G4 수동).
- **unit** (`imageCache.test.ts`): `createImageBitmap` 있음 + gpu → `MakeLazyImageFromTextureSource` 1 · `MakeImageFromEncoded` 0 · `close` 0 / sw → `MakeImageFromCanvasImageSource` 1 · `close` 1 / 없음 → `MakeImageFromEncoded` 1 / 프레임당 상한 초과분이 다음 프레임으로 / 소실 → 캐시 비움 · generation 증가 · 소실 중 `loadSkImage` fetch 0 · 소실 전 in-flight 완료 폐기 / 복원 → `rebind("context-restored")` 1 · 재요청 완료 뒤 DRAW `image.bitmap` 새 핸들 (G2 ⑧ — 실제 scene 경로). 원복 RED: 3a 를 떼면 `imageEncodedDecodeCalls` unit 이 RED · 복원의 `rebind("context-restored")` 를 떼면 G2 ⑧ 이 RED (r2 H1 반례 그대로) · `suspendImageLoading` 을 떼면 「소실 중 fetch 0」 이 RED.
- **live (G1-d)**: headed Playwright 에서 `canvas.getContext("webgl2").getExtension("WEBGL_lose_context")` 의 `loseContext()` → `restoreContext()` — 입력 없이 이미지가 다시 그려지고 소실 전 스크린샷과 0 px 차.
- **live (G1-b)**: 같은 노드를 새 디코더 ↔ `setImageDecoderLegacy` (옛 `MakeImageFromEncoded`) 로 그려 0 px 차 — 반투명 PNG · 2,048² 1 장 · object-fit cover. `setImagePartialOff` 는 splice 만 끄므로 이 arm 이 따로 필요하다.
- **ratchet (G3)**: `imageEncodedDecodeCalls` 0 · `imageTextureImages` ≤ 이미지 수 · `imageReadbackBytes` 0 (GPU) · `imageSwFallbacks` 0 (headless WebGL) · `imageLoadedPerFrameMax` ≤ N. ms 없음.

## 5. 종결 (G4 · G5)

- **G4** production 짝: `pnpm perf:build-dist` → `--serve-dist` headless 60Hz, 기준 = HEAD worktree 빌드, 교대 2 쌍 — `app-pages-images` `load-edit` · `load-zoom` · `load-same-frame`, `app-pages` `zoom` · `edit`, `600:nested-flex` `edit`. 표시 간격 p99 · long task · taskMs 회귀 0 · `imageProcessFrameMs` 기록 (방향). `node apps/builder/scripts/adr201-bundle-gate.mjs` **수동 실행** 통과 (3b 가 있으면 chunk 가 lazy 인지).
- **G5** live: 사용자 프로젝트 (Chrome MCP) 이미지 10+ 페이지 진입 · **편집 중 완료 (편집이 남는다)** · page 전환 중 완료 · `asset:` 이미지 · undo → 본문 `### Live Exercise`.
- **문서**: 본문 Status · README 현황 · CHANGELOG (사용자-가시: 이미지 많은 페이지의 로드 중 끊김 · 편집 유실 위험 제거) · 메모리 (함정이 나오면).

## 6. 파일 (예상 — Phase 0 inventory 로 고정, 1.5× 넘으면 사후 보고)

| 영역      | 파일                                                                                                                                  | 변경                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 캐시      | `apps/builder/src/builder/workspace/canvas/skia/imageCache.ts`                                                                        | 콜백 URL 인자 · `createImageBitmap` + texture/SW 분기 · backend 설정 · context 소실 · 카운터 · 완료 상한  |
| binding   | `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` · `canvasScene.ts`                                                         | `imageOwners` 맵 (bind · splice · dispose) · `seedImageOwners(urls)` · `imageLoaded` 재바인드 → 플래그 뒤 |
| 변환      | `apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts` · `nodeRendererImage.ts` · `nodeRendererTypes.ts` · `types.ts` | `image.src` 보존 · 치수 분리 · intrinsic 출처                                                             |
| Canvas    | `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx`                                                                 | `imagesStale: Set<url>` · `sceneStale = true` · 별도 image-loaded 분기 삭제                               |
| 카운터    | `apps/builder/src/builder/workspace/canvas/skia/renderCounters.ts` · `SkiaRenderer.ts` · `createSurface.ts`                           | 이미지 필드 (A · B · ms 구분) · backend 통지 · 하니스 출력                                                |
| 하니스    | `apps/builder/scripts/perfAppFixture.mjs` · `perf-baseline.mjs` · `adr270-image-load-live.mjs` (신규) · `perf/ratchet.json`           | fixture 변형 2 · 부류 3 · `page.route` 완료 제어 · live oracle 2 arm · run · keys                         |
| 테스트    | `catalogRuntime/__tests__/` · `skia/imageCache.test.ts`                                                                               | G2 7 케이스 (+ 원복 RED 4 축) · 디코딩 경로 5 · object-fit 손계산                                         |
| (3b 조건) | `skia/imageDecodeWorker.ts` (신규)                                                                                                    | 사용자 결정 1 뒤에만                                                                                      |

## 7. 기록

### Phase 0 — 2026-10-18 (G0 통과 · go)

**사용자 결정 2 답** (2026-10-17): 둘 다 한 변형씩 — `app-pages-images` (정적 URL · `page.route` 붙들기) · `app-pages-images-asset` (`asset:` ref — Fill 패널 업로드 writer `storeUploadedFile`).

**inventory 보강 2 건** (추정 vs 실측 — 본 breakdown 안에서 흡수, M3):

1. **Image 노드에는 `src` 가 없다** — DOM 은 `<img alt="">` (`domBinding.runtime.ts:2082 ~ 2090`), Canvas 는 rule 의 placeholder 상자 (`ruleShapes.ts` `BOX_SIZE_TYPES` 의 `Image`). 사용자가 사진을 넣는 길은 **Fill 패널의 Image 층** (`NodeEntry.fills` 의 `kind: "image"` — `catalogRuntime/authoredPaintCanvas.ts:69 ~ 95` → `buildBoxNodeData` → `fillToSkia.ts:315 ~ 330` `imageFillItemToSkia`) · `visual.backgroundImage` (`fillToSkia.ts:390 ~ 404` `cssBgImageToSkia`) · Avatar `src` (`skiaPrimitives.ts:2443 · 2593` → `specShapeConverter.ts:1195`) · mask (`renderCommands.ts:2732 ~ 2776` — **그리기 때** 조회) 넷이다. F7 의 「`P("Image")` 에 `src` 를 준다」 는 불가능 — fixture 는 Image 상자 67 개에 image fill 22 종 (같은 URL 3 ~ 4 상자) 을 준다.
2. **fill 이미지가 miss 이면 node data 에 그 층이 없다** — `imageFillItemToSkia` 가 `null` 을 돌려 `box.fill` 에서 빠진다 (URL 도 함께 사라진다). 그래서 Phase 1 의 URL → 소유 요소 맵은 「node data 의 `image.src`」 만으로는 fill 소유자를 놓친다 → **node data 를 만드는 동안 조회된 URL 을 그 요소 소유로 기록** (`registerNode` 범위 — bind `canvasBinding.ts:1564` · patch `:1920`, `getSkImage` · `loadSkImage` 호출이 범위 안 요소에 귀속). shape `image.src` 보존 (Phase 2 치수 분리의 자리) 은 그대로 둔다. mask 는 그리기 때 조회라 이 범위 밖 — Phase 1 에서 picture 기록 중 조회를 같은 맵에 귀속한다.

**하니스** (`apps/builder/scripts/perfImageFixture.mjs` 신규 · `perf-baseline.mjs`): PNG 22 종 결정적 생성 (256 · 512 · 1,024 · 2,048² — 2,048² 2 장, 다섯에 하나 반투명) · 정적 URL 은 `page.route` 가 붙들고 in-page 드라이버가 `__perfReleaseImage()` 로 한 장씩 푼다 · `asset:` 은 blob URL 이라 붙들 수 없어 드라이버가 상자의 fill 을 한 장씩 새 세대 ref 로 바꾼다 (놓기와 같은 길). 부류 `load-edit` (완료 → 4 프레임 → 편집 → 2 프레임) · `load-same-frame` (완료 통지 task 안에서 다른 노드 편집) · `load-zoom` (줌 휠 매 프레임 · 8 프레임마다 완료 하나). 이미지 부류 준비 (새 세대 · 붙들기 22) 는 창 밖. dev 훅 `__composition_IMAGE_DEBUG__` (`onLoaded` · `stats`) · facade `__COMPOSITION_CATALOG__.assets` (dev · harness 빌드).

**카운터** (`renderCounters.ts` — dev 전용, A): `rebindImageLoaded` (`rebindOther` 의 일부) · `rebindReleasedPicturesImageLoaded` · `rebindReleasedParagraphsImageLoaded` (`*Other` 의 일부) · `imageEncodedDecodeCalls` · `imageCompletions` · `imageLoadedPerFrameMax`. B 키 (`imageTextureImages` · `imageReadbackBytes` · `imageSwFallbacks`) 는 Phase 3 커밋에서.

**측정 조건**: dev 5173 (작업 트리) · headless Chrome (`channel: chrome`) · DPR 1 · `--fixed-inputs --call-counts` · 같은 옵션 2 회. 문서 = `app-pages` 22 페이지 (노드 3,317 · record 5,116) + Image 상자 67.

| run · 부류               | image-loaded 재바인드 | 해제 picture | 해제 paragraph | `MakeImageFromEncoded` | 완료 | 프레임당 최대 | patch | full 기록 |
| ------------------------ | --------------------: | -----------: | -------------: | ---------------------: | ---: | ------------: | ----: | --------: |
| images `load-edit`       |                    22 |        5,284 |          3,924 |                     22 |   22 |             1 |    22 |        22 |
| images `load-same-frame` |                    22 |        5,284 |          3,923 |                     22 |   22 |             1 | **0** |        22 |
| images `load-zoom`       |                    22 |       25,196 |         18,147 |                     22 |   22 |             1 |     0 |        86 |
| images `zoom` (로드 뒤)  |                     0 |            0 |              0 |                      0 |    0 |             0 |     0 |        67 |
| images `edit` (로드 뒤)  |                     0 |            0 |              0 |                      0 |    0 |             0 |    15 |         0 |
| images-asset `load-edit` |                    22 |        5,281 |          3,924 |                     22 |   22 |             1 |    89 |        24 |

2 회 값 동일 (위 키 전부 — 등급 A). ratchet `--add-run 60:app-pages-images` (5 부류) · `60:app-pages-images-asset` (1 부류) — 이미지 키는 A.

- **F4 실측**: 완료 1 = 재바인드 1 — 이미지와 무관한 picture **~240** · paragraph **~178** 를 매번 버린다 (줌 중이면 ~1,145 · ~825).
- **HC2 불리 케이스 실측** (`load-same-frame`): 같은 task 의 편집 22 회가 **patch 0** — 재바인드가 `sceneStale` 을 지워 편집을 흡수했다 (r1 H3 의 현상). Phase 1 이 seed 로 바꾸면 이 부류의 patch 가 편집 수만큼 생긴다 (G2 ②).
- 이미지 캐시 (게이지, ratchet 밖): 한 세대 22 장 = 67.9 MB · 이전 세대가 남은 이미지 부류 뒤 42 장 = **130.5 MB > 128 MiB 예산** (`IMAGE_CACHE_BYTE_BUDGET` — 참조 중이라 퇴거 0, 경고만). ADR-273 Phase 0 의 입력.
- 소비 경로 (Q4): 스크린샷 1 장 — 22 장 로드 뒤 Home hero 상자에 2,048² 그라데이션, Pricing 상자 8 개에 같은 URL 이 그려짐 (`image-probe.mjs`, scratchpad).

**5-질문**: Q1 합성물 (생성 PNG · `app-pages` 복제 아님 — 규모 전용: 이미지 수 · 바이트 · 완료 분산) / Q2 불리 = `load-edit` · `load-same-frame` · `load-zoom` (완료가 여러 프레임 · 같은 프레임 편집 · 줌 중) / Q3 대조군 = 같은 fixture 의 HEAD worktree 빌드 (G4) — Phase 0 은 기준선이라 수정 전 값 그 자체 / Q4 콜백 → `imagesStale` → `scene.imageLoaded()` → 재바인드가 실제 배선됨 (카운트 22 = 22, 스크린샷) / Q5 Phase 1 oracle = `setImagePartialOff` 전체 재바인드 픽셀 · 옛 디코더 픽셀 · object-fit 손계산.

**go/no-go**: go (카운트 2 회 동일).

### Phase 1 — 2026-10-18 (G1-a · G2 · G3 통과 — 종결)

**구현** (설계에서 바뀐 곳 3 — 모두 같은 계약을 더 좁게 지킨다):

- **소유 맵 = node data 를 만드는 동안 조회한 URL** (Phase 0 inventory 2 의 결론 그대로): `imageCache.ts` `readImagesOf(build)` 가 `getSkImage` 조회를 모으고, `canvasBinding.ts` `registerOwned` 가 bind 순회 · `registerNode` (patch · page root 옮기기) 두 자리에서 `imageOwners: Map<url, Set<record>>` · 역맵을 고친다. 지우는 자리 = splice 의 옛 서브트리 (`ownImages(id, ∅)`), 나머지는 binding 수명 (dispose · page 전환은 binding 째 버린다). 내부 자식 · owner-drawn part 는 그 record 의 node data 안에서 만들어져 자동으로 그 record 소유다. shape `image.src` 보존은 Phase 2 (치수 분리) 로 넘긴다 — 소유 판정에 쓰지 않는다.
- **완료 URL 은 scene 이 모은다**: 콜백 `(url) => scene.imageLoaded(url)` + `sceneStale = true` (`CatalogCanvas.tsx`). `scene.sync()` 가 `binding.seedImageOwners(urls)` (살아 있는 record 만 — 같은 프레임에 지워진 소유자는 부모 구조 변경이 처리) 뒤 기존 `update()` 를 돌린다. **아무 재바인드나 대기 URL 을 지운다** (새 bind 는 캐시에서 다 읽는다) — 그래서 drag 중 보관 (`sync({ holdImages })`) 은 drag 끝의 `refresh()` 가 자연히 처리한다. `scene.imageLoaded()` 의 재바인드 · `renderer.invalidateContent()` (full) 는 삭제 — damage 는 `catalogSyncDamage` 합집합.
- **mask 귀속은 불필요**: node data 의 `maskImage` 를 채우는 생산자가 0 이다 (`nodeRendererTypes.ts:174` 선언 · `renderCommands.ts:1700` 복사뿐). **텍스트 편집 중 보관도 넣지 않았다** — 편집 중인 record 의 patch 는 다른 step 의 patch 와 같은 길이고 (`setEditingElementId` 는 id 로 picture 를 건너뛸 뿐), 실패 시나리오가 없다.
- 플래그 `__composition_RENDER_PATH_DEBUG__.setImagePartialOff(true)` (dev) = 옛 경로 (`rebind("image-loaded")`). 카운터 A 3 (`imageSeedOwners` · `imagePatchSyncs` · `imagePatchFallbackRebind`). `imagePatchCommandWrites` 는 두지 않았다 — 같은 update 의 편집 쓰기와 가를 수 없고, `patchSeedCommands` 가 seed 쪽을 이미 센다.

**G2 unit** (`catalogRuntime/__tests__/adr270ImageLoadSplice.test.ts` — 실제 `CatalogWorkspace` + 엔진 + scene, 이미지 캐시는 실제 모듈 + 가짜 저장소, 9 건): ① 완료 → 소유 record 만 `rebound` · `patchRoots`, DRAW (stream 복사본) 에 이미지, 다른 record node data 동일 ② 같은 프레임 다른 요소 fill 편집 + 완료 → 둘 다, `boundsMap` · `hitBoundsMap` · DRAW = `rebuild()` ③ 같은 프레임 소유 요소 삭제 + 완료 → seed 0 · 맵에서 빠짐 ④ 같은 프레임 요소 스크롤 + 완료 → `propertyChanged` + 이미지 + 상자 = `rebuild()` ⑤ 같은 URL 두 요소 → 둘 다 ⑥ 완료 뒤 sync 전 재바인드 → 그 bind 가 읽고 대기 0 ⑦ 아무도 조회하지 않은 URL → unchanged · drag 보관 → 다음 sync 에 seed · fill 교체 → 맵이 새 URL 로. **원복 RED 6**: (a) `getSkImage` 조회 기록 제거 → ① ② ④ ⑤ · drag · fill 교체 RED (b) seed 안 함 → ① ② ④ ⑤ · drag (c) 삭제 시 맵 정리 제거 → ③ (d) **dirty 대신 `registerNode` 만** (r1 H1 반례) → ① ② ④ ⑤ · drag — DRAW 가 안 바뀐다 (e) 재바인드가 대기 URL 을 안 지움 → ⑥ (f) `holdImages` 무시 → drag. 변이 (d) 첫 실행은 무한 루프였다 — 순회 중인 소유 Set 을 `registerNode` 가 지우고 다시 넣어 같은 원소를 또 방문 → `seedImageOwners` 는 복사본을 순회한다. 회귀: `workspace/canvas` + `catalogRuntime` 405 파일 3,272 PASS · type-check PASS.

**G3 카운트** (dev 5173 작업 트리 · Phase 0 과 같은 조건 · 2 회 동일):

| run · 부류               | image-loaded 재바인드 | 해제 picture | 해제 paragraph | seed 소유자 | patch (전 → 후) | full 기록 (전 → 후) |
| ------------------------ | --------------------: | -----------: | -------------: | ----------: | --------------: | ------------------: |
| images `load-edit`       |                22 → 0 |    5,284 → 0 |      3,924 → 0 |          67 |         22 → 89 |              22 → 2 |
| images `load-same-frame` |                22 → 0 |    5,284 → 0 |      3,923 → 0 |          67 |      **0 → 89** |              22 → 2 |
| images `load-zoom`       |                22 → 0 |   25,196 → 0 |     18,147 → 0 |          67 |          0 → 67 |             86 → 85 |
| images `zoom` · `edit`   |                     0 |            0 |              0 |           0 |   0 · 15 (불변) |       67 · 0 (불변) |
| images-asset `load-edit` |                22 → 0 |    5,281 → 0 |      3,924 → 0 |          67 |        89 → 156 |              24 → 4 |

- `imagePatchSyncs` 22 · `imagePatchFallbackRebind` 0 (모든 완료가 splice 로 끝남) · `imageCompletions` 22 · `MakeImageFromEncoded` 22 (Phase 3 몫).
- **비용 교환**: 재바인드가 하던 일 (picture 5,284 · paragraph 3,924 해제 → 다시 기록) 이 소유 요소 67 개의 seed splice (명령 509 쓰기) 로 바뀌었다. 그래서 A 키 46 개가 Phase 0 상한을 넘는다 — `patchCalls` · `patchSeedCommands` · `patchWrites` · `patchScanCommands` · `contentDamageRenders` · `nodePicture.hits` · `pictureColdInvalidated` 등. `load-same-frame` 의 편집 쪽 키 (`translate*` · `pathSelf*` · `scrollSubtreeVisits` · `propertyNodeReads`) 가 0 에서 오르는 것은 **흡수됐던 편집 22 회가 이제 patch 로 처리된 것** (r1 H3 의 해소 — Phase 0 기준선 값 0 이 결함의 산물). 하향 가능 154 키 · 새 지표 58.
- ratchet (사용자 승인 2026-10-18 「승인한다 raise 진행하고」): `--raise` A 46 (만료 2027-04-18) → `--add-keys render.imageSeedOwners,render.imagePatchSyncs,render.imagePatchFallbackRebind` (A — fallback 상한 0) → `--update` 하향 154 · 새 지표 50. 판정 A · B 초과 0.

**G1-a live** (`apps/builder/scripts/adr270-image-load-live.mjs` — headless Chrome · dev 5173 · `app-pages` 22 페이지 · Image 상자 67 · PNG 22 장 fill · fit · stretch 순환 · 하니스가 한 장씩 풂, oracle = 같은 상태를 다시 묶고 picture 캐시 · viewport 질의 끔): 1 줌 0.3 완료 22 — `rebindOther` 0 · seed 67 · splice 22 · 0 px · 상자 맵 · SpatialIndex 후보 동일 / 2 줌 1 (Home hero 2,048² 반투명 섞임) **완료 통지 task 안의 편집 22** — 편집이 남고 (문서 폭 = 마지막 편집 164) · patch 89 · 0 px / 3 `setImagePartialOff` — 완료마다 `image-loaded` 재바인드 22 · seed 0 · 0 px. **3/3 PASS · 콘솔 오류 0**. 스크린샷으로 hero 상자의 2,048² 그라데이션 + 격자 확인.

- 남은 G1-a 배치 (clip 상자 안 · sticky 헤더 아래 · 반경 상자 · `object-fit: none`) 는 이 fixture 에 없다 — 다음 live (G5 사용자 프로젝트) 와 Phase 2 손계산이 object-fit 을 덮는다.
