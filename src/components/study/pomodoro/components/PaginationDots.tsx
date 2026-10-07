"use client";

interface PaginationDotsProps {
  completedSessions: number;
}

export function PaginationDots({ completedSessions }: PaginationDotsProps) {
  return (
    <div className="h-6 flex items-center justify-center gap-1.5 mt-3 opacity-60">
      {[0, 1, 2, 3].map((dot) => (
        <span
          key={dot}
          className={`rounded-full transition-all duration-300 ${
            dot === (completedSessions % 4)
              ? "bg-white w-3.5 h-1.5 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              : "bg-white/40 w-1.5 h-1.5"
          }`}
        />
      ))}
    </div>
  );
}
