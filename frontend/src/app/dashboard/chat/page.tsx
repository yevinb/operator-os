"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChatAliasPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="p-6 text-text-2 text-sm">Opening Nexa Chat…</div>
  );
}
