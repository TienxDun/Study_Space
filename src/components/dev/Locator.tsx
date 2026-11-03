"use client";

import { useEffect } from "react";

export function Locator() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      import("@locator/runtime")
        .then(({ default: setupLocatorUI }) => {
          setupLocatorUI();
        })
        .catch(() => {
          // Locator is only loaded in development environments
        });
    }
  }, []);

  return null;
}

