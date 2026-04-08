import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  let os = 'PC';
  if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Windows')) os = 'Windows';

  return `${browser} / ${os}`;
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem('sf_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('sf_device_id', id);
  }
  return id;
}

export function useSessionManager(enabled = true) {
  const [sessionStatus, setSessionStatus] = useState(null); // 'active' | 'passive' | 'revoked'
  const [sessionExpired, setSessionExpired] = useState(false);

  const isAuthError = (e) => {
    const msg = e?.message || e?.response?.data?.message || '';
    return msg.includes('auth_required') || msg.includes('private') || (e?.status === 403) || (e?.response?.status === 403);
  };

  const initSession = useCallback(async () => {
    try {
      const device_id = getOrCreateDeviceId();
      const device_name = getDeviceInfo();
      const res = await base44.functions.invoke('manageSession', { device_id, device_name });
      const { status, session_id } = res.data;
      setSessionStatus(status);
      if (session_id) localStorage.setItem('sf_session_id', session_id);
    } catch (e) {
      if (isAuthError(e)) setSessionExpired(true);
    }
  }, []);

  const reactivate = useCallback(async () => {
    try {
      const device_id = getOrCreateDeviceId();
      const device_name = getDeviceInfo();
      const res = await base44.functions.invoke('manageSession', { device_id, device_name });
      const { status, session_id } = res.data;
      setSessionStatus(status);
      if (session_id) localStorage.setItem('sf_session_id', session_id);
    } catch (e) {
      if (isAuthError(e)) setSessionExpired(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Inicializar sesión al cargar
    initSession();

    // Heartbeat cada 5 minutos
    const interval = setInterval(async () => {
      try {
        const session_id = localStorage.getItem('sf_session_id');
        if (!session_id) return;
        const res = await base44.functions.invoke('sessionHeartbeat', { session_id });
        setSessionStatus(res.data.status);
      } catch (e) {
        if (isAuthError(e)) setSessionExpired(true);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled, initSession]);

  return { sessionStatus, reactivate, sessionExpired };
}