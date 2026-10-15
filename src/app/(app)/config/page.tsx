"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Endereço antigo ("Perfil e ajustes"): agora é o Perfil do cachorro (a família vai em #familia). */
export default function ConfigRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/perfil${window.location.hash}`);
  }, [router]);
  return null;
}
