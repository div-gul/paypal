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
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200/80 font-semibold',
    info: 'bg-blue-50 text-blue-800 border border-blue-200/80 font-semibold',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200/80 font-medium',
    count: 'bg-rose-500 text-white font-extrabold rounded-full px-1.5 py-0.2 text-[10px] leading-tight min-w-[18px] text-center',
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
