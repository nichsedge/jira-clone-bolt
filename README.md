# Ticket Management System

A comprehensive ticket management system with email integration, built with React, TypeScript, and Supabase.

## Features

- **Ticket Management**: Create, update, and delete support tickets
- **Email Sync Integration**: Automatically create tickets from unread emails with [TICKET] in subject
- **Status-Based Email Replies**: Automatically send email notifications when tickets are marked as DONE
- **Audit Trail**: Track all ticket changes with detailed history
- **Filtering & Search**: Filter tickets by status, priority, and other criteria
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Architecture

The system is built with a modular architecture for easy expansion:

- **Frontend**: React with TypeScript and Tailwind CSS
- **Backend**: Supabase with PostgreSQL database
- **Email Integration**: Supabase Edge Functions for secure email operations
- **State Management**: React hooks with proper separation of concerns

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Supabase project

### Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Set up Supabase**:
   - Click the "Connect to Supabase" button in the top right
   - Or manually create a `.env` file based on `.env.example`

3. **Configure Email Integration**:
   - Update the email provider functions in `supabase/functions/`
   - Add your email service credentials to environment variables
   - Deploy edge functions to Supabase (happens automatically)

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## Email Integration

### Email Sync

The system can sync with your email provider to automatically create tickets:

1. **Manual Trigger**: Click "Sync with Email" to fetch unread emails
2. **Email Filtering**: Only emails with `[TICKET]` in the subject line are processed
3. **Automatic Ticket Creation**: Each matching email becomes a new ticket
4. **Duplicate Prevention**: Email message IDs prevent duplicate tickets

### Email Notifications

When a ticket status changes to "DONE":

1. **Automatic Email**: System sends a completion notification
2. **Custom Templates**: Email includes ticket details and completion time
3. **Error Handling**: Failed notifications don't block ticket updates

## Database Schema

### Tables

- **tickets**: Main ticket data with status, priority, and email information
- **ticket_history**: Audit trail for all ticket changes
- **email_sync_logs**: Track email sync operations and results

### Key Features

- **Row Level Security**: All tables have proper RLS policies
- **Audit Triggers**: Automatic logging of ticket changes
- **Indexing**: Optimized queries for filtering and sorting
- **Constraints**: Data validation at the database level

## API Integration

### Services

- **TicketService**: Handles all ticket CRUD operations
- **Email Functions**: Secure edge functions for email operations
- **Type Safety**: Full TypeScript coverage with proper interfaces

### Edge Functions

Located in `supabase/functions/`:

- **email-sync**: Fetches unread emails and creates tickets
- **send-email-notification**: Sends completion notifications

## Customization

### Adding Email Providers

1. Update `fetchUnreadTicketEmails()` in `email-sync/index.ts`
2. Add provider-specific authentication
3. Implement `markEmailAsRead()` function
4. Update environment variables

### Custom Workflows

1. Modify ticket statuses in the database schema
2. Update TypeScript types in `src/types/ticket.ts`
3. Customize notification triggers in `TicketService`
4. Add new filtering options in the UI

### Styling

- Built with Tailwind CSS for easy customization
- Consistent design system with proper color schemes
- Responsive breakpoints for all screen sizes
- Apple-inspired design aesthetics

## Development Guidelines

### Code Organization

- **Modular Components**: Each component has a single responsibility
- **Service Layer**: Business logic separated from UI components
- **Type Safety**: Comprehensive TypeScript coverage
- **Error Handling**: Proper error boundaries and user feedback

### Best Practices

- **File Organization**: Under 200 lines per file
- **Import/Export**: Proper module boundaries
- **Environment Variables**: Secure credential management
- **Database Migrations**: Version-controlled schema changes

## Deployment

The system is ready for production deployment:

1. **Frontend**: Deploy to Vercel, Netlify, or similar
2. **Database**: Supabase handles hosting and backups
3. **Edge Functions**: Automatically deployed with Supabase
4. **Environment**: Set production environment variables

## Support

For questions or issues:

1. Check the database logs in Supabase dashboard
2. Review edge function logs for email integration issues
3. Ensure environment variables are properly configured
4. Verify RLS policies for data access issues

## License

This project is built for demonstration and educational purposes.


## Test

### send-email-notification
supabase functions serve --no-verify-jwt --env-file .env.local

curl -X POST 'http://localhost:54321/functions/v1/send-email-notification' \
-H 'Content-Type: application/json' \
-d '{ "ticketId": "a6fd9fb6-2a65-4a51-90a7-373f861f5d81" }'

curl -X POST http://localhost:54321/functions/v1/smtp-sender \
  -H "Content-Type: application/json"


### sync email

curl http://localhost:54321/functions/v1/imap-reader

curl -X POST http://localhost:54321/functions/v1/email-sync \
  -H "Content-Type: application/json"