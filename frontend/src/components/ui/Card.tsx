import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'interactive';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white rounded-2xl border border-slate-200/90 shadow-2xs',
    elevated: 'bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow',
    glass: 'glass-card rounded-2xl shadow-xs',
    interactive:
      'bg-white rounded-2xl border border-slate-200 hover:border-brand-500/80 hover:shadow-sm transition-all cursor-pointer',
  };

  return (
    <div className={`p-4 sm:p-5 ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};
