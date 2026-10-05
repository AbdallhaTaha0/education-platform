import { useCallback, useEffect, useState, useRef } from 'react';
import { ApiError } from '../../../auth';
import { fetchInstructions, fetchRequestPage, fetchWallet } from '../api/client';
import type { PageInfo } from '../../../components/ui/Pagination';
import type { PaymentInstruction, RechargeRequestView, WalletView } from '../types/models';

export interface WalletState {
  pagination: PageInfo; setPage: (page: number) => void; setPageSize: (size: number) => void;
  loading: boolean;
  wallet: WalletView | null;
  requests: RechargeRequestView[];
  instructions: PaymentInstruction[] | null;
  instructionsError: string | null;
  error: string | null;
  reload: () => Promise<void>;
}

export function useWallet(): WalletState {
  const generation = useRef(0);
  const [page, setPage] = useState(1); const [pageSize, size] = useState(10);
  const [pagination, setPagination] = useState<PageInfo>({ page: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [requests, setRequests] = useState<RechargeRequestView[]>([]);
  const [instructions, setInstructions] = useState<PaymentInstruction[] | null>(null);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const [w, r] = await Promise.all([fetchWallet(), fetchRequestPage(page, pageSize)]);
      if (current !== generation.current) return;
      setWallet(w);
      setRequests(r.requests); setPagination(r.pagination); setPage(r.pagination.page);
    } catch (err) {
      if (current === generation.current) setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      if (current === generation.current) setLoading(false);
    }
    if (current !== generation.current) return;
    try {
      const received = await fetchInstructions(); if (current !== generation.current) return;
      setInstructions(received);
      setInstructionsError(null);
    } catch (err) {
      if (current !== generation.current) return;
      if (err instanceof ApiError && err.code === 'PAYMENT_UNCONFIGURED') { setInstructions([]); setInstructionsError(null); }
      else setInstructionsError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    }
  }, [page, pageSize]);

  useEffect(() => {
    void reload();
    const refresh = () => { void reload(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [reload]);

  return { pagination, setPage, setPageSize: value => { size(value); setPage(1); }, loading, wallet, requests, instructions, instructionsError, error, reload };
}
