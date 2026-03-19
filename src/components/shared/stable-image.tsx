import type { CSSProperties, ImgHTMLAttributes } from "react";

type StableImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fit?: CSSProperties["objectFit"];
  position?: CSSProperties["objectPosition"];
};

export function StableImage({
  style,
  fit,
  position,
  ...props
}: StableImageProps) {
  return (
    <img
      {...props}
      style={{
        display: "block",
        objectFit: fit,
        objectPosition: position,
        ...style,
      }}
    />
  );
}
