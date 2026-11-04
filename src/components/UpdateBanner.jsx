import { useEffect, useState } from 'react'
import { ArrowClockwise, X } from '@phosphor-icons/react'

export function UpdateBanner() {
  const [applyUpdate, setApplyUpdate] = useState(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const handleUpdateReady = (event) => {
      setApplyUpdate(() => event.detail?.applyUpdate || null)
    }

    window.addEventListener('garder-update-ready', handleUpdateReady)
    return () => window.removeEventListener('garder-update-ready', handleUpdateReady)
  }, [])

  if (!applyUpdate) return null

  const refresh = async () => {
    if (applying) return
    setApplying(true)
    try {
      await applyUpdate()
    } catch (error) {
      console.warn('[PWA] Could not apply the available update:', error)
      setApplying(false)
    }
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 z-[90] mx-auto flex max-w-md items-center gap-3 border border-foreground-tertiary/20 bg-background-secondary px-4 py-3 text-foreground shadow-lg lg:bottom-6 lg:left-auto lg:right-6"
    >
      <span className="min-w-0 flex-1 text-sm font-sans">New version ready.</span>
      <button
        type="button"
        onClick={refresh}
        disabled={applying}
        className="inline-flex shrink-0 items-center gap-2 bg-indigo px-3 py-2 text-sm font-sans font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        <ArrowClockwise size={15} />
        {applying ? 'Refreshing…' : 'Refresh'}
      </button>
      <button
        type="button"
        onClick={() => setApplyUpdate(null)}
        aria-label="Dismiss update notice"
        className="shrink-0 p-1 text-foreground-tertiary hover:text-foreground"
      >
        <X size={16} />
      </button>
    </aside>
  )
}
