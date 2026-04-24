# AiMetaWOW

크레딧 기반 AI 생성 플랫폼 (이미지 · 영상 · 음성 · 음악 · 광고 · 유튜브 자동화).

- **Frontend**: React 19 + Vite + TypeScript + Tailwind + i18next
- **Backend**: Supabase (Postgres + RLS, Auth, Edge Functions, Storage)
- **Payments**: TossPayments
- **AI providers**: fal.ai, OpenAI, ElevenLabs, LALAL.AI, Suno, OpenRouter (admin에서 API 키 관리)

## Local setup

```bash
# 1. Node 20+, npm, Supabase CLI
npm ci --legacy-peer-deps

# 2. Supabase 프로젝트 링크 (1회)
supabase login
supabase link --project-ref <your-project-ref>

# 3. 환경변수
cp .env.example .env
# → VITE_PUBLIC_SUPABASE_URL, VITE_PUBLIC_SUPABASE_ANON_KEY, VITE_PUBLIC_TOSS_CLIENT_KEY 채우기

# 4. DB 마이그레이션 + 함수 배포
supabase db push
supabase functions deploy

# 5. 개발 서버
npm run dev
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | ESLint with `--max-warnings 0` |
| `npm test` | Vitest 단위 테스트 (116+ 건) |
| `npm run e2e` | Playwright E2E (18 specs, headless) |
| `npm run e2e:ui` | Playwright UI 모드 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과물 정적 서빙 |

## Directory overview

```
src/
├─ pages/                라우트별 최상위 페이지 (`page.tsx` 컨벤션)
│  ├─ home/              랜딩
│  ├─ ai-create/         이미지/영상 생성 스튜디오
│  ├─ ai-ad/             광고 템플릿
│  ├─ ai-sound/          음성/음악
│  ├─ ai-board/          스토리보드 + 샷 리스트
│  ├─ youtube-studio/    6-Step 유튜브 영상 자동화
│  ├─ ai-automation/     AI 파이프라인 오케스트레이터
│  ├─ credit-purchase/   크레딧 충전 (TossPayments)
│  ├─ my-payments/       결제 내역
│  ├─ my-account/        계정 설정 + 자가 삭제
│  ├─ payment-success/   TossPayments 성공 리다이렉트
│  ├─ payment-fail/      TossPayments 실패 리다이렉트
│  ├─ admin/             관리자 콘솔 (인증된 관리자만)
│  └─ …
├─ components/
│  ├─ base/              범용 UI 기본 (ErrorBoundary, Toast, ConfirmModal)
│  └─ feature/           제품 특화 컴포넌트 (AuthModal, AppNavbar, AdminGuard)
├─ hooks/                useAuth, useCredits, useNotifications, useSfxStore
├─ lib/                  supabase, env, logger, toss
└─ router/               lazy-loaded 라우트 정의 + ErrorBoundary wrapping

supabase/
├─ migrations/           순차 SQL (baseline RLS, payments, rate_limits, …)
└─ functions/
   ├─ _shared/           auth, cors, rateLimit, credit_packages (공용)
   ├─ admin-*            관리자 전용 (requireAdmin)
   ├─ generate-*         AI 생성 (requireUser + rate-limit)
   ├─ payments-toss/     결제 create_order / confirm / webhook
   ├─ support-submit/    공개 문의 폼 + 환불 요청
   └─ account-delete/    회원 자가 탈퇴 (PIPA)

docs/
├─ deploy.md                 GitHub Actions 자동 배포 설정
├─ payments-setup.md         TossPayments 키/시크릿 구성
├─ edge-function-security.md CORS 허용 목록 + rate-limit 정책
└─ launch-runbook.md         런칭 당일 체크리스트 + 장애 대응
```

## Key concepts

- **Auth**: Supabase Auth, 이메일 확인 필수. `admin_accounts`에 등록된 이메일만 관리자.
- **Credits**: `user_profiles.credit_balance` (로그인 사용자) + `credits` 테이블 (게스트 세션). 결제 완료 시 `grant_credits` RPC로 원자적 증가.
- **RLS**: 모든 사용자 소유 테이블에 `user_id = auth.uid()` 정책. 관리자 전용 테이블은 deny-all + service-role 경유.
- **Edge Function Security**: `_shared/cors.ts` (origin allowlist), `_shared/rateLimit.ts` (sliding window). 자세한 내용은 `docs/edge-function-security.md`.
- **Audit**: 모든 관리자 액션 + 결제 완료 + 회원 탈퇴가 `audit_logs`에 JWT 기반 email로 기록.

## Deploy

Push to `main` → `.github/workflows/deploy.yml`이 Supabase (migrations + functions)와 Vercel을 순차 배포. Secrets 구성은 `docs/deploy.md` 참조.

## Launch checklist

`docs/launch-runbook.md` 참조 — 런칭 전 최소 확인 사항, 당일 체크리스트, 비상 연락망, 롤백 절차.
