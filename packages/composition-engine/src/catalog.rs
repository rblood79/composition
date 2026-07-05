//! ADR-916 P2-CAT ③ — catalog 정적 참조 조회 계층 (Rust 측 완료선).
//!
//! 조상 체인 propagation(`buildSpecNodeData.ts` `getPropagationAncestors` +
//! `applyParentPropagationProps`) 의 tree.rs(2-B) 이관 선결 계약. JS
//! `buildCatalogStaticSnapshot()`(builder 계층 — shared 테이블 + specs resolveToken
//! 동시 import 유일 계층) 이 앱 로드 시 (type×size)→숫자 metrics 스냅샷을 만들고,
//! `initCompositionEngineWasm()` promise 내부에서 이 모듈의 `inject_catalog_snapshot`
//! 으로 WASM 에 **1회 원자 주입**한다(P2-PROP 소유 배선). 본 모듈은 **조회 전용**.
//!
//! ## breakdown §2-CAT 계약 조항 (Rust 이식분)
//!
//! - **조항 1 (사영 = key allowlist)**: `CatalogMetric` 은 `fontSize`/`lineHeight`/
//!   `iconSize` 3 key 만. JS 직렬화가 allowlist 밖(height/borderRadius/indicator)을
//!   이미 제거하므로, Rust 는 그 3 key 만 역직렬화(미존재 필드는 serde `default`=None).
//! - **조항 2 (defaultSize fallback 1급)**: `lookup_catalog_metric(type, size) =
//!   sizes[size] ?? sizes[defaultSize]`. JS `lookupCatalogMetric` 3경로 소비자와 동형.
//!   Negative = "미존재 **type** → None" 만(미존재 size 는 fallback). `defaultSize`
//!   미정의 컴포넌트는 fallback leg 없음(JS 와 동형).
//! - **조항 5 (thread_local static + fail-loud)**: 스냅샷은 per-instance 가 아니라
//!   `thread_local` static(startup 인스턴스 0개). `is_catalog_injected()` 로 주입
//!   여부를 노출 — JS `isAvailable()` 2조건(`engineModule!==null && catalogInjected`)
//!   의 후자를 이 상태가 담당. 미주입 lookup 은 침묵 default 아니라 `None`(호출측
//!   fail-loud 판정용).
//!
//! ## dormant 회피 위상
//!
//! 본 모듈의 조회 로직은 하단 `#[cfg(test)] mod tests`(L2 cargo fixture)가 소비자라
//! **dead 아님**. WASM 주입 인터페이스(`wasm.rs::inject_catalog_snapshot`)는 wasm.rs
//! seam 관습(wrapper 존재 ≠ flag 전환, seam 미배선 유지)을 따르는 의도된 seam —
//! JS init 실배선은 소비 phase P2-PROP 소유(no-dormant-foundation-ahead-of-flip).

use std::cell::RefCell;
use std::collections::HashMap;

use serde::Deserialize;

/// 조항 1 — 사영 대상 allowlist metric. JS `CatalogMetric` 과 동형.
///
/// 3 key 전부 optional(catalog size 마다 존재 필드 상이 — 예: Avatar 는 fontSize 만,
/// Button 은 3 key 전부). serde `default` 로 미존재 필드는 `None`.
#[derive(Debug, Clone, Copy, PartialEq, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogMetric {
    #[serde(default)]
    pub font_size: Option<f32>,
    #[serde(default)]
    pub line_height: Option<f32>,
    #[serde(default)]
    pub icon_size: Option<f32>,
}

/// 단일 컴포넌트 type 스냅샷 — defaultSize(값 보존) + size별 metric.
/// JS `CatalogTypeEntry` 와 동형. `defaultSize` optional(미정의 시 fallback leg 없음).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogTypeEntry {
    #[serde(default)]
    pub default_size: Option<String>,
    pub sizes: HashMap<String, CatalogMetric>,
}

/// type → entry 전체 스냅샷. JS `CatalogStaticSnapshot`(Map) 의 JSON 직렬화 대응.
pub type CatalogSnapshot = HashMap<String, CatalogTypeEntry>;

thread_local! {
    /// 조항 5 — thread_local static(per-instance 아님). init promise 내부 1회 원자 주입.
    /// `None` = 미주입(fail-loud 판정 기준).
    static CATALOG: RefCell<Option<CatalogSnapshot>> = const { RefCell::new(None) };
}

/// JS 스냅샷 JSON(`serializeCatalogSnapshot` 출력) → thread_local static 원자 주입.
///
/// camelCase(`fontSize`/`lineHeight`/`iconSize`/`defaultSize`) JSON key 를 serde
/// `rename` 없이 받기 위해, 역직렬화는 아래 wire 형(`#[serde(rename_all)]`)을 경유한다.
///
/// # Errors
/// JSON 파싱 실패 시 `Err(String)`(no-silent-drop — wasm.rs 관습과 동일).
pub fn inject_catalog_snapshot(json: &str) -> Result<(), String> {
    let snapshot: CatalogSnapshot =
        serde_json::from_str(json).map_err(|e| format!("inject_catalog_snapshot: parse error: {e}"))?;
    CATALOG.with(|c| {
        *c.borrow_mut() = Some(snapshot);
    });
    Ok(())
}

/// 조항 5 — 주입 여부. JS `isAvailable()` 2조건 중 `catalogInjected` 를 담당.
pub fn is_catalog_injected() -> bool {
    CATALOG.with(|c| c.borrow().is_some())
}

/// 조항 2 — defaultSize fallback lookup. `sizes[size] ?? sizes[defaultSize]`.
///
/// JS `lookupCatalogMetric`(builder) + live 소비자 3경로(`buildSpecNodeData:1124` /
/// `implicitStyles:212` / `StoreRenderBridge:553`)와 동형.
///
/// - 미주입 → `None`(조항 5 fail-loud, 침묵 default 아님).
/// - 미존재 **type** → `None`(Negative).
/// - 존재 size → 그 size.
/// - 미존재 size + defaultSize 정의 → defaultSize 값.
/// - 미존재 size + defaultSize 미정의 → `None`(fallback leg 없음).
pub fn lookup_catalog_metric(component_type: &str, size: &str) -> Option<CatalogMetric> {
    CATALOG.with(|c| {
        let borrow = c.borrow();
        let snapshot = borrow.as_ref()?;
        let entry = snapshot.get(component_type)?;
        if let Some(m) = entry.sizes.get(size) {
            return Some(*m);
        }
        let default_size = entry.default_size.as_ref()?;
        entry.sizes.get(default_size).copied()
    })
}

/// thread_local static 초기화(테스트 격리 / HMR 재주입 전 clear 용).
pub fn clear_catalog() {
    CATALOG.with(|c| {
        *c.borrow_mut() = None;
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// L2 fixture — JS `serializeCatalogSnapshot` 출력 형식(camelCase key) 대표 샘플.
    /// Button 5 size(golden 앵커와 동일 손검증값) + Avatar(fontSize 만) 로 조항 1/2/5 를
    /// Rust 측에서 확증한다. JS L1.5 golden 과 **같은 숫자** → 두 언어 lookup 동형 고정.
    const FIXTURE: &str = r#"{
        "Button": {
            "defaultSize": "md",
            "sizes": {
                "xs": {"fontSize": 10, "lineHeight": 16, "iconSize": 14},
                "sm": {"fontSize": 12, "lineHeight": 16, "iconSize": 16},
                "md": {"fontSize": 14, "lineHeight": 20, "iconSize": 18},
                "lg": {"fontSize": 16, "lineHeight": 24, "iconSize": 24},
                "xl": {"fontSize": 18, "lineHeight": 28, "iconSize": 28}
            }
        },
        "Avatar": {
            "defaultSize": "md",
            "sizes": {
                "md": {"fontSize": 14}
            }
        }
    }"#;

    /// defaultSize 미정의 컴포넌트(fallback leg 없음, 조항 2) fixture.
    const FIXTURE_NO_DEFAULT: &str = r#"{
        "Widget": {
            "sizes": {
                "sm": {"fontSize": 12}
            }
        }
    }"#;

    fn inject(json: &str) {
        clear_catalog();
        inject_catalog_snapshot(json).expect("fixture parse");
    }

    // ── 조항 5: 주입 상태 ──

    #[test]
    fn is_injected_false_before_injection() {
        clear_catalog();
        assert!(!is_catalog_injected());
    }

    #[test]
    fn is_injected_true_after_injection() {
        inject(FIXTURE);
        assert!(is_catalog_injected());
    }

    #[test]
    fn lookup_before_injection_is_none_not_silent_default() {
        // 조항 5 fail-loud — 미주입 lookup 은 침묵 default(0 등) 아니라 None.
        clear_catalog();
        assert_eq!(lookup_catalog_metric("Button", "md"), None);
    }

    // ── 조항 1: allowlist key 역직렬화 (camelCase JSON → snake_case field) ──

    #[test]
    fn deserializes_allowlist_keys_camelcase() {
        inject(FIXTURE);
        let md = lookup_catalog_metric("Button", "md").expect("Button md");
        assert_eq!(md.font_size, Some(14.0));
        assert_eq!(md.line_height, Some(20.0));
        assert_eq!(md.icon_size, Some(18.0));
    }

    #[test]
    fn partial_metric_missing_keys_are_none() {
        // Avatar md = fontSize 만 → lineHeight/iconSize None(조항 1 partial).
        inject(FIXTURE);
        let md = lookup_catalog_metric("Avatar", "md").expect("Avatar md");
        assert_eq!(md.font_size, Some(14.0));
        assert_eq!(md.line_height, None);
        assert_eq!(md.icon_size, None);
    }

    // ── 조항 2: defaultSize fallback ──

    #[test]
    fn lookup_existing_size_returns_that_size() {
        inject(FIXTURE);
        let xs = lookup_catalog_metric("Button", "xs").expect("Button xs");
        assert_eq!(xs.font_size, Some(10.0));
        // xs ≠ md(fallback 아님을 확증).
        assert_ne!(xs.font_size, Some(14.0));
    }

    #[test]
    fn lookup_missing_size_falls_back_to_default_size() {
        inject(FIXTURE);
        // Button defaultSize="md". 미존재 "nonexistent" → md 값.
        let fallback = lookup_catalog_metric("Button", "nonexistent").expect("fallback");
        let md = lookup_catalog_metric("Button", "md").expect("md");
        assert_eq!(fallback, md);
        assert_eq!(fallback.font_size, Some(14.0));
    }

    #[test]
    fn lookup_missing_size_no_default_is_none() {
        // 조항 2 — defaultSize 미정의 컴포넌트는 fallback leg 없음.
        inject(FIXTURE_NO_DEFAULT);
        assert!(lookup_catalog_metric("Widget", "sm").is_some());
        assert_eq!(lookup_catalog_metric("Widget", "nonexistent"), None);
    }

    // ── 조항 2: Negative (미존재 type) ──

    #[test]
    fn lookup_missing_type_is_none() {
        inject(FIXTURE);
        assert_eq!(lookup_catalog_metric("DoesNotExist", "md"), None);
    }

    // ── L2: JS golden 앵커 동형 (Button 전 size Rust 대조) ──

    #[test]
    fn button_golden_anchor_matches_js_l1_5() {
        inject(FIXTURE);
        // JS L1.5 golden 과 동일 손검증값 — 두 언어 lookup 결과 동형 고정.
        let want: [(&str, f32, f32, f32); 5] = [
            ("xs", 10.0, 16.0, 14.0),
            ("sm", 12.0, 16.0, 16.0),
            ("md", 14.0, 20.0, 18.0),
            ("lg", 16.0, 24.0, 24.0),
            ("xl", 18.0, 28.0, 28.0),
        ];
        for (size, fs, lh, is) in want {
            let m = lookup_catalog_metric("Button", size).expect(size);
            assert_eq!(m.font_size, Some(fs), "{size} fontSize");
            assert_eq!(m.line_height, Some(lh), "{size} lineHeight");
            assert_eq!(m.icon_size, Some(is), "{size} iconSize");
        }
    }

    // ── no-silent-drop: 파싱 실패는 Err ──

    #[test]
    fn invalid_json_is_err() {
        clear_catalog();
        assert!(inject_catalog_snapshot("{not json").is_err());
        // 실패 시 주입 상태 미변경(None 유지).
        assert!(!is_catalog_injected());
    }
}
