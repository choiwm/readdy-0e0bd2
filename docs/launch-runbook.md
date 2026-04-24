# Launch Runbook

실서비스 런칭 전·당일·후 체크리스트. 모든 항목은 "누가" 확인할지 이름을 적어두면 책임소재가 명확해진다.

## T-7일 — 사전 준비

### 법적 / 사업 등록
- [ ] **통신판매업 신고** 완료 (관할 구청) → 번호 `Footer` 하드코딩 교체 (`src/pages/home/components/Footer.tsx`)
- [ ] **사업자등록번호 / 대표자 / 주소 / 고객센터 전화** Footer 업데이트
- [ ] **전자결제 약관 동의 체크박스** 결제 모달 — 필요 시 체크 기능 추가
- [ ] **개인정보보호책임자(CPO)** 지정 — `Privacy §제10조`에 실명/연락처 기입

### TossPayments
- [ ] 상점 가입 + KYC 승인 (영업일 3–5일 소요)
- [ ] **Live 키** 발급:
  - `VITE_PUBLIC_TOSS_CLIENT_KEY = live_ck_xxx` (GitHub Secrets)
  - `TOSS_SECRET_KEY = live_sk_xxx` (Supabase secrets)
- [ ] **Webhook secret** 생성 + Toss 콘솔 등록 (`TOSS_WEBHOOK_SECRET`)
- [ ] Webhook URL Toss 콘솔에 등록:
  `https://<project>.supabase.co/functions/v1/payments-toss?action=webhook`

### Supabase 프로덕션 프로젝트
- [ ] 새 프로젝트 생성 (dev ≠ prod)
- [ ] `supabase link --project-ref <prod-ref>`
- [ ] Edge Function secrets 설정:
  ```bash
  supabase secrets set ALLOWED_ORIGINS="https://aimetawow.com,https://www.aimetawow.com"
  supabase secrets set TOSS_SECRET_KEY=live_sk_xxx
  supabase secrets set TOSS_WEBHOOK_SECRET=<random-hex>
  supabase secrets set APP_JWT_SECRET=<random-hex>      # API 키 암호화용
  ```
- [ ] DB password 확인 → `SUPABASE_DB_PASSWORD` GitHub Secret에 저장
- [ ] Admin account 생성:
  ```sql
  insert into admin_accounts (email, is_active, role) values ('you@company.com', true, 'owner');
  ```
- [ ] AI provider API 키 등록 (admin UI → AI 엔진 설정 탭)

### Vercel / 호스팅
- [ ] Vercel 프로젝트 생성 + `vercel link`
- [ ] GitHub Secrets 등록 (`docs/deploy.md` 참조)
- [ ] **도메인 구입 + DNS 연결** (Route 53 / Cloudflare / Gabia 등)
- [ ] HTTPS 인증서 자동 발급 확인 (Vercel은 자동)

### Emails
- [ ] `support@aimetawow.com`, `contact@aimetawow.com` 실제 수신 확인 (Supabase CS 폼 → admin CS 탭으로 흐르지만, 직접 이메일도 열어둘 것)
- [ ] Supabase Auth 이메일 템플릿 한국어로 변경 (Auth → Templates)
- [ ] 결제 완료 이메일은 현재 미발송 — 필요 시 `payments-toss/confirm`에 이메일 트리거 추가

## T-1일 — 최종 검수

### 기능
- [ ] 회원가입 → 이메일 확인 → 200 CR 지급 확인
- [ ] 크레딧 충전 (Starter 패키지 ₩6,900) → Toss 결제 → 500 CR 지급 확인
- [ ] 결제 내역 페이지(`/my/payments`)에 row 노출 확인
- [ ] 영수증 모달 정상 표시
- [ ] 이미지 생성 시도 → 크레딧 차감 확인
- [ ] Rate limit 동작 확인 (generate-image 21회 연속 호출 → 429)
- [ ] CORS 허용 목록 외 도메인에서 호출 → 차단 확인
- [ ] 회원탈퇴 → 재가입 이메일 중복 방지 확인
- [ ] `/customer-support` 폼 제출 → admin CS 탭에 ticket 생성 확인
- [ ] Newsletter 이메일 제출 → `newsletter_subscribers` 테이블에 row 확인
- [ ] Admin 콘솔 → 결제 환불 기능 동작 확인

### 비기능
- [ ] Lighthouse: Performance ≥ 70, Accessibility ≥ 90
- [ ] Sentry (설정 시) 에러 수신 확인
- [ ] GA4 (설정 시) 페이지 뷰 확인
- [ ] DB 백업 활성화 (Supabase Pro plan 이상)

### Infra
- [ ] Supabase 프로젝트 **Pause 상태 아님** 확인 (무료 티어 장기 미사용 시 자동 pause)
- [ ] Vercel usage / bandwidth 한도 여유 확인
- [ ] fal.ai / ElevenLabs API 크레딧 잔고 확인

## D-day — 런칭

### 배포
```bash
git checkout main
git pull
# (필요 시) 코드 수정 후 PR → 머지 → 자동 배포
```

CI 실행 확인: Actions 탭 → `Deploy` workflow 그린.

### 런칭 선언
- [ ] 랜딩 **"Beta" 배지 제거** 또는 "Launch" 배지로 교체
- [ ] SNS / 커뮤니티 공지
- [ ] 이메일 뉴스레터 발송 (뉴스레터 구독자 리스트 활용)

### 모니터링 (첫 24시간)
매 시간 다음을 확인:
- Supabase Dashboard → **Edge Functions → Invocations**: 비정상 스파이크 / error rate > 5%
- Supabase Dashboard → **Database → Logs**: long-running queries, 5xx 원인
- Vercel Dashboard → Deployments → Runtime logs: 프론트 에러
- Admin 콘솔 → **대시보드 탭**: 신규 가입 / 결제 / 실패 건수
- Admin 콘솔 → **CS 티켓 탭**: 새 문의 실시간 대응
- Toss 상점 → 결제 승인 내역 (DB `payments.status='done'`과 건수 일치하는지 cross-check)

## 장애 대응

### 결제 실패 급증
1. Supabase Logs → `payments-toss` 함수 에러 메시지 확인
2. 일반적 원인:
   - **"TOSS_SECRET_KEY not configured"** → `supabase secrets set` 재확인
   - **"amount_mismatch"** → 프론트 패키지 데이터와 `_shared/credit_packages.ts` 동기화 확인
   - **"amount required"** → Toss SDK 버전 호환성 확인
3. Admin 콘솔 → 결제 탭 → 실패 row의 `toss_response` 칼럼에 구체 에러 수록됨

### API 쿼터 소진 (fal.ai/ElevenLabs)
1. Admin → AI 엔진 설정 → 해당 서비스 `inactive` 전환 (generate-* 요청이 502 반환)
2. 쿼터 증설 또는 API 키 교체
3. 사용자 공지: Admin → CS/공지 → 새 공지 "AI 생성 일시 중단" 게시

### 악성 트래픽
1. Supabase Dashboard → Database → Query Performance: 반복되는 user_id 식별
2. `rate_limits` 테이블 조회: `select bucket, count(*) from rate_limits group by bucket order by 2 desc limit 20`
3. 필요 시 `POLICIES` 강화 후 `supabase functions deploy` 재배포
4. 악성 계정 → Admin → 사용자 탭 → 계정 정지

### DB 장애 / 연결 실패
1. Supabase Dashboard → Project Health
2. Rate-limit helper는 **fail-open**이므로 DB 다운 시 throttle 해제 → 전체 서비스는 계속 동작, 크레딧 낭비 리스크 증가
3. 즉시 대응: Admin → 시스템 설정 → **유지보수 모드 ON** (프론트 guard 필요 — 현재 미구현, 추가 검토 사항)

## 롤백

### 프론트 (Vercel)
- Vercel Dashboard → Deployments → 이전 배포 선택 → **Promote to Production**
- 또는 `vercel rollback`

### Edge Function
- `git log supabase/functions/<name>` → 안정 커밋 SHA 확인
- `git checkout <sha> -- supabase/functions/<name>`
- `supabase functions deploy <name>`

### DB 마이그레이션
- 마이그레이션은 **additive only**. "롤백"이 아니라 **앞으로 나아가는 수정 마이그레이션** 작성.
- 예: 잘못된 컬럼 → 새 마이그레이션 `00NN_revert_xxx.sql`에서 drop + 재생성.

## Post-launch (T+7일)

- [ ] `audit_logs` 분석 — 결제·환불 통계, 어뷰즈 패턴
- [ ] CS 티켓 처리율 확인
- [ ] Rate-limit 정책 재튜닝 (초기 값 보수적, 실제 트래픽 보고 완화 가능)
- [ ] DB 백업 자동화 설정 여부 재확인

## 연락처 / Escalation

| 상황 | 담당 | 연락 |
|------|------|------|
| Toss 결제 장애 | (담당자) | (전화/이메일) |
| Supabase 인프라 | Supabase Support | https://supabase.com/support |
| AI provider 장애 | — | status.fal.ai / status.openai.com |
| DB/Data 긴급 | (DBA) | (전화) |
| 고객 컴플레인 에스컬레이션 | (CS 리드) | (Slack/전화) |

---
_이 런타임북은 런칭 후 실제로 발생한 장애 대응을 통해 계속 갱신되어야 합니다._
