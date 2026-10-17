import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  tone: 'success' | 'info' | 'error'
}

interface ToastState {
  toasts: Toast[]
  show: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
}

let seq = 0
const DURATION_MS = 3500

/** 짧은 알림(복사 완료 등). 화면 하단에 잠깐 보였다 사라진다. */
export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, tone = 'success') => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }))
    window.setTimeout(() => get().dismiss(id), DURATION_MS)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
