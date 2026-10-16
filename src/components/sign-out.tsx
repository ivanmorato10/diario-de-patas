"use client";

import { useRef, useState } from "react";
import { signOutThisDevice } from "@/data/push-client";

/** "Sair": antes de encerrar a sessão, desliga os avisos deste aparelho (para não chegarem à próxima conta). */
export function SignOutForm({ className, style, children }: { className?: string; style?: React.CSSProperties; children: (busy: boolean) => React.ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form ref={form} method="post" action="/auth/sair" className={className} style={style}
      onSubmit={async (e) => {
        if (busy) return;
        e.preventDefault();
        setBusy(true);
        await signOutThisDevice();
        form.current?.submit();
      }}>
      {children(busy)}
    </form>
  );
}
