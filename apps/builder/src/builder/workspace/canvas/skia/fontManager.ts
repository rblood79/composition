/**
 * CanvasKit 폰트 관리
 *
 * CanvasKit은 CSS @font-face를 사용할 수 없으므로
 * .woff2/.ttf 바이너리를 직접 로드하고 Typeface를 등록해야 한다.
 * IndexedDB에 폰트 바이너리를 캐싱하여 재방문 시 네트워크 요청을 줄인다.
 *
 * 동일 패밀리의 여러 weight/style 변형을 지원한다 (non-variable font).
 * 내부 키: "family::weight::style" 복합키로 각 변형을 구분한다.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §5.7 폰트 관리
 */

import type { FontMgr, Typeface } from "canvaskit-wasm";
import { getCanvasKit } from "./initCanvasKit";

const IDB_NAME = "composition-fonts";
const IDB_VERSION = 2; // v2: 이전 잘못된 서브셋 캐시 무효화
const IDB_STORE = "fonts";

interface FontCacheEntry {
  /** IDB keyPath — 복합키 "family::weight::style" */
  family: string;
  /** 원본 URL — URL 변경 시 캐시 무효화에 사용 */
  url?: string;
  buffer: ArrayBuffer;
  timestamp: number;
}

/**
 * 복합키 생성: "family::weight::style"
 * Pretendard 등 단일 로드 시 weight/style 미지정 → "family::400::normal"
 */
function makeKey(family: string, weight?: string, style?: string): string {
  return `${family}::${weight ?? "400"}::${style ?? "normal"}`;
}

/** 복합키에서 family 부분만 추출 */
function familyFromKey(key: string): string {
  return key.split("::")[0];
}

/**
 * CanvasKit용 폰트 매니저.
 *
 * 사용법:
 * ```ts
 * const fm = new SkiaFontManager();
 * await fm.loadFont('Pretendard', '/fonts/Pretendard-Regular.woff2');
 * fm.loadFontFromBuffer('Nanum Gothic', boldBuffer, '700');
 * const fontMgr = fm.getFontMgr();
 * ```
 */
export class SkiaFontManager {
  private fontMgr: FontMgr | null = null;
  /** 복합키 → Typeface */
  private typefaces: Map<string, Typeface> = new Map();
  /** 복합키 → ArrayBuffer */
  private buffers: Map<string, ArrayBuffer> = new Map();
  /** userFamily → CanvasKit 내부 폰트 이름 매핑 (바이너리 name 테이블 기준) */
  private nameMap: Map<string, string> = new Map();
  private dirty = true;

  /**
   * 폰트를 로드하고 CanvasKit Typeface로 등록한다.
   *
   * 1. IndexedDB 캐시 확인
   * 2. 캐시 미스 시 네트워크 fetch
   * 3. Typeface 생성 + IndexedDB 저장
   */
  async loadFont(
    family: string,
    url: string,
    weight?: string,
    style?: string,
  ): Promise<void> {
    const key = makeKey(family, weight, style);
    if (this.typefaces.has(key)) return;

    let buffer = await this.getFromCache(key, url);

    if (!buffer) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Font fetch 실패: ${family} (${url}) — ${response.status}`,
        );
      }
      buffer = await response.arrayBuffer();
      await this.saveToCache(key, buffer, url);
    }

    const ck = getCanvasKit();
    const typeface = ck.Typeface.MakeFreeTypeFaceFromData(buffer);
    if (!typeface) {
      throw new Error(`Typeface 생성 실패: ${family}`);
    }

    this.typefaces.set(key, typeface);
    this.buffers.set(key, buffer);
    this.extractAndMapName(family, buffer);
    this.dirty = true;
  }

  /**
   * ArrayBuffer로부터 직접 폰트를 로드한다.
   * data-url-temp 소스에서 base64 디코딩 후 사용.
   */
  loadFontFromBuffer(
    family: string,
    buffer: ArrayBuffer,
    weight?: string,
    style?: string,
  ): void {
    const key = makeKey(family, weight, style);
    if (this.typefaces.has(key)) return;

    const ck = getCanvasKit();
    const typeface = ck.Typeface.MakeFreeTypeFaceFromData(buffer);
    if (!typeface) {
      throw new Error(`Typeface 생성 실패: ${family}`);
    }

    this.typefaces.set(key, typeface);
    this.buffers.set(key, buffer);
    this.extractAndMapName(family, buffer);
    this.dirty = true;

    // IndexedDB 캐싱 (fire-and-forget)
    this.saveToCache(key, buffer).catch(() => {});
  }

  /** family 이름으로 시작하는 모든 복합키를 반환 */
  private keysForFamily(family: string): string[] {
    const prefix = family + "::";
    const keys: string[] = [];
    for (const key of this.typefaces.keys()) {
      if (key.startsWith(prefix)) keys.push(key);
    }
    return keys;
  }

  /**
   * 특정 폰트 패밀리의 모든 변형을 언로드한다.
   * Typeface 메모리 해제 + FontMgr 재구성 트리거.
   */
  unloadFont(family: string): void {
    const keys = this.keysForFamily(family);
    for (const key of keys) {
      this.typefaces.get(key)!.delete();
      this.typefaces.delete(key);
      this.buffers.delete(key);
    }
    if (keys.length > 0) {
      this.nameMap.delete(family);
      this.dirty = true;
    }
  }

  /**
   * 등록된 모든 폰트로 구성된 FontMgr을 반환한다.
   * ParagraphBuilder에서 사용한다.
   */
  getFontMgr(): FontMgr {
    if (this.fontMgr && !this.dirty) return this.fontMgr;

    const ck = getCanvasKit();
    const bufferArray = Array.from(this.buffers.values());

    // 이전 FontMgr 해제
    if (this.fontMgr) {
      this.fontMgr.delete();
    }

    if (bufferArray.length === 0) {
      this.fontMgr = null;
      this.dirty = false;
      throw new Error(
        "폰트가 로드되지 않았습니다. loadFont()를 먼저 호출하세요.",
      );
    }

    const mgr = ck.FontMgr.FromData(...bufferArray);
    if (!mgr) {
      throw new Error("FontMgr 생성 실패");
    }
    this.fontMgr = mgr;
    this.dirty = false;

    return this.fontMgr;
  }

  /**
   * dirty 상태면 FontMgr을 즉시 재구축한다 — rAF 프레임 밖 선재구축용.
   *
   * getFontMgr()의 lazy 재구축(FromData 전체 재파싱)은 수백 ms 급이라
   * 렌더 루프의 프레임 안에서 지불되면 draw 비용과 한 프레임에 겹친다.
   * 폰트 배치 로드가 끝나는 지점(loadAllCustomFontsToSkia /
   * syncCustomFontsWithSkia)에서 이 메서드를 호출해 재구축을 프레임 밖
   * 태스크로 옮긴다. getFontMgr()의 lazy 경로는 안전망으로 유지된다.
   */
  warmFontMgr(): void {
    if (!this.dirty || this.buffers.size === 0) return;
    try {
      this.getFontMgr();
    } catch {
      // 재구축 실패 시 렌더 루프의 lazy 경로가 재시도한다
    }
  }

  /**
   * 사용자 폰트 이름 → CanvasKit FontMgr이 인식하는 내부 이름으로 변환.
   * 폰트 바이너리 내장 이름과 사용자가 지정한 이름이 다를 수 있으므로
   * ParagraphBuilder의 fontFamilies에 이 메서드를 통해 변환된 이름을 전달해야 한다.
   */
  resolveFamily(family: string): string {
    return this.nameMap.get(family) ?? family;
  }

  /**
   * 특정 폰트 변형이 로드되었는지 확인.
   * weight/style 미지정 시 해당 패밀리의 아무 변형이라도 있으면 true.
   */
  hasFont(family: string, weight?: string, style?: string): boolean {
    if (weight !== undefined || style !== undefined) {
      return this.typefaces.has(makeKey(family, weight, style));
    }
    // family-only: 아무 변형이라도 존재하는지 확인
    return this.keysForFamily(family).length > 0;
  }

  /** 로드된 고유 폰트 패밀리 목록 (중복 제거) */
  getFamilies(): string[] {
    const families = new Set<string>();
    for (const key of this.typefaces.keys()) {
      families.add(familyFromKey(key));
    }
    return Array.from(families);
  }

  /**
   * 특정 폰트 패밀리의 Typeface를 반환한다.
   * weight/style 미지정 시 해당 패밀리의 첫 번째 변형 반환.
   */
  getTypeface(
    family: string,
    weight?: string,
    style?: string,
  ): Typeface | undefined {
    if (weight !== undefined || style !== undefined) {
      return this.typefaces.get(makeKey(family, weight, style));
    }
    const key = this.keysForFamily(family)[0];
    return key !== undefined ? this.typefaces.get(key) : undefined;
  }

  /** 모든 리소스 해제 */
  dispose(): void {
    for (const typeface of this.typefaces.values()) {
      typeface.delete();
    }
    this.typefaces.clear();
    this.buffers.clear();
    this.nameMap.clear();

    if (this.fontMgr) {
      this.fontMgr.delete();
      this.fontMgr = null;
    }
    this.dirty = true;
  }

  /**
   * 폰트 바이너리에서 내장 패밀리 이름을 추출하여 nameMap에 저장.
   * CanvasKit FontMgr.FromData()는 바이너리 name 테이블의 이름을 사용하므로
   * 사용자 지정 이름과 다를 수 있다.
   * 같은 family에 대해 이미 매핑이 있으면 스킵.
   */
  private extractAndMapName(family: string, buffer: ArrayBuffer): void {
    if (this.nameMap.has(family)) return;
    try {
      const ck = getCanvasKit();
      const tempMgr = ck.FontMgr.FromData(buffer);
      if (!tempMgr) return;
      if (tempMgr.countFamilies() > 0) {
        const embeddedName = tempMgr.getFamilyName(0);
        if (embeddedName && embeddedName !== family) {
          this.nameMap.set(family, embeddedName);
        }
      }
      tempMgr.delete();
    } catch {
      // 이름 추출 실패 시 family 그대로 사용
    }
  }

  // ============================================
  // IndexedDB 캐싱
  // ============================================

  /** 캐시된 IDB 연결 (매 호출마다 새로 열지 않음) */
  private dbInstance: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async openDB(): Promise<IDBDatabase> {
    // 기존 연결 재사용
    if (this.dbInstance) return this.dbInstance;
    // 열기 진행 중이면 대기
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "family" });
        }
      };

      request.onsuccess = () => {
        this.dbInstance = request.result;
        // 연결 끊김 시 캐시 무효화
        this.dbInstance.onclose = () => {
          this.dbInstance = null;
          this.dbPromise = null;
        };
        resolve(this.dbInstance);
      };
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  private async getFromCache(
    key: string,
    expectedUrl?: string,
  ): Promise<ArrayBuffer | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(key);

        req.onsuccess = () => {
          const entry = req.result as FontCacheEntry | undefined;
          if (!entry?.buffer) {
            resolve(null);
            return;
          }
          // URL이 변경되었으면 캐시 무효화 (이전 CDN 소스의 잘못된 데이터 방지)
          if (expectedUrl && entry.url && entry.url !== expectedUrl) {
            resolve(null);
            return;
          }
          resolve(entry.buffer);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      // IndexedDB 사용 불가 시 캐시 스킵
      return null;
    }
  }

  private async saveToCache(
    key: string,
    buffer: ArrayBuffer,
    url?: string,
  ): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const entry: FontCacheEntry = {
        family: key,
        url,
        buffer,
        timestamp: Date.now(),
      };
      store.put(entry);
    } catch {
      // IndexedDB 쓰기 실패 무시
    }
  }
}

// ============================================
// HMR 안전 싱글톤 (initCanvasKit.ts 패턴)
// ============================================

const FM_GLOBAL_KEY = "__composition_SKIA_FONT_MANAGER__";

declare global {
  interface Window {
    [FM_GLOBAL_KEY]?: SkiaFontManager;
  }
}

function getOrCreateFontManager(): SkiaFontManager {
  // HMR 시 이전 인스턴스 재사용 (Typeface 누수 방지)
  const existing = window[FM_GLOBAL_KEY];
  if (existing) return existing;

  const fm = new SkiaFontManager();
  window[FM_GLOBAL_KEY] = fm;
  return fm;
}

/** 싱글톤 인스턴스 */
export const skiaFontManager = getOrCreateFontManager();
