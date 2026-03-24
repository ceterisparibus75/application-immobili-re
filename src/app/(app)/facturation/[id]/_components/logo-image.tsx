"use client";

interface LogoImageProps {
  src: string;
  className?: string;
}

export function LogoImage({ src, className }: LogoImageProps) {
  return (
    <img
      src={src}
      alt="Logo"
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
