import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/utils';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
  disabled?: boolean;
}

interface TooltipProviderProps {
  children: ReactNode;
}

export const TooltipProvider = ({ children }: TooltipProviderProps) => (
  <BaseTooltip.Provider delay={450} closeDelay={0} timeout={180}>
    {children}
  </BaseTooltip.Provider>
);

export const Tooltip = ({
  content,
  children,
  position = 'top',
  delay = 500,
  className,
  disabled = false,
}: TooltipProps) => (
  <BaseTooltip.Root>
    <BaseTooltip.Trigger render={children} delay={delay} disabled={disabled} />
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={position} sideOffset={8} className="z-50">
        <BaseTooltip.Popup
          className={cn(
            'origin-[var(--transform-origin)] rounded-control bg-tooltip px-2 py-1',
            'whitespace-nowrap text-xs font-medium text-white',
            'transition-[transform,opacity] duration-fast ease-out',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:ease-in',
            className
          )}
        >
          {content}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  </BaseTooltip.Root>
);
