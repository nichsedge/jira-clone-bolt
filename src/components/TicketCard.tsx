import React from 'react';
import { format } from 'date-fns';
import { Mail, Calendar, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { Ticket } from '../types/ticket';

interface TicketCardProps {
  ticket: Ticket;
  onClick: () => void;
}

const statusConfig = {
  OPEN: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
  IN_PROGRESS: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  DONE: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  CANCELLED: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

const priorityConfig = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  URGENT: 'bg-red-100 text-red-600',
};

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onClick }) => {
  const statusInfo = statusConfig[ticket.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {ticket.title}
          </h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {ticket.description || 'No description provided'}
          </p>
        </div>
        <div className="ml-4 flex flex-col items-end space-y-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {ticket.status.replace('_', ' ')}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityConfig[ticket.priority]}`}>
            {ticket.priority}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Mail className="w-4 h-4 mr-1" />
            <span className="truncate max-w-48">{ticket.email}</span>
          </div>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            <span>{format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};