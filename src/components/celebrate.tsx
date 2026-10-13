/** Patinhas que saltam — decorativas (sem emoji); o texto sempre confirma a conquista. */
import { Paw } from "./icons";

export function PawBurst({ count = 10 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => {
    const ang = (i / count) * Math.PI * 2;
    const dist = 120 + (i % 3) * 30;
    return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist * 0.8, rot: (i % 2 ? 1 : -1) * (30 + i * 9), delay: (i % 4) * 40 };
  });
  return (
    <div className="burst" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`, ["--rot" as string]: `${p.rot}deg`, animationDelay: `${p.delay}ms`, color: i % 3 === 0 ? "var(--lilac)" : i % 3 === 1 ? "var(--accent)" : "var(--brand-teal)" }}>
          <Paw size={22} />
        </span>
      ))}
    </div>
  );
}
