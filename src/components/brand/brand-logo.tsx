import Image from "next/image";

import { cn } from "@/lib/utils";

export const BRAND_LOGO_SRC =
  "https://exhibytesolution.com/wp-content/uploads/2023/06/cropped-Exhibyte_Logo_Black_Logo-removebg-preview-1.png";

const sizeConfig = {
  sm: { box: "size-10 rounded-lg", padding: "p-1", sizes: "40px" },
  md: { box: "size-14 rounded-2xl", padding: "p-2", sizes: "56px" },
  lg: { box: "size-16 rounded-2xl", padding: "p-2", sizes: "64px" },
} as const;

type BrandLogoProps = {
  size?: keyof typeof sizeConfig;
  priority?: boolean;
  className?: string;
};

export function BrandLogo({ size = "md", priority = false, className }: BrandLogoProps) {
  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        "ring-ex-border relative shrink-0 overflow-hidden bg-white ring-1",
        config.box,
        className,
      )}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt="ExhiByte Solutions"
        fill
        className={cn("object-contain", config.padding)}
        sizes={config.sizes}
        priority={priority}
      />
    </div>
  );
}
