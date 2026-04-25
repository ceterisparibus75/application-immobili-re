"use client";

import Image from "next/image";

interface LogoImageProps {
  src: string;
  className?: string;
}

export function LogoImage({ src, className }: LogoImageProps) {
  return (
    <Image
      src={src}
      alt="Logo"
      width={160}
      height={80}
      unoptimized
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
