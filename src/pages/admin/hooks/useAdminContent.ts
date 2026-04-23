import { useCallback, useState } from 'react';
import { getAuthorizationHeader } from '@/lib/env';
import type { TeamRecord } from '../types';
import type { ContentDbItem, ContentDbStats, TeamStats } from '../components/ContentTab';

const CONTENT_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-content`;
const TEAMS_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-teams`;

const STATUS_MAP: Record<string, string> = { '승인': 'approved', '검토중': 'pending', '차단': 'blocked' };

const INITIAL_TEAM_STATS: TeamStats = { total: 0, active: 0, inactive: 0, total_members: 0 };

type ContentDbItemEx = ContentDbItem & { source?: string; model?: string };

export function useAdminContent() {
  const [contentDbItems, setContentDbItems] = useState<ContentDbItemEx[]>([]);
  const [contentDbStats, setContentDbStats] = useState<ContentDbStats | null>(null);
  const [contentDbLoading, setContentDbLoading] = useState(false);
  const [teamsData, setTeamsData] = useState<TeamRecord[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamStats, setTeamStats] = useState<TeamStats>(INITIAL_TEAM_STATS);

  const loadContentItems = useCallback(async (statusFilter?: string) => {
    setContentDbLoading(true);
    try {
      const url = new URL(CONTENT_URL);
      url.searchParams.set('action', 'list');
      url.searchParams.set('limit', '30');
      if (statusFilter && statusFilter !== '전체') {
        const mapped = STATUS_MAP[statusFilter];
        if (mapped) url.searchParams.set('status', mapped);
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.items) setContentDbItems(data.items);
    } catch (e) {
      console.warn('Content items load failed:', e);
    } finally {
      setContentDbLoading(false);
    }
  }, []);

  const loadContentStats = useCallback(async () => {
    try {
      const url = new URL(CONTENT_URL);
      url.searchParams.set('action', 'stats');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.stats) setContentDbStats(data.stats);
    } catch (e) {
      console.warn('Content stats load failed:', e);
    }
  }, []);

  const loadTeams = useCallback(async () => {
    setTeamsLoading(true);
    try {
      const headers = { Authorization: getAuthorizationHeader() };
      const [teamsRes, statsRes] = await Promise.allSettled([
        fetch(`${TEAMS_URL}?action=list_teams`, { headers }),
        fetch(`${TEAMS_URL}?action=team_stats`, { headers }),
      ]);
      if (teamsRes.status === 'fulfilled') {
        const data = await teamsRes.value.json();
        if (data.teams) setTeamsData(data.teams);
      }
      if (statsRes.status === 'fulfilled') {
        const data = await statsRes.value.json();
        if (data.stats) setTeamStats(data.stats);
      }
    } catch (e) {
      console.warn('Teams load failed:', e);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  return {
    contentDbItems,
    setContentDbItems,
    contentDbStats,
    contentDbLoading,
    teamsData,
    setTeamsData,
    teamsLoading,
    teamStats,
    loadContentItems,
    loadContentStats,
    loadTeams,
  };
}
