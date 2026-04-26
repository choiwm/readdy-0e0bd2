# Audit Log Operational Queries

PR-shipped indexes (`migration 0008`) make these run in milliseconds even
on a million-row `audit_logs` table.

## Daily activity summary by role

```sql
select * from audit_role_activity_30d;
```

→ Powers the optional Slack daily-digest and the admin dashboard widget.

## High-risk actions in the last 7 days

```sql
select * from audit_high_risk_7d;
```

→ Used by the super_admin Slack alert wrapper (PR after this).
   Also paste into Supabase Studio when investigating "did anything weird
   happen this week?".

## Per-admin recent activity

```sql
select created_at, action, target_label, result
  from audit_logs
 where admin_email = 'admin@example.com'
 order by created_at desc
 limit 100;
```

→ When investigating a specific admin (offboarding, suspected compromise,
   user complaint).

## Failed attempts only (last 24h)

```sql
select created_at, admin_email, actor_role, action, target_label, detail
  from audit_logs
 where created_at >= now() - interval '24 hours'
   and result = 'failure'
 order by created_at desc;
```

→ Spot brute-force or buggy admin client patterns.

## Refunds processed by role last month

```sql
select actor_role, count(*) as refund_count, sum((detail::jsonb)->>'amount')::int as total_krw
  from audit_logs
 where action = '결제 환불 처리'
   and created_at >= date_trunc('month', now()) - interval '1 month'
   and created_at <  date_trunc('month', now())
 group by actor_role;
```

→ Monthly billing reconciliation.

## Admin role distribution (current state)

```sql
select role, count(*) filter (where is_active) as active,
              count(*) filter (where not is_active) as inactive
  from admin_accounts
 group by role
 order by case role
   when 'super_admin' then 1
   when 'ops'         then 2
   when 'cs'          then 3
   when 'billing'     then 4
 end;
```

→ Healthy distribution: ≥ 2 super_admins, role-balanced operations.
   If only 1 super_admin exists, the safeguard in PR #64 will block
   downgrade/delete attempts; consider adding a second.
