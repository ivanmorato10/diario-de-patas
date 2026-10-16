import { BottomNav } from "@/components/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      {children}
      <BottomNav />
    </div>
  );
}
