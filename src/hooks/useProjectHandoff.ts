/**
 * useProjectHandoff
 * 프로젝트 갤러리 → YouTube Studio 간 데이터 전달 훅
 * sessionStorage를 사용해 페이지 이동 시 프로젝트 컨텍스트를 유지합니다.
 */

import { useCallback } from 'react';
import { AutomationProject } from '@/mocks/automationProjects';

const HANDOFF_KEY = 'yt_studio_project_handoff';

export interface ProjectHandoffData {
  projectId: string;
  title: string;
  topic: string;
  ratio: string;
  style: string;
  duration: number;
  model: string;
  mode: 'AutoPilot' | 'Manual';
  thumbnail: string;
  /** Step2에 미리 채울 대본 초안 (topic 기반) */
  scriptDraft: string;
  /** Step1에 미리 채울 키워드 */
  keywords: string[];
  /** 채널명 */
  channelName?: string;
  /** 이어서 편집 시작 스텝 (1~6, 기본값 1) */
  resumeStep?: number;
  /** 전달 시각 */
  timestamp: number;
}

/** 프로젝트 → 핸드오프 데이터 변환 */
function projectToHandoff(project: AutomationProject, resumeStep?: number): ProjectHandoffData {
  // topic에서 키워드 추출 (공백/쉼표 기준)
  const keywords = project.topic
    .split(/[\s,]+/)
    .filter((w) => w.length >= 2)
    .slice(0, 5);

  // 대본 초안: topic을 기반으로 간단한 프롬프트 생성
  const scriptDraft = `[${project.title}]\n\n주제: ${project.topic}\n\n위 주제로 ${project.duration}초 분량의 유튜브 영상 대본을 작성해주세요.\n스타일: ${project.style}\n비율: ${project.ratio}`;

  return {
    projectId: project.id,
    title: project.title,
    topic: project.topic,
    ratio: project.ratio,
    style: project.style,
    duration: project.duration,
    model: project.model,
    mode: project.mode,
    thumbnail: project.thumbnail,
    scriptDraft,
    keywords,
    resumeStep: resumeStep ?? 1,
    timestamp: Date.now(),
  };
}

export function useProjectHandoff() {
  /** 프로젝트 데이터를 sessionStorage에 저장 (resumeStep 옵션 지원) */
  const setHandoffProject = useCallback((project: AutomationProject, resumeStep?: number) => {
    try {
      const data = projectToHandoff(project, resumeStep);
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  /** sessionStorage에서 핸드오프 데이터 읽기 (한 번 읽으면 삭제) */
  const consumeHandoffData = useCallback((): ProjectHandoffData | null => {
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as ProjectHandoffData;
      // 5분 이내 데이터만 유효
      if (Date.now() - data.timestamp > 5 * 60 * 1000) {
        sessionStorage.removeItem(HANDOFF_KEY);
        return null;
      }
      sessionStorage.removeItem(HANDOFF_KEY);
      return data;
    } catch {
      return null;
    }
  }, []);

  /** 핸드오프 데이터가 있는지 확인 (삭제하지 않음) */
  const peekHandoffData = useCallback((): ProjectHandoffData | null => {
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as ProjectHandoffData;
      if (Date.now() - data.timestamp > 5 * 60 * 1000) {
        sessionStorage.removeItem(HANDOFF_KEY);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const clearHandoffData = useCallback(() => {
    try {
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { setHandoffProject, consumeHandoffData, peekHandoffData, clearHandoffData };
}
