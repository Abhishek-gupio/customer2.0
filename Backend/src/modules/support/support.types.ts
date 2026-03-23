import { TicketStatus, TicketPriority, TicketCategory } from '../../../../prisma/generated/client';

export interface CreateTicketDTO {
  subject: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
}

export interface AddMessageDTO {
  content: string;
}

export interface SupportTicketResponse {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  createdAt: Date;
  updatedAt: Date;
  messages?: TicketMessageResponse[];
}

export interface TicketMessageResponse {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: 'CUSTOMER' | 'AGENT';
  content: string;
  createdAt: Date;
}

export interface FAQResponse {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
}
