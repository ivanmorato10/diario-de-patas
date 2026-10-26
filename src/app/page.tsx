"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable } from "@/components/shell";

export default function Root() {
  const { snap, unavailable } = useStore();
  const router = useRouter();
  // Enquanto o diário carrega, a tela de Hoje (código e dados da rota) já vai sendo baixada: ao chegar o diário,
  // a troca é imediata (antes, Hoje só começava a carregar depois).
  useEffect(() => { router.prefetch("/hoje"); }, [router]);
  useEffect(() => {
    if (snap) router.replace(snap.dog ? "/hoje" : "/adicionar");
  }, [snap, router]);
  return <main className="main main--bare">{unavailable ? <StorageUnavailable /> : <PageLoading />}</main>;
}
