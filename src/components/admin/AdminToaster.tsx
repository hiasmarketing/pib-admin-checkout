"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function AdminToaster() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("admin-theme") as "dark" | "light" | null;
    if (stored) {
      window.queueMicrotask(() => setTheme(stored));
    }

    const root = document.querySelector(".admin-root");
    if (!root) return;

    const observer = new MutationObserver(() => {
      setTheme(root.classList.contains("light") ? "light" : "dark");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return <Toaster theme={theme} richColors position="top-right" />;
}
