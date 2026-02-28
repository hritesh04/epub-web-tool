import * as React from 'react'

import { cn } from '@/lib/utils'

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  requiredMark?: boolean
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, requiredMark, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {requiredMark ? (
          <span aria-hidden className="text-destructive">
            *
          </span>
        ) : null}
      </span>
    </label>
  ),
)
Label.displayName = 'Label'

export { Label }

