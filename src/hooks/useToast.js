'use client';
import { useState, useCallback } from 'react';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((type, title, message, duration = 6000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => remove(id), duration);
    return id;
  }, []);

  const remove = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    toasts,
    remove,
    success: (title, msg, dur) => add('success', title, msg, dur),
    error:   (title, msg, dur) => add('error',   title, msg, dur),
    info:    (title, msg, dur) => add('info',     title, msg, dur),
    warning: (title, msg, dur) => add('warning',  title, msg, dur),
  };
}
