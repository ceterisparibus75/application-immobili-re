"use client";

import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";

export function SocietyCardLink({
  societyId,
  children,
}: {
  societyId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { societies, setActiveSociety } = useSociety();

  function handleClick() {
    const target = societies.find((s) => s.id === societyId);
    if (target) {
      setActiveSociety(target);
    }
    router.push("/dashboard");
  }

  return (
    <div onClick={handleClick} className="cursor-pointer">
      {children}
    </div>
  );
}
