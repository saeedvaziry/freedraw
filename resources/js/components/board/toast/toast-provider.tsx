import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast(message: string, variant?: ToastVariant): void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION = 2400

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const toast = useCallback((message: string, variant: ToastVariant = 'success'): void => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message, variant }])
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, TOAST_DURATION)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((item) => (
          <ToastCard key={item.id} {...item} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ message, variant }: ToastItem) {
  const Icon = variant === 'error' ? XCircle : CheckCircle2
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-xl border bg-background/95 px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur',
        variant === 'error' ? 'text-destructive' : 'text-foreground',
      )}
    >
      <Icon className="size-4" />
      <span>{message}</span>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
