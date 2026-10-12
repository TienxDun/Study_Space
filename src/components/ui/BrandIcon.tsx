"use client";

interface BrandIconProps {
  /** Đường vẽ SVG lấy từ gói simple-icons (ví dụ siFacebook.path). */
  path: string;
  className?: string;
}

/** Icon logo hãng (Facebook, GitHub...) vẽ 1 màu theo chữ xung quanh. */
export const BrandIcon = ({ path, className }: BrandIconProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
};
