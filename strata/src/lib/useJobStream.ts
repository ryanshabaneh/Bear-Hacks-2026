'use client';

// SSE consumer hook for Client job detail page (and Distributor earnings).
// Phase 4 polish: reconnect on drop with exponential backoff, expose
// connection status so the UI can render loading / disconnected banners.
// See plan/03-dcp-integration.md and plan/05-frontend.md.

import { useEffect, useReducer, useRef, useState } from 'react';

export type JobEvent =
  | { type: 'hello'; jobId: string }
  | { type: 'job_accepted'; dcpJobId: string; total: number; phase: 'rollout' | 'verifier' }
  | {
      type: 'status';
      phase: 'rollout' | 'verifier';
      total: number;
      distributed: number;
      computed: number;
    }
  | {
      type: 'slice_complete';
      sliceIndex: number;
      phase: 'rollout' | 'verifier';
      result: unknown;
      computed: number;
      total: number;
    }
  | { type: 'slice_error'; sliceIndex: number; message: string; phase: 'rollout' | 'verifier' }
  | { type: 'job_done'; winners: Record<string, { answer: string | null; score: number }> }
  | { type: 'job_failed'; error: string };

export type JobState = {
  status: 'queued' | 'rollouts' | 'verifying' | 'done' | 'failed';
  rolloutTotal: number;
  rolloutComputed: number;
  verifierTotal: number;
  verifierComputed: number;
  slices: Record<number, { phase: 'rollout' | 'verifier'; result: unknown }>;
  winners: Record<string, { answer: string | null; score: number }> | null;
  error: string | null;
};

export const initialJobState: JobState = {
  status: 'queued',
  rolloutTotal: 0,
  rolloutComputed: 0,
  verifierTotal: 0,
  verifierComputed: 0,
  slices: {},
  winners: null,
  error: null,
};

function jobReducer(state: JobState, ev: JobEvent): JobState {
  switch (ev.type) {
    case 'hello':
      return state;
    case 'job_accepted':
      return ev.phase === 'rollout'
        ? { ...state, status: 'rollouts', rolloutTotal: ev.total }
        : { ...state, status: 'verifying', verifierTotal: ev.total };
    case 'status':
      return ev.phase === 'rollout'
        ? { ...state, rolloutComputed: ev.computed, rolloutTotal: ev.total }
        : { ...state, verifierComputed: ev.computed, verifierTotal: ev.total };
    case 'slice_complete': {
      const slices = { ...state.slices, [ev.sliceIndex]: { phase: ev.phase, result: ev.result } };
      return ev.phase === 'rollout'
        ? { ...state, slices, rolloutComputed: ev.computed, rolloutTotal: ev.total }
        : {
            ...state,
            slices,
            verifierComputed: ev.computed,
            verifierTotal: ev.total,
            status: 'verifying',
          };
    }
    case 'slice_error':
      return state;
    case 'job_done':
      return { ...state, status: 'done', winners: ev.winners };
    case 'job_failed':
      return { ...state, status: 'failed', error: ev.error };
    default:
      return state;
  }
}

export type Connection = 'connecting' | 'open' | 'reconnecting' | 'closed';

export function useJobStream(jobId: string, initial: Partial<JobState> = {}) {
  const [state, dispatch] = useReducer(jobReducer, { ...initialJobState, ...initial });
  const [connection, setConnection] = useState<Connection>('connecting');
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const closedRef = useRef(false);

  useEffect(() => {
    closedRef.current = false;

    function open() {
      if (closedRef.current) return;
      setConnection(retryRef.current === 0 ? 'connecting' : 'reconnecting');
      const es = new EventSource(`/api/jobs/${jobId}/stream`);
      esRef.current = es;
      es.onopen = () => {
        retryRef.current = 0;
        setConnection('open');
      };
      es.onmessage = (e) => {
        try {
          dispatch(JSON.parse(e.data));
        } catch {
          // ignore malformed payloads
        }
      };
      es.onerror = () => {
        es.close();
        if (closedRef.current) return;
        retryRef.current = Math.min(retryRef.current + 1, 6);
        const backoff = Math.min(1000 * 2 ** (retryRef.current - 1), 15_000);
        setConnection('reconnecting');
        window.setTimeout(open, backoff);
      };
    }

    open();
    return () => {
      closedRef.current = true;
      esRef.current?.close();
      setConnection('closed');
    };
  }, [jobId]);

  return { state, connection };
}

// Companion hook for the Distributor earnings stream. Same reconnection logic,
// but emits raw earnings_tick events so the dashboard can roll them up.
export type EarningsTick = {
  id: string;
  amountCents: number;
  at: number;
};

export function useDistributorTicks(distributorId: string, initial: EarningsTick[] = []) {
  const [ticks, setTicks] = useState<EarningsTick[]>(initial);
  const [connection, setConnection] = useState<Connection>('connecting');
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const closedRef = useRef(false);

  useEffect(() => {
    closedRef.current = false;

    function open() {
      if (closedRef.current) return;
      setConnection(retryRef.current === 0 ? 'connecting' : 'reconnecting');
      const es = new EventSource(`/api/distributors/${distributorId}/stream`);
      esRef.current = es;
      es.onopen = () => {
        retryRef.current = 0;
        setConnection('open');
      };
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'earnings_tick') {
            setTicks((prev) =>
              [
                {
                  id:
                    typeof crypto !== 'undefined' && 'randomUUID' in crypto
                      ? crypto.randomUUID()
                      : `${Date.now()}-${Math.random()}`,
                  amountCents: msg.amountCents,
                  at: Date.now(),
                },
                ...prev,
              ].slice(0, 50),
            );
          }
        } catch {
          // ignore malformed payloads
        }
      };
      es.onerror = () => {
        es.close();
        if (closedRef.current) return;
        retryRef.current = Math.min(retryRef.current + 1, 6);
        const backoff = Math.min(1000 * 2 ** (retryRef.current - 1), 15_000);
        setConnection('reconnecting');
        window.setTimeout(open, backoff);
      };
    }

    open();
    return () => {
      closedRef.current = true;
      esRef.current?.close();
      setConnection('closed');
    };
  }, [distributorId]);

  return { ticks, connection };
}
