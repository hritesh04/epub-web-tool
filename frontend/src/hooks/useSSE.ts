import { useState, useEffect, useRef } from 'react'

const MAX_DELAY = 30000; // 30s max delay

export function useSSE(bookID: string, initialStatus: string) {
  const [progress, setProgress] = useState(initialStatus === 'finished' ? 100 : 10)
  const [status, setStatus] = useState(initialStatus)
  const [error, setError] = useState<string | null>(null)
  
  const retryCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Only connect if status is in-progress or compiling
    if (status !== 'in-progress' && status !== 'compiling' && status !== 'queued') {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (activeControllerRef.current) activeControllerRef.current.abort()
      return;
    }

    const connect = async () => {
      if (activeControllerRef.current) activeControllerRef.current.abort()
      activeControllerRef.current = new AbortController();
      const signal = activeControllerRef.current.signal;

      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        const url = `${baseUrl}/progress/${bookID}`;
        
        const response = await fetch(url, {
          signal,
          credentials: 'include',
        });

        // 202 Accepted: request accepted but processing not started
        if (response.status === 202 ) {
           const delay = Math.min(Math.pow(2, retryCountRef.current) * 1000, MAX_DELAY);
           retryCountRef.current += 1;
           timerRef.current = setTimeout(connect, delay);
           return;
        }

        if (!response.ok) {
           throw new Error(`SSE Connection failed with status ${response.status}`);
        }

        retryCountRef.current = 0; // reset retry count on success
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body reader available');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            let eventType = 'message';
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              
              // Skip comments (heartbeats)
              if (trimmedLine.startsWith(':')) continue;
              
              if (trimmedLine.startsWith('event:')) {
                eventType = trimmedLine.replace('event:', '').trim();
              } else if (trimmedLine.startsWith('data:')) {
                const dataStr = trimmedLine.replace('data:', '').trim();
                try {
                  const data = JSON.parse(dataStr);
                  
                  if (eventType === 'progress') {
                    if (data.progress !== undefined) setProgress(data.progress);
                    if (data.status !== undefined) setStatus(data.status);
                    
                    // Break if finished
                    if (data.status === 'finished') {
                      if (activeControllerRef.current) activeControllerRef.current.abort();
                      return;
                    }
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e, 'Raw:', dataStr);
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        
        setError(err.message);
        
        // Retry on connection error with exponential backoff
        const delay = Math.min(Math.pow(2, retryCountRef.current) * 1000, MAX_DELAY);
        retryCountRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      if (activeControllerRef.current) activeControllerRef.current.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
    };
  }, [bookID, initialStatus]); // We only want to start the loop once, or if bookID changes

  return { progress, status, error };
}
