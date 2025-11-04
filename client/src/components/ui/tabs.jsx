import { cn } from '../../lib/utils'

export function Tabs({ value, onValueChange, children }) {
  return <div data-tabs value={value} onChange={onValueChange}>{children}</div>
}

export function TabsList({ className, ...props }) {
  return <div className={cn('flex items-center gap-2 border-b pb-2 mb-3', className)} {...props} />
}

export function TabsTrigger({ className, value, activeValue, onClick, children }) {
  const active = value === activeValue
  return (
    <button
      className={cn('px-3 py-1.5 rounded-full text-sm', active ? 'bg-slate-900 text-white' : 'hover:bg-slate-100', className)}
      onClick={() => onClick?.(value)}
    >
      {children}
    </button>
  )
}

export function TabsContent({ className, value, activeValue, children }) {
  if (value !== activeValue) return null
  return <div className={cn('text-sm text-slate-800', className)}>{children}</div>
}


