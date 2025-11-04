import { cn } from '../../lib/utils'

export function Card({ className, ...props }) {
  return <div className={cn('rounded-2xl border bg-white text-slate-900 shadow-sm', className)} {...props} />
}
export function CardHeader({ className, ...props }) {
  return <div className={cn('p-4 border-b', className)} {...props} />
}
export function CardTitle({ className, ...props }) {
  return <h3 className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
}
export function CardContent({ className, ...props }) {
  return <div className={cn('p-4', className)} {...props} />
}


