import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Activity, CheckCircle, XCircle, Clock, History } from 'lucide-react';
import type { EmailSyncLog } from '../types/ticket';
import { TicketService } from '../services/ticketService';

interface EmailSyncHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailSyncHistoryModal: React.FC<EmailSyncHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<EmailSyncLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSyncLogs();
    }
  }, [isOpen]);

  const loadSyncLogs = async () => {
    setLoading(true);
    try {
      const syncLogs = await TicketService.getEmailSyncLogs();
      setLogs(syncLogs);
    } catch (error) {
      console.error('Failed to load sync logs:', error);
    } finally {
      setLoading(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <History className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Email Sync History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading sync history...</p>
            </div>
          ) : logs.length > 0 ? (
            <div className="space-y-4">
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
                        Started: {format(new Date(log.sync_started_at), 'MMM d, yyyy HH:mm')}
                      </div>
                      {log.sync_completed_at && (
                        <div className="text-xs text-gray-500">
                          Completed: {format(new Date(log.sync_completed_at), 'MMM d, yyyy HH:mm')}
                        </div>
                      )}
                      {log.error_message && (
                        <div className="text-xs text-red-600 mt-1">
                          Error: {log.error_message}
                        </div>
                      )}
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
          ) : (
            <div className="text-center py-12 text-gray-500">
              <History className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sync history</h3>
              <p>Email sync history will appear here after you run your first sync.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};