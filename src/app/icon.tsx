import { ImageResponse } from "next/og";
import { AppIconDesign } from "./app-icon-design";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<AppIconDesign />, size);
}
