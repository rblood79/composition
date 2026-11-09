import type { ProjectContentV2 } from "@composition/shared/assets";
import type { buildCatalogProjectJson } from "../catalogRuntime/exchange";

/**
 * ADR-305 Decision 6 — Publish 는 별도 HTML 진입 (`publish/index.html`) 이다. 배포 base 아래의 디렉터리
 * 주소 (끝 `/` — 정적 서버 redirect 를 거치지 않는다): dev `/publish/` · production `/composition/publish/`.
 */
export function publishEntryUrl(baseUrl: string, origin: string): URL {
  return new URL("publish/", new URL(baseUrl, origin));
}

/** 클릭 안에서 탭을 확보하고, 검증한 독립 파일을 전달한다. 구 document 변환은 없다. */
export async function openCatalogPublish(
  content: ProjectContentV2,
  readAsset: Parameters<typeof buildCatalogProjectJson>[1],
): Promise<void> {
  const target = window.open("about:blank", "_blank");
  if (!target) throw new Error("PUBLISH_POPUP_BLOCKED");
  target.opener = null;
  let url: string | undefined;
  try {
    const { buildCatalogProjectJson } =
      await import("../catalogRuntime/exchange");
    const text = await buildCatalogProjectJson(content, readAsset);
    if (target.closed) return;
    url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const destination = publishEntryUrl(
      import.meta.env.BASE_URL,
      window.location.origin,
    );
    destination.searchParams.set("project", url);
    target.location.replace(destination.href);
    // 새 탭이 파일을 다시 읽을 수 있도록 닫힐 때까지 유지한다.
    const timer = window.setInterval(() => {
      if (!target.closed) return;
      window.clearInterval(timer);
      URL.revokeObjectURL(url!);
    }, 1000);
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    target.close();
    throw error;
  }
}
