import { ImageResponse } from "next/og";
import { AppIconDesign } from "./app-icon-design";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIconDesign />, size);
}
