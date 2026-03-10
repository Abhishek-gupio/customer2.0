import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { fuelPriceService } from "./fuel-price.service";

const db = dbInstances as any;

/**
 * EXPENSE INTELLIGENCE SERVICE
 * ==============================
 * Advanced features that make expense tracking "top-level":
 * 1. Mileage Calculator (km/l)
 * 2. Expense Deduplication
 * 3. Anomaly Detection
 * 4. Weekly Spending Digest
 * 5. Cost Per Kilometer
 * 6. Recurring Expense Detection
 */

export const expenseIntelligenceService = {
  // ============================================================
  // 1. MILEAGE CALCULATOR
  // ============================================================
  /**
   * When a FUEL expense is added with odometer reading:
   * - Finds previous fuel entry
   * - Calculates: km_driven / liters_filled = km/l
   * - Tracks mileage trend
   * - Alerts if mileage drops (indicates vehicle health issue)
   */
  async calculateMileage(
    vehicleId: string,
    currentOdometer: number,
    amountPaid: number,
    city: string = "Delhi",
    fuelType: string = "PETROL",
  ): Promise<{
    mileage: number | null;
    liters: number;
    kmDriven: number | null;
    trend: "IMPROVING" | "STABLE" | "DECLINING" | "FIRST_ENTRY";
    alert: string | null;
  }> {
    // Get price per liter
    const price = await fuelPriceService.getPrice(city, fuelType);
    const liters = price ? Math.round((amountPaid / price) * 100) / 100 : 0;

    if (!liters || liters <= 0) {
      return {
        mileage: null,
        liters: 0,
        kmDriven: null,
        trend: "FIRST_ENTRY",
        alert: null,
      };
    }

    // Find previous fuel expense that has odometer data
    const previousFuelExpenses = await db.expense.findMany({
      where: {
        vehicleId,
        category: "FUEL",
        id: { not: undefined }, // just need last entries
      },
      orderBy: { date: "desc" },
      take: 5,
    });

    // Find last odometer log before current
    const previousOdoLog = await (dbInstances as any).odometerLog.findFirst({
      where: {
        vehicleId,
        reading: { lt: currentOdometer },
      },
      orderBy: { date: "desc" },
    });

    if (!previousOdoLog) {
      return {
        mileage: null,
        liters,
        kmDriven: null,
        trend: "FIRST_ENTRY",
        alert:
          "First fuel entry recorded! Add odometer readings regularly for mileage tracking.",
      };
    }

    const kmDriven = currentOdometer - previousOdoLog.reading;
    const mileage = Math.round((kmDriven / liters) * 100) / 100;

    // Determine trend by looking at recent mileage history
    let trend: "IMPROVING" | "STABLE" | "DECLINING" | "FIRST_ENTRY" = "STABLE";
    let alert: string | null = null;

    // Calculate average mileage from recent fuel expenses
    // (simplified: compare with a reasonable expected range)
    const fuelTypeRanges: Record<
      string,
      { min: number; max: number; avg: number }
    > = {
      PETROL: { min: 8, max: 25, avg: 14 },
      DIESEL: { min: 12, max: 30, avg: 18 },
      CNG: { min: 15, max: 35, avg: 22 },
    };

    const range = fuelTypeRanges[fuelType] || fuelTypeRanges.PETROL;

    if (mileage < range.min) {
      trend = "DECLINING";
      alert = `⚠️ Mileage is very low (${mileage} km/l). Expected: ${range.min}-${range.max} km/l. Possible issues: low tyre pressure, dirty air filter, or city traffic.`;
    } else if (mileage > range.max) {
      // Suspiciously high — might be data error
      alert = `🤔 Mileage seems unusually high (${mileage} km/l). Please verify your odometer reading.`;
    } else if (mileage >= range.avg) {
      trend = "IMPROVING";
    }

    return { mileage, liters, kmDriven, trend, alert };
  },

  // ============================================================
  // 2. EXPENSE DEDUPLICATION
  // ============================================================
  /**
   * Before creating an auto-parsed expense, check if a similar one
   * already exists (same amount, same day, same category).
   * This prevents duplicate entries from multiple identical notifications.
   */
  async isDuplicate(
    customerId: string,
    amount: number,
    category: string,
    date: Date,
  ): Promise<{
    isDuplicate: boolean;
    existingExpenseId: string | null;
    reason: string | null;
  }> {
    // Window: same calendar day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await db.expense.findFirst({
      where: {
        customerId,
        amount,
        category,
        date: { gte: dayStart, lte: dayEnd },
        isAutomated: true,
      },
      select: { id: true, merchantName: true, source: true, createdAt: true },
    });

    if (existing) {
      // Check if it was created within last 10 minutes (likely same notification)
      const timeDiff = Math.abs(
        new Date().getTime() - new Date(existing.createdAt).getTime(),
      );
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff < 10) {
        return {
          isDuplicate: true,
          existingExpenseId: existing.id,
          reason: `Duplicate detected: ₹${amount} ${category} already recorded ${Math.round(minutesDiff)} min ago.`,
        };
      }
    }

    // Also check raw text similarity (if same notification text)
    return { isDuplicate: false, existingExpenseId: null, reason: null };
  },

  /**
   * Check raw text dedup (exact match of notification text)
   */
  async isRawTextDuplicate(
    customerId: string,
    rawText: string,
  ): Promise<boolean> {
    if (!rawText || rawText.length < 10) return false;

    const existing = await db.expense.findFirst({
      where: {
        customerId,
        rawText,
        isAutomated: true,
      },
    });

    return !!existing;
  },

  // ============================================================
  // 3. ANOMALY DETECTION
  // ============================================================
  /**
   * Check if an expense looks suspicious:
   * - Amount too high for category
   * - Fuel amount exceeds tank capacity
   * - Double charge (same merchant, same day)
   * - Unusual time (midnight fuel?)
   */
  async detectAnomalies(
    customerId: string,
    amount: number,
    category: string,
    merchantName?: string,
    vehicleId?: string,
  ): Promise<{
    hasAnomaly: boolean;
    anomalies: string[];
    severity: "LOW" | "MEDIUM" | "HIGH";
  }> {
    const anomalies: string[] = [];

    // Rule 1: Category-based amount limits
    const categoryLimits: Record<string, number> = {
      FUEL: 10000, // Max ₹10,000 single fuel fill
      TOLL: 2000, // Max ₹2,000 single toll
      PARKING: 1000, // Max ₹1,000 parking
      CHALLAN: 25000, // Max ₹25,000 challan
      SERVICE: 100000, // Max ₹1L service
    };

    const limit = categoryLimits[category];
    if (limit && amount > limit) {
      anomalies.push(
        `Amount ₹${amount} seems high for ${category}. Typical max: ₹${limit}.`,
      );
    }

    // Rule 2: Fuel tank capacity check
    if (category === "FUEL" && vehicleId) {
      const vehicle = await dbInstances.customerVehicle.findUnique({
        where: { id: vehicleId },
        select: { vehicleType: true, fuelType: true },
      });

      if (vehicle) {
        // Approximate tank capacities
        const tankCapacities: Record<string, number> = {
          BIKE: 15,
          SEDAN: 45,
          SUV: 65,
          LUV: 55,
          HATCHBACK: 40,
        };
        const tankLiters = tankCapacities[vehicle.vehicleType || "SEDAN"] || 50;
        const fuelPrice = await fuelPriceService.getPrice(
          "Delhi",
          vehicle.fuelType || "PETROL",
        );

        if (fuelPrice) {
          const estimatedLiters = amount / fuelPrice;
          if (estimatedLiters > tankLiters * 1.1) {
            // 10% buffer
            anomalies.push(
              `₹${amount} would fill ~${Math.round(estimatedLiters)}L, but your ${vehicle.vehicleType || "car"}'s tank is ~${tankLiters}L. Possible overcharge?`,
            );
          }
        }
      }
    }

    // Rule 3: Double charge detection (same merchant, same day)
    if (merchantName) {
      const today = new Date();
      const dayStart = new Date(today.setHours(0, 0, 0, 0));
      const dayEnd = new Date(today.setHours(23, 59, 59, 999));

      const sameMerchant = await db.expense.count({
        where: {
          customerId,
          merchantName: { contains: merchantName, mode: "insensitive" },
          date: { gte: dayStart, lte: dayEnd },
        },
      });

      if (sameMerchant >= 2) {
        anomalies.push(
          `Multiple charges from "${merchantName}" today. Possible double charge?`,
        );
      }
    }

    // Rule 4: Monthly spending spike
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyTotal = await db.expense.aggregate({
      where: {
        customerId,
        category,
        date: { gte: monthStart },
      },
      _sum: { amount: true },
    });

    const currentMonthly = (monthlyTotal._sum.amount || 0) + amount;

    // Compare with last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthTotal = await db.expense.aggregate({
      where: {
        customerId,
        category,
        date: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _sum: { amount: true },
    });

    const lastMonthAmount = lastMonthTotal._sum.amount || 0;
    if (lastMonthAmount > 0 && currentMonthly > lastMonthAmount * 1.5) {
      anomalies.push(
        `${category} spending this month (₹${Math.round(currentMonthly)}) is 50%+ higher than last month (₹${Math.round(lastMonthAmount)}).`,
      );
    }

    const severity =
      anomalies.length >= 2
        ? "HIGH"
        : anomalies.length === 1
          ? "MEDIUM"
          : "LOW";

    return {
      hasAnomaly: anomalies.length > 0,
      anomalies,
      severity,
    };
  },

  // ============================================================
  // 4. WEEKLY SPENDING DIGEST
  // ============================================================
  /**
   * Generate a weekly spending summary for a customer.
   * Called by a cron job every Monday.
   */
  async generateWeeklyDigest(customerId: string): Promise<{
    period: string;
    totalSpent: number;
    breakdown: { category: string; total: number; percentage: number }[];
    topMerchant: string | null;
    vsLastWeek: { change: number; direction: "UP" | "DOWN" | "SAME" };
    tips: string[];
  }> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // This week's expenses
    const thisWeekGroup = await db.expense.groupBy({
      by: ["category"],
      where: {
        customerId,
        date: { gte: weekStart, lte: now },
      },
      _sum: { amount: true },
    });

    const totalSpent = thisWeekGroup.reduce(
      (sum: number, g: any) => sum + (g._sum.amount || 0),
      0,
    );

    const breakdown = thisWeekGroup.map((g: any) => ({
      category: g.category,
      total: g._sum.amount || 0,
      percentage:
        totalSpent > 0
          ? Math.round(((g._sum.amount || 0) / totalSpent) * 100)
          : 0,
    }));

    // Last week's total
    const lastWeekTotal = await db.expense.aggregate({
      where: {
        customerId,
        date: { gte: lastWeekStart, lte: weekStart },
      },
      _sum: { amount: true },
    });

    const lastWeekAmount = lastWeekTotal._sum.amount || 0;
    const change =
      lastWeekAmount > 0
        ? Math.round(((totalSpent - lastWeekAmount) / lastWeekAmount) * 100)
        : 0;
    const direction = change > 5 ? "UP" : change < -5 ? "DOWN" : "SAME";

    // Top merchant
    const topMerchantResult = await db.expense.groupBy({
      by: ["merchantName"],
      where: {
        customerId,
        date: { gte: weekStart, lte: now },
        merchantName: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 1,
    });

    const topMerchant = topMerchantResult[0]?.merchantName || null;

    // Smart Tips
    const tips: string[] = [];

    const fuelEntry = breakdown.find((b: any) => b.category === "FUEL");
    if (fuelEntry && fuelEntry.percentage > 60) {
      tips.push(
        "💡 Fuel is over 60% of your spending. Consider carpooling or optimizing routes.",
      );
    }

    if (direction === "UP" && change > 20) {
      tips.push(
        `📈 Spending is up ${change}% vs last week. Review your expenses for areas to cut.`,
      );
    }

    if (direction === "DOWN" && change < -10) {
      tips.push(`✅ Great job! You spent ${Math.abs(change)}% less this week.`);
    }

    if (totalSpent === 0) {
      tips.push(
        "📝 No expenses recorded this week. Use voice or scan to add expenses easily!",
      );
    }

    return {
      period: `${weekStart.toLocaleDateString("en-IN")} - ${now.toLocaleDateString("en-IN")}`,
      totalSpent: Math.round(totalSpent),
      breakdown,
      topMerchant,
      vsLastWeek: { change, direction },
      tips,
    };
  },

  /**
   * Send weekly digest as notification
   */
  async sendWeeklyDigestNotification(customerId: string): Promise<void> {
    const digest = await this.generateWeeklyDigest(customerId);

    const breakdownText = digest.breakdown
      .sort((a: any, b: any) => b.total - a.total)
      .map((b: any) => `${b.category}: ₹${b.total}`)
      .join(", ");

    const directionEmoji =
      digest.vsLastWeek.direction === "UP"
        ? "📈"
        : digest.vsLastWeek.direction === "DOWN"
          ? "📉"
          : "➡️";

    const body = [
      `💰 Total: ₹${digest.totalSpent}`,
      breakdownText ? `📊 ${breakdownText}` : "",
      `${directionEmoji} ${digest.vsLastWeek.change > 0 ? "+" : ""}${digest.vsLastWeek.change}% vs last week`,
      digest.tips[0] || "",
    ]
      .filter(Boolean)
      .join("\n");

    await db.inAppNotification.create({
      data: {
        customerId,
        title: `📊 Weekly Spending Report (${digest.period})`,
        body,
        type: "INFO",
        link: "/expenses/summary",
        metadata: digest,
      },
    });
  },

  // ============================================================
  // 5. COST PER KILOMETER
  // ============================================================
  /**
   * Calculate total cost of ownership per km
   */
  async costPerKm(
    vehicleId: string,
    customerId: string,
  ): Promise<{
    totalExpenses: number;
    totalKm: number;
    costPerKm: number;
    categoryBreakdownPerKm: { category: string; costPerKm: number }[];
    period: string;
  }> {
    // Get vehicle odometer range
    const firstLog = await (dbInstances as any).odometerLog.findFirst({
      where: { vehicleId },
      orderBy: { date: "asc" },
    });

    const lastLog = await (dbInstances as any).odometerLog.findFirst({
      where: { vehicleId },
      orderBy: { date: "desc" },
    });

    const totalKm =
      firstLog && lastLog ? lastLog.reading - firstLog.reading : 0;

    // Get all expenses for this vehicle
    const categoryGroup = await db.expense.groupBy({
      by: ["category"],
      where: { vehicleId, customerId },
      _sum: { amount: true },
    });

    const totalExpenses = categoryGroup.reduce(
      (sum: number, g: any) => sum + (g._sum.amount || 0),
      0,
    );
    const costPerKm =
      totalKm > 0 ? Math.round((totalExpenses / totalKm) * 100) / 100 : 0;

    const categoryBreakdownPerKm = categoryGroup.map((g: any) => ({
      category: g.category,
      costPerKm:
        totalKm > 0
          ? Math.round(((g._sum.amount || 0) / totalKm) * 100) / 100
          : 0,
    }));

    const period =
      firstLog && lastLog
        ? `${new Date(firstLog.date).toLocaleDateString("en-IN")} - ${new Date(lastLog.date).toLocaleDateString("en-IN")}`
        : "All time";

        console.log(costPerKm)

    return {
      totalExpenses: Math.round(totalExpenses),
      totalKm,
      costPerKm,
      categoryBreakdownPerKm,
      period,
    };
  },

  // ============================================================
  // 6. RECURRING EXPENSE DETECTION
  // ============================================================
  /**
   * Analyze past expenses to find recurring patterns (EMI, Insurance, etc.)
   */
  async detectRecurringExpenses(customerId: string): Promise<{
    patterns: {
      category: string;
      merchantName: string | null;
      averageAmount: number;
      frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
      nextExpectedDate: Date;
      confidence: number;
    }[];
  }> {
    // Get last 6 months of expenses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const expenses = await db.expense.findMany({
      where: {
        customerId,
        date: { gte: sixMonthsAgo },
      },
      orderBy: { date: "asc" },
      select: { amount: true, category: true, merchantName: true, date: true },
    });

    // Group by category + merchant
    const groups = new Map<string, any[]>();
    for (const exp of expenses) {
      const key = `${exp.category}|${exp.merchantName || "unknown"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(exp);
    }

    const patterns: any[] = [];

    for (const [key, exps] of groups.entries()) {
      if (exps.length < 3) continue; // Need at least 3 occurrences

      const [category, merchantName] = key.split("|");
      const amounts = exps.map((e: any) => e.amount);
      const averageAmount =
        amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;

      // Check if amounts are similar (within 20% variance)
      const variance = Math.max(...amounts) - Math.min(...amounts);
      const variancePercent = (variance / averageAmount) * 100;

      if (variancePercent > 30) continue; // Too much variance

      // Calculate average gap between expenses
      const dates = exps.map((e: any) => new Date(e.date).getTime()).sort();
      const gaps: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24)); // days
      }

      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

      let frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
      if (avgGap <= 10) frequency = "WEEKLY";
      else if (avgGap <= 45) frequency = "MONTHLY";
      else if (avgGap <= 120) frequency = "QUARTERLY";
      else frequency = "YEARLY";

      // Predict next date
      const lastDate = new Date(Math.max(...dates));
      const nextExpectedDate = new Date(lastDate);
      nextExpectedDate.setDate(nextExpectedDate.getDate() + Math.round(avgGap));

      // Confidence based on consistency
      const confidence =
        variancePercent < 10 ? 0.95 : variancePercent < 20 ? 0.8 : 0.6;

      patterns.push({
        category,
        merchantName: merchantName === "unknown" ? null : merchantName,
        averageAmount: Math.round(averageAmount),
        frequency,
        nextExpectedDate,
        confidence,
      });
    }

    return { patterns };
  },
};
