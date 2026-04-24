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
│  ├─ ai-shortcuts/      AI 바로가기 + Pro 업그레이드 문의
│  ├─ youtube-studio/    6-Step 유튜브 영상 자동화
│  ├─ ai-automation/     AI 파이프라인 오케스트레이터
│  ├─ credit-purchase/   크레딧 충전 (TossPayments)
│  ├─ my-payments/       결제 내역 + 영수증 + 환불 요청
│  ├─ my-account/        계정 설정 + 자가 삭제 (PIPA)
│  ├─ payment-success/   TossPayments 성공 리다이렉트
│  ├─ payment-fail/      TossPayments 실패 리다이렉트
│  ├─ customer-support/  FAQ + 문의 폼
│  ├─ admin/             관리자 콘솔 (인증된 관리자만)
│  ├─ admin-login/       관리자 로그인
│  ├─ terms/             이용약관
│  ├─ privacy/           개인정보처리방침
│  └─ workflow/          워크플로우 소개
├─ components/
│  ├─ base/              범용 UI 기본 (ErrorBoundary, Toast, ConfirmModal, EmptyState, …)
│  └─ feature/           제품 특화 컴포넌트 (AuthModal, AppNavbar, AdminGuard, …)
├─ hooks/                useAuth, useCredits, useNotifications, useSfxStore,
│                        useAudioHistory, useGallery, useProjectHandoff
├─ lib/                  supabase, env, logger, toss, edgeClient
└─ router/               config.tsx (lazy routes + ErrorBoundary wrapping), index.ts

supabase/
├─ migrations/           순차 SQL — 0001_baseline_rls → 0005_newsletter_and_cs_extensions
└─ functions/            (총 31개)
   ├─ _shared/           auth, cors, rateLimit, credit_packages (공용)
   ├─ admin-*            관리자 전용, requireAdmin (api-keys, audit, billing, content,
   │                     cs, security, stats, teams, users — 9개)
   ├─ generate-*         AI 생성, requireUser + rate-limit (image, video, tts, music,
   │                     sfx, script, vton, transcribe, multishot — 9개)
   ├─ payments-toss/     결제 create_order / confirm / webhook
   ├─ support-submit/    공개 문의 폼 + 환불 요청 + 뉴스레터
   ├─ account-delete/    회원 자가 탈퇴 (PIPA)
   └─ …                  analyze-video-sfx, clean-audio, summarize-text, translate-text,
                         credit-alert-*, cron-manager, healthcheck-scheduler,
                         fal-key-manager, fal-model-catalog, check-fal-status, test-fal-key

scripts/
├─ setup-deploy-secrets.sh     GitHub Actions secrets/vars 대화형 셋업 (gh CLI)
└─ setup-supabase-secrets.sh   Supabase Edge Function 런타임 secrets (supabase CLI)

e2e/                     Playwright E2E 18 specs
                         admin, credits, customer-support, navigation, smoke

.github/workflows/
├─ ci.yml                type-check + lint + unit tests + build + Playwright E2E
└─ deploy.yml            main push 시 Supabase migrations + functions + Vercel 배포

docs/
├─ deploy.md                  GitHub Actions 자동 배포 + secrets 가이드
├─ payments-setup.md          TossPayments 키/시크릿 구성
├─ edge-function-security.md  CORS 허용 목록 + rate-limit 정책
└─ launch-runbook.md          런칭 당일 체크리스트 + 장애 대응

README.md                루트 — 프로젝트 개요 · 로컬 셋업 · 스크립트 · 핵심 개념
.env.example             VITE_PUBLIC_SUPABASE_*, VITE_PUBLIC_TOSS_CLIENT_KEY
                         + Edge Function 런타임 시크릿 (ALLOWED_ORIGINS, TOSS_*) 참고용
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
