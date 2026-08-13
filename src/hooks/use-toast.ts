import { useSyncExternalStore } from "react"

type ToastItem = { id: string; title?: string; description?: string; action?: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }

let items: ToastItem[] = []
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function toast(input: Omit<ToastItem, "id">) {
  const id = `${Date.now()}${Math.random().toString(36).slice(2)}`
  items = [...items, { ...input, id, open: true }]
  notify()
  window.setTimeout(() => dismiss(id), 5000)
  return { id, dismiss: () => dismiss(id), update: (next: Partial<ToastItem>) => { items = items.map((item) => item.id === id ? { ...item, ...next } : item); notify() } }
}

export function dismiss(id?: string) {
  items = id ? items.filter((item) => item.id !== id) : []
  notify()
}

export function useToast() {
  const toasts = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, () => items, () => [])
  return { toasts, toast, dismiss }
}
