export type BadgeType = 'Image' | 'Video' | 'Avatar' | 'Edit';

export interface AIFeature {
  id: number;
  name: string;
  badge: BadgeType;
  iconSrc: string;
}

export const aiFeatures: AIFeature[] = [
  { id: 1, name: 'Aurora V1 Pro', badge: 'Avatar', iconSrc: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://creatify.ai/pricing&size=32' },
  { id: 2, name: 'Nano Banana 2', badge: 'Image', iconSrc: 'https://www.gstatic.com/lamda/images/gemini_sparkle_4g_512_lt_f94943af3be039176192d.png' },
  { id: 3, name: 'Seedance 2.0', badge: 'Video', iconSrc: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://seedance1.org/&size=32' },
  { id: 4, name: 'Topaz Starlight 2.5', badge: 'Edit', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.topazlabs.com/favicon.ico&size=128' },
  { id: 5, name: 'Topaz Image Upscale', badge: 'Edit', iconSrc: 'https://www.google.com/s2/favicons?domain=topazlabs.com&sz=32' },
  { id: 6, name: 'Omni-Human 1.5', badge: 'Avatar', iconSrc: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico' },
  { id: 7, name: 'Nano Banana Pro', badge: 'Image', iconSrc: 'https://www.gstatic.com/lamda/images/gemini_sparkle_4g_512_lt_f94943af3be039176192d.png' },
  { id: 8, name: 'Veo 3.1', badge: 'Video', iconSrc: 'https://www.gstatic.com/lamda/images/favicon_v1_150160cddff7f294ce30.svg' },
  { id: 9, name: 'Topaz Video Upscale', badge: 'Edit', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.topazlabs.com/favicon.ico&size=128' },
  { id: 10, name: 'Veed Fabric', badge: 'Avatar', iconSrc: 'https://cdn.prod.website-files.com/66cdd247adf047149c19f214/66cdd71b5222610712f66faf_favicon.png' },
  { id: 11, name: 'InfiniteTalk', badge: 'Avatar', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://bbanana.ai&size=32' },
  { id: 12, name: 'Sora 2', badge: 'Video', iconSrc: 'https://cdn.openai.com/sora/assets/favicon-nf2.ico' },
  { id: 13, name: 'Seedream 5.0 Lite', badge: 'Image', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.byteplus.com/&size=32' },
  { id: 14, name: 'Sora 2 Watermark Remover', badge: 'Edit', iconSrc: 'https://cdn.openai.com/sora/assets/favicon-nf2.ico' },
  { id: 15, name: 'Runway Aleph', badge: 'Edit', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://runwayml.com&size=32' },
  { id: 16, name: 'Kling 3.0', badge: 'Video', iconSrc: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://klingai.com&size=32' },
  { id: 17, name: 'Recraft Remove Background', badge: 'Edit', iconSrc: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://recraft.ai&size=32' },
  { id: 18, name: 'Hailuo 2.3', badge: 'Video', iconSrc: 'https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/favicon.png' },
  { id: 19, name: 'Z-IMAGE Turbo', badge: 'Image', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://qwen.ai&size=32' },
  { id: 20, name: 'Kling 3.0 Motion Control', badge: 'Avatar', iconSrc: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://klingai.com&size=32' },
  { id: 21, name: 'Wan 2.2 Animate', badge: 'Avatar', iconSrc: 'https://g.alicdn.com/sail-web/wan-static-resources/0.0.30/images/favicon.ico' },
  { id: 22, name: 'Higgsfield Soul', badge: 'Image', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://higgsfield.ai&size=32' },
  { id: 23, name: 'PIxverse Lipsync', badge: 'Avatar', iconSrc: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://pixverse.ai&size=32' },
  { id: 24, name: 'Vidu Q3', badge: 'Video', iconSrc: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.vidu.com/ko&size=32' },
  { id: 25, name: 'Ideogram V3', badge: 'Image', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://ideogram.ai/favicon.ico&size=128' },
  { id: 26, name: 'Runway Gen-4.5 Turbo', badge: 'Video', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://runwayml.com&size=32' },
  { id: 27, name: 'Qwen Image', badge: 'Image', iconSrc: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://chat.qwen.ai/&size=32' },
  { id: 28, name: 'GPT Image 1.5', badge: 'Image', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://openai.com/favicon.ico&size=128' },
  { id: 29, name: 'FLUX 2', badge: 'Image', iconSrc: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bfl.ai/&size=32' },
  { id: 30, name: 'Grok Imagine Image', badge: 'Image', iconSrc: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://x.ai&size=32' },
  { id: 31, name: 'Wan 2.5', badge: 'Video', iconSrc: 'https://g.alicdn.com/sail-web/wan-static-resources/0.0.30/images/favicon.ico' },
  { id: 32, name: 'Grok Imagine Video', badge: 'Video', iconSrc: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://x.ai&size=32' },
  { id: 33, name: 'LTX 2.3', badge: 'Video', iconSrc: 'https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://ltxstudio.ai&size=32' },
];
