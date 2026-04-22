import { useCallback, useRef, useState } from 'react';
import { getAuthorizationHeader } from '@/lib/env';
import type { UserRecord, UserStats } from '../components/UsersTab';

const USERS_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`;

const INITIAL_USER_STATS: UserStats = {
  total: 0,
  active: 0,
  inactive: 0,
  suspended: 0,
  free: 0,
  pro: 0,
  enterprise: 0,
};

export function useAdminUsers() {
  const [usersData, setUsersData] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>(INITIAL_USER_STATS);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('전체');
  const [userGradeFilter, setUserGradeFilter] = useState('전체');
  const userSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUsers = useCallback(async (search?: string, plan?: string, grade?: string) => {
    setUsersLoading(true);
    try {
      const url = new URL(USERS_URL);
      url.searchParams.set('action', 'list_users');
      url.searchParams.set('limit', '50');
      if (search) url.searchParams.set('search', search);
      if (plan && plan !== '전체') url.searchParams.set('plan', plan.toLowerCase());
      const effectiveGrade = grade ?? userGradeFilter;
      if (effectiveGrade && effectiveGrade !== '전체') url.searchParams.set('grade', effectiveGrade);

      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();

      if (json.users && json.users.length > 0) {
        const mapped: UserRecord[] = json.users.map((u: Record<string, unknown>) => ({
          id: u.id as string,
          name: (u.display_name as string) ?? (u.email as string)?.split('@')[0] ?? '알 수 없음',
          email: u.email as string,
          plan: u.plan ? ((u.plan as string).charAt(0).toUpperCase() + (u.plan as string).slice(1)) : 'Free',
          credits: (u.credit_balance as number) ?? 0,
          joined: u.created_at
            ? new Date(u.created_at as string).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')
            : '-',
          status: (u.status as UserRecord['status']) ?? 'active',
          lastLogin: u.last_login_at
            ? new Date(u.last_login_at as string).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')
            : '-',
          loginIp: (u.last_login_ip as string) ?? '-',
          projects: (u.project_count as number) ?? 0,
          memberGrade: (u.member_grade as string) ?? 'general',
        }));
        setUsersData(mapped);
      } else {
        setUsersData([]);
      }
    } catch (e) {
      console.warn('Users load failed:', e);
      setUsersData([]);
    } finally {
      setUsersLoading(false);
    }
  }, [userGradeFilter]);

  const loadUserStats = useCallback(async () => {
    try {
      const url = new URL(USERS_URL);
      url.searchParams.set('action', 'user_stats');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.stats) setUserStats(json.stats);
    } catch (e) {
      console.warn('User stats load failed:', e);
    }
  }, []);

  return {
    usersData,
    setUsersData,
    usersLoading,
    userStats,
    userSearch,
    setUserSearch,
    userPlanFilter,
    setUserPlanFilter,
    userGradeFilter,
    setUserGradeFilter,
    userSearchDebounceRef,
    loadUsers,
    loadUserStats,
  };
}
