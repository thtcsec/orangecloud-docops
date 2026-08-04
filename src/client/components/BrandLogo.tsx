import { useTheme } from "../theme";

type BrandLogoProps = {
  variant?: "light" | "dark" | "mark" | "auto";
  className?: string;
};

/**
 * Brand mark for OrangeCloud DocOps.
 * Full lockups use PNG design exports; `mark` uses clean SVG.
 */
export function BrandLogo({
  variant = "auto",
  className = "h-9 w-auto",
}: BrandLogoProps) {
  const { theme } = useTheme();
  const resolved =
    variant === "auto" ? (theme === "dark" ? "dark" : "light") : variant;

  const src =
    resolved === "mark"
      ? "/brand/logo-mark.svg"
      : resolved === "dark"
        ? "/brand/logo-dark.png"
        : "/brand/logo.png";

  return (
    <img
      src={src}
      alt="OrangeCloud DocOps"
      className={className}
      decoding="async"
    />
  );
}
