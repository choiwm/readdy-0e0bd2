import type { User, ContentItem, PromptTemplate, Coupon, CsTicket, Notice, IpBlock, AdminAccount, PaymentRecord, Notification } from './types';

export const initialNotifications: Notification[] = [
  { id: 'N001', level: 'critical', title: 'API 에러율 급증', desc: 'Suno (음악) API 에러율이 지난 10분간 12.4%로 급증했습니다. 즉시 확인이 필요합니다.', time: '방금 전', read: false, category: 'api' },
  { id: 'N002', level: 'critical', title: '신규 긴급 CS 티켓', desc: '이서연 님이 "크레딧 차감 후 생성 실패" 긴급 티켓을 제출했습니다.', time: '2분 전', read: false, category: 'cs' },
  { id: 'N003', level: 'warning', title: 'GPU-02 부하 임계치 초과', desc: 'GPU-02 (영상) 부하가 88%로 임계치(85%)를 초과했습니다. 부하 분산을 검토하세요.', time: '5분 전', read: false, category: 'system' },
  { id: 'N004', level: 'warning', title: '신규 CS 티켓 2건', desc: '최하은 님의 환불 요청, 윤도현 님의 계정 정지 문의가 접수됐습니다.', time: '12분 전', read: false, category: 'cs' },
  { id: 'N005', level: 'info', title: '대용량 Enterprise 결제', desc: '정태민 님이 Enterprise 플랜 ₩99,000 결제를 완료했습니다.', time: '18분 전', read: true, category: 'billing' },
  { id: 'N006', level: 'warning', title: 'OpenAI API 응답 지연', desc: 'GPT-4o 평균 응답 시간이 2.1s로 평소 대비 2.4배 증가했습니다.', time: '24분 전', read: true, category: 'api' },
  { id: 'N007', level: 'info', title: '신규 사용자 급증', desc: '오늘 신규 가입자가 143명으로 전일 대비 +38% 증가했습니다.', time: '1시간 전', read: true, category: 'user' },
  { id: 'N008', level: 'success', title: '정기 점검 완료', desc: '2026년 4월 정기 점검이 예정대로 완료됐습니다. 모든 서비스가 정상 운영 중입니다.', time: '2시간 전', read: true, category: 'system' },
  { id: 'N009', level: 'info', title: '쿠폰 SPRING2026 사용률 28%', desc: '500개 한도 중 142개가 사용됐습니다. 만료일까지 46일 남았습니다.', time: '3시간 전', read: true, category: 'billing' },
  { id: 'N010', level: 'critical', title: '부적절 콘텐츠 감지', desc: 'C-5517 콘텐츠가 AI 필터에 의해 부적절 콘텐츠로 감지됐습니다. 검수가 필요합니다.', time: '4시간 전', read: true, category: 'system' },
];

export const initialUsers: User[] = [
  { id: 'U-10291', name: '김민준', email: 'minjun@gmail.com', plan: 'Pro', credits: 4200, joined: '2026.04.15', status: 'active', lastLogin: '2026.04.15 14:32', loginIp: '211.234.12.88', projects: 24 },
  { id: 'U-10290', name: '이서연', email: 'seoyeon@naver.com', plan: 'Free', credits: 80, joined: '2026.04.15', status: 'active', lastLogin: '2026.04.15 13:10', loginIp: '175.112.44.21', projects: 3 },
  { id: 'U-10289', name: '박지호', email: 'jiho@kakao.com', plan: 'Pro', credits: 9800, joined: '2026.04.14', status: 'active', lastLogin: '2026.04.15 11:45', loginIp: '58.229.88.14', projects: 47 },
  { id: 'U-10288', name: '최하은', email: 'haeun@gmail.com', plan: 'Free', credits: 0, joined: '2026.04.14', status: 'inactive', lastLogin: '2026.04.10 09:20', loginIp: '121.167.33.55', projects: 1 },
  { id: 'U-10287', name: '정태민', email: 'taemin@outlook.com', plan: 'Enterprise', credits: 50000, joined: '2026.04.13', status: 'active', lastLogin: '2026.04.15 16:00', loginIp: '203.248.77.99', projects: 182 },
  { id: 'U-10286', name: '강수아', email: 'sua@gmail.com', plan: 'Pro', credits: 2100, joined: '2026.04.13', status: 'active', lastLogin: '2026.04.14 22:15', loginIp: '112.168.55.30', projects: 31 },
  { id: 'U-10285', name: '윤도현', email: 'dohyun@naver.com', plan: 'Free', credits: 200, joined: '2026.04.12', status: 'suspended', lastLogin: '2026.04.11 18:40', loginIp: '59.6.112.44', projects: 8 },
  { id: 'U-10284', name: '임채원', email: 'chaewon@gmail.com', plan: 'Pro', credits: 6700, joined: '2026.04.12', status: 'active', lastLogin: '2026.04.15 10:05', loginIp: '175.223.14.88', projects: 56 },
  { id: 'U-10283', name: '오준혁', email: 'junhyuk@gmail.com', plan: 'Enterprise', credits: 120000, joined: '2026.04.11', status: 'active', lastLogin: '2026.04.15 15:30', loginIp: '220.75.44.12', projects: 340 },
  { id: 'U-10282', name: '한지수', email: 'jisu@naver.com', plan: 'Pro', credits: 3400, joined: '2026.04.11', status: 'active', lastLogin: '2026.04.13 20:10', loginIp: '118.44.88.201', projects: 19 },
];

export const initialContentItems: ContentItem[] = [
  { id: 'C-5521', title: 'AI 기술 트렌드 2026 유튜브 쇼츠', user: '김민준', type: '유튜브 자동화', status: 'approved', date: '2026.04.15 14:32', rating: 5, thumbnail: 'https://readdy.ai/api/search-image?query=futuristic%20AI%20technology%20trend%20youtube%20shorts%20thumbnail%20with%20neon%20lights%20and%20digital%20elements%20on%20dark%20background&width=120&height=68&seq=c1&orientation=landscape' },
  { id: 'C-5520', title: '봄 신상 컬렉션 광고 영상', user: '이서연', type: 'AI 광고', status: 'pending', date: '2026.04.15 13:10', rating: 4, thumbnail: 'https://readdy.ai/api/search-image?query=spring%20fashion%20collection%20advertisement%20video%20thumbnail%20with%20flowers%20and%20elegant%20clothing%20on%20white%20background&width=120&height=68&seq=c2&orientation=landscape' },
  { id: 'C-5519', title: '스타트업 피칭 보드 디자인', user: '박지호', type: 'AI 보드', status: 'approved', date: '2026.04.15 11:45', rating: 5, thumbnail: 'https://readdy.ai/api/search-image?query=startup%20pitch%20board%20design%20with%20charts%20graphs%20and%20modern%20business%20presentation%20on%20clean%20white%20background&width=120&height=68&seq=c3&orientation=landscape' },
  { id: 'C-5518', title: '제품 소개 나레이션 음성', user: '정태민', type: 'AI 사운드', status: 'approved', date: '2026.04.14 18:20', rating: 4, thumbnail: 'https://readdy.ai/api/search-image?query=product%20introduction%20narration%20audio%20waveform%20visualization%20on%20dark%20background%20with%20sound%20waves&width=120&height=68&seq=c4&orientation=landscape' },
  { id: 'C-5517', title: '캐릭터 일러스트 생성 결과물', user: '강수아', type: 'AI 생성', status: 'blocked', date: '2026.04.14 16:05', rating: 1, thumbnail: 'https://readdy.ai/api/search-image?query=anime%20character%20illustration%20digital%20art%20colorful%20fantasy%20character%20design%20on%20gradient%20background&width=120&height=68&seq=c5&orientation=landscape' },
  { id: 'C-5516', title: '유튜브 쇼츠 자동화 영상', user: '임채원', type: '유튜브 자동화', status: 'pending', date: '2026.04.14 14:30', rating: 3, thumbnail: 'https://readdy.ai/api/search-image?query=youtube%20shorts%20automated%20video%20content%20creation%20with%20modern%20editing%20interface%20on%20dark%20background&width=120&height=68&seq=c6&orientation=landscape' },
  { id: 'C-5515', title: '브랜드 로고 AI 생성', user: '오준혁', type: 'AI 생성', status: 'approved', date: '2026.04.14 12:00', rating: 5, thumbnail: 'https://readdy.ai/api/search-image?query=brand%20logo%20AI%20generated%20minimalist%20modern%20design%20on%20clean%20white%20background%20with%20geometric%20shapes&width=120&height=68&seq=c7&orientation=landscape' },
  { id: 'C-5514', title: '배경음악 자동 생성', user: '한지수', type: 'AI 사운드', status: 'approved', date: '2026.04.13 20:10', rating: 4, thumbnail: 'https://readdy.ai/api/search-image?query=background%20music%20auto%20generation%20audio%20spectrum%20visualization%20with%20colorful%20equalizer%20bars%20on%20dark%20background&width=120&height=68&seq=c8&orientation=landscape' },
];

export const initialPromptTemplates: PromptTemplate[] = [
  { id: 'PT-01', name: '유튜브 광고용 스크립트', category: '영상', model: 'GPT-4o', lastUpdated: '2026.04.10', usageCount: 8420, active: true },
  { id: 'PT-02', name: '음악 제작 마스터 프롬프트', category: '음악', model: 'Suno', lastUpdated: '2026.04.08', usageCount: 3210, active: true },
  { id: 'PT-03', name: '이미지 생성 기본 템플릿', category: '이미지', model: 'Stable Diffusion', lastUpdated: '2026.04.12', usageCount: 21840, active: true },
  { id: 'PT-04', name: '쇼츠 자동화 나레이션', category: '음성', model: 'ElevenLabs', lastUpdated: '2026.04.05', usageCount: 5670, active: true },
  { id: 'PT-05', name: '광고 카피라이팅 템플릿', category: '텍스트', model: 'GPT-4o', lastUpdated: '2026.04.01', usageCount: 2890, active: false },
];

export const initialCoupons: Coupon[] = [
  { code: 'SPRING2026', discount: '30%', type: '구독 할인', used: 142, limit: 500, expires: '2026.05.31', active: true },
  { code: 'NEWUSER100', discount: '100 CR', type: '무료 크레딧', used: 891, limit: 2000, expires: '2026.06.30', active: true },
  { code: 'ENTERPRISE50', discount: '50%', type: '구독 할인', used: 28, limit: 100, expires: '2026.04.30', active: false },
];

export const initialCsTickets: CsTicket[] = [
  { id: 'TK-1021', user: '이서연', subject: '크레딧이 차감됐는데 생성이 안 됩니다', category: '기술 지원', priority: 'high', status: 'open', date: '2026.04.15 13:20' },
  { id: 'TK-1020', user: '최하은', subject: '구독 해지 후 환불 요청', category: '결제/환불', priority: 'high', status: 'in_progress', date: '2026.04.15 11:05' },
  { id: 'TK-1019', user: '윤도현', subject: '계정 정지 사유 문의', category: '계정 관리', priority: 'medium', status: 'open', date: '2026.04.14 18:30' },
  { id: 'TK-1018', user: '박지호', subject: '영상 생성 품질 개선 요청', category: '기능 개선', priority: 'low', status: 'closed', date: '2026.04.14 15:10' },
  { id: 'TK-1017', user: '김민준', subject: 'API 연동 오류 문의', category: '기술 지원', priority: 'medium', status: 'in_progress', date: '2026.04.14 10:45' },
  { id: 'TK-1016', user: '강수아', subject: '프로 플랜 업그레이드 문의', category: '구독/플랜', priority: 'low', status: 'closed', date: '2026.04.13 16:20' },
];

export const initialNotices: Notice[] = [
  { id: 'N-041', title: '2026년 4월 정기 점검 안내', type: '점검', status: 'published', date: '2026.04.14', views: 2840 },
  { id: 'N-040', title: 'AI 이미지 생성 모델 업데이트 v3.2', type: '업데이트', status: 'published', date: '2026.04.10', views: 5210 },
  { id: 'N-039', title: '5월 프로모션 이벤트 사전 안내', type: '이벤트', status: 'draft', date: '2026.04.08', views: 0 },
  { id: 'N-038', title: '유튜브 자동화 기능 베타 출시', type: '업데이트', status: 'published', date: '2026.04.01', views: 8920 },
];

export const initialIpBlockList: IpBlock[] = [
  { ip: '221.148.33.77', reason: '비정상 접근 시도 (브루트포스)', blockedAt: '2026.04.10 08:45', blockedBy: '관리자C', status: 'active' },
  { ip: '103.55.12.88', reason: 'API 남용 (분당 1000회 초과)', blockedAt: '2026.04.07 14:20', blockedBy: '관리자A', status: 'active' },
  { ip: '58.229.44.11', reason: '저작권 침해 콘텐츠 반복 생성', blockedAt: '2026.04.03 09:30', blockedBy: '관리자B', status: 'active' },
  { ip: '175.112.88.200', reason: '스팸 계정 생성', blockedAt: '2026.03.28 16:00', blockedBy: '관리자A', status: 'released' },
];

export const initialAdminAccounts: AdminAccount[] = [
  { id: 'ADM-001', name: '관리자A', email: 'admin-a@aimetawow.com', role: 'Super Admin', twofa: true, lastLogin: '2026.04.15 14:30', loginIp: '192.168.1.10', permissions: ['전체'] },
  { id: 'ADM-002', name: '관리자B', email: 'admin-b@aimetawow.com', role: 'CS Manager', twofa: true, lastLogin: '2026.04.15 11:20', loginIp: '192.168.1.22', permissions: ['사용자 관리', 'CS', '공지사항'] },
  { id: 'ADM-003', name: '관리자C', email: 'admin-c@aimetawow.com', role: 'System Admin', twofa: false, lastLogin: '2026.04.14 09:00', loginIp: '192.168.1.35', permissions: ['AI 엔진', '시스템 설정', '감사 로그'] },
];

export const initialPaymentHistory: PaymentRecord[] = [
  { id: 'PAY-9921', user: '정태민', plan: 'Enterprise', amount: '₩99,000', date: '2026.04.15', status: 'completed', method: '카드' },
  { id: 'PAY-9920', user: '김민준', plan: 'Pro', amount: '₩29,000', date: '2026.04.15', status: 'completed', method: '카드' },
  { id: 'PAY-9919', user: '오준혁', plan: 'Enterprise', amount: '₩99,000', date: '2026.04.14', status: 'completed', method: '카드' },
  { id: 'PAY-9918', user: '임채원', plan: 'Pro', amount: '₩29,000', date: '2026.04.14', status: 'refunded', method: '카드' },
  { id: 'PAY-9917', user: '박지호', plan: 'Pro', amount: '₩29,000', date: '2026.04.13', status: 'completed', method: '카카오페이' },
  { id: 'PAY-9916', user: '강수아', plan: 'Pro', amount: '₩29,000', date: '2026.04.13', status: 'completed', method: '카드' },
  { id: 'PAY-9915', user: '한지수', plan: 'Pro', amount: '₩29,000', date: '2026.04.12', status: 'pending', method: '카드' },
];

export const auditLogsExtended = [
  { id: 'AL-0421', admin: '관리자A', role: 'Super Admin', action: '사용자 크레딧 수동 지급', target: '김민준 (U-10291)', detail: '+500 크레딧', ip: '192.168.1.10', time: '2026.04.15 14:30', category: 'user' },
  { id: 'AL-0420', admin: '관리자B', role: 'CS Manager', action: '계정 정지 처리', target: '윤도현 (U-10285)', detail: '약관 위반 - 저작권 침해', ip: '192.168.1.22', time: '2026.04.15 11:20', category: 'user' },
  { id: 'AL-0419', admin: '관리자A', role: 'Super Admin', action: '콘텐츠 차단', target: 'C-5517', detail: '부적절한 콘텐츠 감지', ip: '192.168.1.10', time: '2026.04.14 16:10', category: 'content' },
  { id: 'AL-0418', admin: '관리자C', role: 'System Admin', action: 'API 키 갱신', target: 'GoAPI (이미지)', detail: '키 만료 전 갱신 완료', ip: '192.168.1.35', time: '2026.04.14 09:00', category: 'system' },
  { id: 'AL-0417', admin: '관리자B', role: 'CS Manager', action: '환불 처리', target: 'PAY-9918 임채원', detail: '₩29,000 환불 승인', ip: '192.168.1.22', time: '2026.04.13 15:40', category: 'billing' },
  { id: 'AL-0416', admin: '관리자A', role: 'Super Admin', action: '프롬프트 템플릿 수정', target: 'PT-03 이미지 생성 기본 템플릿', detail: 'cfg_scale 7→8, steps 30→40', ip: '192.168.1.10', time: '2026.04.12 13:15', category: 'system' },
  { id: 'AL-0415', admin: '관리자C', role: 'System Admin', action: '시스템 설정 변경', target: '최대 동시 요청 수', detail: '500 → 800으로 변경', ip: '192.168.1.35', time: '2026.04.12 10:00', category: 'system' },
  { id: 'AL-0414', admin: '관리자A', role: 'Super Admin', action: '구독 플랜 가격 수정', target: 'Pro 플랜', detail: '₩25,000 → ₩29,000', ip: '192.168.1.10', time: '2026.04.11 16:30', category: 'billing' },
  { id: 'AL-0413', admin: '관리자B', role: 'CS Manager', action: '공지사항 게시', target: 'N-040 AI 이미지 모델 업데이트', detail: '게시 완료', ip: '192.168.1.22', time: '2026.04.10 11:00', category: 'content' },
  { id: 'AL-0412', admin: '관리자C', role: 'System Admin', action: 'IP 차단 등록', target: '221.148.33.77', detail: '비정상 접근 시도 감지', ip: '192.168.1.35', time: '2026.04.10 08:45', category: 'security' },
  { id: 'AL-0411', admin: '관리자A', role: 'Super Admin', action: '쿠폰 생성', target: 'SPRING2026', detail: '30% 할인, 500개 한도', ip: '192.168.1.10', time: '2026.04.09 14:20', category: 'billing' },
  { id: 'AL-0410', admin: '관리자C', role: 'System Admin', action: 'GPU 인스턴스 재시작', target: 'GPU-02 (영상)', detail: '부하 초과로 인한 재시작', ip: '192.168.1.35', time: '2026.04.08 22:10', category: 'system' },
];

export const statsCards = [
  { label: '현재 접속자', value: '1,284', change: '+12.3%', up: true, icon: 'ri-user-voice-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { label: '실시간 AI 요청', value: '347/분', change: '+8.2%', up: true, icon: 'ri-flashlight-line', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { label: '이번 달 매출', value: '₩24,380,000', change: '+5.1%', up: true, icon: 'ri-money-dollar-circle-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { label: '전체 사용자', value: '12,847', change: '+8.2%', up: true, icon: 'ri-user-3-line', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { label: 'API 에러율', value: '0.12%', change: '-0.03%', up: true, icon: 'ri-error-warning-line', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { label: '총 생성 콘텐츠', value: '89,412', change: '+22.4%', up: true, icon: 'ri-image-ai-line', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
];

export const revenueData = [
  { label: '1월', daily: 18200000, weekly: 19800000, monthly: 21000000 },
  { label: '2월', daily: 19500000, weekly: 20400000, monthly: 22100000 },
  { label: '3월', daily: 21000000, weekly: 22800000, monthly: 23500000 },
  { label: '4월', daily: 24380000, weekly: 24380000, monthly: 24380000 },
];

export const apiStatus = [
  { name: 'GoAPI (이미지)', status: 'normal', latency: '142ms', uptime: '99.98%', requests: 34821, errors: 4 },
  { name: 'GoAPI (영상)', status: 'normal', latency: '2.3s', uptime: '99.91%', requests: 12304, errors: 11 },
  { name: 'ElevenLabs (TTS)', status: 'normal', latency: '380ms', uptime: '99.95%', requests: 9871, errors: 5 },
  { name: 'Suno (음악)', status: 'warning', latency: '4.1s', uptime: '98.72%', requests: 5210, errors: 73 },
  { name: 'OpenAI GPT-4o', status: 'normal', latency: '890ms', uptime: '99.99%', requests: 28400, errors: 2 },
  { name: 'LALAL.AI (클린)', status: 'normal', latency: '1.2s', uptime: '99.80%', requests: 3109, errors: 6 },
];

export const contentTrends = [
  { name: '유튜브 쇼츠', count: 28400, pct: 85, color: 'bg-red-500', icon: 'ri-youtube-line' },
  { name: 'AI 이미지', count: 34821, pct: 100, color: 'bg-indigo-500', icon: 'ri-image-ai-line' },
  { name: '광고 영상', count: 12304, pct: 62, color: 'bg-amber-500', icon: 'ri-advertisement-line' },
  { name: 'AI 음악', count: 9871, pct: 51, color: 'bg-emerald-500', icon: 'ri-music-2-line' },
  { name: 'AI 보드', count: 7432, pct: 38, color: 'bg-violet-500', icon: 'ri-layout-masonry-line' },
];

export const dailySignups = [14, 22, 18, 31, 27, 43, 38, 52, 47, 61, 55, 72, 68, 143];

export const planDist = [
  { label: 'Free', count: 8204, pct: 63.8, color: 'bg-zinc-500' },
  { label: 'Pro', count: 3891, pct: 30.3, color: 'bg-indigo-500' },
  { label: 'Enterprise', count: 752, pct: 5.9, color: 'bg-amber-500' },
];

export const subscriptionPlans = [
  { name: 'Free', price: '₩0', credits: 100, users: 8204, features: ['워터마크 포함', '기본 해상도', '월 100 크레딧'], color: 'border-zinc-600' },
  { name: 'Pro', price: '₩29,000', credits: 5000, users: 3891, features: ['워터마크 없음', 'HD 해상도', '월 5,000 크레딧', '우선 처리'], color: 'border-indigo-500' },
  { name: 'Enterprise', price: '₩99,000', credits: 50000, users: 752, features: ['워터마크 없음', '4K 해상도', '월 50,000 크레딧', '전담 지원', 'API 직접 연동'], color: 'border-amber-500' },
];

export const auditLogs = [
  { admin: '관리자A', action: '사용자 크레딧 수동 지급', target: '김민준 (U-10291)', detail: '+500 크레딧', time: '2026.04.15 14:30' },
  { admin: '관리자B', action: '계정 정지 처리', target: '윤도현 (U-10285)', detail: '약관 위반', time: '2026.04.15 11:20' },
  { admin: '관리자A', action: '콘텐츠 차단', target: 'C-5517', detail: '부적절한 콘텐츠', time: '2026.04.14 16:10' },
  { admin: '관리자C', action: 'API 키 갱신', target: 'GoAPI (이미지)', detail: '키 만료 전 갱신', time: '2026.04.14 09:00' },
  { admin: '관리자B', action: '환불 처리', target: 'PAY-9918 임채원', detail: '₩29,000 환불', time: '2026.04.13 15:40' },
  { admin: '관리자A', action: '프롬프트 템플릿 수정', target: 'PT-03 이미지 생성 기본 템플릿', detail: '파라미터 최적화', time: '2026.04.12 13:15' },
];
