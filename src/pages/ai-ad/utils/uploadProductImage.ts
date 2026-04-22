import { supabase } from '@/lib/supabase';

const UPLOAD_TIMEOUT_MS = 20000; // 20초 타임아웃
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_DIMENSION = 1536; // 최대 해상도 (fal.ai 권장)

/**
 * fetch with timeout — blob URL 읽기 시 무한 대기 방지
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 이미지를 Canvas로 리사이즈 (최대 MAX_DIMENSION px)
 * fal.ai는 너무 큰 이미지를 거부하거나 느리게 처리함
 */
async function resizeImageBlob(blob: Blob): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve(blob); // 리사이즈 불필요
        return;
      }
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(blob); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((resized) => resolve(resized ?? blob), 'image/jpeg', 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

/**
 * Blob → base64 data URL 변환
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader 오류'));
    reader.readAsDataURL(blob);
  });
}

/**
 * blob URL → Supabase Storage 업로드 → Signed URL 반환
 * Storage RLS가 허용하는 경우에만 사용 (로그인 사용자)
 */
async function uploadToStorage(blob: Blob, userId: string): Promise<string | null> {
  try {
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `users/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from('ad-products')
      .upload(fileName, blob, { contentType: blob.type || 'image/jpeg', upsert: false });

    if (error) {
      console.warn('[uploadProductImage] Storage 업로드 실패:', error.message);
      return null;
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from('ad-products')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7일 유효

    if (signError || !signedData?.signedUrl) {
      console.warn('[uploadProductImage] Signed URL 생성 실패:', signError?.message);
      return null;
    }

    console.log('[uploadProductImage] Storage 업로드 성공:', signedData.signedUrl.slice(0, 80));
    return signedData.signedUrl;
  } catch (e) {
    console.warn('[uploadProductImage] Storage 업로드 예외:', e);
    return null;
  }
}

/**
 * blob URL(로컬 파일)을 처리합니다.
 * 1순위: Supabase Storage 업로드 (로그인 사용자, RLS 허용 시)
 * 2순위: base64 data URL 반환 (Storage 실패 시 폴백)
 * 이미 https:// URL이면 그대로 반환합니다.
 */
export async function uploadProductImageToStorage(
  blobUrl: string,
  userId?: string | null,
): Promise<string> {
  // 이미 원격 URL이면 그대로 사용
  if (blobUrl.startsWith('http://') || blobUrl.startsWith('https://')) {
    return blobUrl;
  }

  if (!blobUrl.startsWith('blob:') && !blobUrl.startsWith('data:')) {
    throw new Error(`지원하지 않는 URL 형식: ${blobUrl.slice(0, 30)}`);
  }

  // data URL이면 그대로 반환
  if (blobUrl.startsWith('data:')) {
    return blobUrl;
  }

  // blob URL → Blob 변환 (타임아웃 포함)
  let response: Response;
  try {
    response = await fetchWithTimeout(blobUrl, UPLOAD_TIMEOUT_MS);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('이미지 읽기 시간 초과 (20초). 파일이 너무 크거나 손상됐을 수 있어요.');
    }
    throw new Error(`이미지 읽기 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!response.ok) {
    throw new Error(`이미지 읽기 실패: HTTP ${response.status}`);
  }

  let blob = await response.blob();

  if (blob.size === 0) {
    throw new Error('이미지 파일이 비어있습니다.');
  }

  // 파일 크기 제한 (8MB)
  if (blob.size > MAX_FILE_SIZE) {
    throw new Error(`이미지 파일이 너무 큽니다 (${(blob.size / 1024 / 1024).toFixed(1)}MB). 8MB 이하로 줄여주세요.`);
  }

  // 이미지 리사이즈 (너무 크면 fal.ai가 거부)
  try {
    blob = await resizeImageBlob(blob);
  } catch {
    // 리사이즈 실패해도 원본으로 계속 진행
  }

  // 1순위: Storage 업로드 (로그인 사용자)
  if (userId) {
    const storageUrl = await uploadToStorage(blob, userId);
    if (storageUrl) return storageUrl;
  }

  // 2순위: base64 data URL (Storage 실패 또는 비로그인)
  // fal.ai는 base64 data URL을 image_url로 직접 받을 수 있음
  try {
    const base64 = await blobToBase64(blob);
    console.log('[uploadProductImage] base64 폴백 사용, 크기:', Math.round(blob.size / 1024), 'KB');
    return base64;
  } catch (e) {
    throw new Error(`이미지 변환 실패: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * 여러 blob URL을 병렬로 처리합니다.
 * 실패한 항목은 건너뜁니다.
 */
export async function uploadProductImagesToStorage(
  blobUrls: string[],
  userId?: string | null,
): Promise<string[]> {
  if (blobUrls.length === 0) return [];

  const results = await Promise.allSettled(
    blobUrls.map((url) => uploadProductImageToStorage(url, userId)),
  );

  const succeeded: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      succeeded.push(r.value);
    } else {
      console.warn(`[uploadProductImage] ${i + 1}번째 이미지 처리 실패:`, r.reason);
    }
  });

  return succeeded;
}
