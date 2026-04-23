# Supabase Edge Function 보안 감사

감사 일자: 2026-04-22. 대상: `supabase/functions/` 하의 30개 함수.

## 상태 (2026-04-22 기준 코드 반영)

**CRITICAL / HIGH 항목은 모두 커밋으로 패치됨.** 배포 전 다음을 수행하세요:

1. Supabase Edge Functions에 `_shared/` 디렉토리 동기화
2. `SCHEDULER_SECRET` 환경변수 설정 (`healthcheck-scheduler` + pg_cron 양쪽에 동일 값)
3. pg_cron 잡 재등록 (`cron-manager?action=upsert_job` — 이제 헤더에 `x-scheduler-secret` 포함됨)
4. 스테이징에서 회귀 테스트 (관리자 페이지, 생성 기능, 결제 알림)

## 적용된 변경 요약

- `_shared/auth.ts`: `requireUser`, `requireAdmin`, `requireSchedulerSecret`, `AuthFailure`, `writeAuditLog`
- 9개 `admin-*` 함수 → `requireAdmin` 적용 (admin-stats의 `check_admin` 액션만 예외)
- 9개 `generate-*` 함수 → `requireUser` + `user_id`를 JWT에서 추출하여 본문 값 대체
- `cron-manager` → `requireAdmin` + `slug`/`jobname`/`cronExpr` 화이트리스트
- `healthcheck-scheduler` → `requireSchedulerSecret` 우선, 실패 시 `requireAdmin` 폴백
- `fal-key-manager`, `test-fal-key`, `fal-model-catalog` → `requireAdmin`
- `check-fal-status`, `clean-audio`, `analyze-video-sfx`, `summarize-text`, `translate-text` → `requireUser`
- `credit-alert-email`, `credit-alert-notify` → `requireUser` + `body.user_id` 일치 확인
- `clean-audio` SSRF 오진 (외부 URL 입력 없음 — 파일 업로드만 수용)

## 배경

`.env`의 `VITE_PUBLIC_SUPABASE_ANON_KEY`는 브라우저 번들에 포함되어 공개됩니다. 따라서 **anon key로 함수를 호출할 수 있다는 사실 자체는 취약점이 아니며, 각 함수 내부의 권한 검증이 유일한 방어선**입니다.

현재 감사에서 **30개 중 22개 함수에 결함**이 발견됐습니다. 아래 체크리스트를 각 함수에 적용하세요.

## 공통 체크리스트

모든 함수는 다음을 만족해야 합니다:

```ts
// 1. JWT 검증 — 서비스 롤을 클라이언트에 노출하지 말 것
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 });
const jwt = authHeader.slice('Bearer '.length);
const { data: { user }, error } = await supabase.auth.getUser(jwt);
if (error || !user) return new Response('unauthorized', { status: 401 });

// 2. admin-* 함수라면 admin_accounts 조회
const { data: admin } = await supabase
  .from('admin_accounts')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle();
if (!admin) return new Response('forbidden', { status: 403 });

// 3. 요청 본문 검증 — zod 등으로 타입·길이·범위 제한
// 4. 파괴적 작업은 audit_logs에 기록
// 5. 에러 응답에 내부 스키마/쿼리 세부 노출 금지
```

## CRITICAL — 즉시 수정

### admin-* 함수 (8개) 권한 미검증
대상: `admin-audit`, `admin-billing`, `admin-content`, `admin-cs`, `admin-security`, `admin-teams`, `admin-users`, `admin-api-keys`

**문제**: 서비스 롤 키로 Supabase 클라이언트를 생성하여 모든 쿼리를 실행하지만, 호출자의 관리자 여부를 확인하지 않음. anon key로 누구나 호출해서 사용자 데이터, 결제, 감사 로그, API 키 등에 접근 가능.

**수정**: 각 함수 진입부에 위 "공통 체크리스트"의 1·2번을 추가.

### admin-stats 부분 검증
대상: `admin-stats/index.ts`

**문제**: `action=check_admin`만 `admin_accounts` 테이블을 조회하고, `action=overview` 등 나머지 액션은 권한 확인 없이 전사 통계를 반환.

**수정**: 진입부에서 한 번만 권한 확인 후 모든 액션에 적용.

### generate-* 함수 (9개) 신원 미검증
대상: `generate-script`, `generate-music`, `generate-sfx`, `generate-tts`, `generate-transcribe`, `generate-image`, `generate-multishot`, `generate-video`, `generate-vton`

**문제**: 요청 본문의 `user_id`를 신뢰하여 크레딧을 차감하거나 사용 이력을 남김. JWT를 검증하지 않아 다른 사용자의 크레딧을 소진시키는 공격 가능.

**수정**: JWT에서 `user.id`를 꺼내 사용. 본문의 `user_id`와 다르면 403.

### cron-manager SQL 주입
위치: `supabase/functions/cron-manager/index.ts:52-62`

```ts
const url = `${supabaseUrl}/functions/v1/healthcheck-scheduler?action=run&slug=${slug}`;
return `SELECT net.http_post(url := '${url}', ...)`;
```

**문제**: `slug`이 사용자 입력으로 SQL 문자열에 직접 보간됨.

**수정**: `slug`을 `^[a-z0-9_-]+$` 패턴으로 화이트리스트 검증 후, pg 파라미터(`$1`)로 전달.

### 스케줄러 함수 헤더 검증 부재
대상: `cron-manager`, `fal-key-manager`, `test-fal-key`, `healthcheck-scheduler`

**문제**: `x-scheduler-secret` 헤더를 정의만 하고 실제 검증하지 않음. 외부에서 무단 호출 가능.

**수정**: 환경변수로 비밀을 두고 헤더와 상수 시간 비교.

## HIGH — 빠른 수정

### SSRF 위험 — clean-audio
위치: `supabase/functions/clean-audio/index.ts`

**문제**: 사용자 입력 `audioFileUrl`을 LALAL.AI 같은 외부 API에 그대로 전달. 내부 IP 스캔 가능성.

**수정**: URL을 파싱해 `https:` 스킴만 허용, 내부 대역(`169.254.*`, `10.*`, `192.168.*`, `localhost`) 차단, 허용 도메인 화이트리스트.

### 외부 API 크레딧 소모 — summarize-text, translate-text
**문제**: 인증 없음. 누구나 OpenAI/GoAPI 호출로 비용 발생 가능.

**수정**: JWT 검증 + 사용자당 분당 레이트 리밋.

### 입력 길이·형식 검증 부재
- `admin-cs` 티켓 생성: `title`, `content` 길이 미검증
- `admin-security` IP 차단: IP/CIDR 형식 미검증
- `analyze-video-sfx`: `sensitivity` 범위 미검증
- `generate-*`: 프롬프트 길이 미검증

**수정**: 함수 상단에서 zod 또는 수동 가드로 전부 검증.

### 알림 엔드포인트 — credit-alert-email, credit-alert-notify
**문제**: 본문의 `user_id`를 검증 없이 사용. 타사용자 알림을 조작 가능.

**수정**: JWT의 `user.id`만 사용.

## MEDIUM — 위생

- **감사 로그**: 모든 `admin-*`의 `POST/PATCH/DELETE`는 `audit_logs`에 who/when/what 기록 필요.
- **에러 메시지 노출**: DB 에러 메시지를 클라이언트에 그대로 반환하는 함수가 여럿(`admin-stats:53`, `admin-cs:74`). 내부 로그만 남기고 사용자에게는 `"Internal error"` 반환.
- **레거시 `enc_v1:` 키 형식**: base64 수준이라 보안이 약함. 키를 순환하며 더 강한 방식으로 이관.
- **응답 포맷 불일치**: 일부 `json({ error })`, 일부 `Response(JSON.stringify())`. 공통 헬퍼로 통일.

## OK — 스캔됨, 이슈 없음

- `check-fal-status`
- `fal-model-catalog`
- `healthcheck-scheduler` (헤더 검증만 추가하면 OK)
- `test-fal-key` (동일)

## 권장 작업 순서

1. `admin-*` 8개 함수에 권한 검증 추가 (공통 유틸로 추출)
2. `generate-*` 9개 함수에 JWT 검증 추가
3. `cron-manager` SQL 주입 수정
4. SSRF 위험 함수(clean-audio 등) 도메인 화이트리스트
5. 입력 검증 라이브러리 도입 (zod)
6. 감사 로그 공통 훅 추가
7. 레이트 리미팅 (DB 기반 또는 Upstash 등 외부)

## 공통 유틸 제안

`supabase/functions/_shared/auth.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function requireUser(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new Response('unauthorized', { status: 401 });
  const jwt = auth.slice(7);
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Response('unauthorized', { status: 401 });
  return { user: data.user, jwt };
}

export async function requireAdmin(req: Request) {
  const { user, jwt } = await requireUser(req);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data } = await admin.from('admin_accounts').select('role').eq('user_id', user.id).maybeSingle();
  if (!data) throw new Response('forbidden', { status: 403 });
  return { user, role: data.role, jwt };
}
```

각 함수는 진입부에서 한 줄 호출로 검증 가능:

```ts
try {
  const { user } = await requireAdmin(req);
  // ...
} catch (e) {
  if (e instanceof Response) return e;
  throw e;
}
```

## 검증 스냅샷 (2026-04-23)

`for fn in supabase/functions/*/index.ts` 자동 스캔 결과:

| 항목 | 결과 |
|------|------|
| `_shared/auth.ts` 헬퍼 호출 함수 수 | **30 / 30** |
| `AuthFailure` 캐치 처리 | **30 / 30** |
| `requireAdmin` 적용 함수 (admin-* 9개 + cron-manager + healthcheck-scheduler + fal-key-manager + fal-model-catalog + test-fal-key = 14개) | **14 / 14** |
| `requireUser` 적용 함수 (generate-* 9개 + analyze-video-sfx + check-fal-status + clean-audio + summarize-text + translate-text + credit-alert-* 2개 = 16개) | **16 / 16** |
| `requireSchedulerSecret` 적용 (cron-manager, healthcheck-scheduler) | **2 / 2** |

### 미해결 위생 항목 (MEDIUM)

- **`writeAuditLog` 미사용**: `_shared/auth.ts`에 정의된 공통 헬퍼를 어떤 함수도 호출하지 않음. 각 admin-* 함수가 `audit_logs` 테이블에 직접 insert 중 (총 inserts: admin-cs 6, admin-users 6, admin-billing 4, admin-security 4, admin-audit 3, admin-stats 1, admin-teams 1, admin-api-keys 1; admin-content는 read-only). → 후속 리팩토링 대상.
- **읽기 전용 admin-content / admin-stats**: 파괴적 호출 없음. 현 상태 OK.

자동 검증 명령:

```bash
for fn in supabase/functions/*/index.ts; do
  name=$(basename $(dirname "$fn"))
  invokes=$(grep -cE "(await\s+(requireUser|requireAdmin)\(|requireSchedulerSecret\()" "$fn")
  authfail=$(grep -c "AuthFailure" "$fn")
  echo "$name : invocations=$invokes AuthFailure_handling=$authfail"
done
```

