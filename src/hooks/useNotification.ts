import { useCallback } from 'react';
import { useNotification as useNotificationContext } from '../components/NotificationManager';

export const useNotification = () => {
  const { showNotification, removeNotification } = useNotificationContext();
  
  const showSuccess = useCallback((title: string, message: string, duration?: number) => {
    return showNotification({ title, message, type: 'success', duration });
  }, [showNotification]);

  const showError = useCallback((title: string, message: string, duration?: number) => {
    return showNotification({ title, message, type: 'error', duration });
  }, [showNotification]);

  const showLoading = useCallback((title: string, message: string, duration?: number) => {
    return showNotification({ title, message, type: 'loading', duration });
  }, [showNotification]);

  return {
    showNotification,
    removeNotification,
    showSuccess,
    showError,
    showLoading,
  };
};