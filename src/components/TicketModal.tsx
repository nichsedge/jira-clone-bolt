import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Mail, Calendar, History, Save, Trash2 } from 'lucide-react';
import type { Ticket, UpdateTicketData, TicketHistory } from '../types/ticket';
import { TicketService } from '../services/ticketService';
import { useNotification } from '../hooks/useNotification';

interface TicketModalProps {
  ticket: Ticket;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (ticket: Ticket) => void;
  onDelete: (ticketId: string) => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<UpdateTicketData>({});
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
      });
      loadHistory();
    }
  }, [ticket, isOpen]);

  const loadHistory = async () => {
    try {
      const historyData = await TicketService.getTicketHistory(ticket.id);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load ticket history:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updatedTicket = await TicketService.updateTicket(ticket.id, formData);
      onUpdate(updatedTicket);
      setEditMode(false);
      await loadHistory();
      
      if (formData.status === 'DONE') {
        showSuccess(
          'Ticket Updated',
          `Ticket "${updatedTicket.title}" has been marked as done and email notification is being sent.`
        );
      } else {
        showSuccess(
          'Ticket Updated',
          `Ticket "${updatedTicket.title}" has been updated successfully.`
        );
      }
    } catch (error) {
      console.error('Failed to update ticket:', error);
      showError(
        'Update Failed',
        'Failed to update ticket. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this ticket?')) {
      setLoading(true);
      try {
        await TicketService.deleteTicket(ticket.id);
        onDelete(ticket.id);
        onClose();
      } catch (error) {
        console.error('Failed to delete ticket:', error);
        alert('Failed to delete ticket. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Ticket Details</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Show History"
            >
              <History className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {editMode ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Ticket['status'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Ticket['priority'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {ticket.title}
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {ticket.description || 'No description provided'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <Mail className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium text-gray-700 mr-2">Email:</span>
                    <span className="text-gray-600">{ticket.email}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium text-gray-700 mr-2">Created:</span>
                    <span className="text-gray-600">
                      {format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700 mr-2">Status:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      ticket.status === 'OPEN' ? 'bg-blue-100 text-blue-800' :
                      ticket.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                      ticket.status === 'DONE' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700 mr-2">Priority:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      ticket.priority === 'LOW' ? 'bg-gray-100 text-gray-600' :
                      ticket.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-600' :
                      ticket.priority === 'HIGH' ? 'bg-orange-100 text-orange-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {ticket.priority}
                    </span>
                  </div>
                </div>
              </div>

              {showHistory && history.length > 0 && (
                <div className="border-t pt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Change History</h4>
                  <div className="space-y-3">
                    {history.map((change) => (
                      <div key={change.id} className="text-sm bg-gray-50 rounded-lg p-3">
                        <div className="font-medium text-gray-900">
                          {change.field_name.toUpperCase()} changed
                        </div>
                        <div className="text-gray-600">
                          From: <span className="font-mono">{change.old_value || 'empty'}</span> →{' '}
                          To: <span className="font-mono">{change.new_value || 'empty'}</span>
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          {format(new Date(change.created_at), 'MMM d, yyyy HH:mm')} by {change.changed_by}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>

          <div className="flex items-center space-x-3">
            {editMode ? (
              <>
                <button
                  onClick={() => setEditMode(false)}
                  disabled={loading}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Edit Ticket
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};