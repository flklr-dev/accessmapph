import { useEffect } from 'react'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useMapStore, type ToastType } from '../../store/mapStore'
import { cn } from '../../lib/utils'

const config: Record<
  ToastType,
  { Icon: typeof CheckCircle; borderClass: string; role: 'status' | 'alert' }
> = {
  success: { Icon: CheckCircle, borderClass: 'border-l-green-500', role: 'status' },
  error: { Icon: AlertCircle, borderClass: 'border-l-red-500', role: 'alert' },
  info: { Icon: Info, borderClass: 'border-l-blue-500', role: 'status' },
}

export function ToastContainer() {
  const toast = useMapStore((s) => s.toast)
  const clearToast = useMapStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(clearToast, 5000)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  if (!toast) return null

  const { Icon, borderClass, role } = config[toast.type]

  return (
    <div
      role={role}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'fixed bottom-6 right-6 z-toast flex items-start gap-3 p-4',
        'bg-[#1C1C1C] text-white rounded-md text-sm max-w-[360px] shadow-elevated border border-white/10',
        'border-l-[3px]',
        borderClass,
      )}
    >
      <Icon size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
      <p className="m-0 leading-relaxed">{toast.message}</p>
    </div>
  )
}
