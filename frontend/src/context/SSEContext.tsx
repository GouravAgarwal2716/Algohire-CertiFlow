import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type SSEListener = (event: { type: string; data: any; timestamp: string }) => void;

interface SSEContextType {
  isConnected: boolean;
  subscribe: (listener: SSEListener) => () => void;
  lastEvent: any;
}

const SSEContext = createContext<SSEContextType>({
  isConnected: false,
  subscribe: () => () => {},
  lastEvent: null,
});

export const SSEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<any>(null);
  const [listeners, setListeners] = useState<Set<SSEListener>>(new Set());

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      try {
        eventSource = new EventSource('/api/events/stream');

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (e) => {
          try {
            const parsed = JSON.parse(e.data);
            setLastEvent(parsed);
            listeners.forEach((listener) => listener(parsed));
          } catch {
            // Heartbeat or raw text ping
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Reconnect after 3 seconds
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [listeners]);

  const subscribe = useCallback((listener: SSEListener) => {
    setListeners((prev) => new Set(prev).add(listener));
    return () => {
      setListeners((prev) => {
        const next = new Set(prev);
        next.delete(listener);
        return next;
      });
    };
  }, []);

  return (
    <SSEContext.Provider value={{ isConnected, subscribe, lastEvent }}>
      {children}
    </SSEContext.Provider>
  );
};

export const useSSE = () => useContext(SSEContext);
