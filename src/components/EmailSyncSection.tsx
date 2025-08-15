import React, { useState, useEffect } from 'react';
import { RefreshCw, Mail, History } from 'lucide-react';
import type { EmailSyncLog } from '../types/ticket';
import { TicketService } from '../services/ticketService';
import { useNotification } from '../hooks/useNotification';
import { EmailSyncHistoryModal } from './EmailSyncHistoryModal';

export interface EmailSyncSectionProps {
  onTicketRefresh?: () => void;
}

export const EmailSyncSection: React.FC<EmailSyncSectionProps> = ({ onTicketRefresh }) => {
  const [syncing, setSyncing] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const { showSuccess, showError, showLoading, removeNotification } = useNotification();

  const handleEmailSync = async () => {
    setSyncing(true);
    let loadingNotificationId: string | null = null;
    
    try {
      loadingNotificationId = showLoading('Syncing Email', 'Fetching new emails from your inbox...', 0);
      
      await TicketService.triggerEmailSync();
      
      // Remove loading notification
      if (loadingNotificationId) {
        removeNotification(loadingNotificationId);
      }
      
      // Refresh logs after a short delay to allow the sync to start
      setTimeout(() => {
        // Call the ticket refresh callback if provided
        if (onTicketRefresh) {
          onTicketRefresh();
        }
        
      }, 2000);
      
      showSuccess(
        'Email Sync Completed',
        'New emails have been synced and tickets created successfully.'
      );
    } catch (error) {
      console.error('Email sync failed:', error);
      
      // Remove loading notification on error
      if (loadingNotificationId) {
        removeNotification(loadingNotificationId);
      }
      
      showError(
        'Email Sync Failed',
        'Failed to sync emails. Please check your email configuration and try again.'
      );
      setSyncing(false);
    }
    setSyncing(false);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Mail className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Email Sync</h2>
            <p className="text-sm text-gray-500 mt-1">
              Sync unread emails with [TICKET] in subject line
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <History className="w-4 h-4 mr-2" />
            View History
          </button>
          <button
            onClick={handleEmailSync}
            disabled={syncing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync with Email'}
          </button>
        </div>
      </div>

        <div className="text-center py-8 text-gray-500">
          <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">Email Sync Ready</p>
          <p className="text-sm">Click "Sync with Email" to fetch unread emails with [TICKET] in subject</p>
          <p className="text-xs text-gray-400 mt-2">View sync history to see past operations</p>
        </div>
      </div>

      <EmailSyncHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
    </>
  );
};