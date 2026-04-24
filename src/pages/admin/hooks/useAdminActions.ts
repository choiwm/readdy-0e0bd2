import type { Dispatch, SetStateAction } from 'react';
import { getAuthorizationHeader } from '@/lib/env';
import type { Notice, CsTicket, AdminAccount, PaymentRecord } from '../types';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;

function buildUrl(fn: string, action: string): URL {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${fn}`);
  url.searchParams.set('action', action);
  return url;
}

const jsonHeaders = () => ({
  'Authorization': getAuthorizationHeader(),
  'Content-Type': 'application/json',
});

// ── CS: ticket reply + status change ─────────────────────────────────────────
export async function ticketStatusChange(ticketId: string, status: string, replyContent?: string): Promise<void> {
  try {
    if (replyContent) {
      const url = buildUrl('admin-cs', 'reply_ticket');
      await fetch(url.toString(), {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ id: ticketId, reply_content: replyContent, new_status: status }),
      });
    } else {
      const url = buildUrl('admin-cs', 'update_ticket_status');
      await fetch(url.toString(), {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ id: ticketId, status }),
      });
    }
  } catch (e) {
    console.warn('Ticket status update failed:', e);
  }
}

// ── CS: notice save ──────────────────────────────────────────────────────────
export async function noticeSave(
  notice: Notice,
  existing: Notice[],
  setNoticeList: Dispatch<SetStateAction<Notice[]>>,
): Promise<Notice> {
  const isExisting = existing.some((n) => n.id === notice.id);
  let saved = notice;
  try {
    if (isExisting) {
      const url = buildUrl('admin-cs', 'update_notice');
      await fetch(url.toString(), {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({
          id:       notice.id,
          title:    notice.title,
          category: notice.type,
          status:   notice.status,
        }),
      });
    } else {
      const url = buildUrl('admin-cs', 'create_notice');
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          title:    notice.title,
          content:  notice.title,
          category: notice.type,
          status:   notice.status,
        }),
      });
      const json = await res.json();
      if (json.notice) saved = { ...notice, id: json.notice.id };
    }
  } catch (e) {
    console.warn('Notice save failed:', e);
  }
  setNoticeList((prev) => {
    const exists = prev.find((n) => n.id === saved.id);
    if (exists) return prev.map((n) => n.id === saved.id ? saved : n);
    return [saved, ...prev];
  });
  return saved;
}

// ── CS: notice delete ────────────────────────────────────────────────────────
export async function noticeDelete(
  noticeId: string,
  setNoticeList: Dispatch<SetStateAction<Notice[]>>,
): Promise<void> {
  try {
    const url = buildUrl('admin-cs', 'delete_notice');
    url.searchParams.set('id', noticeId);
    await fetch(url.toString(), {
      method: 'DELETE',
      headers: { 'Authorization': getAuthorizationHeader() },
    });
  } catch (e) {
    console.warn('Notice delete failed:', e);
  }
  setNoticeList((prev) => prev.filter((n) => n.id !== noticeId));
}

// ── CS: push / email send ────────────────────────────────────────────────────
export async function sendPushMail(
  type: 'push' | 'email',
  payload: { subject?: string; message: string; target: string },
): Promise<void> {
  try {
    const url = buildUrl('admin-cs', type === 'email' ? 'send_email' : 'send_push');
    await fetch(url.toString(), {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        subject:     payload.subject,
        message:     payload.message,
        target_plan: payload.target,
      }),
    });
  } catch (e) {
    console.warn('Send push/mail failed:', e);
  }
}

// ── Billing: refund ──────────────────────────────────────────────────────────
export async function paymentRefund(
  payId: string,
  paymentsData: PaymentRecord[],
  setPaymentsData: Dispatch<SetStateAction<PaymentRecord[]>>,
  localPayments: PaymentRecord[],
  setLocalPayments: Dispatch<SetStateAction<PaymentRecord[]>>,
): Promise<void> {
  try {
    const url = buildUrl('admin-billing', 'refund_payment');
    await fetch(url.toString(), {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ id: payId }),
    });
  } catch (e) {
    console.warn('Refund failed:', e);
  }
  const targetList = paymentsData.length > 0 ? paymentsData : localPayments;
  const updated = targetList.map((p) => p.id === payId ? { ...p, status: 'refunded' } : p);
  if (paymentsData.length > 0) setPaymentsData(updated);
  else setLocalPayments(updated);
}

// ── Security: update admin permissions ───────────────────────────────────────
export async function savePermissions(
  adminId: string,
  permissions: string[],
  setAdminAccounts: Dispatch<SetStateAction<AdminAccount[]>>,
  adminAccountsData: AdminAccount[],
  setAdminAccountsData: Dispatch<SetStateAction<AdminAccount[]>>,
): Promise<void> {
  try {
    const url = buildUrl('admin-security', 'update_admin');
    await fetch(url.toString(), {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ id: adminId, permissions }),
    });
  } catch (e) {
    console.warn('Permission update failed:', e);
  }
  setAdminAccounts((prev) => prev.map((a) => a.id === adminId ? { ...a, permissions } : a));
  if (adminAccountsData.length > 0) {
    setAdminAccountsData((prev) => prev.map((a) => a.id === adminId ? { ...a, permissions } : a));
  }
}

export type { CsTicket };
