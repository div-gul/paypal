import React, { useEffect, useState } from 'react';
import { Server, CheckCircle2, AlertCircle } from 'lucide-react';

interface HealthResponse {
  status: string;
  mode?: {
    paypal: string;
    quotes: string;
  };
  service?: string;
}

export const BackendHealthBadge: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/health')
      .then(res => {
        if (!res.ok) throw new Error('Health check failed');
        return res.json();
      })
      .then(data => {
        if (isMounted) {
          setHealth(data);
          setHasError(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setHasError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-[11px] font-medium">
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-paper text-ink-muted border-secondary-tint">
        <Server className="w-3 h-3 text-ink-muted" />
        <span className="text-ink-muted font-medium">Backend:</span>
        {health ? (
          <span className="flex items-center gap-1 text-good font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Connected ({health.mode?.paypal || 'mock'})</span>
          </span>
        ) : hasError ? (
          <span className="flex items-center gap-1 text-ink-muted font-medium">
            <AlertCircle className="w-3 h-3 text-secondary" />
            <span>Simulated (Client Mode)</span>
          </span>
        ) : (
          <span className="text-ink-muted animate-pulse">Checking /api/health...</span>
        )}
      </span>
    </div>
  );
};
