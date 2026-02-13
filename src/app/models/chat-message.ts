export type ChatMessageType = 'CHAT' | 'JOIN' | 'LEAVE';

export interface ChatMessage {
  username: string;
  message: string;
  timestamp?: string;
  type: ChatMessageType;
}
