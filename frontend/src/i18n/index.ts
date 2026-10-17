import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { useUiStore } from '../store/ui'
import en from './locales/en.json'
import ko from './locales/ko.json'

void i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko }, en: { translation: en } },
  lng: useUiStore.getState().locale,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
})

export default i18n
