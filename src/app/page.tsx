"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/data/store";
import { PageLoading, StorageUnavailable } from "@/components/shell";

export default function Root() {
  const { snap, unavailable } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (snap) router.replace(snap.dog ? "/hoje" : "/adicionar");
  }, [snap, router]);
  return <main className="main main--bare">{unavailable ? <StorageUnavailable /> : <PageLoading />}</main>;
}
