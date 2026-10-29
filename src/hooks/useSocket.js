import { useEffect, useRef, useCallback } from 'react';
import { io }        from 'socket.io-client';
import toast         from 'react-hot-toast';
import { useAuth }   from '../context/AuthContext';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

// Use window so AuthContext.logout() can clear it on user switch
if (typeof window !== 'undefined' && !window.__socketInstance) window.__socketInstance = null;

/**
 * useSocket — connects to the backend Socket.io server and lets
 * components subscribe to real-time events.
 *
 * Usage:
 *   const { on, off } = useSocket();
 *   useEffect(() => {
 *     on('new_alert', handler);
 *     return () => off('new_alert', handler);
 *   }, []);
 */
const useSocket = () => {
  const { user }   = useAuth();
  const socketRef  = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    // Reuse existing connection across renders
    if (!window.__socketInstance) {
      window.__socketInstance = io(SOCKET_URL, {
        auth:              { token },
        transports:        ['websocket'],
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      });

      window.__socketInstance.on('connect', () => {
        console.log('⚡ Socket connected:', window.__socketInstance.id);
      });

      window.__socketInstance.on('connect_error', (err) => {
        console.warn('Socket connection error:', err.message);
      });

      window.__socketInstance.on('disconnect', (reason) => {
        console.log('⚡ Socket disconnected:', reason);
      });

      // Global alert toast
      window.__socketInstance.on('new_alert', (alert) => {
        const icon  = { critical: '🚨', high: '⚠️', medium: '📢', low: 'ℹ️' }[alert.severity] || '🔔';
        const color = { critical: '#C0392B', high: '#C0392B', medium: '#B8670A' }[alert.severity];
        toast(alert.title, {
          icon,
          style: color ? { borderLeft: `4px solid ${color}` } : undefined,
          duration: 6000,
        });
      });
    }

    socketRef.current = window.__socketInstance;

    return () => {
      // Don't disconnect on unmount — keep the singleton alive
    };
  }, [user]);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, on, off, emit };
};

export default useSocket;
