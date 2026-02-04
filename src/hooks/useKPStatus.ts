import { useState, useEffect } from 'react';
import { KPStatus } from '../types';
import { fetchKPStatus } from '../monitor/kpMonitor';

/**
 * Custom hook for fetching and monitoring KP status
 */
export function useKPStatus() {
  const [status, setStatus] = useState<KPStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      setLoading(true);
      const kpStatus = await fetchKPStatus();
      if (mounted) {
        setStatus(kpStatus);
        setLoading(false);
      }
    };

    checkStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const refresh = async () => {
    setLoading(true);
    const kpStatus = await fetchKPStatus();
    setStatus(kpStatus);
    setLoading(false);
  };

  return {
    status,
    loading,
    refresh
  };
}
