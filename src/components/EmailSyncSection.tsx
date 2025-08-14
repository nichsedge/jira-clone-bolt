import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { RefreshCw, Mail, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { EmailSyncLog } from '../types/ticket';
import { TicketService } from '../services/ticketService';
import { useNotification } from '../hooks/useNotification';

export interface EmailSyncSectionProps {
  onTicketRefresh?: () => void;
}

export const EmailSyncSection: React.FC<EmailSyncSectionProps> = ({ onTicketRefresh }) => {
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<EmailSyncLog[]>([]);
  const { showSuccess, showError, showLoading } = useNotification();

  useEffect(() => {
    loadSyncLogs();
  }, []);

  const loadSyncLogs = async () => {
    try {
      const syncLogs = await TicketService.getEmailSyncLogs();
      setLogs(syncLogs);
    } catch (error) {
      console.error('Failed to load sync logs:', error);
    }
  };

  const handleEmailSync = async () => {
    setSyncing(true);
    try {
      showLoading('Syncing Email', 'Fetching new emails from your inbox...', 0);
      
      await TicketService.triggerEmailSync();
      // Refresh logs after a short delay to allow the sync to start
      setTimeout(() => {
        loadSyncLogs();
        // Call the ticket refresh callback if provided
        if (onTicketRefresh) {
          onTicketRefresh();
        }
        setSyncing(false);
        
        showSuccess(
          'Email Sync Completed',
          'New emails have been synced and tickets created successfully.'
        );
      }, 2000);
    } catch (error) {
      console.error('Email sync failed:', error);
      showError(
        'Email Sync Failed',
        'Failed to sync emails. Please check your email configuration and try again.'
      );
      setSyncing(false);
    }
  };

  const getStatusIcon = (status: EmailSyncLog['status']) => {
    switch (status) {
      case 'RUNNING':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
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
        <button
          onClick={handleEmailSync}
          disabled={syncing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync with Email'}
        </button>
      </div>

      {logs.length > 0 && (
        <div>
          <h3 className="text-md font-medium text-gray-900 mb-4">Recent Sync History</h3>
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(log.status)}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {log.status === 'RUNNING' ? 'Sync in progress...' :
                       log.status === 'COMPLETED' ? 'Sync completed' :
                       'Sync failed'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(log.sync_started_at), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <div className="text-center">
                    <div className="font-medium">{log.emails_processed}</div>
                    <div className="text-xs">Emails</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{log.tickets_created}</div>
                    <div className="text-xs">Tickets</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p>No email sync history yet</p>
          <p className="text-sm">Click "Sync with Email" to start</p>
        </div>
      )}
    </div>
  );
};