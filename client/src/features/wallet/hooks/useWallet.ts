import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../auth';
import { fetchInstructions, fetchMyRequests, fetchWallet } from '../api/client';
import type { PaymentInstruction, RechargeRequestView, WalletView } from '../types/models';

export interface WalletState {
  loading: boolean;
  wallet: WalletView | null;
  requests: RechargeRequestView[];
  instructions: PaymentInstruction[] | null;
  instructionsError: string | null;
  error: string | null;
  reload: () => Promise<void>;
}

export function useWallet(): WalletState {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [requests, setRequests] = useState<RechargeRequestView[]>([]);
  const [instructions, setInstructions] = useState<PaymentInstruction[] | null>(null);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, r] = await Promise.all([fetchWallet(), fetchMyRequests()]);
      setWallet(w);
      setRequests(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setLoading(false);
    }
    try {
      setInstructions(await fetchInstructions());
      setInstructionsError(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PAYMENT_UNCONFIGURED') { setInstructions([]); setInstructionsError(null); }
      else setInstructionsError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, wallet, requests, instructions, instructionsError, error, reload };
}
