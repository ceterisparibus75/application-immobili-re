"use client";

import { ModuleError } from "@/components/layout/module-error";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ModuleError {...props} moduleName="Comptabilité" />;
}
