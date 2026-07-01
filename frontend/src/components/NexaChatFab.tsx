"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { NexaChat } from "@/components/NexaChat";
import { cn } from "@/lib/utils";

function isChatRoute(pathname: string | null) {
  if (!pathname) return false;
  const p = pathname.replace(/\/$/, "");
  return p === "/dashboard" || p === "/dashboard/chat";
}

export function NexaChatFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const onChatHome = isChatRoute(pathname);

  if (onChatHome) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full",
          "bg-gold text-black font-bold text-sm shadow-lg shadow-gold/30",
          "hover:scale-105 transition-transform"
        )}
        aria-label="Open Nexa chat"
      >
        <MessageCircle size={18} />
        Chat with Nexa
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/70">
          <div className="w-full sm:max-w-2xl h-[92vh] sm:h-[80vh] relative">
            <div className="absolute top-3 right-3 z-10 flex gap-2">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-xs text-white"
              >
                Full screen
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg bg-black/60 border border-white/20 text-white"
                aria-label="Close chat"
              >
                <X size={16} />
              </button>
            </div>
            <NexaChat compact />
          </div>
        </div>
      )}
    </>
  );
}
