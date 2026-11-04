import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-2.5 min-h-[44px] gap-1.5',
    md: 'text-xs px-4 py-2.5 min-h-[44px] gap-2',
    lg: 'text-sm px-5 py-3 min-h-[48px] gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-accent hover:bg-accent-dark text-white shadow-soft focus-visible:ring-brand active:translate-y-px',
    secondary:
      'bg-secondary-tint hover:bg-secondary/15 text-secondary border border-secondary-tint focus-visible:ring-brand',
    outline:
      'bg-surface hover:bg-paper text-ink border border-secondary-tint shadow-soft focus-visible:ring-brand',
    ghost:
      'bg-transparent hover:bg-secondary-tint/50 text-ink-muted hover:text-ink focus-visible:ring-brand',
    danger:
      'bg-danger hover:bg-red-700 text-white shadow-soft focus-visible:ring-brand',
    success:
      'bg-good hover:bg-teal-700 text-white shadow-soft focus-visible:ring-brand',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
