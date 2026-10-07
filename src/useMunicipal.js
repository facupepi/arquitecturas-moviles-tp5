import { useState, useEffect, useCallback, useRef } from "react";
import { repository } from "./repository";
import { shouldAlert, showBrowserNotification } from "./notificationPolicy";
import { distanceKm } from "../server/domain.mjs";
export function useMunicipal() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [toast, setToast] = useState("");
  const seen = useRef(new Set()),
    loaded = useRef(false),
    lock = useRef(false),
    bootstrap = useRef(null),
    sequence = useRef(0),
    position = useRef(null);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      if (!bootstrap.current) {
        bootstrap.current = repository.bootstrap().catch((e) => {
          bootstrap.current = null;
          throw e;
        });
      }
      await bootstrap.current;
      const next = await repository.state();
      if (seq !== sequence.current) return;
      if (loaded.current)
        for (const n of next.notifications)
          if (
            !seen.current.has(n.id) &&
            shouldAlert(n, next.preferences, position.current)
          ) {
            setToast(n.title);
            if (next.preferences.desktop)
              showBrowserNotification(n).catch(() => setToast(n.title));
          }
      seen.current = new Set(next.notifications.map((n) => n.id));
      loaded.current = true;
      setData(next);
      setConnected(true);
      setError("");
    } catch (e) {
      if (seq === sequence.current) {
        setError(e.message);
        setConnected(false);
      }
    }
  }, []);
  useEffect(() => {
    refresh();
    const off = repository.subscribe(refresh, () => setConnected(false));
    const timer = setInterval(refresh, 30000);
    return () => {
      sequence.current++;
      off();
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const act = async (path, body, message) => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await repository.request(path, {
        ...body,
        requestId: body.requestId || crypto.randomUUID(),
      });
      await refresh();
      if (message) setToast(message);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return {
    data,
    error,
    busy,
    connected,
    toast,
    refresh,
    act,
    setError,
    setToast,
    setPosition: (value) => {
      position.current = value;
      if (data)
        repository
          .request("/alarms/nearby", {
            alarmIds: data.alarms
              .filter((a) => distanceKm(value, a) <= 1)
              .map((a) => a.id),
          })
          .catch((e) => setError(e.message));
    },
  };
}
