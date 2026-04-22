export interface ShortcutTool {
  name: string;
  icon: string;
  color: string;
  url: string;
  desc: string;
}

export interface ShortcutCategory {
  id: string;
  label: string;
  tools: ShortcutTool[];
}

export const shortcutCategories: ShortcutCategory[] = [
  {
    id: 'ai-agent',
    label: 'AI Agent',
    tools: [
      { name: 'ChatGPT', icon: 'https://readdy.ai/api/search-image?query=ChatGPT%20OpenAI%20logo%20icon%2C%20white%20on%20dark%20background%2C%20clean%20minimal%20design%2C%20circular%20icon&width=60&height=60&seq=sc1&orientation=squarish', color: '#10a37f', url: 'https://chat.openai.com', desc: 'OpenAI 대화형 AI' },
      { name: 'Perplexity', icon: 'https://readdy.ai/api/search-image?query=Perplexity%20AI%20logo%20icon%2C%20teal%20color%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc2&orientation=squarish', color: '#20b2aa', url: 'https://www.perplexity.ai', desc: 'AI 검색 엔진' },
      { name: 'Gemini', icon: 'https://readdy.ai/api/search-image?query=Google%20Gemini%20AI%20logo%20icon%2C%20colorful%20gradient%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc3&orientation=squarish', color: '#4285f4', url: 'https://gemini.google.com', desc: 'Google AI 어시스턴트' },
      { name: 'Claude', icon: 'https://readdy.ai/api/search-image?query=Anthropic%20Claude%20AI%20logo%20icon%2C%20orange%20coral%20color%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc4&orientation=squarish', color: '#d97706', url: 'https://claude.ai', desc: 'Anthropic AI 어시스턴트' },
      { name: 'Grok', icon: 'https://readdy.ai/api/search-image?query=Grok%20xAI%20logo%20icon%2C%20white%20X%20symbol%2C%20dark%20background%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc5&orientation=squarish', color: '#ffffff', url: 'https://grok.x.ai', desc: 'xAI 대화형 AI' },
      { name: 'Genspark', icon: 'https://readdy.ai/api/search-image?query=Genspark%20AI%20logo%20icon%2C%20spark%20symbol%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc6&orientation=squarish', color: '#6366f1', url: 'https://www.genspark.ai', desc: 'AI 검색 & 에이전트' },
      { name: 'Flowith', icon: 'https://readdy.ai/api/search-image?query=Flowith%20AI%20logo%20icon%2C%20flow%20symbol%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc7&orientation=squarish', color: '#8b5cf6', url: 'https://flowith.io', desc: 'AI 플로우 빌더' },
    ],
  },
  {
    id: 'image',
    label: 'Image',
    tools: [
      { name: 'Midjourney', icon: 'https://readdy.ai/api/search-image?query=Midjourney%20AI%20logo%20icon%2C%20white%20boat%20symbol%2C%20dark%20background%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc8&orientation=squarish', color: '#ffffff', url: 'https://www.midjourney.com', desc: 'AI 이미지 생성' },
      { name: 'Nano Banana', icon: 'https://readdy.ai/api/search-image?query=banana%20AI%20logo%20icon%2C%20yellow%20banana%20symbol%2C%20dark%20background%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc9&orientation=squarish', color: '#eab308', url: 'https://nanobanana.ai', desc: 'AI 이미지 생성' },
      { name: 'Imagine Art', icon: 'https://readdy.ai/api/search-image?query=Imagine%20Art%20AI%20logo%20icon%2C%20colorful%20art%20symbol%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc10&orientation=squarish', color: '#ec4899', url: 'https://www.imagine.art', desc: 'AI 아트 생성' },
      { name: 'Sora', icon: 'https://readdy.ai/api/search-image?query=OpenAI%20Sora%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon%2C%20dark%20background&width=60&height=60&seq=sc11&orientation=squarish', color: '#10a37f', url: 'https://sora.com', desc: 'OpenAI 영상 생성' },
      { name: 'Flux', icon: 'https://readdy.ai/api/search-image?query=Flux%20AI%20image%20generation%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc12&orientation=squarish', color: '#7c3aed', url: 'https://flux.ai', desc: 'AI 이미지 생성' },
      { name: 'Whisk', icon: 'https://readdy.ai/api/search-image?query=Google%20Whisk%20AI%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc13&orientation=squarish', color: '#4285f4', url: 'https://labs.google/fx/tools/whisk', desc: 'Google AI 이미지 리믹스' },
      { name: 'Dreamina', icon: 'https://readdy.ai/api/search-image?query=Dreamina%20AI%20logo%20icon%2C%20dream%20symbol%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc14&orientation=squarish', color: '#f59e0b', url: 'https://dreamina.capcut.com', desc: 'AI 이미지 & 영상' },
      { name: 'Qwen', icon: 'https://readdy.ai/api/search-image?query=Alibaba%20Qwen%20AI%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc15&orientation=squarish', color: '#6366f1', url: 'https://qwenlm.github.io', desc: 'Alibaba AI 모델' },
    ],
  },
  {
    id: 'video',
    label: 'Video',
    tools: [
      { name: 'Sora 2', icon: 'https://readdy.ai/api/search-image?query=OpenAI%20Sora%202%20video%20AI%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc16&orientation=squarish', color: '#10a37f', url: 'https://sora.com', desc: 'OpenAI 영상 생성' },
      { name: 'VEO 3', icon: 'https://readdy.ai/api/search-image?query=Google%20VEO%203%20video%20AI%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc17&orientation=squarish', color: '#4285f4', url: 'https://deepmind.google/technologies/veo', desc: 'Google 영상 생성' },
      { name: 'Hailuo', icon: 'https://readdy.ai/api/search-image?query=Hailuo%20AI%20video%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc19&orientation=squarish', color: '#06b6d4', url: 'https://hailuoai.video', desc: 'AI 영상 생성' },
      { name: 'Kling', icon: 'https://readdy.ai/api/search-image?query=Kling%20AI%20video%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc21&orientation=squarish', color: '#f59e0b', url: 'https://klingai.com', desc: 'AI 영상 생성' },
      { name: 'Runway', icon: 'https://readdy.ai/api/search-image?query=Runway%20ML%20AI%20video%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc22&orientation=squarish', color: '#10b981', url: 'https://runwayml.com', desc: 'AI 영상 편집 & 생성' },
      { name: 'Pika Labs', icon: 'https://readdy.ai/api/search-image?query=Pika%20Labs%20AI%20video%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc23&orientation=squarish', color: '#ec4899', url: 'https://pika.art', desc: 'AI 영상 생성' },
      { name: 'Luma AI', icon: 'https://readdy.ai/api/search-image?query=Luma%20AI%20video%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc24&orientation=squarish', color: '#6366f1', url: 'https://lumalabs.ai', desc: 'AI 3D & 영상' },
      { name: 'Topaz', icon: 'https://readdy.ai/api/search-image?query=Topaz%20Labs%20AI%20video%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc25&orientation=squarish', color: '#0ea5e9', url: 'https://www.topazlabs.com', desc: 'AI 영상 업스케일' },
    ],
  },
  {
    id: 'voice-lipsync',
    label: 'Voice / Lip-Sync',
    tools: [
      { name: 'ElevenLabs', icon: 'https://readdy.ai/api/search-image?query=ElevenLabs%20AI%20voice%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc27&orientation=squarish', color: '#f59e0b', url: 'https://elevenlabs.io', desc: 'AI 음성 합성' },
      { name: 'Supertone', icon: 'https://readdy.ai/api/search-image?query=Supertone%20AI%20voice%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc29&orientation=squarish', color: '#06b6d4', url: 'https://supertone.ai', desc: 'AI 보이스 클로닝' },
      { name: 'Typecast', icon: 'https://readdy.ai/api/search-image?query=Typecast%20AI%20voice%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc30&orientation=squarish', color: '#10b981', url: 'https://typecast.ai', desc: 'AI TTS 플랫폼' },
      { name: 'HeyGen', icon: 'https://readdy.ai/api/search-image?query=HeyGen%20AI%20avatar%20video%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc31&orientation=squarish', color: '#6366f1', url: 'https://www.heygen.com', desc: 'AI 아바타 영상' },
      { name: 'Hedra', icon: 'https://readdy.ai/api/search-image?query=Hedra%20AI%20lip%20sync%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc32&orientation=squarish', color: '#ec4899', url: 'https://www.hedra.com', desc: 'AI 립싱크' },
    ],
  },
  {
    id: 'vibe-coding',
    label: 'Vibe Coding',
    tools: [
      { name: 'Google AI Studio', icon: 'https://readdy.ai/api/search-image?query=Google%20AI%20Studio%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc33&orientation=squarish', color: '#4285f4', url: 'https://aistudio.google.com', desc: 'Google AI 개발 도구' },
      { name: 'Lovable', icon: 'https://readdy.ai/api/search-image?query=Lovable%20AI%20coding%20logo%20icon%2C%20heart%20symbol%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc34&orientation=squarish', color: '#ec4899', url: 'https://lovable.dev', desc: 'AI 앱 빌더' },
      { name: 'Replit AI', icon: 'https://readdy.ai/api/search-image?query=Replit%20AI%20coding%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc35&orientation=squarish', color: '#f59e0b', url: 'https://replit.com', desc: 'AI 코딩 플랫폼' },
      { name: 'Cursor', icon: 'https://readdy.ai/api/search-image?query=Cursor%20AI%20code%20editor%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc36&orientation=squarish', color: '#ffffff', url: 'https://cursor.sh', desc: 'AI 코드 에디터' },
      { name: 'Bolt', icon: 'https://readdy.ai/api/search-image?query=Bolt%20AI%20coding%20logo%20icon%2C%20lightning%20bolt%20symbol%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc39&orientation=squarish', color: '#6366f1', url: 'https://bolt.new', desc: 'AI 풀스택 빌더' },
    ],
  },
  {
    id: 'music',
    label: 'Music',
    tools: [
      { name: 'Suno AI', icon: 'https://readdy.ai/api/search-image?query=Suno%20AI%20music%20generation%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc40&orientation=squarish', color: '#f59e0b', url: 'https://suno.com', desc: 'AI 음악 생성' },
      { name: 'Udio', icon: 'https://readdy.ai/api/search-image?query=Udio%20AI%20music%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc41&orientation=squarish', color: '#ec4899', url: 'https://www.udio.com', desc: 'AI 음악 작곡' },
      { name: 'AIVA', icon: 'https://readdy.ai/api/search-image?query=AIVA%20AI%20music%20composition%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc42&orientation=squarish', color: '#8b5cf6', url: 'https://www.aiva.ai', desc: 'AI 작곡 도구' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    tools: [
      { name: 'Opus', icon: 'https://readdy.ai/api/search-image?query=Opus%20AI%20video%20editing%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc43&orientation=squarish', color: '#10b981', url: 'https://opus.pro', desc: 'AI 영상 클립 편집' },
      { name: 'CapCut', icon: 'https://readdy.ai/api/search-image?query=CapCut%20video%20editing%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc45&orientation=squarish', color: '#ffffff', url: 'https://www.capcut.com', desc: 'AI 영상 편집' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    tools: [
      { name: 'Gamma', icon: 'https://readdy.ai/api/search-image?query=Gamma%20AI%20presentation%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc46&orientation=squarish', color: '#6366f1', url: 'https://gamma.app', desc: 'AI 프레젠테이션' },
      { name: 'NotebookLM', icon: 'https://readdy.ai/api/search-image?query=Google%20NotebookLM%20AI%20logo%20icon%2C%20minimal%20clean%20design%2C%20circular%20icon&width=60&height=60&seq=sc47&orientation=squarish', color: '#4285f4', url: 'https://notebooklm.google.com', desc: 'Google AI 노트' },
    ],
  },
];
