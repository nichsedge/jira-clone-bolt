import React, { useState, useEffect } from 'react';
import { Ticket, Plus, Filter, TicketIcon } from 'lucide-react';
import { TicketCard } from './components/TicketCard';
import { TicketModal } from './components/TicketModal';
import { CreateTicketModal } from './components/CreateTicketModal';
import { EmailSyncSection } from './components/EmailSyncSection';
import { TicketService } from './services/ticketService';
import type { Ticket as TicketType } from './types/ticket';

function App() {
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '' as TicketType['status'] | '',
    priority: '' as TicketType['priority'] | '',
  });

  useEffect(() => {
    loadTickets();
  }, [filters]);

  const loadTickets = async () => {
    try {
      const ticketData = await TicketService.getTickets({
        status: filters.status || undefined,
        priority: filters.priority || undefined,
      });
      setTickets(ticketData);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      // Show user-friendly error message
      if (error instanceof Error && error.message.includes('Supabase not configured')) {
        console.warn('Supabase is not configured. Please click "Connect to Supabase" to set up your database connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTicketUpdate = (updatedTicket: TicketType) => {
    setTickets(prev => 
      prev.map(ticket => 
        ticket.id === updatedTicket.id ? updatedTicket : ticket
      )
    );
    setSelectedTicket(updatedTicket);
  };

  const handleTicketDelete = (ticketId: string) => {
    setTickets(prev => prev.filter(ticket => ticket.id !== ticketId));
    setSelectedTicket(null);
  };

  const getStatusCounts = () => {
    const counts = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'OPEN').length,
      inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
      done: tickets.filter(t => t.status === 'DONE').length,
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tickets...</p>
        </div>
      </div>
    );
  }

  // Check if Supabase is configured
  const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TicketIcon className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Supabase Not Connected</h2>
          <p className="text-gray-600 mb-6">
            Please click the "Connect to Supabase" button in the top right corner to set up your database connection.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
            <p className="text-sm text-yellow-800">
              <strong>Missing:</strong> VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TicketIcon className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Ticket Management</h1>
                <p className="text-sm text-gray-500 mt-1">Manage support tickets with email integration</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <Ticket className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Total Tickets</p>
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Open</p>
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.open}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <div className="w-4 h-4 bg-yellow-600 rounded-full"></div>
              </div>
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.inProgress}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <div className="w-4 h-4 bg-green-600 rounded-full"></div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Done</p>
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.done}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Email Sync Section */}
        <div className="mb-8">
          <EmailSyncSection onTicketRefresh={loadTickets} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as TicketType['status'] | '' })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value as TicketType['priority'] | '' })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Tickets ({tickets.length})
          </h3>
          
          {tickets.length > 0 ? (
            <div className="grid gap-4">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => setSelectedTicket(ticket)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h4>
              <p className="text-gray-500 mb-6">
                {filters.status || filters.priority ? 
                  'Try adjusting your filters or create a new ticket to get started.' :
                  'Create your first ticket or sync with email to get started.'
                }
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Ticket
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdate}
          onDelete={handleTicketDelete}
        />
      )}

      <CreateTicketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTicketCreated={loadTickets}
      />
    </div>
  );
}

export default App;