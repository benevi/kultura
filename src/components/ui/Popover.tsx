'use client'

import { forwardRef } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils/index'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export const PopoverContent = forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'start', sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 bg-surface border border-border rounded-xl shadow-xl p-2 text-sm text-text',
        'animate-modal-in origin-[var(--radix-popover-content-transform-origin)]',
        'focus:outline-none',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = 'PopoverContent'
