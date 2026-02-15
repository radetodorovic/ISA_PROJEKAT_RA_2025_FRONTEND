import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';
import { AuthService } from './auth.service';
import { WatchPartyRoom } from '../models/watch-party-room';
import { WatchPartyStart } from '../models/watch-party-start';

@Injectable({
  providedIn: 'root',
})
export class WatchPartyService {
  private client: Client | null = null;
  private connectedRoomId: string | null = null;
  private readonly debugEnabled = true;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private log(message: string, ...args: unknown[]): void {
    if (this.debugEnabled) {
      console.log(`[WatchParty] ${message}`, ...args);
    }
  }

  createRoom(): Observable<WatchPartyRoom> {
    const token = this.authService.getToken();
    const headers = token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : new HttpHeaders();
    return this.http.post<WatchPartyRoom>(`${environment.apiBaseUrl}/api/watch-party`, {}, { headers });
  }

  getRoom(roomId: string): Observable<WatchPartyRoom> {
    const token = this.authService.getToken();
    const headers = token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : new HttpHeaders();
    return this.http.get<WatchPartyRoom>(`${environment.apiBaseUrl}/api/watch-party/${roomId}`, { headers });
  }

  connect(
    roomId: string,
    onStart: (msg: WatchPartyStart) => void,
    onStatus?: (status: string) => void
  ): void {
    if (this.client && this.connectedRoomId === roomId) {
      return;
    }
    this.disconnect();

    const wsUrl = `${environment.apiBaseUrl}/ws`;
    this.client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 2000,
      debug: (msg: string) => this.log(msg),
      onConnect: () => {
        this.connectedRoomId = roomId;
        onStatus?.('connected');
        const topic = `/topic/watch-party/${roomId}/start`;
        this.log('subscribe', topic);
        this.client?.subscribe(topic, (payload: IMessage) => {
          try {
            const parsed = JSON.parse(payload.body) as WatchPartyStart;
            onStart(parsed);
          } catch {
            // ignore bad payloads
          }
        });
      },
      onStompError: () => {
        onStatus?.('error');
      },
      onWebSocketClose: () => {
        onStatus?.('disconnected');
      },
    });

    onStatus?.('connecting');
    this.client.activate();
  }

  sendStart(roomId: string, videoId: number, startedBy: number | null): void {
    if (!this.client) return;
    const message: WatchPartyStart = {
      roomId,
      videoId,
      startedBy: startedBy ?? 0,
      startedAt: new Date().toISOString(),
    };
    this.client.publish({
      destination: `/app/watch-party/${roomId}/start`,
      body: JSON.stringify(message),
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this.connectedRoomId = null;
    }
  }
}
