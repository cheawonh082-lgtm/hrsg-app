/**
 * 클립보드 복사 (PRD §3.3): navigator.clipboard → 실패하면 textarea를 선택해 execCommand('copy').
 * 둘 다 안 되면 'selected' — 텍스트는 선택된 상태로 두어 사용자가 직접 복사(Ctrl+C / 길게 눌러 복사)할 수 있게 한다.
 */
export async function copyText(text: string, fallback?: HTMLTextAreaElement | null): Promise<'copied' | 'selected' | 'failed'> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return 'copied'
    }
  } catch {
    // 권한 거부·비보안 컨텍스트(http LAN 접속 등) → 아래 대체 경로
  }
  if (!fallback) return 'failed'
  fallback.focus()
  fallback.select()
  fallback.setSelectionRange(0, text.length)
  try {
    if (document.execCommand?.('copy')) return 'copied'
  } catch {
    // 무시하고 선택 상태로 둔다
  }
  return 'selected'
}
