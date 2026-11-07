import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

import type { ChatRequest, ChatResponse } from "../api/types";

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      /** 같은 질문을 다시 보낼 때(재시도·확인 카드 "계산 실행") 쓰는 원래 요청 */
      request: ChatRequest;
      status: "pending" | "done" | "error";
      response?: ChatResponse;
      errorCode?: string;
    };

export type AssistantMessage = Extract<ChatMessage, { role: "assistant" }>;

/** 저장된 대화 1건 (사이드바 대화 기록) */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  calcContextId: string | null;
}

interface ChatState {
  /** 지금 보고 있는 대화의 ID (= 서버에 보내는 sessionId) */
  sessionId: string;
  messages: ChatMessage[];
  /** 계산기에서 넘어온 결과 ID — 사용자가 지우기 전까지 질문에 함께 보낸다 */
  calcContextId: string | null;
  /** 이전 대화 기록 (최근 순). 메시지가 하나라도 있는 대화만 들어간다. */
  conversations: Conversation[];
  add: (message: ChatMessage) => void;
  update: (id: string, patch: Partial<AssistantMessage>) => void;
  setCalcContextId: (id: string | null) => void;
  /** 새 대화 시작 (현재 대화는 기록에 남는다) */
  reset: () => void;
  /** 기록의 대화를 연다 */
  select: (id: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

const newId = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/** 브라우저 저장 공간(localStorage 약 5MB)을 넘지 않도록 보관 개수를 제한한다 */
export const MAX_CONVERSATIONS = 50;
const TITLE_MAX = 60;
export const STORAGE_KEY = "hrsg-chat";

function titleOf(messages: ChatMessage[]) {
  const first = messages.find((m) => m.role === "user");
  const text =
    first?.role === "user" ? first.text.replace(/\s+/g, " ").trim() : "";
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX)}…` : text;
}

/** 현재 대화를 기록에 반영(없으면 맨 앞에 추가, 있으면 갱신 후 맨 앞으로) */
function upsert(
  s: ChatState,
  messages: ChatMessage[],
  calcContextId: string | null,
): Conversation[] {
  if (!messages.length) return s.conversations;
  const now = Date.now();
  const prev = s.conversations.find((c) => c.id === s.sessionId);
  const conv: Conversation = {
    id: s.sessionId,
    title: prev?.title || titleOf(messages),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    messages,
    calcContextId,
  };
  return [conv, ...s.conversations.filter((c) => c.id !== s.sessionId)].slice(
    0,
    MAX_CONVERSATIONS,
  );
}

const patchMessages = (
  messages: ChatMessage[],
  id: string,
  patch: Partial<AssistantMessage>,
) =>
  messages.map((m) =>
    m.id === id && m.role === "assistant" ? { ...m, ...patch } : m,
  );

/** 저장 중 용량 초과면 오래된 대화부터 지우고 다시 시도한다. 저장이 막힌 환경(사생활 보호 모드 등)에서도 앱은 계속 동작. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    let v = value;
    for (let i = 0; i < 20; i++) {
      try {
        localStorage.setItem(name, v);
        return;
      } catch {
        const data = JSON.parse(v) as {
          state: { conversations: Conversation[] };
        };
        const list = data.state.conversations;
        if (list.length <= 1) return;
        data.state.conversations = list.slice(
          0,
          Math.max(1, Math.floor(list.length * 0.7)),
        );
        v = JSON.stringify(data);
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* 무시 */
    }
  },
};

/**
 * 대화 상태. 대화 기록은 이 브라우저의 localStorage에만 저장된다(서버·다른 기기와 공유되지 않음).
 * 새로고침하면 새 대화로 시작하고, 이전 대화는 사이드바에서 다시 열 수 있다.
 */
export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionId: newId(),
      messages: [],
      calcContextId: null,
      conversations: [],
      add: (message) =>
        set((s) => {
          const messages = [...s.messages, message];
          return {
            messages,
            conversations: upsert(s, messages, s.calcContextId),
          };
        }),
      // 답변이 오기 전에 다른 대화로 옮겨도 원래 대화에 반영되도록 기록 전체에서 찾는다
      update: (id, patch) =>
        set((s) => ({
          messages: patchMessages(s.messages, id, patch),
          conversations: s.conversations.map((c) =>
            c.messages.some((m) => m.id === id)
              ? { ...c, messages: patchMessages(c.messages, id, patch) }
              : c,
          ),
        })),
      setCalcContextId: (calcContextId) =>
        set((s) => ({
          calcContextId,
          conversations: s.conversations.map((c) =>
            c.id === s.sessionId ? { ...c, calcContextId } : c,
          ),
        })),
      reset: () =>
        set({ sessionId: newId(), messages: [], calcContextId: null }),
      select: (id) =>
        set((s) => {
          const c = s.conversations.find((x) => x.id === id);
          return c
            ? {
                sessionId: c.id,
                messages: c.messages,
                calcContextId: c.calcContextId,
              }
            : {};
        }),
      remove: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          ...(s.sessionId === id
            ? { sessionId: newId(), messages: [], calcContextId: null }
            : {}),
        })),
      clearAll: () =>
        set({
          conversations: [],
          sessionId: newId(),
          messages: [],
          calcContextId: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ conversations }) => ({ conversations }),
      // 새로고침으로 끊긴 '응답 대기' 메시지는 오류(다시 시도 가능)로 바꿔 불러온다
      merge: (persisted, current) => {
        const saved =
          (persisted as { conversations?: Conversation[] } | undefined)
            ?.conversations ?? [];
        const conversations = saved.map((c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.role === "assistant" && m.status === "pending"
              ? { ...m, status: "error" as const, errorCode: "INTERRUPTED" }
              : m,
          ),
        }));
        return { ...current, conversations };
      },
    },
  ),
);

export { newId };
