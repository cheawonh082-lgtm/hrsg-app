import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useUiStore } from '../store/ui'

/** 선택한 언어를 i18next와 <html lang>에 반영. */
export function useApplyLocale() {
  const locale = useUiStore((s) => s.locale)
  const { i18n } = useTranslation()

  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale)
    document.documentElement.lang = locale
  }, [locale, i18n])
}
