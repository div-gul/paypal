import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`rounded-xl border border-dashed border-secondary-tint bg-paper/60 p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-surface border border-secondary-tint shadow-soft flex items-center justify-center text-secondary">
          {icon}
        </div>
      )}
      <div className="max-w-md space-y-1">
        <h4 className="font-bold text-ink text-sm">{title}</h4>
        <p className="text-xs text-ink-muted leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
