import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

// Toss 가 실패 콜백에 query string 으로 message 를 보내는데, 이론적으로는
// 누군가 임의 길이의 phishing 메시지를 URL 에 넣어 사용자에게 공유할 수 있어요
// (예: 결제 안내 사칭). React 가 자동 escape 해서 XSS 는 막지만 사회공학적
// 메시지를 그대로 보여주지 않도록 길이 cap.
const MAX_MESSAGE_LEN = 200;

export default function PaymentFailPage() {
  const [params] = useSearchParams();
  const code = params.get('code') ?? '';
  const rawMessage = params.get('message') ?? '결제가 정상적으로 완료되지 않았습니다.';
  const message = rawMessage.length > MAX_MESSAGE_LEN
    ? `${rawMessage.slice(0, MAX_MESSAGE_LEN)}...`
    : rawMessage;
  const orderId = params.get('orderId') ?? '';

  useEffect(() => {
    document.title = '결제 실패 | AiMetaWOW';
  }, []);

  // PAY_PROCESS_CANCELED = 사용자가 결제창을 닫음. UX 차원에서 좀 더 부드러운 메시지로 표시.
  const isUserCancel = code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL';
  const heading = isUserCancel ? '결제를 취소하셨습니다' : '결제에 실패했습니다';
  const subtitle = isUserCancel
    ? '언제든 다시 시도하실 수 있어요.'
    : message;

  return (
    <div className="min-h-screen bg-[#06060a] text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex flex-col items-center gap-5 px-6 py-8 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
            isUserCancel
              ? 'bg-zinc-700/60 border border-white/10'
              : 'bg-red-500/15 border border-red-500/30'
          }`}>
            <i className={`${isUserCancel ? 'ri-close-line text-zinc-400' : 'ri-error-warning-line text-red-400'} text-3xl`} />
          </div>
          <div>
            <p className="text-base font-bold">{heading}</p>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed break-keep">{subtitle}</p>
            {code && !isUserCancel && (
              <p className="text-[10px] text-zinc-600 mt-3 font-mono">에러 코드: {code}</p>
            )}
            {orderId && (
              <p className="text-[10px] text-zinc-600 mt-1 font-mono">주문번호: {orderId}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 w-full">
            <Link to="/customer-support" className="contents">
              <button className="w-full py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/5 text-zinc-300 font-semibold text-sm rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                고객지원
              </button>
            </Link>
            <Link to="/credit-purchase" className="contents">
              <button className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                다시 시도
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
