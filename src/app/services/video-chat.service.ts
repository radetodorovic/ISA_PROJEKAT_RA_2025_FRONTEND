import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { environment } from '../config/environment';
import { ChatMessage } from '../models/chat-message';

@Injectable({
  providedIn: 'root',
})
export class VideoChatService {
  private client: Client | null = null;
  private connectedVideoId: number | null = null;
  private readonly debugEnabled = true;

  private log(message: string, ...args: unknown[]): void {
    if (this.debugEnabled) {
      console.log(`[VideoChat] ${message}`, ...args);
    }
  }

  connect(
    videoId: number,
    username: string,
    onMessage: (msg: ChatMessage) => void,
    onStatus?: (status: string) => void
  ): void {
    if (this.client && this.connectedVideoId === videoId) {
      return;
    }
    this.disconnect();

    const wsUrl = `${environment.apiBaseUrl}/ws`;
    this.client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 2000,
      debug: (msg: string) => this.log(msg),
      onConnect: () => {
        this.connectedVideoId = videoId;
        this.log('connected', { videoId });
        onStatus?.('connected');
        const topic = `/topic/video/${videoId}/chat`;
        this.log('subscribe', topic);
        this.client?.subscribe(topic, (payload: IMessage) => {
          try {
            const parsed = JSON.parse(payload.body) as ChatMessage;
            onMessage(parsed);
            this.log('message', parsed);
          } catch {
            // ignore bad payloads
          }
        });

        const joinMessage: ChatMessage = {
          username,
          message: `${username} se pridruÅ¾io chatu.`,
          type: 'JOIN',
        };
        this.client?.publish({
          destination: `/app/chat/${videoId}/join`,
          body: JSON.stringify(joinMessage),
        });
        this.log('sent join', joinMessage);
      },
      onStompError: () => {
        this.log('stomp error');
        onStatus?.('error');
      },
      onWebSocketClose: () => {
        this.log('socket closed');
        onStatus?.('disconnected');
      },
      onWebSocketError: () => {
        this.log('socket error');
      },
    });

    onStatus?.('connecting');
    this.client.activate();
    this.log('activating', wsUrl);
  }

  sendMessage(videoId: number, username: string, message: string): void {
    if (!this.client || !message.trim()) {
      return;
    }
    const chatMessage: ChatMessage = {
      username,
      message: message.trim(),
      type: 'CHAT',
    };
    this.client.publish({
      destination: `/app/chat/${videoId}`,
      body: JSON.stringify(chatMessage),
    });
    this.log('sent chat', chatMessage);
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this.connectedVideoId = null;
    }
  }
}
