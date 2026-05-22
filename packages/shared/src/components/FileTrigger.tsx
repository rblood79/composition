import {
  FileTrigger as AriaFileTrigger,
  FileTriggerProps as AriaFileTriggerProps,
} from "react-aria-components";

import "./styles/generated/FileTrigger.css";

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */

export interface FileTriggerProps extends AriaFileTriggerProps {
  /**
   * Accepted file types (MIME types)
   * @example ["image/png", "image/jpeg"]
   */
  acceptedFileTypes?: string[];
  /**
   * Allow multiple file selection
   * @default false
   */
  allowsMultiple?: boolean;
  /**
   * Allow directory selection (Chrome only)
   * @default false
   */
  acceptDirectory?: boolean;
  /**
   * Default camera for media capture
   * @default undefined
   */
  defaultCamera?: "user" | "environment";
}

/**
 * FileTrigger Component
 *
 * A component that allows users to select files from their file system.
 * Works with any pressable React Aria component as a trigger.
 *
 * Features:
 * - File type filtering
 * - Multiple file selection
 * - Directory selection (Chrome)
 * - Camera capture on mobile
 *
 * @example
 * <FileTrigger acceptedFileTypes={["image/*"]} onSelect={handleFiles}>
 *   <Button>Upload Image</Button>
 * </FileTrigger>
 *
 * @example
 * <FileTrigger allowsMultiple onSelect={handleFiles}>
 *   <Button>Upload Files</Button>
 * </FileTrigger>
 */
export function FileTrigger({
  acceptedFileTypes,
  allowsMultiple = false,
  acceptDirectory = false,
  defaultCamera,
  children,
  ...props
}: FileTriggerProps) {
  return (
    <AriaFileTrigger
      {...props}
      acceptedFileTypes={acceptedFileTypes}
      allowsMultiple={allowsMultiple}
      acceptDirectory={acceptDirectory}
      defaultCamera={defaultCamera}
    >
      {children}
    </AriaFileTrigger>
  );
}
