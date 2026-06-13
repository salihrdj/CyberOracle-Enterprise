'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSession } from '@auth0/nextjs-auth0';

export interface ThreatAlert {
  id: string;
  timestamp: string;
  attack_type: string;
  industry: string;
  region: string;
  severity: number;
  threat_score: number;
  growth_probability: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  explainability: Record<string, number>;
  enrichment: {
    splunk: any;
    virustotal: any;
  };
}

type MessageHandler = (data: any) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;
  private token: string | null = null;

  async connect(token?: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;
    this.token = token;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      // Use Sec-WebSocket-Protocol for token (more secure than query param)
      this.ws = new WebSocket(baseUrl, [`auth.${token}`]);
      
      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.dispatch(message.type, message.data);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`[WS] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.connect(this.token), this.reconnectDelay);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (error) {
      this.isConnecting = false;
      console.error('[WS] Connection failed:', error);
    }
  }

  private buildWsUrl(): string {
    const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const url = new URL(baseUrl);
    if (this.token) {
      url.searchParams.set('token', this.token);
    }
    return url.toString();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.token = null;
  }

  // Deprecated - kept for backward compatibility
  private buildWsUrl(): string {
    const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    return baseUrl;
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    
    return () => this.off(type, handler);
  }

  off(type: string, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  private dispatch(type: string, data: any): void {
    this.handlers.get(type)?.forEach((handler) => handler(data));
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

// React hook for using WebSocket
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<ThreatAlert | null>(null);

  useEffect(() => {
    const initWs = async () => {
      try {
        const session = await getSession();
        if (session?.accessToken) {
          await wsManager.connect(session.accessToken);
          setConnected(true);
        }
      } catch (e) {
        console.error('WS init failed:', e);
      }
    };

    initWs();

    const unsubInit = wsManager.on('INITIAL_CACHE', (data: ThreatAlert[]) => {
      setAlerts(data);
      if (data.length > 0 && !selectedAlert) {
        setSelectedAlert(data[0]);
      }
    });

    const unsubNew = wsManager.on('NEW_ALERT', (data: ThreatAlert) => {
      setAlerts((prev) => [data, ...prev].slice(0, 50));
    });

    const interval = setInterval(() => {
      setConnected(wsManager.readyState === WebSocket.OPEN);
    }, 5000);

    return () => {
      unsubInit();
      unsubNew();
      clearInterval(interval);
    };
  }, [selectedAlert]);

  const selectAlert = useCallback((alert: ThreatAlert) => {
    setSelectedAlert(alert);
  }, []);

  const pause = useCallback(() => {
    wsManager.disconnect();
    setConnected(false);
  }, []);

  const resume = useCallback(async () => {
    try {
      const session = await getSession();
      if (session?.accessToken) {
        await wsManager.connect(session.accessToken);
      }
    } catch (e) {
      console.error('WS resume failed:', e);
    }
  }, []);

  return {
    connected,
    alerts,
    selectedAlert,
    selectAlert,
    pause,
    resume,
  };
}