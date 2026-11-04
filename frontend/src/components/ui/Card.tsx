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
    default: 'bg-surface rounded-xl border border-secondary-tint shadow-soft',
    elevated: 'bg-surface rounded-xl border border-secondary-tint shadow-card hover:shadow-md transition-shadow',
    glass: 'glass-card rounded-xl shadow-soft',
    interactive:
      'bg-surface rounded-xl border border-secondary-tint hover:border-brand/40 shadow-soft hover:shadow-card transition-all cursor-pointer',
  };

  return (
    <div className={`p-4 sm:p-5 ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};
