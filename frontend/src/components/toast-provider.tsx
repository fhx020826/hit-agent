"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const add = useCallback((type: ToastType, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    const timer = setTimeout(() => remove(id), 3000);
    timers.current.set(id, timer);
  }, [remove]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => add("success", message),
      error: (message: string) => add("error", message),
      info: (message: string) => add("info", message),
    }),
    [add],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-md transition-all ${
              toast.type === "success"
                ? "bg-emerald-50/95 text-emerald-800 border border-emerald-200"
                : toast.type === "error"
                  ? "bg-rose-50/95 text-rose-800 border border-rose-200"
                  : "bg-blue-50/95 text-blue-800 border border-blue-200"
            }`}
          >
            <span>{toast.type === "success" ? "\u2713" : toast.type === "error" ? "\u2717" : "\u2139"}</span>
            <span>{toast.message}</span>
            <button onClick={() => remove(toast.id)} className="ml-2 opacity-50 hover:opacity-100">&times;</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
