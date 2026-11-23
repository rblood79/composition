/**
 * FileUpload 의 오류 표시 (S2 체크리스트 §4.1, 2026-11-23) — S2 InlineAlert (negative · border): 제목 +
 * 이유 문장 + variant 아이콘. 노드가 아니라 런타임 상태라 catalog InlineAlert 와 같은 DOM 모양
 * (`div.react-aria-InlineAlert[data-variant][data-fill-style]` > Heading + Content · 아이콘) 을 그려
 * 생성 `InlineAlert.css` 를 그대로 받는다. 코드는 `data-code` 로 남는다.
 *
 * 쓰는 곳: 실패한 파일의 행 (`FileUploadActive`) · 보낼 수 없는 uploader 의 상태 (`FileUpload`).
 */
import { tokenToCSSVar, type TokenRef } from "@composition/rendering";
import { useLocale } from "react-aria-components/I18nProvider";

import { catalogInlineAlertIcon } from "../catalog/document/inlineAlertIcon";
import {
  uploadErrorMessage,
  uploadErrorTitle,
} from "../upload/uploadErrorMessages";
import { InlineAlertIcon } from "./InlineAlertIcon";

/** The InlineAlert rule's M padding (the icon sits at the padding box's top end). */
const ALERT_PADDING = 16;

export function FileUploadAlert({
  code,
  blocked = false,
  className,
}: {
  code: string;
  /** The uploader cannot send at all (no address · no engine) — not one file. */
  blocked?: boolean;
  className: string;
}) {
  const { locale } = useLocale();
  const icon = catalogInlineAlertIcon({
    variant: "negative",
    fillStyle: "border",
  })!;
  return (
    <div
      className={`react-aria-InlineAlert ${className}`}
      data-variant="negative"
      data-fill-style="border"
      data-size="M"
      data-code={code}
      role="alert"
      style={{ position: "relative" }}
    >
      <InlineAlertIcon
        variant={icon.variant}
        iconName={icon.iconName}
        size={icon.size}
        color={
          icon.color.startsWith("{")
            ? tokenToCSSVar(icon.color as TokenRef)
            : icon.color
        }
        top={ALERT_PADDING}
        end={ALERT_PADDING}
      />
      <div className="react-aria-Heading">
        {uploadErrorTitle(locale, blocked)}
      </div>
      <div className="react-aria-Content">
        {uploadErrorMessage(locale, code)}
      </div>
    </div>
  );
}
