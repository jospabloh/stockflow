import { useEffect, useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// Tiempo de inactividad antes de mostrar advertencia (20 minutos)
const IDLE_WARNING_MS = 20 * 60 * 1000;
// Tiempo adicional antes de cerrar sesión desde la advertencia (2 minutos)
const IDLE_LOGOUT_MS = 2 * 60 * 1000;
// Heartbeat mientras el usuario está activo (cada 4 minutos)
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;

// Eventos que indican que el usuario está activo
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];

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
  const [sessionStatus, setSessionStatus] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // 'idle_warning' = mostrar aviso de inactividad, null = normal
  const [idleState, setIdleState] = useState(null);

  const lastActivityRef = useRef(Date.now());
  const idleWarningTimerRef = useRef(null);
  const idleLogoutTimerRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  const isAuthError = (e) => {
    // Only treat TRUE auth failures as session expiry.
    // 403 must NOT be treated as auth expiry — our own backend functions return 403
    // for business-logic reasons (cross-tenant protection, admin-only access, etc.).
    // Only 401 Unauthorized means "token expired / not logged in".
    const msg = e?.message || e?.response?.data?.message || '';
    const status = e?.status || e?.response?.status;
    return msg.includes('auth_required') || status === 401;
  };

  const callSession = useCallback(async () => {
    const device_id = getOrCreateDeviceId();
    const device_name = getDeviceInfo();
    const res = await base44.functions.invoke('manageSession', { device_id, device_name });
    const { status, session_id } = res.data;
    setSessionStatus(status);
    if (session_id) localStorage.setItem('sf_session_id', session_id);
    return status;
  }, []);

  // Inicializar sesión (llamada al montar)
  const initSession = useCallback(async () => {
    try {
      await callSession();
    } catch (e) {
      if (isAuthError(e)) setSessionExpired(true);
    }
  }, [callSession]);

  // Reactivar desde banner de sesión pasiva
  const reactivate = useCallback(async () => {
    try {
      await callSession();
      setIdleState(null);
    } catch (e) {
      if (isAuthError(e)) setSessionExpired(true);
    }
  }, [callSession]);

  // Cuando el usuario hace click en "Seguir trabajando" en el aviso idle
  const continueSession = useCallback(async () => {
    setIdleState(null);
    clearTimeout(idleLogoutTimerRef.current);
    lastActivityRef.current = Date.now();
    // Renovar heartbeat inmediatamente
    try {
      await callSession();
    } catch (e) {
      if (isAuthError(e)) setSessionExpired(true);
    }
  }, [callSession]);

  // Reiniciar los timers de idle cuando hay actividad
  const resetIdleTimers = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Si ya estábamos en warning, cancelar el logout automático
    if (idleState === 'idle_warning') {
      setIdleState(null);
      clearTimeout(idleLogoutTimerRef.current);
    }

    clearTimeout(idleWarningTimerRef.current);
    clearTimeout(idleLogoutTimerRef.current);

    // Programar el aviso de inactividad
    idleWarningTimerRef.current = setTimeout(() => {
      setIdleState('idle_warning');
      // Si ignora el aviso, cerrar sesión tras IDLE_LOGOUT_MS
      idleLogoutTimerRef.current = setTimeout(() => {
        setSessionExpired(true);
        setIdleState(null);
      }, IDLE_LOGOUT_MS);
    }, IDLE_WARNING_MS);
  }, [idleState]);

  useEffect(() => {
    if (!enabled) return;

    initSession();

    // Escuchar actividad del usuario
    const handleActivity = () => resetIdleTimers();
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));

    // Arrancar timers de idle
    resetIdleTimers();

    // Heartbeat periódico — SOLO si el usuario estuvo activo recientemente
    heartbeatIntervalRef.current = setInterval(async () => {
      const idleSince = Date.now() - lastActivityRef.current;
      // Si lleva más tiempo inactivo que IDLE_WARNING_MS, no hacer heartbeat (ya está en warning o logout)
      if (idleSince >= IDLE_WARNING_MS) return;

      try {
        const session_id = localStorage.getItem('sf_session_id');
        if (!session_id) return;
        const res = await base44.functions.invoke('sessionHeartbeat', { session_id });
        setSessionStatus(res.data.status);
      } catch (e) {
        if (isAuthError(e)) setSessionExpired(true);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearTimeout(idleWarningTimerRef.current);
      clearTimeout(idleLogoutTimerRef.current);
      clearInterval(heartbeatIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { sessionStatus, reactivate, sessionExpired, idleState, continueSession };
}