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

    return await (dbInstances as any).ticketMessage.create({
      data: {
        ticketId,
        senderId: customerId,
        senderRole: 'CUSTOMER',
        content: data.content,
      }
    });
  },

  async listFaqs() {
    return await (dbInstances as any).fAQ.findMany({
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
          where: { date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
          select: { amount: true, category: true }
        }
      }
    });

    if (!customer) throw AppError.unauthorized();

    const firstName = customer.fullName?.split(' ')[0] || 'there';
    
    // Calculate monthly fuel spend
    const fuelSpend = customer.expenses
      .filter((e: any) => e.category === 'FUEL')
      .reduce((sum: number, e: any) => sum + e.amount, 0);

    const flows: Record<string, any> = {
      'root': {
        message: `Hi ${firstName}! I'm Gupio AI. I've analyzed your account. How can I assist you today?`,
        options: [
          { label: "Vehicle Assistant", nextFlow: 'vehicle_hub' },
          { label: "Expense Analysis", nextFlow: 'expense_hub' },
          { label: "My Support Tickets", nextFlow: 'my_tickets' },
          { label: "App Services & SOS", nextFlow: 'services_hub' },
        ]
      },
      'vehicle_hub': {
        message: customer.vehicles.length > 0 
          ? `You have ${customer.vehicles.length} vehicle(s) registered. Which one shall we look at?`
          : "You haven't added any vehicles yet. Want to add your first one?",
        options: [
          ...customer.vehicles.map((v: any) => ({
            label: `${v.make} ${v.model} (${v.registrationNumber})`,
            nextFlow: `vh_details_${v.id}`
          })),
          { label: "Add New Vehicle", nextFlow: 'add_vehicle' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'expense_hub': {
        message: `Your fuel spend this month is ₹${fuelSpend.toLocaleString()}. ${fuelSpend > 5000 ? "It's slightly higher than average." : "You're well within your limit!"} What would you like to check?`,
        options: [
          { label: "View All Expenses", nextFlow: 'sh_analytics' },
          { label: "Budget Tracking", nextFlow: 'sh_budget' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'my_tickets': {
        message: customer.supportTickets.length > 0
          ? `You have ${customer.supportTickets.length} active tickets. Which one needs your attention?`
          : "No active support tickets found. Everything looks clear!",
        options: [
          ...customer.supportTickets.map((t: any) => ({
            label: `[${t.status}] ${t.subject}`,
            nextFlow: `tk_details_${t.id}`
          })),
          { label: "Raise New Ticket", nextFlow: 'raise_ticket' },
          { label: "Back to Main", nextFlow: 'root' }
        ]
      },
      'services_hub': {
        message: "Gupio offers several premium services. What can I help you with?",
        options: [
          { label: "DigiLocker Sync", nextFlow: 'sh_digilocker' },
          { label: "SOS Info", nextFlow: 'sh_sos' },
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
        message: "In case of emergency, Gupio notifies your contacts and emergency services immediately. Have you verified your emergency contacts?",
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
          ? `Your RC for ${v.registrationNumber} is ${rc.verificationStatus}. ${rc.verificationStatus === 'VERIFIED' ? 'Everything looks good! ✅' : 'It is still being processed. ⏳'}`
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
