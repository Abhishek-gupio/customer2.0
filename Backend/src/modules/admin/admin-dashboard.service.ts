import { dbInstances } from "@repo/db-customer";
import { storageService } from "../../services/storage.service";
import { AppError } from "../../utils/AppError";
import type { AdminRole } from "@repo/db-customer";

async function withReadablePic<T extends { profilePic?: string | null }>(obj: T): Promise<T> {
  if (!obj.profilePic) return obj;
  try {
    const url = await storageService.ensureReadableUrl(obj.profilePic);
    return { ...obj, profilePic: url };
  } catch {
    return obj;
  }
}

export const adminDashboardService = {
  /** List customers with optional search and pagination. */
  async listCustomers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role: AdminRole;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search?.trim()) {
      const q = `%${params.search.trim()}%`;
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phoneNumber: { contains: params.search.trim() } },
      ];
    }

    const [customers, total] = await Promise.all([
      dbInstances.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          phoneNumber: true,
          email: true,
          fullName: true,
          profilePic: true,
          createdAt: true,
          _count: {
            select: {
              vehicles: true,
              expenses: true,
            },
          },
        },
      }),
      dbInstances.customer.count({ where }),
    ]);

    const withPics = await Promise.all(customers.map((c) => withReadablePic(c)));
    return {
      data: withPics,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /** List all support tickets with search and pagination. */
  async listTickets(params: {
    page?: number;
    limit?: number;
    search?: string;
    role: AdminRole;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search?.trim()) {
      const q = `%${params.search.trim()}%`;
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { customer: { fullName: { contains: q, mode: "insensitive" } } },
        { customer: { phoneNumber: { contains: params.search.trim() } } },
      ];
    }

    const db = dbInstances;
    if (!db.supportTicket) return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };

    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          customer: {
            select: { id: true, fullName: true, phoneNumber: true, email: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      db.supportTicket.count({ where }),
    ]);

    return {
      data: tickets,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /** List all vehicles with search and pagination. */
  async listVehicles(params: {
    page?: number;
    limit?: number;
    search?: string;
    role: AdminRole;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search?.trim()) {
      const q = `%${params.search.trim()}%`;
      where.OR = [
        { registrationNumber: { contains: q, mode: "insensitive" } },
        { make: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { ownerName: { contains: q, mode: "insensitive" } },
        { customer: { fullName: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [vehicles, total] = await Promise.all([
      dbInstances.customerVehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: { id: true, fullName: true, phoneNumber: true, email: true },
          },
          _count: { select: { challans: true, documents: true, expenses: true } },
        },
      }),
      dbInstances.customerVehicle.count({ where }),
    ]);

    return {
      data: vehicles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /** Full customer detail for admin. SUPPORT role gets limited data. */
  async getCustomerDetail(customerId: string, role: AdminRole) {
    const customer = await dbInstances.customer.findUnique({
      where: { id: customerId },
      include: {
        vehicles: {
          include: {
            _count: { select: { challans: true, documents: true, expenses: true } },
            healthScore: true,
            telematicsDevice: true,
            accessList: {
              include: {
                customer: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
              },
            },
            challans: { orderBy: { date: "desc" }, take: 50 },
            documents: { orderBy: { createdAt: "desc" }, take: 30 },
            odometerLogs: { orderBy: { date: "desc" }, take: 30 },
            serviceRecords: {
              orderBy: { serviceDate: "desc" },
              take: 30,
              include: { parts: true },
            },
            drivingTrips: { orderBy: { startTime: "desc" }, take: 30 },
          },
        },
        devices: true,
        emergencyContacts: true,
        digilocker: {
          select: { id: true, status: true, connectedAt: true, lastSyncAt: true },
        },
        _count: {
          select: {
            vehicles: true,
            expenses: true,
            documents: true,
            supportTickets: true,
            chats: true,
            sosRequests: true,
          },
        },
      },
    });
    if (!customer) {
      throw AppError.notFound("Customer not found");
    }

    const withPic = await withReadablePic(customer);
    const db = dbInstances;

    // Fetch documents, expenses, and tickets for ALL roles (including SUPPORT)
    const [expensesRaw, documentsRaw, supportTickets] = await Promise.all([
      db.expense?.findMany({
        where: { customerId },
        take: 50,
        orderBy: { date: "desc" },
        include: {
          vehicle: { select: { registrationNumber: true, make: true, model: true } },
        },
      }) ?? [],
      dbInstances.vehicleDocument.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
      }),
      db.supportTicket?.findMany({
        where: { customerId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
        orderBy: { updatedAt: "desc" },
      }) ?? [],
    ]);

    console.log(`[admin] getCustomerDetail customerId=${customerId} docs=${documentsRaw.length} expenses=${expensesRaw.length}`);

    // Generate signed/readable URLs for file access
    const [expenses, documents] = await Promise.all([
      Promise.all(
        expensesRaw.map(async (e: any) => ({
          ...e,
          receiptUrl: e.receiptUrl
            ? await storageService.ensureReadableUrl(e.receiptUrl)
            : null,
        }))
      ),
      Promise.all(
        documentsRaw.map(async (d: any) => ({
          ...d,
          fileUrl: d.fileUrl
            ? await storageService.ensureReadableUrl(d.fileUrl)
            : d.fileUrl,
        }))
      ),
    ]);

    // SUPPORT role: hide vehicles and devices but still show docs/expenses/tickets
    if (role === "SUPPORT") {
      return {
        ...withPic,
        vehicles: [],
        devices: [],
        emergencyContacts: withPic.emergencyContacts,
        digilocker: withPic.digilocker,
        _count: withPic._count,
        supportTickets,
        expenses,
        documents,
      };
    }

    return {
      ...withPic,
      expenses,
      documents,
      supportTickets,
    };
  },

  /** Dashboard overview stats. Only SUPER_ADMIN and ADMIN. */
  async getOverviewStats(role: AdminRole) {
    const empty = {
      customers: 0,
      vehicles: 0,
      totalExpenses: 0,
      expenseCount: 0,
      supportTicketsOpen: 0,
      weeklyTrend: [] as { date: string; label: string; customers: number; expenseAmount: number }[],
      databaseAvailable: false as boolean,
    };
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return { ...empty, databaseAvailable: true };
    }
    const db = dbInstances;
    try {
      const expenseFallback = { _sum: { amount: 0 as number }, _count: 0 };
      const [customers, vehicles, expenses, supportTicketsOpen, weeklyTrend] = await Promise.all([
        dbInstances.customer.count(),
        dbInstances.customerVehicle.count(),
        db.expense
          ? db.expense.aggregate({ _sum: { amount: true }, _count: true }).catch(() => expenseFallback)
          : Promise.resolve(expenseFallback),
        db.supportTicket
          ? db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }).catch(() => 0)
          : Promise.resolve(0),
        this.getWeeklyTrend(),
      ]);
      return {
        customers,
        vehicles,
        totalExpenses: (expenses as { _sum?: { amount?: number }; _count?: number })._sum?.amount ?? 0,
        expenseCount: (expenses as { _count?: number })._count ?? 0,
        supportTicketsOpen: Number(supportTicketsOpen),
        weeklyTrend,
        databaseAvailable: true,
      };
    } catch (err) {
      console.error("[admin] getOverviewStats database unreachable:", (err as Error).message);
      return empty;
    }
  },

  /** Last 7 days: new customers and expense amount per day (UTC) using efficient groupBy. */
  async getWeeklyTrend(): Promise<{ date: string; label: string; customers: number; expenseAmount: number }[]> {
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const db = dbInstances;

    // 1. Fetch data in bulk using groupBy (2 queries total vs 14)
    const [customerCounts, expenseSums] = await Promise.all([
      dbInstances.customer.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: sevenDaysAgo } },
        _count: { id: true },
      }),
      db.expense ? db.expense.groupBy({
        by: ['date'],
        where: { date: { gte: sevenDaysAgo } },
        _sum: { amount: true },
      }) : Promise.resolve([]),
    ]);

    // 2. Map results into the 7-day window
    const results = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = dayLabels[d.getUTCDay()];

      // Simple filter logic for pre-fetched counts
      const custCount = customerCounts
        .filter(c => c.createdAt.toISOString().split('T')[0] === dateStr)
        .reduce((sum, c) => sum + (c._count?.id || 0), 0);
      
      const expSum = expenseSums
        .filter((e: any) => e.date.toISOString().split('T')[0] === dateStr)
        .reduce((sum: number, e: any) => sum + (e._sum?.amount || 0), 0);

      results.push({
        date: dateStr,
        label,
        customers: custCount,
        expenseAmount: Math.round(expSum * 100) / 100,
      });
    }

    return results;
  },
};
