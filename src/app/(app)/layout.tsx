import { BottomNav, DemoBanner } from "@/components/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <DemoBanner />
      {children}
      <BottomNav />
    </div>
  );
}
