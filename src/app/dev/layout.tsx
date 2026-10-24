import type { ReactNode } from "react";
import { AdminThemeProvider } from "@/components/admin/AdminThemeContext";

export default function DevLayout({ children }: { children: ReactNode }) {
  return <AdminThemeProvider>{children}</AdminThemeProvider>;
}
