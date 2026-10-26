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
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
        <Server className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500 font-medium">Backend:</span>
        {health ? (
          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Connected ({health.mode?.paypal || 'mock'})</span>
          </span>
        ) : hasError ? (
          <span className="flex items-center gap-1 text-slate-500 font-medium">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            <span>Simulated (Client Mode)</span>
          </span>
        ) : (
          <span className="text-slate-400 animate-pulse">Checking /api/health...</span>
        )}
      </span>
    </div>
  );
};
