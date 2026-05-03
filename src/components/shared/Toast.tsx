import { useEffect } from 'react'
import { Icon, type IconName } from './Icon'
import { clsx } from 'clsx'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  onClose: (id: string) => void
}

const icons: Record<ToastType, IconName> = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-circle',
  info: 'info',
}

const styles = {
  success: 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800 text-success-900 dark:text-success-100',
  error: 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800 text-error-900 dark:text-error-100',
  warning: 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800 text-warning-900 dark:text-warning-100',
  info: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary-100',
}

const iconStyles = {
  success: 'text-success-600 dark:text-success-400',
  error: 'text-error-600 dark:text-error-400',
  warning: 'text-warning-600 dark:text-warning-400',
  info: 'text-primary-600 dark:text-primary-400',
}

export function Toast({ id, type, message, duration = 5000, onClose }: ToastProps) {
  const iconName = icons[type]

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-3 p-4 rounded-xl border shadow-lg',
        'animate-slide-in-right',
        'min-w-[320px] max-w-md',
        styles[type]
      )}
    >
      <Icon name={iconName} size={20} className={clsx('flex-shrink-0 mt-0.5', iconStyles[type])} />

      <p className="flex-1 text-sm font-medium">{message}</p>

      <button
        onClick={() => onClose(id)}
        className={clsx(
          'flex-shrink-0 p-0.5 rounded-lg transition-colors',
          'hover:bg-black/5 dark:hover:bg-white/5'
        )}
        aria-label="Close notification"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}

export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-auto">{children}</div>
    </div>
  )
}
