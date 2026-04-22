import { useState, useCallback, useEffect } from 'react';

interface FalApiKey {
  key_id: string;
  alias: string;
  scope: string;
  created_at: string;
  creator_nickname?: string;
  creator_email?: string;
}

interface Props {
  isDark: boolean;
  onToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const BASE_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/fal-key-manager`;
const HEADERS = {
  'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export default function FalKeyManagerPanel({ isDark, onToast }: Props) {
  const [keys, setKeys] = useState<FalApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminCheckLoading, setAdminCheckLoading] = useState(false);

  // 새 키 생성 상태
  const [createAlias, setCreateAlias] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<{ key_id: string; key_secret: string; alias: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  // 삭제 확인 상태
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'   : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'  : 'bg-gray-50',
    border:    isDark ? 'border-white/5'  : 'border-gray-200',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'   : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'   : 'text-gray-400',
    inputBg:   isDark ? 'bg-zinc-800 border-white/10 text-white placeholder-zinc-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400',
    inputBg2:  isDark ? 'bg-zinc-800'     : 'bg-gray-100',
    divider:   isDark ? 'divide-white/[0.03]' : 'divide-gray-100',
    rowHover:  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50',
  };

  // ── Admin 권한 확인 ──
  const checkAdminPermission = useCallback(async () => {
    setAdminCheckLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}?action=validate_admin`, { headers: HEADERS });
      const data = await res.json();
      if (data.error && !data.is_admin) {
        setIsAdmin(false);
        setError(data.message ?? data.error);
      } else {
        setIsAdmin(data.is_admin ?? false);
        if (!data.is_admin) setError(data.message ?? '관리자 권한 없음');
      }
    } catch (e) {
      setIsAdmin(false);
      setError(`연결 오류: ${String(e)}`);
    } finally {
      setAdminCheckLoading(false);
    }
  }, []);

  // ── 키 목록 로드 ──
  const loadKeys = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ action: 'list', limit: '50', expand: 'creator_info' });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`${BASE_URL}?${params.toString()}`, { headers: HEADERS });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        if (data.hint) setError(`${data.error}\n${data.hint}`);
        if (data.authenticated === false) setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
      if (cursor) {
        setKeys((prev) => [...prev, ...(data.keys ?? [])]);
      } else {
        setKeys(data.keys ?? []);
      }
      setHasMore(data.has_more ?? false);
      setNextCursor(data.next_cursor ?? null);
    } catch (e) {
      setError(`로드 실패: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAdminPermission();
  }, [checkAdminPermission]);

  useEffect(() => {
    if (isAdmin === true) loadKeys();
  }, [isAdmin, loadKeys]);

  // ── 새 키 생성 ──
  const handleCreate = async () => {
    if (!createAlias.trim()) {
      onToast('키 이름(alias)을 입력해주세요', 'warning');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${BASE_URL}?action=create`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ alias: createAlias.trim() }),
      });
      const data = await res.json();

      if (data.error) {
        onToast(`키 생성 실패: ${data.error}`, 'error');
        return;
      }

      setNewKeySecret({ key_id: data.key_id, key_secret: data.key_secret, alias: data.alias });
      setCreateAlias('');
      onToast(`"${data.alias}" 키가 생성됐습니다. key_secret을 지금 바로 복사해주세요!`, 'success');
      // 목록 새로고침
      await loadKeys();
    } catch (e) {
      onToast(`생성 오류: ${String(e)}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  // ── 키 삭제 ──
  const handleDelete = async (keyId: string) => {
    setDeletingKeyId(keyId);
    try {
      const res = await fetch(`${BASE_URL}?action=delete&key_id=${encodeURIComponent(keyId)}`, {
        method: 'DELETE',
        headers: HEADERS,
      });
      const data = await res.json();

      if (data.error) {
        onToast(`삭제 실패: ${data.error}`, 'error');
        return;
      }

      setKeys((prev) => prev.filter((k) => k.key_id !== keyId));
      setConfirmDeleteId(null);
      onToast('API 키가 삭제됐습니다', 'success');
    } catch (e) {
      onToast(`삭제 오류: ${String(e)}`, 'error');
    } finally {
      setDeletingKeyId(null);
    }
  };

  // ── 클립보드 복사 ──
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast(`${label} 복사됐습니다`, 'success');
      if (label.includes('Secret')) {
        setSecretCopied(true);
        setTimeout(() => setSecretCopied(false), 3000);
      }
    } catch {
      onToast('복사 실패 — 직접 선택해서 복사해주세요', 'error');
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="space-y-4">
      {/* ── 헤더 ── */}
      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
          <div>
            <p className={`text-sm font-black ${t.text}`}>fal.ai API 키 관리</p>
            <p className={`text-xs ${t.textSub} mt-0.5`}>
              fal.ai Platform API v1/keys — 워크스페이스 API 키 조회·생성·삭제
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
            <button
              onClick={() => { setIsAdmin(null); checkAdminPermission(); }}
              className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
              title="새로고침"
            >
              <i className={`ri-refresh-line text-sm ${t.textSub}`} />
            </button>
          </div>
        </div>

        {/* ── Admin 권한 상태 배너 ── */}
        <div className={`px-5 py-3 border-b ${t.border}`}>
          {adminCheckLoading ? (
            <div className="flex items-center gap-2">
              <i className="ri-loader-4-line animate-spin text-amber-400 text-xs" />
              <span className={`text-xs ${t.textSub}`}>Admin API 권한 확인 중...</span>
            </div>
          ) : isAdmin === true ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Admin API 권한 확인됨</span>
              <span className={`text-[10px] ${t.textFaint} ml-auto`}>
                fal.ai Platform API v1/keys 사용 가능
              </span>
            </div>
          ) : isAdmin === false ? (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-red-400">Admin API 권한 없음</span>
                <p className={`text-[10px] ${t.textFaint} mt-0.5 whitespace-pre-line`}>{error}</p>
                <a
                  href="https://fal.ai/dashboard/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-amber-400 underline mt-1 inline-block"
                >
                  fal.ai 대시보드에서 Admin 키 발급 →
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
              <span className={`text-xs ${t.textSub}`}>권한 확인 전</span>
            </div>
          )}
        </div>

        {/* ── 새 키 생성 폼 ── */}
        {isAdmin === true && (
          <div className={`px-5 py-4 border-b ${t.border}`}>
            <p className={`text-xs font-black ${t.textSub} mb-3 flex items-center gap-2`}>
              <i className="ri-add-circle-line text-teal-400" />
              새 API 키 생성
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={createAlias}
                onChange={(e) => setCreateAlias(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="키 이름 (예: Production Key, Dev Key)"
                className={`flex-1 px-3 py-2 rounded-xl border text-xs ${t.inputBg} focus:outline-none focus:ring-1 focus:ring-teal-500/50`}
                maxLength={100}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !createAlias.trim()}
                className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                {creating ? (
                  <><i className="ri-loader-4-line animate-spin" />생성 중...</>
                ) : (
                  <><i className="ri-add-line" />키 생성</>
                )}
              </button>
            </div>
            <p className={`text-[10px] ${t.textFaint} mt-1.5`}>
              생성된 key_secret은 한 번만 표시됩니다. 즉시 복사해서 안전한 곳에 보관하세요.
            </p>
          </div>
        )}

        {/* ── 새로 생성된 키 표시 (한 번만) ── */}
        {newKeySecret && (
          <div className={`px-5 py-4 border-b ${t.border} bg-amber-500/5`}>
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-alert-line text-amber-400 text-sm" />
              <p className="text-xs font-black text-amber-400">새 키가 생성됐습니다 — key_secret을 지금 바로 복사하세요!</p>
            </div>
            <div className="space-y-2">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${t.cardBg2} border ${t.border}`}>
                <span className={`text-[10px] font-bold ${t.textFaint} w-20 flex-shrink-0`}>Key ID</span>
                <span className={`text-xs font-mono ${t.text} flex-1 min-w-0 truncate`}>{newKeySecret.key_id}</span>
                <button
                  onClick={() => copyToClipboard(newKeySecret.key_id, 'Key ID')}
                  className={`w-6 h-6 flex items-center justify-center rounded-lg ${t.inputBg2} hover:opacity-80 cursor-pointer flex-shrink-0`}
                >
                  <i className={`ri-file-copy-line text-[10px] ${t.textSub}`} />
                </button>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? 'bg-amber-500/10 border-amber-500/25' : 'bg-amber-50 border-amber-200'}`}>
                <span className={`text-[10px] font-bold text-amber-400 w-20 flex-shrink-0`}>Secret Key</span>
                <span className="text-xs font-mono text-amber-300 flex-1 min-w-0 truncate">{newKeySecret.key_secret}</span>
                <button
                  onClick={() => copyToClipboard(newKeySecret.key_secret, 'Secret Key')}
                  className={`w-6 h-6 flex items-center justify-center rounded-lg ${secretCopied ? 'bg-emerald-500/20' : 'bg-amber-500/20'} hover:opacity-80 cursor-pointer flex-shrink-0 transition-colors`}
                >
                  <i className={`${secretCopied ? 'ri-checkbox-circle-fill text-emerald-400' : 'ri-file-copy-line text-amber-400'} text-[10px]`} />
                </button>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${t.cardBg2} border ${t.border}`}>
                <span className={`text-[10px] font-bold ${t.textFaint} w-20 flex-shrink-0`}>Alias</span>
                <span className={`text-xs ${t.text} flex-1`}>{newKeySecret.alias}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className={`text-[10px] ${t.textFaint}`}>
                이 창을 닫으면 key_secret을 다시 볼 수 없습니다.
              </p>
              <button
                onClick={() => setNewKeySecret(null)}
                className={`text-[10px] font-bold ${t.textSub} hover:opacity-80 cursor-pointer px-2 py-1 rounded-lg ${t.inputBg2}`}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* ── 에러 표시 (권한 있는데 로드 실패) ── */}
        {error && isAdmin !== false && (
          <div className={`px-5 py-3 border-b ${t.border} bg-red-500/5`}>
            <div className="flex items-start gap-2">
              <i className="ri-error-warning-line text-red-400 text-xs mt-0.5 flex-shrink-0" />
              <p className={`text-[11px] text-red-400 whitespace-pre-line`}>{error}</p>
            </div>
          </div>
        )}

        {/* ── 키 목록 ── */}
        {isAdmin === true && (
          <>
            {/* 통계 헤더 */}
            <div className={`px-5 py-3 border-b ${t.border} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <i className="ri-key-2-line text-teal-400 text-xs" />
                <span className={`text-xs font-black ${t.textSub}`}>
                  워크스페이스 API 키 목록
                </span>
                {keys.length > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400`}>
                    {keys.length}개{hasMore ? '+' : ''}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ${t.textFaint}`}>
                fal.ai 대시보드와 동기화됨
              </span>
            </div>

            {loading && keys.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-12 ${t.textFaint}`}>
                <i className="ri-loader-4-line animate-spin text-2xl mb-2 text-teal-400" />
                <p className="text-xs">fal.ai에서 키 목록 불러오는 중...</p>
              </div>
            ) : keys.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-12 ${t.textFaint}`}>
                <i className="ri-key-2-line text-2xl mb-2" />
                <p className="text-xs">등록된 API 키가 없습니다</p>
                <p className={`text-[10px] mt-1 ${t.textFaint}`}>위에서 새 키를 생성해보세요</p>
              </div>
            ) : (
              <div className={`divide-y ${t.divider}`}>
                {keys.map((key) => {
                  const isDeleting = deletingKeyId === key.key_id;
                  const isConfirming = confirmDeleteId === key.key_id;

                  return (
                    <div
                      key={key.key_id}
                      className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group ${
                        isDeleting ? 'opacity-50' : ''
                      }`}
                    >
                      {/* 아이콘 */}
                      <div className={`w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0`}>
                        <i className="ri-key-2-line text-teal-400 text-sm" />
                      </div>

                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className={`text-sm font-semibold ${t.text}`}>{key.alias || '(이름 없음)'}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-400`}>
                            {key.scope ?? 'API'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span
                            className={`text-[11px] font-mono ${t.textFaint} cursor-pointer hover:opacity-80`}
                            onClick={() => copyToClipboard(key.key_id, 'Key ID')}
                            title="클릭하면 Key ID 복사"
                          >
                            {key.key_id}
                          </span>
                          <span className={`text-[10px] ${t.textFaint}`}>
                            생성: {formatDate(key.created_at)}
                          </span>
                          {key.creator_email && (
                            <span className={`text-[10px] ${t.textFaint}`}>
                              by {key.creator_nickname ?? key.creator_email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 액션 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => copyToClipboard(key.key_id, 'Key ID')}
                          className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100`}
                          title="Key ID 복사"
                        >
                          <i className={`ri-file-copy-line ${t.textSub} text-xs`} />
                        </button>

                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] text-red-400 font-semibold`}>삭제할까요?</span>
                            <button
                              onClick={() => handleDelete(key.key_id)}
                              disabled={isDeleting}
                              className="px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-bold cursor-pointer hover:bg-red-500/25 transition-colors whitespace-nowrap"
                            >
                              {isDeleting ? <i className="ri-loader-4-line animate-spin" /> : '삭제'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className={`px-2 py-1 rounded-lg ${t.inputBg2} ${t.textSub} text-[10px] font-bold cursor-pointer hover:opacity-80 transition-colors whitespace-nowrap`}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(key.key_id)}
                            className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:bg-red-500/15 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100`}
                            title="키 삭제"
                          >
                            <i className={`ri-delete-bin-line ${t.textSub} hover:text-red-400 text-xs`} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 더 불러오기 */}
            {hasMore && nextCursor && (
              <div className={`px-5 py-3 border-t ${t.border}`}>
                <button
                  onClick={() => loadKeys(nextCursor)}
                  disabled={loading}
                  className={`w-full py-2 rounded-xl ${t.inputBg2} ${t.textSub} text-xs font-semibold cursor-pointer hover:opacity-80 transition-colors disabled:opacity-50`}
                >
                  {loading ? (
                    <><i className="ri-loader-4-line animate-spin mr-1.5" />불러오는 중...</>
                  ) : (
                    <><i className="ri-arrow-down-line mr-1.5" />더 불러오기</>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── 안내 푸터 ── */}
        <div className={`px-5 py-3 border-t ${t.border} flex items-start gap-2 ${isDark ? 'bg-teal-500/5' : 'bg-teal-50/50'}`}>
          <i className="ri-information-line text-teal-400 text-xs flex-shrink-0 mt-0.5" />
          <div className={`text-[10px] ${t.textFaint} space-y-0.5`}>
            <p>이 패널은 fal.ai Platform API <code className="font-mono">GET /v1/keys</code>를 사용합니다.</p>
            <p>Admin API 키가 필요합니다 —
              <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline ml-1">
                fal.ai 대시보드에서 발급 →
              </a>
            </p>
            <p>key_secret은 생성 시 한 번만 표시됩니다. 반드시 즉시 복사해서 보관하세요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
