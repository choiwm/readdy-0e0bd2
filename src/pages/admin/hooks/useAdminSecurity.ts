import { useCallback, useState } from 'react';
import { getAuthorizationHeader } from '@/lib/env';
import type { AdminAccount, IpBlock } from '../types';

const SECURITY_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-security`;

interface BlockIpResult {
  ok: boolean;
  ip: string;
}

interface UnblockIpResult {
  ok: boolean;
  ip: string;
}

interface CreateAdminResult {
  ok: boolean;
  name: string;
}

export function useAdminSecurity() {
  const [ipBlockList, setIpBlockList] = useState<IpBlock[]>([]);
  const [ipBlockInput, setIpBlockInput] = useState('');
  const [ipBlockReason, setIpBlockReason] = useState('');

  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('CS Manager');
  const [newAdminPerms, setNewAdminPerms] = useState<string[]>([]);

  const blockIp = useCallback(async (
    ipBlocksData: IpBlock[],
    setIpBlocksData: (updater: (prev: IpBlock[]) => IpBlock[]) => void,
    reload: () => Promise<void>,
  ): Promise<BlockIpResult | null> => {
    const ip = ipBlockInput.trim();
    if (!ip) return null;
    const reason = ipBlockReason || '수동 차단';
    try {
      const url = new URL(SECURITY_URL);
      url.searchParams.set('action', 'block_ip');
      await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ip_address: ip, reason }),
      });
      await reload();
    } catch (e) {
      console.warn('IP block failed:', e);
      const newBlock: IpBlock = {
        ip,
        reason,
        blockedAt: new Date().toLocaleString('ko-KR'),
        blockedBy: 'admin',
        status: 'active',
      };
      if (ipBlocksData.length > 0) setIpBlocksData((prev) => [newBlock, ...prev]);
      else setIpBlockList((prev) => [newBlock, ...prev]);
    }
    setIpBlockInput('');
    setIpBlockReason('');
    return { ok: true, ip };
  }, [ipBlockInput, ipBlockReason]);

  const unblockIp = useCallback(async (
    ip: string,
    ipBlocksData: IpBlock[],
    setIpBlocksData: (updater: (prev: IpBlock[]) => IpBlock[]) => void,
  ): Promise<UnblockIpResult | null> => {
    const displayBlocks = ipBlocksData.length > 0 ? ipBlocksData : ipBlockList;
    const block = displayBlocks.find((b) => b.ip === ip) as (IpBlock & { _id?: string }) | undefined;
    if (!block) return null;
    try {
      const url = new URL(SECURITY_URL);
      url.searchParams.set('action', 'unblock_ip');
      await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: block._id ?? block.ip }),
      });
      if (ipBlocksData.length > 0) {
        setIpBlocksData((prev) => prev.map((b) => b.ip === ip ? { ...b, status: 'released' as const } : b));
      } else {
        setIpBlockList((prev) => prev.map((b) => b.ip === ip ? { ...b, status: 'released' as const } : b));
      }
    } catch (e) {
      console.warn('IP unblock failed:', e);
      setIpBlockList((prev) => prev.map((b) => b.ip === ip ? { ...b, status: 'released' as const } : b));
    }
    return { ok: true, ip };
  }, [ipBlockList]);

  const createAdmin = useCallback(async (
    setAdminAccounts: (updater: (prev: AdminAccount[]) => AdminAccount[]) => void,
    reload: () => Promise<void>,
  ): Promise<CreateAdminResult | null> => {
    const name = newAdminName.trim();
    const email = newAdminEmail.trim();
    if (!name || !email) return null;
    try {
      const url = new URL(SECURITY_URL);
      url.searchParams.set('action', 'create_admin');
      await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          display_name: name,
          role: newAdminRole,
          permissions: newAdminPerms.length > 0 ? newAdminPerms : [],
        }),
      });
      await reload();
    } catch (e) {
      console.warn('Add admin failed:', e);
      const newAdmin: AdminAccount = {
        id: `ADM-${String(Date.now()).slice(-3)}`,
        name,
        email,
        role: newAdminRole,
        twofa: false,
        lastLogin: '-',
        loginIp: '-',
        permissions: newAdminPerms.length > 0 ? newAdminPerms : ['없음'],
      };
      setAdminAccounts((prev) => [...prev, newAdmin]);
    }
    setNewAdminName('');
    setNewAdminEmail('');
    setNewAdminRole('CS Manager');
    setNewAdminPerms([]);
    return { ok: true, name };
  }, [newAdminName, newAdminEmail, newAdminRole, newAdminPerms]);

  return {
    ipBlockList,
    setIpBlockList,
    ipBlockInput, setIpBlockInput,
    ipBlockReason, setIpBlockReason,
    newAdminName, setNewAdminName,
    newAdminEmail, setNewAdminEmail,
    newAdminRole, setNewAdminRole,
    newAdminPerms, setNewAdminPerms,
    blockIp,
    unblockIp,
    createAdmin,
  };
}
