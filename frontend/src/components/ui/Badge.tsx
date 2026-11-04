import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'count';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const variantStyles = {
    success: 'bg-good/15 text-good font-semibold border border-good/30',
    warning: 'bg-accent-tint text-accent-dark font-semibold border border-accent/25',
    danger: 'bg-danger/10 text-danger font-semibold border border-danger/25',
    info: 'bg-secondary-tint text-secondary font-semibold border border-secondary/20',
    neutral: 'bg-paper text-ink-muted font-medium border border-secondary-tint',
    count: 'bg-accent text-white font-extrabold rounded-full px-1.5 py-0.5 text-[10px] leading-tight min-w-[18px] text-center shadow-soft',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
