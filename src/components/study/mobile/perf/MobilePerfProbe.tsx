"use client";

import { Profiler, type ReactNode } from "react";

interface MobilePerfProbeProps {
  name: string;
  children: ReactNode;
}

// Nhánh nào mất bao nhiêu ms khi render, in ra console ở bản dev.
// Bản production đi thẳng qua children, không mang Profiler.
export function MobilePerfProbe({ name, children }: MobilePerfProbeProps) {
  if (process.env.NODE_ENV !== "development") {
    return <>{children}</>;
  }

  return (
    <Profiler
      id={name}
      onRender={(_id, phase, actualDuration) => {
        if (actualDuration >= 2) {
          console.log(
            `[PERF] ${name} ${actualDuration.toFixed(1)}ms (${phase})`
          );
        }
      }}
    >
      {children}
    </Profiler>
  );
}
