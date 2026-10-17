/**
 * ADR-263 Phase 0 — 그리기 명령 층의 결정적 카운트 (ADR-264 Phase 0 — patch 분해 · 재바인드 사유).
 *
 * 프레임 하니스 (`perf-baseline.mjs` frame lane) 가 부류마다 reset → snapshot 해
 * `results.<부류>.counts.counters` 로 기록하고, ratchet (ADR-246) 이 그 값을 상한으로 막는다.
 * 호출부는 전부 `process.env.NODE_ENV === "development"` 게이트 안이라 production 빌드에서는
 * 사라진다. 고정 필드에 정수만 더한다 — 명령 하나마다 지나는 자리라 Map 조회를 두지 않는다.
 */
export interface RenderCounters {
  /** executeCommandRange 가 지난 명령 수 (record 재진입 포함). */
  execVisited: number;
  /** 그중 컬링 · 숨김으로 건너뛴 서브트리 안에서 소비한 명령 수. */
  execSkipped: number;
  /** 노드 picture 재생으로 건너뛴 self-draw 명령 수 (방문하지 않은 명령). */
  execPictureJumped: number;
  /** 컬링 · 숨김 서브트리를 끝으로 점프해 방문하지 않은 명령 수 (ADR-263 Phase 2). */
  execCulledJumped: number;
  /** full 재기록이 viewport 공간 질의 sequence 로 실행된 횟수. */
  viewportSequences: number;
  /** 공간 질의를 쓸 수 없어 선형 실행으로 간 횟수. */
  viewportFallbacks: number;
  /** content 재기록 중 damage 부분 재기록으로 끝난 수 (ADR-263 Phase 3). */
  contentDamageRenders: number;
  /** damage 가 있었으나 full 로 간 수 (전제 불충족 · 실패). */
  contentDamageFallbacks: number;
  /** full 재기록 수. */
  contentFullRenders: number;
  /** executeRenderCommands 호출 수. */
  execCalls: number;
  /** piece-table Proxy 의 index 읽기 수. */
  bufferProxyReads: number;
  /** executeRenderCommands 호출 시점의 segment 수 합계 (평평한 배열이면 0). */
  bufferSegmentsAtExec: number;
  /** scroll/auto 상자 extent 의 전체 descent 가 방문한 자손 수. */
  scrollRangeVisits: number;
  /** 전체 descent 횟수 (ADR-263 Phase 4 전에는 범위 계산마다 한 번). */
  scrollRangeCalls: number;
  /** extent 증분 갱신이 읽은 바뀐 서브트리 노드 수 (전 · 후 합). */
  scrollSubtreeVisits: number;
  /** applyCommitSubtreeCommandPatch 검증이 읽은 명령 수 (span 순회 합). */
  patchScanCommands: number;
  /** applyCommitSubtreeCommandPatch 호출 수. */
  patchCalls: number;
  /** 성공한 patch 의 교체 명령 수 (patch root 서브트리 크기). */
  patchWrites: number;
  /**
   * ADR-264 Phase 0 — patch 교체 명령 (`patchWrites`) 의 분해. 다섯 몫의 합 = `patchWrites`.
   * seed: record 가 바뀐 노드 (· 구조 region) 의 서브트리.
   */
  patchSeedCommands: number;
  /** 바뀐 상자의 조상 경로 · 크기가 바뀐 상자의 자기 명령 (서브트리 span − 자식 서브트리 span). */
  patchPathCommands: number;
  /** 자리만 옮긴 서브트리 (x · y 만 다름 — 크기 · 엔진 입력 · 자손 rect 불변). */
  patchMovedOnlyCommands: number;
  patchMovedOnlyNodes: number;
  /** 그중 부모 상자의 크기도 바뀐 것 (부모가 clip 하면 바깥 clip 이 같이 바뀐다). */
  patchMovedUnderResizedCommands: number;
  /** rect 가 그대로인 형제 서브트리 (region 이 부모로 올라가 같이 다시 기록된 것). */
  patchUnchangedCommands: number;
  /** x · y 만 바뀐 후보인데 엔진이 자손 rect 를 바꾼 노드 수 (R3 — 옮기기 후보에서 빠진다). */
  patchMovedDescendantChanged: number;
  /** 사유별 scene 재바인드 수 (`canvasScene.ts` rebind). page grid = 자동 열 수 · page grid 편집. */
  rebindPageGrid: number;
  rebindOther: number;
  /** page grid 재바인드 중 page root 의 크기가 바뀐 재바인드 수 (R4 — 옮기기로 못 대신하는 것). */
  pageGridResized: number;
  /** page grid 재바인드에서 위치가 바뀐 page root 수. */
  pageGridMovedRoots: number;
  /** ADR-264 옮기기 (`subtreeTranslate.ts`) — 적용 수 · 옮긴 요소 수 · SpatialIndex upsert 수. */
  translateCalls: number;
  translateNodes: number;
  translateIndexUpserts: number;
  /** ADR-264 Phase 2 — 자기 명령만 다시 쓴 경로 노드 수 · 쓴 명령 수. */
  pathSelfPatches: number;
  pathSelfWrites: number;
  /**
   * `placeRegion` 이 계획을 접고 그 자리 서브트리를 다시 기록한 사유 — seed 의 문맥이 바뀜 ·
   * 옮기기 불가 (`checkTranslate`) · 자기 명령 모양이 바뀜 · 자식 계획 실패.
   */
  placeFallbackSeedContext: number;
  placeFallbackTranslate: number;
  placeFallbackShape: number;
  placeFallbackChild: number;
  /**
   * ADR-266 Phase 0 — `movePageRoots` 가 null 을 돌려 page grid 재바인드로 간 사유. 대기 delta ·
   * root 상자 없음 · 크기 변화 · 옮길 수 없는 root (`checkTranslate` 사유별 — 그 호출의 첫 root).
   */
  pageGridMoveNullDirty: number;
  pageGridMoveNullMissing: number;
  pageGridMoveNullResized: number;
  pageGridMoveNullSubtreeContext: number;
  pageGridMoveNullTopLayer: number;
  pageGridMoveNullDragOffset: number;
  pageGridMoveNullMissingSpan: number;
  pageGridMoveNullInvalidSpan: number;
  pageGridMoveNullFixedOrSticky: number;
  /** 그 호출에서 옮길 수 없던 root 수 (옮길 수 있던 root 수 — 「안 되는 것만」 재바인드의 몫). */
  pageGridMoveBlockedRoots: number;
  pageGridMoveMovableRoots: number;
  /**
   * 재바인드 해제 구간 (`scene.rebind` 의 `dispose`) 이 버린 picture entry · paragraph 수 — page grid
   * 재바인드와 그 밖의 사유로 나눈다. `rebindSameContent` = 새 bind 가 같은 id 로 다시 등록한 데이터가
   * 옛 데이터와 그리기 내용이 같은 수 (인계 가능량의 상한).
   */
  rebindReleasedPicturesPageGrid: number;
  rebindReleasedPicturesOther: number;
  rebindReleasedParagraphsPageGrid: number;
  rebindReleasedParagraphsOther: number;
  rebindReregistered: number;
  rebindSameContent: number;
  /** picture miss `cold` 의 사유 — 처음 · 퇴거 · 재바인드 해제 · 내용 교체 등 무효화 · 전량 폐기. */
  pictureColdFirst: number;
  pictureColdEvicted: number;
  pictureColdReleased: number;
  pictureColdInvalidated: number;
  pictureColdCleared: number;
  /** picture LRU 퇴거 수 (상한 초과). */
  pictureEvictions: number;
  /** ADR-266 Phase 4: idle 미리 기록이 새로 기록한 picture 수 (`nodePictureWarmup`). */
  pictureWarmRecorded: number;
  /** paragraph miss 사유 — 처음 · 슬롯 해제 뒤 (노드 교체 · 재바인드) · 키 다름 · fontMgr 다름. */
  paragraphMissFirst: number;
  paragraphMissReleased: number;
  paragraphMissKey: number;
  paragraphMissFontMgr: number;
  /** viewport 공간 질의 경로가 선형으로 간 사유 (`executeViewportRenderCommands`). */
  viewportFallbackLinearOnly: number;
  viewportFallbackNoIndex: number;
  viewportFallbackUnsafePaint: number;
  viewportFallbackDragOffset: number;
  viewportFallbackHalfRule: number;
  viewportFallbackNoSequence: number;
  /**
   * content full 기록이 picture 로 지나간 요소 수 (hit + record = working set) · 그중 새로 record 한 수 ·
   * paragraph 를 새로 만든 수 · 한 번의 full 기록에서 지나간 최대 수 (상한 1,024 대비). damage 부분
   * 기록은 따로 센다.
   */
  contentTouchedElements: number;
  contentTouchedMax: number;
  contentRecordedElements: number;
  contentRecordedText: number;
  damageTouchedElements: number;
  /** ADR-266 Phase 4 — 옮기기 검사 (`checkTranslate`) 가 훑은 명령 수. */
  translateCheckCommands: number;
  /**
   * ADR-269 Phase 0 — 요소 스크롤이 다시 기록한 명령 수 (스크롤된 상자를 덮는 patch root 의 쓰기) ·
   * 그 patch 를 낸 update 수.
   */
  scrollRecordCommands: number;
  scrollRecordCalls: number;
  /** `splice-rejected:<reason>` 재바인드를 사유별로 — clip 문맥 · scroll 문맥 · 그 밖. */
  rebindSpliceRejectedClipContext: number;
  rebindSpliceRejectedScrollContext: number;
  rebindSpliceRejectedOther: number;
  /** 옮기기가 쓴 맵 항목 수 (bounds · clipContext · buildContext · hit — 요소당 3 ~ 4) + root 명령 1. */
  translateMapWrites: number;
  /** 실행기 · damage · 검사가 property node 테이블을 읽은 횟수 (ADR-269 Phase 1 부터 — HC4). */
  propertyNodeReads: number;
  /**
   * ADR-269 Phase 1 — 스크롤이 자손 맵을 옮긴 비용 (`applyScrollDelta` — 옮기기와 같은 기계): 적용 수 ·
   * 옮긴 요소 수 · 맵 쓰기 수 · SpatialIndex upsert 수. 그리고 sticky 처럼 옮길 수 없어 다시 기록한
   * 자식 서브트리 수.
   */
  scrollDeltaCalls: number;
  scrollDeltaNodes: number;
  scrollDeltaMapWrites: number;
  scrollDeltaIndexUpserts: number;
  scrollDeltaRerecords: number;
  /**
   * ADR-270 Phase 0 — 이미지 로드 경로. `image-loaded` 사유의 재바인드 수 (`rebindOther` 에도 들어 있다)
   * · 그 재바인드가 버린 picture · paragraph (`rebindReleased*Other` 에도 들어 있다) · `MakeImageFromEncoded`
   * 호출 수 · 완료 통지 수 (캐시 등록 = 이미지 처리 1 회) · 한 프레임에 처리한 완료 수의 최대.
   */
  rebindImageLoaded: number;
  rebindReleasedPicturesImageLoaded: number;
  rebindReleasedParagraphsImageLoaded: number;
  imageEncodedDecodeCalls: number;
  imageCompletions: number;
  imageLoadedPerFrameMax: number;
  /**
   * ADR-270 Phase 1 — 완료 = 소유 요소 seed. sync 에 넘긴 소유 요소 수 · seed 를 담은 sync 가 patch 로
   * 끝난 수 · 재바인드로 끝난 수 (splice 거부 · page root 변경 — 사유는 `rebind*` 쪽에).
   */
  imageSeedOwners: number;
  imagePatchSyncs: number;
  imagePatchFallbackRebind: number;
  /**
   * ADR-270 Phase 3a — 디코딩 = 브라우저 코덱 (`createImageBitmap`, 메인 밖). GPU surface 의 texture-backed
   * 이미지 수 (텍스처는 그리는 context 에 lazy 업로드) · SW surface 폴백 수 · 그 폴백의 readback 바이트
   * (2D canvas 에 그린 뒤 `getImageData` → WASM 복사, 메인).
   */
  imageTextureImages: number;
  imageSwFallbacks: number;
  imageReadbackBytes: number;
  /**
   * ADR-273 Phase 2 — GL context 소유 (`createSurface.ts` `CanvasSurfaceOwner`). 만든 · 지운 GL 핸들 수
   * (산 context 는 resize 에서 재사용 — 늘어나는 것은 첫 생성 · 복원뿐) · 프레임 끝 GrDirectContext 캐시
   * 사용 바이트 고수위 · 사용량이 한도의 90 % 를 넘은 프레임 수 (HC4 여유 규칙).
   */
  gpuContextsCreated: number;
  gpuContextsDeleted: number;
  grCacheUsageMax: number;
  grCacheNearLimitFrames: number;
  /**
   * ADR-273 Phase 0 — content 여백. 팬이 스냅샷 (main + 여백 × 2) 밖으로 나가 content 를 다시 기록한 수
   * (`coverage-refresh`) · 줌을 바꾸지 않은 카메라 이동 프레임 수와 그 프레임의 이동 거리 (device px, 축별
   * 큰 쪽) 분포 · 최대 · 프레임 끝 화면 · content surface 바이트 고수위 (규격 × 4 B — GPU 실사용량이 아니다).
   */
  contentRedrawsOutOfPad: number;
  panFrames: number;
  panDeviceLe16: number;
  panDeviceLe32: number;
  panDeviceLe64: number;
  panDeviceLe128: number;
  panDeviceGt128: number;
  panDeviceMax: number;
  surfaceBytesMax: number;
}

const counters: RenderCounters = {
  execVisited: 0,
  execSkipped: 0,
  execPictureJumped: 0,
  execCulledJumped: 0,
  viewportSequences: 0,
  viewportFallbacks: 0,
  contentDamageRenders: 0,
  contentDamageFallbacks: 0,
  contentFullRenders: 0,
  execCalls: 0,
  bufferProxyReads: 0,
  bufferSegmentsAtExec: 0,
  scrollRangeVisits: 0,
  scrollRangeCalls: 0,
  scrollSubtreeVisits: 0,
  patchScanCommands: 0,
  patchCalls: 0,
  patchWrites: 0,
  patchSeedCommands: 0,
  patchPathCommands: 0,
  patchMovedOnlyCommands: 0,
  patchMovedOnlyNodes: 0,
  patchMovedUnderResizedCommands: 0,
  patchUnchangedCommands: 0,
  patchMovedDescendantChanged: 0,
  rebindPageGrid: 0,
  rebindOther: 0,
  pageGridResized: 0,
  pageGridMovedRoots: 0,
  translateCalls: 0,
  translateNodes: 0,
  translateIndexUpserts: 0,
  pathSelfPatches: 0,
  pathSelfWrites: 0,
  placeFallbackSeedContext: 0,
  placeFallbackTranslate: 0,
  placeFallbackShape: 0,
  placeFallbackChild: 0,
  pageGridMoveNullDirty: 0,
  pageGridMoveNullMissing: 0,
  pageGridMoveNullResized: 0,
  pageGridMoveNullSubtreeContext: 0,
  pageGridMoveNullTopLayer: 0,
  pageGridMoveNullDragOffset: 0,
  pageGridMoveNullMissingSpan: 0,
  pageGridMoveNullInvalidSpan: 0,
  pageGridMoveNullFixedOrSticky: 0,
  pageGridMoveBlockedRoots: 0,
  pageGridMoveMovableRoots: 0,
  rebindReleasedPicturesPageGrid: 0,
  rebindReleasedPicturesOther: 0,
  rebindReleasedParagraphsPageGrid: 0,
  rebindReleasedParagraphsOther: 0,
  rebindReregistered: 0,
  rebindSameContent: 0,
  pictureColdFirst: 0,
  pictureColdEvicted: 0,
  pictureColdReleased: 0,
  pictureColdInvalidated: 0,
  pictureColdCleared: 0,
  pictureEvictions: 0,
  pictureWarmRecorded: 0,
  paragraphMissFirst: 0,
  paragraphMissReleased: 0,
  paragraphMissKey: 0,
  paragraphMissFontMgr: 0,
  viewportFallbackLinearOnly: 0,
  viewportFallbackNoIndex: 0,
  viewportFallbackUnsafePaint: 0,
  viewportFallbackDragOffset: 0,
  viewportFallbackHalfRule: 0,
  viewportFallbackNoSequence: 0,
  contentTouchedElements: 0,
  contentTouchedMax: 0,
  contentRecordedElements: 0,
  contentRecordedText: 0,
  damageTouchedElements: 0,
  translateCheckCommands: 0,
  scrollRecordCommands: 0,
  scrollRecordCalls: 0,
  rebindSpliceRejectedClipContext: 0,
  rebindSpliceRejectedScrollContext: 0,
  rebindSpliceRejectedOther: 0,
  translateMapWrites: 0,
  propertyNodeReads: 0,
  scrollDeltaCalls: 0,
  scrollDeltaNodes: 0,
  scrollDeltaMapWrites: 0,
  scrollDeltaIndexUpserts: 0,
  scrollDeltaRerecords: 0,
  rebindImageLoaded: 0,
  rebindReleasedPicturesImageLoaded: 0,
  rebindReleasedParagraphsImageLoaded: 0,
  imageEncodedDecodeCalls: 0,
  imageCompletions: 0,
  imageLoadedPerFrameMax: 0,
  imageSeedOwners: 0,
  imagePatchSyncs: 0,
  imagePatchFallbackRebind: 0,
  imageTextureImages: 0,
  imageSwFallbacks: 0,
  imageReadbackBytes: 0,
  gpuContextsCreated: 0,
  gpuContextsDeleted: 0,
  grCacheUsageMax: 0,
  grCacheNearLimitFrames: 0,
  contentRedrawsOutOfPad: 0,
  panFrames: 0,
  panDeviceLe16: 0,
  panDeviceLe32: 0,
  panDeviceLe64: 0,
  panDeviceLe128: 0,
  panDeviceGt128: 0,
  panDeviceMax: 0,
  surfaceBytesMax: 0,
};

/**
 * ADR-266 Phase 0 — 지금 실행 중인 content 기록의 종류 (full · damage). picture · paragraph 경로가
 * 기록당 요소 수를 이 구간에 더한다. dev 게이트 안에서만 바뀐다.
 */
export const renderScope: {
  kind: "full" | "damage" | null;
  touched: number;
} = { kind: null, touched: 0 };

export function beginContentScope(kind: "full" | "damage"): void {
  renderScope.kind = kind;
  renderScope.touched = 0;
}

export function endContentScope(): void {
  if (
    renderScope.kind === "full" &&
    renderScope.touched > counters.contentTouchedMax
  )
    counters.contentTouchedMax = renderScope.touched;
  renderScope.kind = null;
  renderScope.touched = 0;
}

/** 카운터 객체 — 호출부가 필드를 직접 더한다 (dev 게이트 안에서만). */
export const renderCounters: RenderCounters = counters;

export function snapshotRenderCounters(): RenderCounters {
  return { ...counters };
}

export function resetRenderCounters(): void {
  for (const key of Object.keys(counters) as Array<keyof RenderCounters>)
    counters[key] = 0;
}

/**
 * live 픽셀 대조용 스위치 (dev 전용) — 같은 상태를 다른 경로로 그려 비교한다.
 * `linearOnly`: full 재기록이 viewport 공간 질의 대신 선형 실행 (컬링 점프 없음) 으로 간다.
 * `damageOff`: damage 부분 재기록 대신 full 로 그린다.
 * `translateOff`: ADR-264 옮기기 · 경로 자기 patch 대신 region 전체를 다시 기록한다 (지금까지의 길).
 * `propertyNodesOff`: ADR-269 스크롤이 자손 맵 Δ 대신 소유자 서브트리를 다시 기록한다 (지금까지의 길).
 * `imagePartialOff`: ADR-270 이미지 완료가 소유 요소 splice 대신 scene 전체를 다시 묶는다 (지금까지의 길).
 * `imageDecoderLegacy`: ADR-270 이미지를 `MakeImageFromEncoded` (WASM 코덱 · 첫 그리기에 메인에서 디코딩) 로
 *   만든다 (지금까지의 길). 다음 로드부터 적용된다.
 * `legacySurface`: ADR-273 화면 surface 를 `MakeWebGLCanvasSurface` 로 만든다 (호출마다 새 context — 지금까지의 길).
 *   다음 resize 부터 적용된다.
 */
export const renderDebug = {
  linearOnly: false,
  damageOff: false,
  translateOff: false,
  propertyNodesOff: false,
  imagePartialOff: false,
  imageDecoderLegacy: false,
  legacySurface: false,
};

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  const debug = ((
    window as unknown as Record<string, unknown>
  ).__composition_RENDER_PATH_DEBUG__ ??= {}) as Record<string, unknown>;
  debug.setLinearOnly = (on: boolean) => {
    renderDebug.linearOnly = on;
  };
  debug.setDamageOff = (on: boolean) => {
    renderDebug.damageOff = on;
  };
  debug.setTranslateOff = (on: boolean) => {
    renderDebug.translateOff = on;
  };
  debug.setPropertyNodesOff = (on: boolean) => {
    renderDebug.propertyNodesOff = on;
  };
  debug.setImagePartialOff = (on: boolean) => {
    renderDebug.imagePartialOff = on;
  };
  debug.setImageDecoderLegacy = (on: boolean) => {
    renderDebug.imageDecoderLegacy = on;
  };
  debug.setLegacySurface = (on: boolean) => {
    renderDebug.legacySurface = on;
  };
  (
    window as unknown as {
      __composition_RENDER_COUNTERS__?: {
        snapshot: typeof snapshotRenderCounters;
        reset: typeof resetRenderCounters;
      };
    }
  ).__composition_RENDER_COUNTERS__ = {
    snapshot: snapshotRenderCounters,
    reset: resetRenderCounters,
  };
}
