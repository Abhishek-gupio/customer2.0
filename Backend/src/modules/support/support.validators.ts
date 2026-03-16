import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(5).max(100),
  description: z.string().min(1).max(5000), // Increased max to match frontend
  category: z.enum(['VEHICLE', 'DOCUMENTS', 'VALET', 'AI_ASSISTANT', 'BILLING', 'ACCOUNT', 'TECHNICAL', 'OTHER', 'GENERAL', 'APP_ISSUE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export const addMessageSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const getTicketSchema = z.object({
  ticketId: z.string().min(1),
});
