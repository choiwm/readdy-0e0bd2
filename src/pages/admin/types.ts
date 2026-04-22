export type TabType = 'overview' | 'users' | 'content' | 'ai-engine' | 'billing' | 'cs' | 'cs-notice' | 'audit' | 'sys-settings' | 'security';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type ContentStatus = 'approved' | 'pending' | 'blocked';
export type NotifLevel = 'critical' | 'warning' | 'info' | 'success';

export interface Notification {
  id: string;
  level: NotifLevel;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  category: 'api' | 'cs' | 'system' | 'billing' | 'user';
}

export interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
  credits: number;
  joined: string;
  status: UserStatus;
  lastLogin: string;
  loginIp: string;
  projects: number;
}

export interface ContentItem {
  id: string;
  title: string;
  user: string;
  type: string;
  status: ContentStatus;
  date: string;
  rating: number;
  thumbnail: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  model: string;
  lastUpdated: string;
  usageCount: number;
  active: boolean;
}

export interface Coupon {
  code: string;
  discount: string;
  type: string;
  used: number;
  limit: number;
  expires: string;
  active: boolean;
}

export interface CsTicket {
  id: string;
  user: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  date: string;
}

export interface Notice {
  id: string;
  title: string;
  type: string;
  status: string;
  date: string;
  views: number;
}

export interface IpBlock {
  ip: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
  status: 'active' | 'released';
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  twofa: boolean;
  lastLogin: string;
  loginIp: string;
  permissions: string[];
}

export interface PaymentRecord {
  id: string;
  user: string;
  plan: string;
  amount: string;
  date: string;
  status: string;
  method: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  status: 'active' | 'inactive' | 'archived';
  content_access: 'shared' | 'private' | 'restricted';
  max_members: number;
  member_count: number;
  created_at: string;
}
