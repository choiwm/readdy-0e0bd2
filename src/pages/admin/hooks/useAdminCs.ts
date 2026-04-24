import { useCallback, useState } from 'react';
import { getAuthorizationHeader } from '@/lib/env';
import type { CsTicket, Notice } from '../types';
import type { CsTicketStats } from '../components/CsTab';

const CS_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-cs`;

const INITIAL_CS_STATS: CsTicketStats = {
  total: 0,
  open: 0,
  in_progress: 0,
  resolved: 0,
  closed: 0,
  urgent: 0,
  high: 0,
};

export function useAdminCs() {
  const [csTickets, setCsTickets] = useState<CsTicket[]>([]);
  const [csLoading, setCsLoading] = useState(false);
  const [csTicketStats, setCsTicketStats] = useState<CsTicketStats>(INITIAL_CS_STATS);
  const [noticeList, setNoticeList] = useState<Notice[]>([]);

  const loadCsTickets = useCallback(async (statusFilter?: string) => {
    setCsLoading(true);
    try {
      const url = new URL(CS_URL);
      url.searchParams.set('action', 'list_tickets');
      url.searchParams.set('limit', '50');
      if (statusFilter && statusFilter !== 'all') url.searchParams.set('status', statusFilter);

      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();

      if (json.tickets && json.tickets.length > 0) {
        const mapped: CsTicket[] = json.tickets.map((t: Record<string, string>) => ({
          id:       t.id,
          user:     t.user_name ?? t.user_email ?? '알 수 없음',
          subject:  t.title,
          category: t.category,
          priority: t.priority,
          status:   t.status,
          date:     new Date(t.created_at).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, ''),
        }));
        setCsTickets(mapped);
      } else {
        setCsTickets([]);
      }
    } catch (e) {
      console.warn('CS tickets load failed:', e);
      setCsTickets([]);
    } finally {
      setCsLoading(false);
    }
  }, []);

  const loadCsTicketStats = useCallback(async () => {
    try {
      const url = new URL(CS_URL);
      url.searchParams.set('action', 'ticket_stats');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.stats) setCsTicketStats(json.stats);
    } catch (e) {
      console.warn('CS stats load failed:', e);
    }
  }, []);

  const loadNotices = useCallback(async () => {
    try {
      const url = new URL(CS_URL);
      url.searchParams.set('action', 'list_notices');
      url.searchParams.set('limit', '20');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.notices && json.notices.length > 0) {
        const mapped: Notice[] = json.notices.map((n: Record<string, string | number | boolean>) => ({
          id:     n.id as string,
          title:  n.title as string,
          type:   n.category as string,
          status: n.status as string,
          date:   new Date(n.created_at as string).toISOString().slice(0, 10).replace(/-/g, '.'),
          views:  n.view_count as number ?? 0,
        }));
        setNoticeList(mapped);
      } else {
        setNoticeList([]);
      }
    } catch (e) {
      console.warn('Notices load failed:', e);
      setNoticeList([]);
    }
  }, []);

  return {
    csTickets,
    setCsTickets,
    csLoading,
    csTicketStats,
    noticeList,
    setNoticeList,
    loadCsTickets,
    loadCsTicketStats,
    loadNotices,
  };
}
