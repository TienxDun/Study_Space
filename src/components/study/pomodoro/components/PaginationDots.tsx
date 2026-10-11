"use client";

interface PaginationDotsProps {
  completedSessions: number;
  /** Ghi đè wrapper mặc định (dùng để đặt dots vào khoảng hở của ring). */
  className?: string;
}

export function PaginationDots({ completedSessions, className }: PaginationDotsProps) {
  return (
    <div
      className={
        className ?? "h-6 flex items-center justify-center gap-1.5 mt-3 opacity-60"
      }
      title={`Chu kỳ Pomodoro: Phiên ${(completedSessions % 4) + 1}/4`}
      aria-label={`Chu kỳ Pomodoro: Phiên ${(completedSessions % 4) + 1} trên 4`}
    >
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
