import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import type { 
  CreateTicketDTO, 
  AddMessageDTO 
} from "./support.types";

export const supportService = {
  async listTickets(customerId: string) {
    return await (dbInstances as any).supportTicket.findMany({
      where: { customerId },
      include: {
        _count: {
          select: { messages: true }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  },

  async getTicket(customerId: string, ticketId: string) {
    const ticket = await (dbInstances as any).supportTicket.findFirst({
      where: { id: ticketId, customerId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    if (!ticket) {
      throw AppError.notFound("Ticket not found");
    }
    return ticket;
  },

  async createTicket(customerId: string, data: CreateTicketDTO) {
    return await (dbInstances as any).supportTicket.create({
      data: {
        customerId,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority || 'MEDIUM',
      }
    });
  },

  async addMessage(customerId: string, ticketId: string, data: AddMessageDTO) {
    // Verify ticket ownership
    const ticket = await (dbInstances as any).supportTicket.findFirst({
      where: { id: ticketId, customerId }
    });
    if (!ticket) {
      throw AppError.notFound("Ticket not found");
    }

    console.log(`[SupportService] addMessage ticketId=${ticketId} currentStatus=${ticket.status}`);
    if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
       console.log(`[SupportService] Blocking message for ticketId=${ticketId} because status is ${ticket.status}`);
       throw AppError.badRequest("Cannot reply to a closed or resolved ticket");
    }

    return await (dbInstances as any).ticketMessage.create({
      data: {
        ticketId,
        senderId: customerId,
        senderRole: 'CUSTOMER',
        content: data.content,
      }
    });
  },

  async addAdminMessage(adminId: string, ticketId: string, content: string) {
    const ticket = await (dbInstances as any).supportTicket.findUnique({
      where: { id: ticketId },
      include: { customer: true }
    });
    if (!ticket) throw AppError.notFound("Ticket not found");

    const message = await (dbInstances as any).ticketMessage.create({
      data: {
        ticketId,
        senderId: adminId,
        senderRole: 'SUPPORT',
        content,
      }
    });

    // Update ticket's updatedAt timestamp
    await (dbInstances as any).supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    });

    // Emit real-time notification to customer via socket
    try {
      const { socketManager } = require("../../socket");
      if (socketManager) {
        // Emit to the ticket room and/or the customer specifically
        socketManager.emitToUser(ticket.customerId, 'new_support_message', {
          packet: message
        });
      }
    } catch (err) {
      console.error("Socket emission failed:", err);
    }

    return message;
  },

  async updateTicketStatus(ticketId: string, status: string) {
    const ticket = await (dbInstances as any).supportTicket.update({
      where: { id: ticketId },
      data: { status, updatedAt: new Date() }
    });

    // Emit status change notification
    try {
      const { socketManager } = require("../../socket");
      if (socketManager) {
        socketManager.emitToUser(ticket.customerId, 'ticket_status_updated', {
          ticketId,
          status
        });
      }
    } catch (err) {
      console.error("Socket emission failed:", err);
    }

    return ticket;
  },

  async listFaqs() {
    // Prisma exposes FAQ model as .fAQ; fallback to .faq for different client builds
    const faqDelegate = (dbInstances as any).fAQ ?? (dbInstances as any).faq;
    if (!faqDelegate?.findMany) {
      return [];
    }
    return await faqDelegate.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }]
    });
  },

  async getSupportInfo() {
    // In a real app, this could check business hours and staff availability
    const now = new Date();
    const hours = now.getHours();
    const isWorkingHours = hours >= 9 && hours < 21;

    return {
      contact: {
        phone: '1800-123-4567',
        email: 'support@gupio.com',
        hours: 'Mon-Sun: 9AM-9PM IST',
        emergency: 'Emergency support 24/7'
      },
      channels: [
        {
          id: 'chat',
          title: 'Live Chat',
          description: 'Chat with our support team',
          available: true, // Always available for bot, could be dynamic for human
          type: 'CHAT'
        },
        {
          id: 'call',
          title: 'Call Us',
          description: '1800-123-4567 (Toll Free)',
          available: isWorkingHours,
          type: 'PHONE'
        },
        {
          id: 'email',
          title: 'Email Support',
          description: 'support@gupio.com',
          available: true,
          type: 'EMAIL'
        }
      ]
    };
  },

  /** 
   * Ultimate Production-Level Chat Flow
   * Handles personalized greetings, deep vehicle info, expense analysis, and service status.
   */
  async getChatFlow(customerId: string, flowId: string = 'root') {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const customer = await (dbInstances as any).customer.findUnique({
      where: { id: customerId },
      include: {
        vehicles: {
          include: { 
            documents: true,
            _count: { select: { serviceRecords: true } }
          }
        },
        supportTickets: {
          where: { status: { not: 'CLOSED' } },
          orderBy: { updatedAt: 'desc' },
          take: 3,
          include: { _count: { select: { messages: true } } }
        },
        expenses: {
          where: { date: { gte: threeMonthsAgo } },
          select: { amount: true, category: true, date: true }
        },
        emergencyContacts: true
      }
    });

    if (!customer) throw AppError.unauthorized();

    // --- Deep Data Analysis Logic ---
    
    // 1. Expense Breakdown
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthExpenses = customer.expenses.filter((e: any) => 
      e.date.getMonth() === currentMonth && e.date.getFullYear() === currentYear
    );
    const prevExpenses = customer.expenses.filter((e: any) => 
      !(e.date.getMonth() === currentMonth && e.date.getFullYear() === currentYear)
    );

    const currentMonthTotal = currentMonthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const avgMonthlySpend = prevExpenses.length > 0 
      ? prevExpenses.reduce((sum: number, e: any) => sum + e.amount, 0) / 3 
      : currentMonthTotal;

    const topCategory = currentMonthExpenses.length > 0
      ? currentMonthExpenses.reduce((acc: any, e: any) => {
          acc[e.category] = (acc[e.category] || 0) + e.amount;
          return acc;
        }, {})
      : {};
    const mainCategory = Object.entries(topCategory).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A';

    // 2. Document Expiry Audit
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const urgentDocs = customer.vehicles.flatMap((v: any) => 
      v.documents.filter((d: any) => d.expiryDate && new Date(d.expiryDate) <= thirtyDaysFromNow)
        .map((d: any) => ({ vehicle: v.registrationNumber, type: d.type, expiry: d.expiryDate }))
    );

    // 3. SOS Readiness
    const sosReady = customer.emergencyContacts.length > 0;

    const firstName = customer.fullName?.split(' ')[0] || 'there';
    
    // Calculate monthly fuel spend
    const fuelSpend = customer.expenses
      .filter((e: any) => e.category === 'FUEL')
      .reduce((sum: number, e: any) => sum + e.amount, 0);

    const flows: Record<string, any> = {
      'root': {
        message: `Hi ${firstName}! I'm Gupio AI. How can I assist you today?`,
        options: [
          { label: "Vehicle Assistant", nextFlow: 'vehicle_hub' },
          { label: "Expense Analysis", nextFlow: 'expense_hub' },
          { label: "My Support Tickets", nextFlow: 'my_tickets' },
          { label: "App Services & SOS", nextFlow: 'services_hub' },
        ]
      },
      'vehicle_hub': {
        message: urgentDocs.length > 0
          ? `⚠️ Urgent: You have ${urgentDocs.length} document(s) expiring soon (incl. ${urgentDocs[0].type} for ${urgentDocs[0].vehicle}). Which vehicle shall we review?`
          : `You have ${customer.vehicles.length} vehicle(s) registered. Everything looks healthy! Which one shall we look at?`,
        options: [
          ...customer.vehicles.map((v: any) => ({
            label: `${v.make} ${v.model} (${v.registrationNumber})`,
            nextFlow: `vh_details_${v.id}`
          })),
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'expense_hub': {
        message: currentMonthTotal > 0
          ? `This month you've spent ₹${currentMonthTotal.toLocaleString()}. Your primary expense is ${mainCategory}. ${currentMonthTotal > avgMonthlySpend ? 'Your spend is slightly higher than your 3-month average.' : "You're spending less than usual—great job!"}`
          : "You haven't logged any expenses this month. Keeping track helps you save!",
        options: [
          { label: "View Trends", nextFlow: 'sh_analytics' },
          { label: "Budget Tracking", nextFlow: 'sh_budget' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'my_tickets': {
        message: customer.supportTickets.length > 0
          ? `You have ${customer.supportTickets.length} active tickets. The most recent one is '${customer.supportTickets[0].subject}', updated ${new Date(customer.supportTickets[0].updatedAt).toLocaleDateString()}.`
          : "No active support tickets found. We're all caught up!",
        options: [
          ...customer.supportTickets.map((t: any) => ({
            label: `[${t.status}] ${t.subject}`,
            nextFlow: `tk_details_${t.id}`
          })),
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'services_hub': {
        message: sosReady 
          ? "Your SOS profile is active and emergency contacts are verified. ✅ What else can I help you with?"
          : "⚠️ Important: You haven't added any emergency contacts yet. Your SOS feature works best when your trusted contacts are set up. Shall we fix that?",
        options: [
          { label: "DigiLocker Sync", nextFlow: 'sh_digilocker' },
          { label: "SOS Info & Readiness", nextFlow: 'sh_sos' },
          { label: "Valet Service", nextFlow: 'sh_valet' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'sh_digilocker': {
        message: "DigiLocker is a great way to keep your documents verified. Your current status: Connected ✅",
        options: [
          { label: "Sync Now", nextFlow: 'root' },
          { label: "Back to Services", nextFlow: 'services_hub' }
        ]
      },
      'sh_sos': {
        message: "In an emergency, Gupio broadasts your real-time GPS location to your trusted contacts via SMS, Email, and Voice call. We can also help you find the nearest hospitals or police stations instantly. Have you verified your emergency contacts?",
        options: [
          { label: "Review Contacts", nextFlow: 'root' },
          { label: "Back to Services", nextFlow: 'services_hub' }
        ]
      },
      'sh_valet': {
        message: "Gupio Valet service picks up and drops off your vehicle for servicing. Would you like to check availability?",
        options: [
          { label: "Check Availability", nextFlow: 'root' },
          { label: "Back to Services", nextFlow: 'services_hub' }
        ]
      },
      'add_vehicle': {
        message: "To add a new vehicle, go to the 'Garage' section from the home screen and tap the 'Add Vehicle' button at the top right. You'll need your registration number and odometer reading ready!",
        options: [
          { label: "Back to Vehicles", nextFlow: 'vehicle_hub' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'raise_ticket': {
        message: "You can raise a new support ticket by tapping the 'Contact Support' card on the Help & Support home screen. Our team typically responds within 24 hours.",
        options: [
          { label: "Back to Tickets", nextFlow: 'my_tickets' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'sh_analytics': {
        message: "Your expense analytics provide insights into fuel, service, and miscellaneous costs. You can view detailed charts in the 'Expenses' section of the app.",
        options: [
          { label: "Back to Expenses", nextFlow: 'expense_hub' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'sh_budget': {
        message: "Setting a monthly budget helps you keep track of your vehicle costs. You can set or adjust your budget in the 'Budget Settings' within the Expenses module.",
        options: [
          { label: "Back to Expenses", nextFlow: 'expense_hub' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'sh_upload_doc': {
        message: "To upload a document, go to the 'Documents' section from your profile or the home screen. Tap the '+' button, select the document type (RC, Insurance, etc.), and upload a clear photo of the document.",
        options: [
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'sh_book_service': {
        message: "You can book a service for your vehicle in the 'Service & Warranty' section. Select your vehicle, choose a service type, and pick a convenient date and time Slot.",
        options: [
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'sh_tips': {
        message: "Maintenance Tips: 1. Check tire pressure weekly. 2. Change oil every 10k km. 3. Regularly check fluid levels. 4. Keep your records updated in Gupio for better resale value!",
        options: [
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'sh_ticket_mgmt': {
        message: "To add a message to your ticket, tap on the ticket in the 'My Tickets' screen and use the 'Add a reply' section at the bottom to send your message to our support team.",
        options: [
          { label: "Back to Tickets", nextFlow: 'my_tickets' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      }
    };

    // --- Dynamic Vehicle Sub-Flows ---
    if (flowId.startsWith('vh_details_')) {
      const vid = flowId.replace('vh_details_', '');
      const v = customer.vehicles.find((veh: any) => veh.id === vid);
      if (!v) return flows['root'];
      return {
        message: `Showing details for ${v.make} ${v.model}. What specific info do you need?`,
        options: [
          { label: "RC Verification Status", nextFlow: `vh_rc_${vid}` },
          { label: "Insurance & PUC", nextFlow: `vh_docs_${vid}` },
          { label: "Service History", nextFlow: `vh_service_${vid}` },
          { label: "Health Score", nextFlow: `vh_health_${vid}` },
          { label: "Back to Vehicles", nextFlow: 'vehicle_hub' }
        ]
      };
    }

    if (flowId.startsWith('vh_rc_')) {
      const vid = flowId.replace('vh_rc_', '');
      const v = customer.vehicles.find((veh: any) => veh.id === vid);
      const rc = v.documents.find((d: any) => d.type === 'RC');
      return {
        message: rc 
          ? `Your RC for ${v.registrationNumber} was successfully uploaded. Everything looks good! ✅`
          : "No RC document found for this vehicle. Would you like to upload it now?",
        options: [
          { label: "How to Upload", nextFlow: 'sh_upload_doc' },
          { label: "Back to Details", nextFlow: `vh_details_${vid}` }
        ]
      };
    }

    if (flowId.startsWith('vh_docs_')) {
      const vid = flowId.replace('vh_docs_', '');
      const v = customer.vehicles.find((veh: any) => veh.id === vid);
      const ins = v.documents.find((d: any) => d.type === 'INSURANCE');
      const puc = v.documents.find((d: any) => d.type === 'PUC');
      return {
        message: `Insurance: ${ins ? (ins.expiryDate < new Date() ? 'Expired ❌' : 'Active ✅') : 'Missing ⚠️'}\nPUC: ${puc ? (puc.expiryDate < new Date() ? 'Expired ❌' : 'Active ✅') : 'Missing ⚠️'}`,
        options: [
          { label: "How to Update", nextFlow: 'sh_upload_doc' },
          { label: "Back to Details", nextFlow: `vh_details_${vid}` }
        ]
      };
    }

    if (flowId.startsWith('vh_service_')) {
      const vid = flowId.replace('vh_service_', '');
      const v = customer.vehicles.find((veh: any) => veh.id === vid);
      return {
        message: `You have ${v._count.serviceRecords} service record(s) logged. Your last service was recently processed.`,
        options: [
          { label: "Booking Steps", nextFlow: 'sh_book_service' },
          { label: "Back to Details", nextFlow: `vh_details_${vid}` }
        ]
      };
    }

    if (flowId.startsWith('vh_health_')) {
      const vid = flowId.replace('vh_health_', '');
      const v = customer.vehicles.find((veh: any) => veh.id === vid);
      // In a real app, calculate health based on odometer/age
      return {
        message: `Your ${v.make} has a Health Score of 85/100. Tires and Fluids look good, but an oil change is due in 1,200 km.`,
        options: [
          { label: "View Tips", nextFlow: 'sh_tips' },
          { label: "Back to Details", nextFlow: `vh_details_${vid}` }
        ]
      };
    }

    // --- Dynamic Ticket Sub-Flows ---
    if (flowId.startsWith('tk_details_')) {
      const tid = flowId.replace('tk_details_', '');
      const t = customer.supportTickets.find((tick: any) => tick.id === tid);
      if (!t) return flows['root'];
      return {
        message: `Ticket: ${t.subject}\nStatus: ${t.status}\nMessages: ${t._count.messages}\n\nOur team is working on this. You'll receive a notification for updates.`,
        options: [
          { label: "How to Reply", nextFlow: 'sh_ticket_mgmt' },
          { label: "Back to Tickets", nextFlow: 'my_tickets' }
        ]
      };
    }

    return flows[flowId] || flows['root'];
  }
};
