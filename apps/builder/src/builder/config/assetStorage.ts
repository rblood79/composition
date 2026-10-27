/** ADR-235: 자산 저장 실패 시 dataURL fallback을 유지하며, writer만 비활성화할 수 있다. */
export function assetStorageEnabled(): boolean {
  const value = import.meta.env.VITE_ASSET_WRITER;
  return value === undefined || value === "" || /^(true|1)$/i.test(value);
}
