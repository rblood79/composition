import {
  Heading as AriaHeading,
  HeadingProps,
} from "react-aria-components/Heading";
import { Text as AriaText, TextProps } from "react-aria-components/Text";

import "./styles/Content.css";

export function Heading(props: HeadingProps) {
  return <AriaHeading {...props} className="react-aria-Heading" />;
}

export function Text(props: TextProps) {
  return <AriaText {...props} className="react-aria-Text" />;
}
