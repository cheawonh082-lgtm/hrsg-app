import { Calculator, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { PagePlaceholder } from '../components/common/PagePlaceholder'

export function ChatPage() {
  const { t } = useTranslation()
  // 계산기 화면 "AI에게 질문하기"에서 넘어온 계산 결과 ID (3주차 질의응답 컨텍스트로 사용)
  const calcId = (useLocation().state as { calcId?: string } | null)?.calcId

  return (
    <div className="space-y-4">
      <PagePlaceholder icon={MessageSquare} title={t('pages.chatTitle')} description={t('pages.chatDesc')} />
      {calcId && (
        <p
          data-testid="chat-calc-context"
          className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm"
        >
          <Calculator aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <span className="min-w-0">{t('pages.chatCalcContext', { id: calcId })}</span>
        </p>
      )}
    </div>
  )
}
