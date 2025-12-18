import { cn } from '../../utils/cn';

type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  size?: IconButtonSize;
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export const IconButton = ({
  icon,
  label,
  active = false,
  size = 'md',
  className,
  disabled,
  ...props
}: IconButtonProps) => {
  return (
    <button
      className={cn(
        'flex items-center justify-center',
        'rounded-md',
        'transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        active ? 'bg-gray-200 text-gray-900' : 'bg-transparent text-gray-600 hover:bg-gray-200',
        sizeStyles[size],
        className
      )}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
};
