import { dbInstances } from "@repo/db-customer";
import axios from "axios";
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

    const db = dbInstances as any;
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
    type?: string;
    healthStatus?: string;
    verificationStatus?: string;
    role: AdminRole;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.type) {
      where.vehicleType = params.type;
    }

    if (params.healthStatus) {
      if (params.healthStatus === 'critical') {
        where.healthScore = { overallScore: { lt: 50 } };
      } else if (params.healthStatus === 'warning') {
        where.healthScore = { overallScore: { gte: 50, lt: 80 } };
      } else if (params.healthStatus === 'good') {
        where.healthScore = { overallScore: { gte: 80 } };
      }
    }

    if (params.verificationStatus) {
      if (params.verificationStatus === 'verified') {
        where.rcVerified = true;
      } else if (params.verificationStatus === 'unverified') {
        where.rcVerified = false;
      }
    }
    
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
          healthScore: true,
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
    const db = dbInstances as any;

    // Fetch documents, expenses, and tickets for ALL roles (including SUPPORT)
    const [expensesRaw, documentsRaw, supportTickets] = await Promise.all([
      db.expense?.findMany({
        where: { customerId },
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
          downloadUrl: d.fileUrl
            ? await storageService.ensureReadableUrl(d.fileUrl, 3600, `attachment; filename="${d.type.replace(/\s+/g, '_')}_${d.id.slice(0, 8)}"`)
            : d.fileUrl,
        }))
      ),
    ]);

    // Calculate full expense breakdown for export
    const totalExpenseAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const categories = ["FUEL", "TOLL", "PARKING", "SERVICE", "INSURANCE", "CHALLAN", "EMI", "OTHER"];
    const breakdown: Record<string, number> = {};

    categories.forEach(cat => {
      breakdown[cat.toLowerCase()] = expenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    });

    const expenseSummary = {
      total: totalExpenseAmount,
      breakdown,
      currency: expenses[0]?.currency || "INR",
    };

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
        expenseSummary,
      };
    }

    return {
      ...withPic,
      expenses,
      documents,
      supportTickets,
      expenseSummary,
    };
  },

  async downloadDocument(documentId: string) {
    const doc = await dbInstances.vehicleDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw AppError.notFound("Document not found");

    if (!doc.fileUrl) {
      if (doc.fileContent) {
        return {
          buffer: doc.fileContent,
          mimeType: doc.mimeType || "application/octet-stream",
          filename: `${doc.type}_${doc.id.slice(0, 8)}`,
        };
      }
      throw AppError.badRequest("Document has no file content or URL");
    }

    const readableUrl = await storageService.ensureReadableUrl(doc.fileUrl, 3600, `attachment; filename="${doc.type.replace(/\s+/g, '_')}_${doc.id.slice(0, 8)}"`);

    // If it's already a signed URL with query params, we can just return the URL or stream it.
    // Streaming is safer for forcing download.
    const response = await axios.get(readableUrl, { responseType: "arraybuffer" });

    return {
      buffer: Buffer.from(response.data),
      mimeType: (response.headers["content-type"] as string) || doc.mimeType || "application/octet-stream",
      filename: `${doc.type.replace(/\s+/g, "_")}_${doc.id.slice(0, 8)}`,
    };
  },

  /** Dashboard overview stats. Only SUPER_ADMIN and ADMIN. */
  async getOverviewStats(role: AdminRole, days: number = 7) {
    const empty = {
      customers: 0,
      vehicles: 0,
      totalExpenses: 0,
      expenseCount: 0,
      supportTicketsOpen: 0,
      unverifiedVehiclesCount: 0,
      totalCustomersToday: 0,
      recentHighExpenses: [] as any[],
      trendData: [] as { date: string; label: string; customers: number; expenseAmount: number; tickets: number; vehicles: number }[],
      databaseAvailable: false as boolean,
    };
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return { ...empty, databaseAvailable: true };
    }
    const db = dbInstances as any;
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const rangeStart = new Date(today);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));

    try {
      const expenseFallback = { _sum: { amount: 0 as number }, _count: 0 };
      const [
        customers,
        vehicles,
        periodExpenses,
        supportTicketsOpen,
        trendData,
        unverifiedVehiclesCount,
        verifiedVehiclesCount,
        totalCustomersToday,
        recentHighExpenses,
        expenseCategoryBreakdown,
        ticketPriorityDistribution,
        healthScores
      ] = await Promise.all([
        dbInstances.customer.count(),
        dbInstances.customerVehicle.count(),
        db.expense
          ? db.expense.aggregate({ 
              _sum: { amount: true }, 
              _count: true,
              where: { date: { gte: rangeStart } }
            }).catch(() => expenseFallback)
          : Promise.resolve(expenseFallback),
        db.supportTicket
          ? db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }).catch(() => 0)
          : Promise.resolve(0),
        this.getTrendData(db, days),
        dbInstances.customerVehicle.count({ where: { rcVerified: false } }),
        dbInstances.customerVehicle.count({ where: { rcVerified: true } }),
        dbInstances.customer.count({ where: { createdAt: { gte: today } } }),
        db.expense
          ? db.expense.findMany({
            where: { date: { gte: rangeStart }, amount: { gt: 1000 } },
            take: 3,
            orderBy: { date: "desc" },
            include: { customer: { select: { fullName: true } } },
          }).catch(() => [])
          : Promise.resolve([]),
        db.expense
          ? db.expense.groupBy({
            by: ['category'],
            where: { date: { gte: rangeStart } },
            _sum: { amount: true },
            _count: true,
          }).catch(() => [])
          : Promise.resolve([]),
        db.supportTicket
          ? db.supportTicket.groupBy({
            by: ['priority'],
            where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
            _count: true,
          }).catch(() => [])
          : Promise.resolve([]),
        dbInstances.vehicleHealthScore.findMany({
          select: { overallScore: true }
        }).catch(() => []),
      ]);

      // Process health distribution
      const healthDist = { critical: 0, warning: 0, good: 0 };
      healthScores.forEach((h: { overallScore: number }) => {
        if (h.overallScore < 50) healthDist.critical++;
        else if (h.overallScore < 80) healthDist.warning++;
        else healthDist.good++;
      });

      return {
        customers,
        vehicles,
        totalExpenses: (periodExpenses as { _sum?: { amount?: number }; _count?: number })._sum?.amount ?? 0,
        expenseCount: (periodExpenses as { _count?: number })._count ?? 0,
        supportTicketsOpen: Number(supportTicketsOpen),
        trendData,
        unverifiedVehiclesCount,
        verifiedVehiclesCount,
        totalCustomersToday,
        recentHighExpenses,
        expenseCategoryBreakdown: expenseCategoryBreakdown.map((b: any) => ({
          category: b.category,
          amount: b._sum.amount || 0,
          count: b._count
        })),
        ticketPriorityDistribution: ticketPriorityDistribution.map((b: any) => ({
          priority: b.priority,
          count: b._count
        })),
        vehicleHealthDistribution: healthDist,
        databaseAvailable: true,
      };
    } catch (err) {
      console.error("[admin] getOverviewStats database unreachable:", (err as Error).message);
      return empty;
    }
  },

  /** Trend analysis for specified number of days: new customers, vehicles, expense amount, and tickets per day (UTC). */
  async getTrendData(db: any, daysToFetch: number): Promise<{ date: string; label: string; customers: number; vehicles: number; expenseAmount: number; tickets: number }[]> {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    const rangeStart = new Date(today);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (daysToFetch - 1));

    // Fetch everything for the range upfront in 4 bulk queries
    const [allCustomers, allVehicles, allExpenses, allTickets] = await Promise.all([
      dbInstances.customer.findMany({
        where: { createdAt: { gte: rangeStart } },
        select: { createdAt: true }
      }),
      dbInstances.customerVehicle.findMany({
        where: { createdAt: { gte: rangeStart } },
        select: { createdAt: true }
      }),
      db.expense 
        ? db.expense.findMany({
            where: { date: { gte: rangeStart } },
            select: { date: true, amount: true }
          }).catch(() => [])
        : Promise.resolve([]),
      db.supportTicket 
        ? db.supportTicket.findMany({
            where: { createdAt: { gte: rangeStart } },
            select: { createdAt: true }
          }).catch(() => [])
        : Promise.resolve([])
    ]);

    // Helper to format date consistent with our labels
    const formatDateKey = (d: Date) => {
      const dd = new Date(d);
      return `${dd.getUTCFullYear()}-${String(dd.getUTCMonth() + 1).padStart(2, "0")}-${String(dd.getUTCDate()).padStart(2, "0")}`;
    };

    // Pre-calculate data structures for efficiency
    const results: { date: string; label: string; customers: number; vehicles: number; expenseAmount: number; tickets: number }[] = [];
    
    // Initialize day map
    const dayMap = new Map<string, { customers: number; vehicles: number; expenseAmount: number; tickets: number }>();

    for (let i = 0; i < daysToFetch; i++) {
      const d = new Date(rangeStart);
      d.setUTCDate(d.getUTCDate() + i);
      dayMap.set(formatDateKey(d), { customers: 0, vehicles: 0, expenseAmount: 0, tickets: 0 });
    }

    // Populate stats with O(N) complexity
    allCustomers.forEach(c => {
      const key = formatDateKey(c.createdAt);
      const data = dayMap.get(key);
      if (data) data.customers++;
    });

    allVehicles.forEach(v => {
      const key = formatDateKey(v.createdAt);
      const data = dayMap.get(key);
      if (data) data.vehicles++;
    });

    allExpenses.forEach((e: any) => {
      const key = formatDateKey(e.date);
      const data = dayMap.get(key);
      if (data) data.expenseAmount += e.amount || 0;
    });

    allTickets.forEach((t: any) => {
      const key = formatDateKey(t.createdAt);
      const data = dayMap.get(key);
      if (data) data.tickets++;
    });

    // Transform into final array
    for (let i = 0; i < daysToFetch; i++) {
      const d = new Date(rangeStart);
      d.setUTCDate(d.getUTCDate() + i);
      const key = formatDateKey(d);
      const stats = dayMap.get(key)!;
      
      let label = dayLabels[d.getUTCDay()];
      if (daysToFetch > 7) {
        label = `${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}`;
      }

      results.push({
        date: key,
        label,
        ...stats,
        expenseAmount: Math.round(stats.expenseAmount * 100) / 100
      });
    }

    return results;
  },
  /** Delete one or more customers. SUPER_ADMIN only. */
  async deleteCustomers(customerIds: string[]) {
    if (!customerIds.length) return { count: 0 };

    // Prisma handle cascading deletes for most related models.
    const result = await dbInstances.customer.deleteMany({
      where: { id: { in: customerIds } }
    });

    return { count: result.count };
  },

  /** Update customer profile data. SUPER_ADMIN only. */
  async updateCustomer(id: string, data: { fullName?: string; email?: string; phoneNumber?: string }) {
    return dbInstances.customer.update({
      where: { id },
      data: {
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
      },
    });
  },
};
