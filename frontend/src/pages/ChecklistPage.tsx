import { ClipboardList } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PagePlaceholder } from '../components/common/PagePlaceholder'

export function ChecklistPage() {
  const { t } = useTranslation()
  return (
    <PagePlaceholder icon={ClipboardList} title={t('pages.checklistTitle')} description={t('pages.checklistDesc')} />
  )
}
