//! ADR-916 Phase 2-B (seam 배선 A) — WASM 바인딩 wrapper.
//!
//! `tree::LayoutTree`(순수 Rust) 를 JS `LayoutEngineAPI`(layoutBridge.ts) 계약으로
//! 노출하는 얇은 wrapper. `taffy_bridge.rs::TaffyLayoutEngine` 과 **동일 메서드
//! 시그니처**를 구현하여 `createLayoutEngine` seam 에 그대로 꽂힌다.
//!
//! ## 설계
//!
//! - **native 무영향**: 모듈 전체가 `#[cfg(target_arch = "wasm32")]` 게이트 —
//!   native `cargo test` 는 `tree::LayoutTree` 순수 API 로 검증(JsValue 는 non-wasm32
//!   에서 panic 하므로 게이트 필수, taffy_bridge.rs:1209-1210 와 동일 이유).
//! - **wrapper 얇게**: 레이아웃 로직은 `LayoutTree` 에 있고, 본 모듈은 (1) JSON
//!   payload → `NodeStyle` 역직렬화, (2) 결과 flat f32 직렬화, (3) 에러 → JsValue
//!   변환만 담당. taffy_bridge 처럼 no-silent-drop(파싱 실패는 Err, unwrap/filter_map
//!   금지).
//! - **binary protocol 미구현**: `has_binary_protocol()` → false 이면 JS(persistent
//!   TaffyTree.buildFull line 141)가 JSON 경로(`build_tree_batch`)로 fallback 하므로
//!   `build_tree_batch_binary` 는 호출되지 않는다(계약 충족용 stub — 호출 시 Err).
//!   Taffy 대비 binary 최적화는 dual-run diff 0 확인 후 별도 착수(no-dormant).
//!
//! ## seam 배선 위상
//!
//! 본 wrapper 는 `LayoutEngineAPI` 를 만족시키는 candidate 엔진 구현일 뿐,
//! `createLayoutEngine` flag 전환(live builder 엔진 교체)은 **별도 게이트**다.
//! dual-run(candidate=본 wrapper vs reference=Taffy)이 self-diff 0 를 통과해야
//! flag 전환 진입(ADR-916 no-dormant-foundation-ahead-of-flip).
//!
//! (모듈 게이트는 lib.rs `#[cfg(target_arch = "wasm32")] pub mod wasm;` 에서 처리 —
//! 여기 `#![cfg]` 중복은 duplicated-attribute 경고라 두지 않음.)

use wasm_bindgen::prelude::*;

use crate::tree::{collect_unknown_keys, LayoutTree};

/// `LayoutEngineAPI`(layoutBridge.ts) 를 구현하는 자체 엔진 wrapper.
///
/// `taffy_bridge.rs::TaffyLayoutEngine` 과 동일 계약 — 두 엔진이 같은 seam 에
/// 교체 가능하게 꽂힌다. 내부는 Taffy 없는 `LayoutTree`.
#[wasm_bindgen]
pub struct LayoutEngine {
    tree: LayoutTree,
}

#[wasm_bindgen]
impl LayoutEngine {
    /// 빈 엔진 생성.
    ///
    /// (`new_without_default` allow: `#[wasm_bindgen(constructor)]` 로 JS `new
    /// LayoutEngine()` 이 유일 생성 경로 — Default 구현 시 wasm-bindgen export 중복.)
    #[allow(clippy::new_without_default)]
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            tree: LayoutTree::new(),
        }
    }

    /// 엔진 사용 가능 여부 (WASM 로드 성공 시 항상 true).
    #[wasm_bindgen(js_name = isAvailable)]
    pub fn is_available(&self) -> bool {
        true
    }

    // ── batch tree 구축 ──

    /// post-order JSON 배열(`[{style, children}, ...]`) → handle 배열.
    ///
    /// # Errors
    /// 파싱 실패 / 자식 인덱스 범위 초과(forward-ref) 시 `Err(JsValue)`.
    #[wasm_bindgen(js_name = buildTreeBatch)]
    pub fn build_tree_batch(&mut self, nodes_json: &str) -> Result<Box<[usize]>, JsValue> {
        self.tree
            .build_tree_batch(nodes_json)
            .map(|v| v.into_boxed_slice())
            .map_err(|e| JsValue::from_str(&e))
    }

    /// binary protocol 미구현 — `has_binary_protocol()` 이 false 이므로 JS 는 이
    /// 메서드를 호출하지 않는다(JSON 경로 fallback). 계약 충족용 stub.
    #[wasm_bindgen(js_name = buildTreeBatchBinary)]
    pub fn build_tree_batch_binary(&mut self, _data: &[u8]) -> Result<Box<[usize]>, JsValue> {
        Err(JsValue::from_str(
            "composition-engine: binary protocol not implemented (use JSON buildTreeBatch)",
        ))
    }

    /// binary protocol 지원 여부 — 자체 엔진은 JSON 경로만(false).
    #[wasm_bindgen(js_name = hasBinaryProtocol)]
    pub fn has_binary_protocol(&self) -> bool {
        false
    }

    // ── strict 입력 (하니스·진단 전용) ──

    /// strict 입력 모드 토글 (기본 false).
    ///
    /// true 면 `buildTreeBatch` 가 엔진이 읽지 않는 키를 만났을 때 조용히 버리지
    /// 않고 오류를 낸다. **production 에서 켜지 말 것** — 미지 키 하나로 레이아웃이
    /// 통째로 실패한다. 켜는 곳은 parity/visual-parity 하니스다.
    #[wasm_bindgen(js_name = setStrictInput)]
    pub fn set_strict_input(&mut self, enabled: bool) {
        self.tree.set_strict_input(enabled);
    }

    /// 현재 strict 입력 모드.
    #[wasm_bindgen(js_name = isStrictInput)]
    pub fn is_strict_input(&self) -> bool {
        self.tree.strict_input()
    }

    /// batch payload 에서 엔진이 읽지 않는 키를 진단한다 (일회성 — hot path 금지).
    ///
    /// 반환: `[{"index":0,"keys":["style.gap"]}, ...]` JSON. 미지 키가 없으면 `[]`.
    ///
    /// # Errors
    /// JSON 파싱 실패 시 `Err(JsValue)`.
    #[wasm_bindgen(js_name = inspectUnknownKeys)]
    pub fn inspect_unknown_keys(&self, nodes_json: &str) -> Result<String, JsValue> {
        let found =
            collect_unknown_keys(nodes_json).map_err(|e| JsValue::from_str(&e))?;
        let payload: Vec<serde_json::Value> = found
            .into_iter()
            .map(|(index, keys)| serde_json::json!({ "index": index, "keys": keys }))
            .collect();
        serde_json::to_string(&payload)
            .map_err(|e| JsValue::from_str(&format!("inspectUnknownKeys: {e}")))
    }

    // ── 증분 갱신 ──

    /// leaf 노드 생성 → handle.
    ///
    /// # Errors
    /// style JSON 파싱 실패 시 `Err(JsValue)`.
    #[wasm_bindgen(js_name = createNodeRaw)]
    pub fn create_node_raw(&mut self, style_json: &str) -> Result<usize, JsValue> {
        let style = serde_json::from_str(style_json)
            .map_err(|e| JsValue::from_str(&format!("createNodeRaw: parse error: {e}")))?;
        Ok(self.tree.create_node(style))
    }

    /// 노드 스타일 교체(dirty 조상 전파).
    ///
    /// # Errors
    /// style JSON 파싱 실패 시 `Err(JsValue)`.
    #[wasm_bindgen(js_name = updateStyleRaw)]
    pub fn update_style_raw(&mut self, handle: usize, style_json: &str) -> Result<(), JsValue> {
        let style = serde_json::from_str(style_json)
            .map_err(|e| JsValue::from_str(&format!("updateStyleRaw: parse error: {e}")))?;
        self.tree.update_style(handle, style);
        Ok(())
    }

    /// 노드 자식 교체(parent 배선 + dirty 조상 전파).
    #[wasm_bindgen(js_name = setChildren)]
    pub fn set_children(&mut self, handle: usize, children: &[usize]) {
        self.tree.set_children(handle, children.to_vec());
    }

    /// 노드 dirty 표시(조상 전파).
    #[wasm_bindgen(js_name = markDirty)]
    pub fn mark_dirty(&mut self, handle: usize) {
        self.tree.mark_dirty(handle);
    }

    /// 노드 제거 + handle 재활용.
    #[wasm_bindgen(js_name = removeNode)]
    pub fn remove_node(&mut self, handle: usize) {
        self.tree.remove_node(handle);
    }

    // ── 레이아웃 계산/수집 ──

    /// `root` 를 뿌리로 트리 레이아웃 계산.
    #[wasm_bindgen(js_name = computeLayout)]
    pub fn compute_layout(&mut self, root: usize, avail_w: f32, avail_h: f32) {
        self.tree.compute_layout(root, avail_w, avail_h);
    }

    /// 여러 노드 레이아웃을 flat `[x0,y0,w0,h0,b0, x1,...]` 로 수집
    /// (ADR-923 Phase 2 — handle 당 **5값**, b = baseline: 원천 없으면 height 폴백).
    ///
    /// JS(`getLayoutsBatch`)는 이 flat Float32Array 를 handle 순서로 슬라이스해
    /// `Map<handle, LayoutResult>` 로 재구성한다(compositionEngine.ts flatToLayoutMap).
    #[wasm_bindgen(js_name = getLayoutsBatch)]
    pub fn get_layouts_batch(&self, handles: &[usize]) -> Box<[f32]> {
        self.tree.get_layouts_batch(handles).into_boxed_slice()
    }

    /// 단일 노드 레이아웃 JSON(`{"x":..,"y":..,"width":..,"height":..,"baseline":..}`).
    ///
    /// baseline 은 경계 계약값 (ADR-923 Phase 2 — 원천 없으면 height 폴백).
    #[wasm_bindgen(js_name = getLayout)]
    pub fn get_layout(&self, handle: usize) -> String {
        let l = self.tree.get_layout(handle);
        format!(
            r#"{{"x":{},"y":{},"width":{},"height":{},"baseline":{}}}"#,
            l.x,
            l.y,
            l.width,
            l.height,
            l.resolved_baseline()
        )
    }

    // ── 판정 트레이스 (ADR-183 Phase 2 — 디버그 채널) ──

    /// 트레이스 게이트 토글. enable 시에만 sink 를 할당하고 disable 은 즉시
    /// 해제한다 (R3 — off 시 WASM 힙 0).
    ///
    /// **배치 프로토콜과 무관한 별도 API 다 (HC3)** — `build_tree_batch` /
    /// binary_protocol payload 에는 트레이스가 실리지 않는다.
    #[wasm_bindgen(js_name = enableLayoutTrace)]
    pub fn enable_layout_trace(&mut self, enabled: bool) {
        if enabled {
            self.tree.enable_trace();
        } else {
            self.tree.disable_trace();
        }
    }

    /// 노드 판정 트레이스 JSON (`{"handle","enabled","dropped","events"}`).
    ///
    /// 스키마 계약은 `tree.rs::trace_json` 의 native 테스트가 잠근다 — 본 메서드는
    /// wasm32 게이트라 여기서 검증하지 않는다.
    #[wasm_bindgen(js_name = getLayoutTrace)]
    pub fn get_layout_trace(&self, handle: usize) -> String {
        self.tree.trace_json(handle)
    }

    // ── 상태 ──

    /// 전체 트리 초기화.
    pub fn clear(&mut self) {
        self.tree.clear();
    }

    /// 살아있는 노드 수.
    #[wasm_bindgen(js_name = nodeCount)]
    pub fn node_count(&self) -> usize {
        self.tree.node_count()
    }
}
