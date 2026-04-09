import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { ReplaySubject, Subject } from 'rxjs';
import {
  PvpBattleState,
  PvpMatchFoundEvent,
  PvpMatchResumeEvent,
  PvpQueueErrorEvent,
  PvpQueueJoinedEvent,
  PvpQueueLeftEvent,
  PvpQueueReadyEvent,
} from '../models/pvp.models';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class PvpService {
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private socket: Socket | null = null;

  private readonly queueReadySubject = new ReplaySubject<PvpQueueReadyEvent>(1);
  private readonly queueJoinedSubject = new Subject<PvpQueueJoinedEvent>();
  private readonly queueLeftSubject = new Subject<PvpQueueLeftEvent>();
  private readonly queueErrorSubject = new Subject<PvpQueueErrorEvent>();
  private readonly matchFoundSubject = new Subject<PvpMatchFoundEvent>();
  private readonly matchResumeSubject = new Subject<PvpMatchResumeEvent>();
  private readonly battleStateSubject = new Subject<PvpBattleState>();
  private readonly battleErrorSubject = new Subject<PvpQueueErrorEvent>();
  private readonly disconnectedSubject = new Subject<void>();

  readonly queueReady$ = this.queueReadySubject.asObservable();
  readonly queueJoined$ = this.queueJoinedSubject.asObservable();
  readonly queueLeft$ = this.queueLeftSubject.asObservable();
  readonly queueError$ = this.queueErrorSubject.asObservable();
  readonly matchFound$ = this.matchFoundSubject.asObservable();
  readonly matchResume$ = this.matchResumeSubject.asObservable();
  readonly battleState$ = this.battleStateSubject.asObservable();
  readonly battleError$ = this.battleErrorSubject.asObservable();
  readonly disconnected$ = this.disconnectedSubject.asObservable();

  async connect(accessToken: string): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    const socket = io(`${this.apiBaseUrl}/pvp`, {
      transports: ['websocket'],
      auth: {
        token: accessToken,
      },
      withCredentials: true,
    });

    this.socket = socket;
    this.bindEvents(socket);

    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (error: Error) => {
        reject(error);
      });
    });
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.disconnect();
    this.socket = null;
  }

  joinQueue(teamId?: string): void {
    if (!this.socket?.connected) {
      this.queueErrorSubject.next({ message: 'PvP socket is not connected.' });
      return;
    }

    this.socket.emit('queue:join', teamId ? { teamId } : {});
  }

  leaveQueue(): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('queue:leave');
  }

  joinMatch(matchId: string): void {
    if (!this.socket?.connected) {
      this.queueErrorSubject.next({ message: 'PvP socket is not connected.' });
      return;
    }
    this.socket.emit('match:join', { matchId });
  }

  sendMove(matchId: string, moveIndex: number): void {
    if (!this.socket?.connected) {
      this.battleErrorSubject.next({ message: 'PvP socket is not connected.' });
      return;
    }
    this.socket.emit('battle:action', { matchId, action: 'MOVE', moveIndex });
  }

  sendSwitch(matchId: string, switchIndex: number): void {
    if (!this.socket?.connected) {
      this.battleErrorSubject.next({ message: 'PvP socket is not connected.' });
      return;
    }
    this.socket.emit('battle:action', { matchId, action: 'SWITCH', switchIndex });
  }

  private bindEvents(socket: Socket): void {
    socket.on('queue:ready', (payload: PvpQueueReadyEvent) => {
      this.queueReadySubject.next(payload);
    });
    socket.on('queue:joined', (payload: PvpQueueJoinedEvent) => {
      this.queueJoinedSubject.next(payload);
    });
    socket.on('queue:left', (payload: PvpQueueLeftEvent) => {
      this.queueLeftSubject.next(payload);
    });
    socket.on('queue:error', (payload: PvpQueueErrorEvent) => {
      this.queueErrorSubject.next(payload);
    });
    socket.on('match:found', (payload: PvpMatchFoundEvent) => {
      this.matchFoundSubject.next(payload);
    });
    socket.on('match:resume', (payload: PvpMatchResumeEvent) => {
      this.matchResumeSubject.next(payload);
    });
    socket.on('match:state', (payload: PvpBattleState) => {
      this.battleStateSubject.next(payload);
    });
    socket.on('battle:error', (payload: PvpQueueErrorEvent) => {
      this.battleErrorSubject.next(payload);
    });
    socket.on('exception', (payload: { message?: string }) => {
      this.queueErrorSubject.next({ message: payload?.message ?? 'Socket exception.' });
    });
    socket.on('disconnect', () => {
      this.disconnectedSubject.next();
    });
  }
}
