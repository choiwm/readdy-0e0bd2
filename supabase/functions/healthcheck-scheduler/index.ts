import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, requireSchedulerSecret, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

function err(msg: string, status = 400) { return json({ error: msg }, status); }

// ── 암호화 키 파생: SHA-256 해시로 항상 정확히 32바이트 생성 (aes_v2) ──
async function getEncryptionKeyV2(): Promise<CryptoKey> {
  const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decryptKey(encrypted: string): Promise<string | null> {
  if (!encrypted) return null;
  try {
    // ── aes_v2: SHA-256 해시 기반 (현재 방식) ──
    if (encrypted.startsWith('aes_v2:')) {
      const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
      const key = await getEncryptionKeyV2();
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
      return new TextDecoder().decode(decrypted);
    }
    // ── aes_v1: 구버전 (slice 방식) — 복호화 시도, 실패하면 null ──
    if (encrypted.startsWith('aes_v1:')) {
      try {
        const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
        const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
        const legacyKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.slice(0, 32).padEnd(32, '0')), { name: 'AES-GCM' }, false, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, legacyKey, combined.slice(12));
        return new TextDecoder().decode(decrypted);
      } catch {
        console.warn('aes_v1 decryption failed');
        return null;
      }
    }
    if (encrypted.startsWith('enc_v1:')) {
      const parts = encrypted.split(':');
      if (parts.length >= 3) { try { return atob(parts[2]); } catch { return null; } }
    }
    return encrypted;
  } catch (e) { console.error('decryptKey error:', e); return null; }
}

async function testServiceKey(slug: string, rawKey: string): Promise<{ success: boolean; message: string; latency_ms: number }> {
  const startTime = Date.now();
  let testSuccess = false;
  let testResult = 'unknown';
  try {
    if (slug === 'fal') {
      const res = await fetch('https://fal.run/fal-ai/flux/schnell', { method: 'POST', headers: { 'Authorization': `Key ${rawKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'healthcheck', image_size: { width: 64, height: 64 }, num_images: 1 }), signal: AbortSignal.timeout(15000) });
      testSuccess = res.status !== 401 && res.status !== 403;
      testResult = testSuccess ? `fal.ai 연결 성공 (HTTP ${res.status})` : `인증 실패 (HTTP ${res.status})`;
    } else if (slug === 'goapi') {
      const res = await fetch('https://api.goapi.ai/api/flux/v1/image', { method: 'POST', headers: { 'x-api-key': rawKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'flux-realism', prompt: 'healthcheck', image_size: { width: 64, height: 64 } }), signal: AbortSignal.timeout(15000) });
      testSuccess = res.status !== 401 && res.status !== 403;
      testResult = testSuccess ? `GoAPI 연결 성공 (HTTP ${res.status})` : `인증 실패 (HTTP ${res.status})`;
    } else if (slug === 'elevenlabs') {
      const res = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': rawKey }, signal: AbortSignal.timeout(10000) });
      testSuccess = res.ok;
      testResult = testSuccess ? 'ElevenLabs 연결 성공' : `HTTP ${res.status}`;
    } else if (slug === 'suno') {
      const res = await fetch('https://api.goapi.ai/api/suno/v1/music', { method: 'POST', headers: { 'x-api-key': rawKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ custom_mode: false, prompt: 'healthcheck', mv: 'chirp-v3-5', wait_audio: false }), signal: AbortSignal.timeout(15000) });
      testSuccess = res.status !== 401 && res.status !== 403;
      testResult = testSuccess ? `Suno API 연결 성공 (HTTP ${res.status})` : `인증 실패 (HTTP ${res.status})`;
    } else if (slug === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${rawKey}` }, signal: AbortSignal.timeout(10000) });
      testSuccess = res.ok;
      testResult = testSuccess ? 'OpenAI 연결 성공' : `HTTP ${res.status}`;
    } else if (slug === 'lalalai' || slug === 'lalal') {
      testSuccess = rawKey.length > 10;
      testResult = testSuccess ? 'LALAL.AI 키 형식 확인됨' : '키가 너무 짧습니다';
    } else {
      testSuccess = rawKey.length > 10;
      testResult = testSuccess ? '키 형식 확인됨' : '키가 너무 짧습니다';
    }
  } catch (e) {
    const errMsg = String(e);
    testResult = errMsg.includes('timeout') || errMsg.includes('AbortError') ? '연결 타임아웃 (15초 초과)' : `연결 오류: ${errMsg.slice(0, 60)}`;
    testSuccess = false;
  }
  return { success: testSuccess, message: testResult, latency_ms: Date.now() - startTime };
}

interface EmailSettings {
  enabled: boolean;
  admin_emails: string[];
  failure_threshold: number;
  cooldown_minutes: number;
  last_sent_at: string | null;
  email_subject_prefix: string;
  notify_on_recovery: boolean;
}

interface SlackSettings {
  enabled: boolean;
  webhook_url: string;
  channel: string;
  failure_threshold: number;
  cooldown_minutes: number;
  last_sent_at: string | null;
  notify_on_recovery: boolean;
  mention_channel: boolean;
}

async function getAllSettings(supabase: ReturnType<typeof createClient>): Promise<{ email: EmailSettings; slack: SlackSettings }> {
  const { data } = await supabase.from('alert_email_settings').select('setting_key, setting_value');
  const map: Record<string, string | null> = {};
  (data ?? []).forEach((row: { setting_key: string; setting_value: string | null }) => { map[row.setting_key] = row.setting_value; });
  let adminEmails: string[] = [];
  try { adminEmails = JSON.parse(map['admin_emails'] ?? '[]'); } catch { adminEmails = []; }
  const email: EmailSettings = { enabled: map['enabled'] === 'true', admin_emails: adminEmails, failure_threshold: parseInt(map['failure_threshold'] ?? '3'), cooldown_minutes: parseInt(map['cooldown_minutes'] ?? '60'), last_sent_at: map['last_sent_at'] ?? null, email_subject_prefix: map['email_subject_prefix'] ?? '[Readdy AI 알림]', notify_on_recovery: map['notify_on_recovery'] !== 'false' };
  const slack: SlackSettings = { enabled: map['slack_enabled'] === 'true', webhook_url: map['slack_webhook_url'] ?? '', channel: map['slack_channel'] ?? '#alerts', failure_threshold: parseInt(map['slack_failure_threshold'] ?? '3'), cooldown_minutes: parseInt(map['slack_cooldown_minutes'] ?? '60'), last_sent_at: map['slack_last_sent_at'] ?? null, notify_on_recovery: map['slack_notify_on_recovery'] !== 'false', mention_channel: map['slack_mention_channel'] === 'true' };
  return { email, slack };
}

async function getEmailSettings(supabase: ReturnType<typeof createClient>): Promise<EmailSettings> { const { email } = await getAllSettings(supabase); return email; }
async function getSlackSettings(supabase: ReturnType<typeof createClient>): Promise<SlackSettings> { const { slack } = await getAllSettings(supabase); return slack; }

async function sendSlackMessage(webhookUrl: string, payload: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
    if (res.ok) return { success: true };
    const text = await res.text().catch(() => '');
    return { success: false, error: `HTTP ${res.status}: ${text}` };
  } catch (e) { return { success: false, error: String(e) }; }
}

function buildSlackFailurePayload(params: { failedServices: Array<{ service_name: string; slug: string; failures: number; message: string }>; threshold: number; timestamp: string; mentionChannel: boolean; channel: string; }): Record<string, unknown> {
  const { failedServices, threshold, timestamp, mentionChannel, channel } = params;
  const isMultiple = failedServices.length > 1;
  const title = isMultiple ? `🚨 ${failedServices.length}개 API 서비스 연결 실패` : `🚨 ${failedServices[0].service_name} API 연결 실패`;
  const serviceFields = failedServices.map((f) => ({ type: 'mrkdwn', text: `*${f.service_name}*\n연속 ${f.failures}회 실패\n\`${f.message.slice(0, 80)}\`` }));
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `${mentionChannel ? '<!channel> ' : ''}API 키가 *${threshold}회 이상 연속으로 연결 테스트에 실패*했습니다.` } },
    { type: 'divider' },
    { type: 'section', fields: serviceFields.slice(0, 10) },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `🕐 발생 시각: ${new Date(timestamp).toLocaleString('ko-KR')} | Readdy AI 헬스체크 시스템` }] },
    { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: '관리자 패널 확인', emoji: true }, style: 'danger', url: 'https://readdy.ai/admin' }] },
  ];
  return { channel, username: 'Readdy AI 헬스체크', icon_emoji: ':rotating_light:', text: title, blocks };
}

function buildSlackRecoveryPayload(params: { serviceName: string; timestamp: string; latencyMs: number; channel: string; }): Record<string, unknown> {
  const { serviceName, timestamp, latencyMs, channel } = params;
  return { channel, username: 'Readdy AI 헬스체크', icon_emoji: ':white_check_mark:', text: `✅ ${serviceName} API 연결 복구됨`, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `✅ *${serviceName}* API 키가 정상적으로 연결되었습니다.` }, fields: [{ type: 'mrkdwn', text: `*복구 시각*\n${new Date(timestamp).toLocaleString('ko-KR')}` }, { type: 'mrkdwn', text: `*응답 시간*\n${latencyMs}ms` }] }] };
}

async function sendSlackFailureAlert(supabase: ReturnType<typeof createClient>, slackSettings: SlackSettings, failedServices: Array<{ service_name: string; slug: string; failures: number; message: string }>, timestamp: string): Promise<void> {
  if (!slackSettings.enabled || !slackSettings.webhook_url) return;
  if (failedServices.length === 0) return;
  if (slackSettings.last_sent_at) { const lastSent = new Date(slackSettings.last_sent_at).getTime(); const cooldownMs = slackSettings.cooldown_minutes * 60 * 1000; if (Date.now() - lastSent < cooldownMs) { console.log(`Slack cooldown active.`); return; } }
  const payload = buildSlackFailurePayload({ failedServices, threshold: slackSettings.failure_threshold, timestamp, mentionChannel: slackSettings.mention_channel, channel: slackSettings.channel });
  const result = await sendSlackMessage(slackSettings.webhook_url, payload);
  await supabase.from('alert_email_settings').update({ setting_value: timestamp, updated_at: timestamp }).eq('setting_key', 'slack_last_sent_at');
  if (result.success) { await supabase.from('notifications').insert({ type: 'system', title: `슬랙 알림 발송: ${failedServices.map((f) => f.service_name).join(', ')}`, message: `슬랙 채널 ${slackSettings.channel}에 헬스체크 실패 알림 발송 완료`, is_read: false, created_at: timestamp }); console.log('Slack failure alert sent successfully'); }
  else { console.error('Slack failure alert failed:', result.error); }
}

async function sendSlackRecoveryAlert(supabase: ReturnType<typeof createClient>, slackSettings: SlackSettings, serviceName: string, timestamp: string, latencyMs: number): Promise<void> {
  if (!slackSettings.enabled || !slackSettings.webhook_url) return;
  if (!slackSettings.notify_on_recovery) return;
  const payload = buildSlackRecoveryPayload({ serviceName, timestamp, latencyMs, channel: slackSettings.channel });
  await sendSlackMessage(slackSettings.webhook_url, payload);
}

async function sendAlertEmail(supabase: ReturnType<typeof createClient>, toEmails: string[], subject: string, html: string, text: string): Promise<{ success: boolean; sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;
  for (const email of toEmails) {
    try {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (resendKey) {
        const resendRes = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('ALERT_FROM_EMAIL') ?? 'noreply@readdy.ai', to: [email], subject, html, text }) });
        if (resendRes.ok) { sent++; } else { const errData = await resendRes.json().catch(() => ({})); errors.push(`${email}: Resend 오류 — ${JSON.stringify(errData)}`); }
      } else {
        await supabase.from('email_queue').insert({ to_email: email, subject, html_body: html, text_body: text, status: 'pending', created_at: new Date().toISOString() }).maybeSingle();
        sent++;
      }
    } catch (e) { errors.push(`${email}: ${String(e)}`); }
  }
  return { success: sent > 0, sent, errors };
}

async function sendFailureAlert(supabase: ReturnType<typeof createClient>, emailSettings: EmailSettings, failedServices: Array<{ service_name: string; slug: string; failures: number; message: string }>, timestamp: string): Promise<void> {
  if (!emailSettings.enabled || emailSettings.admin_emails.length === 0) return;
  if (failedServices.length === 0) return;
  if (emailSettings.last_sent_at) { const lastSent = new Date(emailSettings.last_sent_at).getTime(); const cooldownMs = emailSettings.cooldown_minutes * 60 * 1000; if (Date.now() - lastSent < cooldownMs) return; }
  const primary = failedServices[0];
  const subject = `[Readdy AI 알림] ${primary.service_name} API 연결 실패 (${primary.failures}회 연속)`;
  const html = `<h2>API 연결 실패 알림</h2><p>${failedServices.map(f => `${f.service_name}: ${f.failures}회 연속 실패 — ${f.message}`).join('<br>')}</p>`;
  const text = `API 연결 실패\n${failedServices.map(f => `${f.service_name}: ${f.failures}회 연속 실패 — ${f.message}`).join('\n')}`;
  const result = await sendAlertEmail(supabase, emailSettings.admin_emails, subject, html, text);
  await supabase.from('alert_email_settings').update({ setting_value: timestamp, updated_at: timestamp }).eq('setting_key', 'last_sent_at');
  await supabase.from('notifications').insert({ type: 'system', title: `이메일 알림 발송: ${failedServices.map((f) => f.service_name).join(', ')}`, message: `${emailSettings.admin_emails.length}명에게 헬스체크 실패 알림 이메일 발송 (성공: ${result.sent}건)`, is_read: false, created_at: timestamp });
}

async function sendRecoveryAlert(supabase: ReturnType<typeof createClient>, emailSettings: EmailSettings, serviceName: string, timestamp: string, latencyMs: number): Promise<void> {
  if (!emailSettings.enabled || !emailSettings.notify_on_recovery) return;
  if (emailSettings.admin_emails.length === 0) return;
  const subject = `[Readdy AI 알림] ${serviceName} API 연결 복구됨`;
  const html = `<h2>${serviceName} 연결 복구</h2><p>복구 시각: ${new Date(timestamp).toLocaleString('ko-KR')}, 응답 시간: ${latencyMs}ms</p>`;
  const text = `${serviceName} 연결 복구\n복구 시각: ${new Date(timestamp).toLocaleString('ko-KR')}\n응답 시간: ${latencyMs}ms`;
  await sendAlertEmail(supabase, emailSettings.admin_emails, subject, html, text);
}

interface TestHistoryEntry { tested_at: string; success: boolean; message: string; latency_ms?: number; triggered_by?: string; }

async function appendTestHistory(supabase: ReturnType<typeof createClient>, slug: string, entry: TestHistoryEntry, consecutiveFailures: number) {
  const { data } = await supabase.from('api_keys').select('test_history').eq('service_slug', slug).maybeSingle();
  const existing: TestHistoryEntry[] = Array.isArray(data?.test_history) ? data.test_history : [];
  const updated = [entry, ...existing].slice(0, 50);
  const now = new Date().toISOString();
  const nextRunMs = Date.now() + (60 * 60 * 1000);
  await supabase.from('api_keys').update({ test_history: updated, last_tested_at: entry.tested_at, test_result: entry.message, status: entry.success ? 'active' : 'error', healthcheck_last_run_at: now, healthcheck_next_run_at: new Date(nextRunMs).toISOString(), healthcheck_consecutive_failures: consecutiveFailures, updated_at: now }).eq('service_slug', slug);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  const err = (msg: string, status = 400) => json({ error: msg }, status);
  // 스케줄러 비밀 헤더 또는 관리자 JWT 둘 중 하나로 인증
  try {
    try {
      requireSchedulerSecret(req);
    } catch (schedErr) {
      if (!(schedErr instanceof AuthFailure)) throw schedErr;
      await requireAdmin(req);
    }
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return err('Server configuration error', 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'run';

  if (req.method === 'GET' && action === 'get_schedule') {
    const { data, error } = await supabase.from('api_keys').select('service_slug, service_name, healthcheck_enabled, healthcheck_interval_min, healthcheck_last_run_at, healthcheck_next_run_at, healthcheck_consecutive_failures, status').order('service_name');
    if (error) return err(error.message);
    return json({ schedules: data ?? [] });
  }

  if (req.method === 'GET' && action === 'get_logs') {
    const limit = parseInt(url.searchParams.get('limit') ?? '20');
    const { data, error } = await supabase.from('healthcheck_logs').select('*').order('run_at', { ascending: false }).limit(limit);
    if (error) return err(error.message);
    return json({ logs: data ?? [] });
  }

  if (req.method === 'GET' && action === 'get_email_settings') { const settings = await getEmailSettings(supabase); return json({ settings }); }
  if (req.method === 'GET' && action === 'get_slack_settings') {
    const settings = await getSlackSettings(supabase);
    const masked = { ...settings, webhook_url: settings.webhook_url ? settings.webhook_url.replace(/\/[^/]+$/, '/****') : '', webhook_url_set: !!settings.webhook_url };
    return json({ settings: masked });
  }

  if (req.method === 'PATCH' && action === 'update_email_settings') {
    let body: Partial<EmailSettings> | null = null;
    try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
    if (!body) return err('body required');
    const now = new Date().toISOString();
    const updates: Array<{ setting_key: string; setting_value: string; updated_at: string }> = [];
    if (body.enabled !== undefined) updates.push({ setting_key: 'enabled', setting_value: String(body.enabled), updated_at: now });
    if (body.admin_emails !== undefined) updates.push({ setting_key: 'admin_emails', setting_value: JSON.stringify(body.admin_emails), updated_at: now });
    if (body.failure_threshold !== undefined) updates.push({ setting_key: 'failure_threshold', setting_value: String(Math.max(1, Math.min(10, body.failure_threshold))), updated_at: now });
    if (body.cooldown_minutes !== undefined) updates.push({ setting_key: 'cooldown_minutes', setting_value: String(Math.max(5, body.cooldown_minutes)), updated_at: now });
    if (body.email_subject_prefix !== undefined) updates.push({ setting_key: 'email_subject_prefix', setting_value: body.email_subject_prefix, updated_at: now });
    if (body.notify_on_recovery !== undefined) updates.push({ setting_key: 'notify_on_recovery', setting_value: String(body.notify_on_recovery), updated_at: now });
    for (const u of updates) { await supabase.from('alert_email_settings').update({ setting_value: u.setting_value, updated_at: u.updated_at }).eq('setting_key', u.setting_key); }
    return json({ success: true });
  }

  if (req.method === 'PATCH' && action === 'update_slack_settings') {
    let body: Partial<SlackSettings & { webhook_url_raw?: string }> | null = null;
    try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
    if (!body) return err('body required');
    const now = new Date().toISOString();
    const updates: Array<{ setting_key: string; setting_value: string; updated_at: string }> = [];
    if (body.enabled !== undefined) updates.push({ setting_key: 'slack_enabled', setting_value: String(body.enabled), updated_at: now });
    if (body.webhook_url !== undefined && body.webhook_url !== '' && !body.webhook_url.includes('****')) updates.push({ setting_key: 'slack_webhook_url', setting_value: body.webhook_url, updated_at: now });
    if (body.channel !== undefined) updates.push({ setting_key: 'slack_channel', setting_value: body.channel, updated_at: now });
    if (body.failure_threshold !== undefined) updates.push({ setting_key: 'slack_failure_threshold', setting_value: String(Math.max(1, Math.min(10, body.failure_threshold))), updated_at: now });
    if (body.cooldown_minutes !== undefined) updates.push({ setting_key: 'slack_cooldown_minutes', setting_value: String(Math.max(5, body.cooldown_minutes)), updated_at: now });
    if (body.notify_on_recovery !== undefined) updates.push({ setting_key: 'slack_notify_on_recovery', setting_value: String(body.notify_on_recovery), updated_at: now });
    if (body.mention_channel !== undefined) updates.push({ setting_key: 'slack_mention_channel', setting_value: String(body.mention_channel), updated_at: now });
    for (const u of updates) { await supabase.from('alert_email_settings').update({ setting_value: u.setting_value, updated_at: u.updated_at }).eq('setting_key', u.setting_key); }
    return json({ success: true });
  }

  if (req.method === 'POST' && action === 'send_test_email') {
    const emailSettings = await getEmailSettings(supabase);
    if (emailSettings.admin_emails.length === 0) return err('수신 이메일이 설정되지 않았습니다');
    const result = await sendAlertEmail(supabase, emailSettings.admin_emails, '[테스트] Readdy AI 헬스체크 알림', '<h2>테스트 이메일</h2><p>이것은 테스트 알림입니다.</p>', '테스트 이메일입니다.');
    return json({ success: result.success, sent: result.sent, errors: result.errors, message: result.success ? `${result.sent}명에게 테스트 이메일을 발송했습니다` : `발송 실패: ${result.errors.join(', ')}` });
  }

  if (req.method === 'POST' && action === 'send_test_slack') {
    const slackSettings = await getSlackSettings(supabase);
    if (!slackSettings.webhook_url) return err('Slack Webhook URL이 설정되지 않았습니다');
    const now = new Date().toISOString();
    const payload = buildSlackFailurePayload({ failedServices: [{ service_name: 'fal.ai (테스트)', slug: 'fal', failures: 3, message: '이것은 테스트 알림입니다.' }], threshold: slackSettings.failure_threshold, timestamp: now, mentionChannel: slackSettings.mention_channel, channel: slackSettings.channel });
    (payload as Record<string, unknown>).text = '🧪 [테스트] ' + (payload as Record<string, unknown>).text;
    const result = await sendSlackMessage(slackSettings.webhook_url, payload);
    return json({ success: result.success, error: result.error, message: result.success ? `슬랙 채널 ${slackSettings.channel}에 테스트 메시지를 발송했습니다` : `발송 실패: ${result.error}` });
  }

  if (req.method === 'PATCH' && action === 'update_schedule') {
    let body: { service_slug?: string; healthcheck_enabled?: boolean; healthcheck_interval_min?: number } | null = null;
    try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
    if (!body?.service_slug) return err('service_slug required');
    const { service_slug, healthcheck_enabled, healthcheck_interval_min } = body;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (healthcheck_enabled !== undefined) updateData.healthcheck_enabled = healthcheck_enabled;
    if (healthcheck_interval_min !== undefined) { const validIntervals = [30, 60, 120, 360, 720, 1440]; updateData.healthcheck_interval_min = validIntervals.includes(healthcheck_interval_min) ? healthcheck_interval_min : 60; if (healthcheck_enabled !== false) updateData.healthcheck_next_run_at = new Date(Date.now() + (updateData.healthcheck_interval_min as number) * 60 * 1000).toISOString(); }
    const { error } = await supabase.from('api_keys').update(updateData).eq('service_slug', service_slug);
    if (error) return err(error.message);
    return json({ success: true });
  }

  if (req.method === 'PATCH' && action === 'update_all_schedules') {
    let body: { healthcheck_enabled?: boolean; healthcheck_interval_min?: number } | null = null;
    try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
    if (!body) return err('body required');
    const { healthcheck_enabled, healthcheck_interval_min } = body;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (healthcheck_enabled !== undefined) updateData.healthcheck_enabled = healthcheck_enabled;
    if (healthcheck_interval_min !== undefined) { const validIntervals = [30, 60, 120, 360, 720, 1440]; updateData.healthcheck_interval_min = validIntervals.includes(healthcheck_interval_min) ? healthcheck_interval_min : 60; if (healthcheck_enabled !== false) updateData.healthcheck_next_run_at = new Date(Date.now() + (updateData.healthcheck_interval_min as number) * 60 * 1000).toISOString(); }
    const { error } = await supabase.from('api_keys').update(updateData);
    if (error) return err(error.message);
    return json({ success: true });
  }

  if (req.method === 'POST' && (action === 'run' || action === 'run_manual')) {
    const triggeredBy = action === 'run_manual' ? 'manual' : 'scheduler';
    const slugFilter = url.searchParams.get('slug');
    const runStart = Date.now();
    const { email: emailSettings, slack: slackSettings } = await getAllSettings(supabase);
    let query = supabase.from('api_keys').select('service_slug, service_name, encrypted_key, status, healthcheck_enabled, healthcheck_interval_min, healthcheck_last_run_at, healthcheck_consecutive_failures').not('encrypted_key', 'is', null);
    if (slugFilter) { query = query.eq('service_slug', slugFilter); } else if (triggeredBy === 'scheduler') { query = query.eq('healthcheck_enabled', true); }
    const { data: keys, error: keysError } = await query.order('service_name');
    if (keysError) return err(keysError.message);
    const allKeys = keys ?? [];
    const now = new Date().toISOString();
    const results: Array<{ service_slug: string; service_name: string; success: boolean; message: string; latency_ms: number; skipped: boolean; skip_reason?: string; consecutive_failures: number; was_failing?: boolean; }> = [];
    let successCount = 0; let failureCount = 0; let skippedCount = 0;
    const toNotifyFailures: Array<{ service_name: string; slug: string; failures: number; message: string }> = [];
    const toNotifyRecoveries: Array<{ service_name: string; latency_ms: number }> = [];

    for (const keyRow of allKeys) {
      if (triggeredBy === 'scheduler' && keyRow.healthcheck_last_run_at) {
        const intervalMs = (keyRow.healthcheck_interval_min ?? 60) * 60 * 1000;
        const lastRun = new Date(keyRow.healthcheck_last_run_at).getTime();
        const elapsed = Date.now() - lastRun;
        if (elapsed < intervalMs * 0.9) { results.push({ service_slug: keyRow.service_slug, service_name: keyRow.service_name, success: false, message: '', latency_ms: 0, skipped: true, skip_reason: `아직 ${Math.round((intervalMs - elapsed) / 60000)}분 남음`, consecutive_failures: keyRow.healthcheck_consecutive_failures ?? 0 }); skippedCount++; continue; }
      }
      const rawKey = await decryptKey(keyRow.encrypted_key ?? '');
      if (!rawKey) { results.push({ service_slug: keyRow.service_slug, service_name: keyRow.service_name, success: false, message: '키 복호화 실패', latency_ms: 0, skipped: false, consecutive_failures: (keyRow.healthcheck_consecutive_failures ?? 0) + 1 }); failureCount++; continue; }
      const testResult = await testServiceKey(keyRow.service_slug, rawKey);
      const prevFailures = keyRow.healthcheck_consecutive_failures ?? 0;
      const newFailures = testResult.success ? 0 : prevFailures + 1;
      const wasFailingBefore = prevFailures >= emailSettings.failure_threshold;
      await appendTestHistory(supabase, keyRow.service_slug, { tested_at: now, success: testResult.success, message: testResult.message, latency_ms: testResult.latency_ms, triggered_by: triggeredBy }, newFailures);
      if (!testResult.success) {
        failureCount++;
        if (newFailures >= emailSettings.failure_threshold) toNotifyFailures.push({ service_name: keyRow.service_name, slug: keyRow.service_slug, failures: newFailures, message: testResult.message });
        if (newFailures >= 3) await supabase.from('notifications').insert({ type: 'system', title: `API 키 헬스체크 실패: ${keyRow.service_name}`, message: `${keyRow.service_name} API 키가 ${newFailures}회 연속으로 연결 테스트에 실패했습니다. 마지막 오류: ${testResult.message}`, is_read: false, created_at: now });
      } else {
        successCount++;
        if (wasFailingBefore) toNotifyRecoveries.push({ service_name: keyRow.service_name, latency_ms: testResult.latency_ms });
      }
      results.push({ service_slug: keyRow.service_slug, service_name: keyRow.service_name, success: testResult.success, message: testResult.message, latency_ms: testResult.latency_ms, skipped: false, consecutive_failures: newFailures, was_failing: wasFailingBefore });
    }

    const durationMs = Date.now() - runStart;
    const alertPromises: Promise<void>[] = [];
    if (toNotifyFailures.length > 0) { alertPromises.push(sendFailureAlert(supabase, emailSettings, toNotifyFailures, now)); alertPromises.push(sendSlackFailureAlert(supabase, slackSettings, toNotifyFailures, now)); }
    for (const recovery of toNotifyRecoveries) { alertPromises.push(sendRecoveryAlert(supabase, emailSettings, recovery.service_name, now, recovery.latency_ms)); alertPromises.push(sendSlackRecoveryAlert(supabase, slackSettings, recovery.service_name, now, recovery.latency_ms)); }
    await Promise.allSettled(alertPromises);
    await supabase.from('healthcheck_logs').insert({ run_at: now, triggered_by: triggeredBy, total_keys: allKeys.length, success_count: successCount, failure_count: failureCount, skipped_count: skippedCount, duration_ms: durationMs, results });
    if (triggeredBy === 'manual') await supabase.from('audit_logs').insert({ admin_email: 'admin', action: 'API 키 헬스체크 수동 실행', target_type: 'system', target_id: slugFilter ?? 'all', target_label: slugFilter ? `${slugFilter} 단독 테스트` : '전체 키 일괄 테스트', result: failureCount === 0 ? 'success' : 'partial', detail: `총 ${allKeys.length}개 키 — 성공 ${successCount}, 실패 ${failureCount}, 스킵 ${skippedCount} (${durationMs}ms)`, created_at: now });
    return json({ success: true, triggered_by: triggeredBy, total: allKeys.length, success_count: successCount, failure_count: failureCount, skipped_count: skippedCount, duration_ms: durationMs, results, email_alerts_sent: toNotifyFailures.length > 0 || toNotifyRecoveries.length > 0, slack_alerts_sent: slackSettings.enabled && (toNotifyFailures.length > 0 || toNotifyRecoveries.length > 0) });
  }

  return err('Unknown action', 404);
});
