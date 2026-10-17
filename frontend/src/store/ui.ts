import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ThemePref = 'light' | 'dark' | 'system'
export type Locale = 'ko' | 'en'

interface UiState {
  theme: ThemePref
  locale: Locale
  setTheme: (theme: ThemePref) => void
  setLocale: (locale: Locale) => void
}

/** 화면 설정(테마·언어). 저장 키 'hrsg-ui'는 index.html 초기 스크립트와 공유한다. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      locale: 'ko',
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'hrsg-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ theme, locale }) => ({ theme, locale }),
    },
  ),
)
