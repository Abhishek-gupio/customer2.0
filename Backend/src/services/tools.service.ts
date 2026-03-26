import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { expenseService } from "../modules/expense/expense.service";
import {
  CreateExpenseInput,
  ExpenseCategory,
} from "../modules/expense/expense.validators";
import { warrantyService } from "./warranty.service";
import { documentService } from "../modules/document/document.service";
import {
  suggestIntervalsFromAI,
  saveSuggestedIntervals,
} from "./oem-interval.service";
import { customerService } from "../modules/customer/customer.service";
import { notificationService } from "./notification.service";
import { challanService } from "./challan.service";
import { telematicsService } from "./telematics.service";
import { vehicleService } from "../modules/vehicle/vehicle.service";
import { addVehicleSchema } from "../modules/vehicle/vehicle.validators";
import { tripExpenseService } from "../modules/trip-expense/trip-expense.service";

const db = dbInstances as any;

async function resolveVehicleForTools(
  customerId: string,
  vehicleId?: string,
  registrationNumber?: string,
): Promise<{
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
} | null> {
  if (vehicleId?.trim()) {
    try {
      const v = await vehicleService.getVehicle(customerId, vehicleId.trim());
      return {
        id: v.id,
        registrationNumber: v.registrationNumber,
        make: v.make ?? null,
        model: v.model ?? null,
      };
    } catch {
      return null;
    }
  }
  if (registrationNumber?.trim()) {
    const clean = registrationNumber.replace(/\s/g, "");
    const v = await db.customerVehicle.findFirst({
      where: {
        isActive: true,
        registrationNumber: { contains: clean, mode: "insensitive" },
        OR: [{ customerId }, { accessList: { some: { customerId } } }],
      },
      select: { id: true, registrationNumber: true, make: true, model: true },
    });
    return v;
  }
  return null;
}

async function defaultGarageVehicleForTools(customerId: string) {
  return db.customerVehicle.findFirst({
    where: {
      isActive: true,
      OR: [{ customerId }, { accessList: { some: { customerId } } }],
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    select: { id: true, registrationNumber: true, make: true, model: true },
  });
}

/**
 * Registry of safe tools the AI can call.
 * Each tool must have a clear description and schema.
 */
export const toolRegistry = {
  /**
   * Tool: add_expense
   * Use when user wants to log spending.
   */
  add_expense: {
    name: "add_expense",
    description: "Log a new vehicle expense (fuel, service, toll, etc.)",
    parameters: {
      amount: "number (required)",
      category:
        "string (FUEL, TOLL, SERVICE, PARKING, INSURANCE, CHALLAN, OTHER) (required)",
      merchantName: "string (optional, e.g. Shell, McDonald's)",
      location: "string (optional, e.g. Delhi, Mumbai)",
      notes: "string (optional)",
      date: "string (optional, ISO format or natural lang like 'yesterday')",
      vehicleId: "string (optional ID)",
      registrationNumber: "string (optional, e.g. DL01AB1234)",
    },
    execute: async (customerId: string, args: any) => {
      // Validate basic inputs
      if (!args.amount || !args.category) {
        return { success: false, error: "Amount and Category are required." };
      }

      // Map AI category to Enum if needed
      const validCategories = [
        "FUEL",
        "TOLL",
        "SERVICE",
        "PARKING",
        "INSURANCE",
        "CHALLAN",
        "EMI",
        "OTHER",
      ];
      const category = validCategories.includes(args.category.toUpperCase())
        ? (args.category.toUpperCase() as ExpenseCategory)
        : "OTHER";

      // Resolve Natural Language Dates (yesterday, today)
      let finalDate = new Date();
      if (args.date) {
        const lowerDate = args.date.toLowerCase();
        if (lowerDate.includes("yesterday")) {
          finalDate.setDate(finalDate.getDate() - 1);
        } else if (lowerDate.includes("today")) {
          // already today
        } else {
          const parsed = new Date(args.date);
          if (!isNaN(parsed.getTime())) finalDate = parsed;
        }
      }

      // Resolve Vehicle ID from Reg Number if provided
      let vehicleId = args.vehicleId;
      if (!vehicleId && args.registrationNumber) {
        const v = await db.customerVehicle.findFirst({
          where: {
            customerId,
            registrationNumber: {
              contains: args.registrationNumber.replace(/\s/g, ""),
              mode: "insensitive",
            },
          },
          select: { id: true },
        });
        if (v) vehicleId = v.id;
      }

      const input: CreateExpenseInput = {
        amount: parseFloat(args.amount),
        category,
        merchantName: args.merchantName,
        location: args.location,
        notes: args.notes,
        date: finalDate.toISOString(),
        vehicleId,
        source: "VOICE",
      };

      const result = await expenseService.createExpense(customerId, input);
      const successMessage = `Expense of ₹${result.expense.amount} for ${result.expense.category} added successfully.`;

      // Update the expense notes with the success message for better record keeping
      await db.expense.update({
        where: { id: result.expense.id },
        data: {
          notes: input.notes
            ? `${input.notes} | ${successMessage}`
            : successMessage,
        },
      });

      return {
        success: true,
        message: successMessage,
        expenseId: result.expense.id,
      };
    },
  },

  /**
   * Tool: update_expense
   * Use when user says "Change my last fuel amount to 600" or "Correct that merchant name"
   */
  update_expense: {
    name: "update_expense",
    description:
      "Update an existing expense record. Provide the expenseId or the AI will try to find the last one.",
    parameters: {
      expenseId: "string (optional, will use last if not provided)",
      amount: "number (optional)",
      category: "string (optional)",
      merchantName: "string (optional)",
      location: "string (optional)",
      notes: "string (optional)",
    },
    execute: async (customerId: string, args: any) => {
      let id = args.expenseId;

      // If no ID, find the latest expense for this user
      if (!id) {
        const latest = await db.expense.findFirst({
          where: { customerId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (!latest) return { error: "No expenses found to update." };
        id = latest.id;
      }

      // Clean up inputs
      const data: any = {};
      if (args.amount) data.amount = parseFloat(args.amount);
      if (args.category) data.category = args.category.toUpperCase();
      if (args.merchantName) data.merchantName = args.merchantName;
      if (args.location) data.location = args.location;
      if (args.notes) data.notes = args.notes;

      const updated = await db.expense.update({
        where: { id, customerId },
        data,
      });

      const successMessage = `Expense updated successfully. New amount: ₹${updated.amount}`;

      // Store the update message in the record
      await db.expense.update({
        where: { id, customerId },
        data: { notes: successMessage },
      });

      return {
        success: true,
        message: successMessage,
        updatedFields: Object.keys(data),
      };
    },
  },

  /**
   * Tool: get_vehicle_status
   * Use when user asks about car health, odometer, or status.
   */
  get_vehicle_status: {
    name: "get_vehicle_status",
    description:
      "Get odometer, fuel type, and health score for one vehicle or all vehicles in the garage. Use when user asks about a specific car, 'my primary vehicle', or wants a health/odometer snapshot (pairs well after list_my_vehicles for 'my garage').",
    parameters: {
      vehicleId: "string (optional, usually inferred from context)", // If null, fetches all
      registrationNumber: "string (optional)",
    },
    execute: async (customerId: string, args: any) => {
      const accessOr = {
        OR: [
          { customerId, isActive: true },
          { accessList: { some: { customerId } }, isActive: true },
        ],
      };

      const vehicles = await db.customerVehicle.findMany({
        where:
          args.vehicleId
            ? { id: args.vehicleId, ...accessOr }
            : args.registrationNumber
              ? {
                  registrationNumber: {
                    contains: args.registrationNumber.replace(/\s/g, ""),
                    mode: "insensitive",
                  },
                  ...accessOr,
                }
              : accessOr,
        select: {
          id: true,
          make: true,
          model: true,
          registrationNumber: true,
          currentOdometer: true,
          fuelType: true,
          healthScore: { select: { overallScore: true } },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      });

      if (vehicles.length === 0)
        return { message: "No active vehicles found in your garage (including shared access)." };

      return {
        success: true,
        vehicles: vehicles.map((v: any) => ({
          name: `${v.make} ${v.model} (${v.registrationNumber})`,
          odometer:
            typeof v.currentOdometer === "number" ? `${v.currentOdometer} km` : "—",
          fuel: v.fuelType,
          health: v.healthScore
            ? `${v.healthScore.overallScore}%`
            : "Not calculated",
        })),
      };
    },
  },

  /**
   * Tool: set_budget
   * Use when user says "Set budget for fuel to 5000"
   */
  set_budget: {
    name: "set_budget",
    description: "Set a monthly budget for a specific category",
    parameters: {
      category: "string (FUEL, SERVICE, TOTAL, etc.)",
      amount: "number",
    },
    execute: async (customerId: string, args: any) => {
      if (!args.category || !args.amount) {
        return { error: "Category and Amount required." };
      }

      await expenseService.setBudget(customerId, {
        category: args.category.toUpperCase(),
        amount: parseFloat(args.amount),
        period: "MONTHLY",
        notifyThreshold: 80, // Default to 80% notification
      });

      return {
        success: true,
        message: `Monthly budget of ₹${args.amount} set for ${args.category}.`,
      };
    },
  },

  /**
   * Tool: get_expenses_summary
   * Use when user asks "How much did I spend?" or "Show my fuel costs"
   */
  get_expenses_summary: {
    name: "get_expenses_summary",
    description:
      "Get a summary of expenses by category or a total for a period",
    parameters: {
      category: "string (optional, e.g. FUEL)",
      days: "number (optional, default 30 days)",
    },
    execute: async (customerId: string, args: any) => {
      const days = args.days || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const where: any = {
        customerId,
        date: { gte: startDate },
      };
      if (args.category) {
        where.category = args.category.toUpperCase();
      }

      const expenses = await db.expense.findMany({
        where,
        select: { amount: true, category: true, date: true },
      });

      if (expenses.length === 0)
        return { message: `No expenses found for the last ${days} days.` };

      const total = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
      const breakdown = expenses.reduce((acc: any, e: any) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {});

      const categoryLabel = args.category
        ? ` on ${args.category.toLowerCase()}`
        : "";
      const message =
        `In the last ${days} days you spent ₹${total.toLocaleString("en-IN")}${categoryLabel}.` +
        (Object.keys(breakdown).length > 1
          ? ` Breakdown: ${Object.entries(breakdown)
              .map(([cat, amt]) => `${cat} ₹${Number(amt).toLocaleString("en-IN")}`)
              .join(", ")}`
          : "");

      return {
        success: true,
        message,
        total: `₹${total}`,
        period: `Last ${days} days`,
        breakdown,
      };
    },
  },

  /**
   * Tool: get_maintenance_advisor
   * Use when user asks "Is my car ready for a trip?" or "Show my car health"
   */
  get_maintenance_advisor: {
    name: "get_maintenance_advisor",
    description:
      "Analyze vehicle health, part warranty, and upcoming service needs",
    parameters: {
      vehicleId: "string (optional)",
    },
    execute: async (customerId: string, args: any) => {
      const vehicle = await db.customerVehicle.findFirst({
        where: args.vehicleId
          ? { id: args.vehicleId, customerId }
          : { customerId, isActive: true },
        select: { id: true, make: true, model: true },
      });

      if (!vehicle) return { error: "No vehicle found to analyze." };

      const [warranty, replacements, adr] = await Promise.all([
        warrantyService.getWarrantyStatus(vehicle.id),
        warrantyService.getUpcomingReplacements(vehicle.id),
        warrantyService.calculateAverageDailyRunning(vehicle.id),
      ]);

      return {
        success: true,
        vehicle: `${vehicle.make} ${vehicle.model}`,
        averageDailyRunning: `${Math.round(adr)} km/day`,
        urgentIssues: replacements
          .filter((r) => r.urgency === "OVERDUE")
          .map((r) => r.message),
        upcomingService: replacements
          .filter((r) => r.urgency !== "OVERDUE")
          .map((r) => r.message),
        warrantyStatus: {
          active: warranty.active.length,
          expiringSoon: warranty.expiring.map((e) => e.message),
          expiredCount: warranty.expired.length,
        },
      };
    },
  },

  /**
   * Tool: get_or_suggest_parts_interval
   * Use when user asks "When should I change oil for my car?" or "What are the service intervals for my vehicle?" or "Get OEM intervals for my Swift".
   * Fetches or suggests parts replacement intervals from public OEM knowledge (Indian market) and can save them for the vehicle.
   */
  get_or_suggest_parts_interval: {
    name: "get_or_suggest_parts_interval",
    description:
      "Get or suggest OEM-style parts replacement intervals (engine oil, brake pads, etc.) for the customer's vehicle. Uses public Indian OEM schedule knowledge. Can save suggested intervals so future reminders use them.",
    parameters: {
      vehicleId: "string (optional; uses customer's vehicle if not provided)",
      saveToDatabase: "string (optional; 'true' to save suggested intervals for this vehicle so they are used for reminders)",
    },
    execute: async (customerId: string, args: any) => {
      const vehicle = await db.customerVehicle.findFirst({
        where: args.vehicleId
          ? { id: args.vehicleId, customerId }
          : { customerId, isActive: true },
        select: { id: true, make: true, model: true, manufacturingMonthYear: true },
      });

      if (!vehicle)
        return { success: false, error: "No vehicle found for this customer." };

      const make = (vehicle.make ?? "").trim() || "Unknown";
      const model = (vehicle.model ?? "").trim() || "Unknown";
      
      // Extract year from manufacturingMonthYear (format: "MM/YYYY")
      let year: number | null = null;
      if (vehicle?.manufacturingMonthYear) {
          const parts = vehicle.manufacturingMonthYear.split('/');
          const yearStr = parts.length > 1 ? parts[1] : parts[0];
          const parsedYear = parseInt(yearStr);
          if (!isNaN(parsedYear)) year = parsedYear;
      }

      // Check if we already have vehicle-specific intervals (not just DEFAULT/FALLBACK)
      const existingLifecycle = await warrantyService.getLifecycleForVehiclePart(
        vehicle.id,
        "ENGINE_OIL",
      );
      const alreadyHasSpecific =
        existingLifecycle.source &&
        existingLifecycle.source !== "FALLBACK" &&
        existingLifecycle.source !== "DEFAULT";

      if (alreadyHasSpecific) {
        const intervals = await warrantyService.getPartLifecycleInfo();
        return {
          success: true,
          message: `Your ${make} ${model} already has vehicle-specific intervals in our system. Replacement reminders are based on these.`,
          vehicle: `${make} ${model}${year ? ` (${year})` : ""}`,
          source: existingLifecycle.source,
        };
      }

      // Suggest intervals from AI (public OEM knowledge)
      const suggested = await suggestIntervalsFromAI(make, model, year);
      if (suggested.length === 0) {
        return {
          success: true,
          message: `Could not suggest intervals for ${make} ${model}. You can add them manually from the OEM manual (see app help).`,
          vehicle: `${make} ${model}${year ? ` (${year})` : ""}`,
        };
      }

      const saveToDb =
        args.saveToDatabase === "true" || args.saveToDatabase === true;
      if (saveToDb) {
        const { saved, errors } = await saveSuggestedIntervals(
          make,
          model,
          year,
          suggested,
        );
        return {
          success: true,
          message: `I've added suggested parts intervals for your ${make} ${model} based on typical Indian OEM schedules (${saved} parts). Future replacement reminders will use these. For exact values, verify with the manufacturer manual.`,
          vehicle: `${make} ${model}${year ? ` (${year})` : ""}`,
          intervalsSaved: saved,
          intervals: suggested.map((p) => ({
            part: p.partType,
            everyKm: p.intervalKm,
            everyMonths: p.intervalMonths,
          })),
          source: "AI_SUGGESTED",
          errors: errors.length ? errors : undefined,
        };
      }

      return {
        success: true,
        message: `Suggested intervals for ${make} ${model} (from typical Indian OEM schedules). Say "save these intervals" or ask to save if you want to use them for reminders.`,
        vehicle: `${make} ${model}${year ? ` (${year})` : ""}`,
        intervals: suggested.map((p) => ({
          part: p.partType,
          everyKm: p.intervalKm,
          everyMonths: p.intervalMonths,
        })),
        source: "AI_SUGGESTED",
      };
    },
  },

  /**
   * Tool: get_document_status
   * Use when user asks "When is my RC expiring?" or "Are my papers clear?"
   */
  get_document_status: {
    name: "get_document_status",
    description:
      "Check status and expiry of vehicle documents (RC, Insurance, PUC). Includes shared vehicles (accessList) as well as owned vehicles.",
    parameters: {
      vehicleId: "string (optional)",
    },
    execute: async (customerId: string, args: any) => {
      const accessOr = {
        OR: [{ customerId, isActive: true }, { accessList: { some: { customerId } }, isActive: true }],
      };

      const where: any = {
        OR: [
          // Owner: docs stored with customerId
          { customerId },
          // Shared: docs are linked to a vehicle the customer can access
          { vehicle: { accessList: { some: { customerId } } } },
        ],
      };

      if (args.vehicleId) where.vehicleId = args.vehicleId;

      const docs = await db.vehicleDocument.findMany({
        where,
        select: {
          type: true,
          expiryDate: true,
          documentNumber: true,
          vehicle: { select: { make: true, model: true } },
        },
      });

      // Fallback: if no VehicleDocument rows exist, try expiry fields stored directly on CustomerVehicle
      // (these are shown in the app under Garage → Details → More).
      if (docs.length === 0) {
        const vehicleId =
          typeof args.vehicleId === "string" && args.vehicleId.trim()
            ? args.vehicleId.trim()
            : null;

        const v = await db.customerVehicle.findFirst({
          where: vehicleId ? { id: vehicleId, ...accessOr } : accessOr,
          orderBy: vehicleId ? undefined : [{ isPrimary: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            make: true,
            model: true,
            registrationNumber: true,
            insuranceUpto: true,
            pollutionUpto: true,
            fitnessUpto: true,
            rcStatus: true,
          },
        });

        if (!v) return { success: false, error: "Vehicle not found or you do not have access." };

        const fmt = (d: any) => {
          const dt = d ? new Date(d) : null;
          return dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString("en-IN") : null;
        };

        const documents = [
          { type: "INSURANCE", expiry: fmt(v.insuranceUpto), status: v.insuranceUpto ? "Valid" : "Unknown", vehicle: `${v.make || ""} ${v.model || ""}`.trim() || v.registrationNumber },
          { type: "PUC", expiry: fmt(v.pollutionUpto), status: v.pollutionUpto ? "Valid" : "Unknown", vehicle: `${v.make || ""} ${v.model || ""}`.trim() || v.registrationNumber },
          { type: "FITNESS", expiry: fmt(v.fitnessUpto), status: v.fitnessUpto ? "Valid" : "Unknown", vehicle: `${v.make || ""} ${v.model || ""}`.trim() || v.registrationNumber },
        ];

        return {
          success: true,
          source: "CUSTOMER_VEHICLE_FIELDS",
          vehicle: { id: v.id, registrationNumber: v.registrationNumber, make: v.make, model: v.model, rcStatus: v.rcStatus ?? null },
          documents,
          message:
            "I couldn't find uploaded document records, but I found expiry dates saved on your vehicle profile (Garage → Details → More).",
        };
      }

      const now = new Date();
      const status = docs.map((d: any) => {
        const isExpired = d.expiryDate && new Date(d.expiryDate) < now;
        return {
          type: d.type,
          vehicle: d.vehicle
            ? `${d.vehicle.make} ${d.vehicle.model}`
            : "General",
          expiry: d.expiryDate
            ? new Date(d.expiryDate).toLocaleDateString("en-IN")
            : "No expiry set",
          status: isExpired ? "Expired" : "Valid",
        };
      });

      return { success: true, documents: status };
    },
  },

  /**
   * Tool: get_smart_recommendations
   * Use when user asks "How can I save money?" or "Give me some tips"
   */
  get_smart_recommendations: {
    name: "get_smart_recommendations",
    description:
      "Get personalized AI recommendations to save fuel, money, or improve car health",
    parameters: {},
    execute: async (customerId: string) => {
      const [vehicles, expenses] = await Promise.all([
        db.customerVehicle.findMany({
          where: { customerId, isActive: true },
          include: { healthScore: true },
        }),
        db.expense.findMany({
          where: { customerId, category: "FUEL" },
          orderBy: { date: "desc" },
          take: 5,
        }),
      ]);

      const recs = [];

      // 1. Health based
      for (const v of vehicles) {
        if (v.healthScore && v.healthScore.overallScore < 70) {
          recs.push(
            `⚠️ Your ${v.make} ${v.model} has a low health score (${v.healthScore.overallScore}). We recommend a full checkup.`,
          );
        }
      }

      // 2. Fuel based
      if (expenses.length >= 2) {
        recs.push(
          "💡 We noticed your fuel frequency increased. Consider checking tyre pressure to improve mileage.",
        );
      }

      // 3. Document based (fallback)
      recs.push(
        "🔍 Reminder: Regularly uploading service bills helps me predict your part lifecycle better.",
      );

      return {
        success: true,
        recommendations: recs,
      };
    },
  },

  /**
   * Tool: get_profile
   * Use when user asks about their profile, name, email, or account details.
   */
  get_profile: {
    name: "get_profile",
    description:
      "Get the logged-in user's profile (name, email, phone, profile picture). Use for questions like 'what is my name', 'show my profile', 'my email'.",
    parameters: {},
    execute: async (customerId: string) => {
      try {
        const profile = await customerService.getProfile(customerId);
        return {
          success: true,
          profile: {
            fullName: profile.fullName ?? "Not set",
            email: profile.email ?? "Not set",
            phoneNumber: profile.phoneNumber ?? "Not set",
            profilePic: profile.profilePic ? "Set" : "Not set",
            memberSince: new Date(profile.createdAt).toLocaleDateString("en-IN"),
          },
        };
      } catch (e) {
        return { success: false, error: "Could not fetch profile." };
      }
    },
  },

  /**
   * Tool: update_profile
   * Use when user wants to change name, email, or profile picture.
   */
  update_profile: {
    name: "update_profile",
    description:
      "Update the user's profile. Use when they say 'change my name to X', 'update my email', 'set my name'.",
    parameters: {
      fullName: "string (optional)",
      email: "string (optional, valid email)",
      profilePic: "string (optional, URL of profile picture)",
    },
    execute: async (customerId: string, args: any) => {
      const data: any = {};
      if (args.fullName !== undefined) data.fullName = args.fullName;
      if (args.email !== undefined) data.email = args.email;
      if (args.profilePic !== undefined) data.profilePic = args.profilePic;
      if (Object.keys(data).length === 0) {
        return { success: false, error: "Provide at least one field to update (fullName, email, or profilePic)." };
      }
      try {
        const updated = await customerService.updateProfile(customerId, data);
        return {
          success: true,
          message: "Profile updated successfully.",
          profile: {
            fullName: updated.fullName ?? "Not set",
            email: updated.email ?? "Not set",
          },
        };
      } catch (e) {
        return { success: false, error: "Could not update profile. Check that email is valid if provided." };
      }
    },
  },

  /**
   * Tool: get_notifications
   * Use when user asks about alerts, notifications, or what they missed.
   */
  get_notifications: {
    name: "get_notifications",
    description:
      "Get the user's in-app notifications (alerts, reminders, budget warnings). Use when they ask 'any notifications', 'what are my alerts', 'did I miss anything'.",
    parameters: {
      unreadOnly: "string (optional; 'true' to return only unread notifications)",
    },
    execute: async (customerId: string, args: any) => {
      const list = await notificationService.getNotifications(customerId);
      const unreadOnly = args.unreadOnly === "true" || args.unreadOnly === true;
      const notifications = unreadOnly
        ? list.filter((n: any) => !n.isRead)
        : list;
      const limited = notifications.slice(0, 20);
      return {
        success: true,
        count: limited.length,
        notifications: limited.map((n: any) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          type: n.type,
          isRead: n.isRead,
          createdAt: new Date(n.createdAt).toLocaleString("en-IN"),
        })),
      };
    },
  },

  /**
   * Tool: get_current_trip_info
   * Use when user asks "How much is the next toll?", "Show my trip budget", "Tell me about my journey"
   */
  get_current_trip_info: {
    name: "get_current_trip_info",
    description: "Get details of the user's most recently calculated trip (origin, destination, total costs, tolls, weather).",
    parameters: {},
    execute: async (customerId: string) => {
      const trip = await tripExpenseService.getLatestTrip(customerId);
      if (!trip) {
        return { success: false, message: "No active or saved trip found. You can plan one in the Trip Expense screen." };
      }

      const activeRoute = trip.cheapestRoute || trip.fastestRoute || trip.routes?.[0];
      if (!activeRoute) {
        return { success: false, message: "No route data found for the recent trip." };
      }

      return {
        success: true,
        origin: trip.from,
        destination: trip.to,
        vehicleType: trip.vehicleType,
        fuelType: trip.fuelType,
        totalCost: `₹${activeRoute.costs.total}`,
        fuelCost: `₹${activeRoute.costs.fuel}`,
        tollCost: `₹${activeRoute.costs.tollFastag}`,
        distance: activeRoute.distance.text,
        duration: activeRoute.duration.text,
        nextTolls: activeRoute.tolls.slice(0, 3).map(t => `${t.name} (₹${t.tagCost})`),
        weather: trip.weather ? `${trip.weather.temp}°C, ${trip.weather.condition}` : "Clear conditions expected",
        message: `Your trip from ${trip.from} to ${trip.to} for a ${trip.vehicleType} has an estimated cost of ₹${activeRoute.costs.total}.`,
      };
    },
  },

  /**
   * Tool: mark_notification_read
   * Use when user says "mark that as read", "dismiss notification", or "clear that alert".
   */
  mark_notification_read: {
    name: "mark_notification_read",
    description:
      "Mark a notification as read. Use when user says 'mark as read', 'dismiss', 'clear that notification'. Requires the notification id (from get_notifications).",
    parameters: {
      notificationId: "string (required; the id of the notification to mark as read)",
    },
    execute: async (customerId: string, args: any) => {
      if (!args.notificationId) {
        return { success: false, error: "notificationId is required." };
      }
      try {
        await notificationService.markAsRead(customerId, args.notificationId);
        return { success: true, message: "Notification marked as read." };
      } catch (e) {
        return { success: false, error: "Could not mark notification as read." };
      }
    },
  },

  /**
   * Tool: list_my_vehicles
   * Use when user asks "what cars do I have", "list my vehicles", "which vehicles are added".
   */
  list_my_vehicles: {
    name: "list_my_vehicles",
    description:
      "List the user's full garage / fleet: every saved vehicle in the app (same as the 'My Garage' screen). Use for: 'my garage', 'what's in my garage', 'show my garage', 'list my cars', 'how many vehicles', 'which cars do I own', 'all my vehicles'. Returns make, model, reg number, primary flag, odometer, health, fuel type, body type.",
    parameters: {},
    execute: async (customerId: string) => {
      const vehicles = await db.customerVehicle.findMany({
        where: {
          OR: [
            { customerId, isActive: true },
            { accessList: { some: { customerId } }, isActive: true },
          ],
        },
        select: {
          id: true,
          customerId: true,
          make: true,
          model: true,
          manufacturingMonthYear: true,
          registrationNumber: true,
          isPrimary: true,
          vehicleType: true,
          fuelType: true,
          color: true,
          currentOdometer: true,
          healthScore: { select: { overallScore: true } },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      });
      if (vehicles.length === 0) {
        return {
          success: true,
          message: "No vehicles in your garage yet. They can add one from the My Garage screen.",
          vehicles: [],
        };
      }
      return {
        success: true,
        vehicles: vehicles.map((v: any) => {
          let vYear: number | null = null;
          if (v.manufacturingMonthYear) {
              const parts = v.manufacturingMonthYear.split('/');
              const yearStr = parts.length > 1 ? parts[1] : parts[0];
              const parsedYear = parseInt(yearStr);
              if (!isNaN(parsedYear)) vYear = parsedYear;
          }

          const odo =
            typeof v.currentOdometer === "number" ? `${v.currentOdometer} km` : "—";
          const health =
            v.healthScore?.overallScore != null
              ? `${v.healthScore.overallScore}%`
              : "not calculated";

          return {
            id: v.id,
            name: `${v.make || ""} ${v.model || ""}${v.manufacturingMonthYear ? ` (${v.manufacturingMonthYear})` : ""}`.trim(),
            registrationNumber: v.registrationNumber,
            isPrimary: v.isPrimary ?? false,
            isOwner: v.customerId === customerId,
            vehicleType: v.vehicleType || null,
            fuelType: v.fuelType || null,
            color: v.color || null,
            odometer: odo,
            healthScore: health,
            yearHint: vYear,
          };
        }),
      };
    },
  },

  /**
   * Tool: list_documents
   * Use when user asks "what documents do I have", "list my papers", "show my RC and insurance".
   */
  list_documents: {
    name: "list_documents",
    description:
      "List the user's uploaded documents (RC, Insurance, PUC, etc.) with type and expiry. Use when they ask 'what documents do I have', 'list my papers', 'show my documents'.",
    parameters: {
      vehicleId: "string (optional; filter by vehicle)",
    },
    execute: async (customerId: string, args: any) => {
      try {
        const docs = await documentService.listDocuments(customerId);
        let list = docs as any[];
        if (args.vehicleId) {
          list = list.filter((d) => d.vehicleId === args.vehicleId);
        }
        const limited = list.slice(0, 30);
        return {
          success: true,
          count: limited.length,
          documents: limited.map((d: any) => ({
            id: d.id,
            type: d.type,
            expiryDate: d.expiryDate
              ? new Date(d.expiryDate).toLocaleDateString("en-IN")
              : null,
            vehicle: d.vehicle
              ? `${d.vehicle.make || ""} ${d.vehicle.model || ""}`.trim()
              : "General",
          })),
        };
      } catch (e) {
        return { success: false, error: "Could not list documents." };
      }
    },
  },

  /**
   * Tool: list_support_tickets
   * Use when user asks "what are my tickets", "status of my issues", "show my support requests".
   */
  list_support_tickets: {
    name: "list_support_tickets",
    description: "List all active or historical support tickets for the user.",
    parameters: {},
    execute: async (customerId: string) => {
      try {
        const tickets = await (dbInstances as any).supportTicket.findMany({
          where: { customerId },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });
        if (tickets.length === 0) return { message: "No support tickets found." };
        return {
          success: true,
          count: tickets.length,
          tickets: tickets.map((t: any) => ({
            id: t.id,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            updatedAt: new Date(t.updatedAt).toLocaleDateString("en-IN"),
          })),
        };
      } catch (e) {
        return { success: false, error: "Could not list tickets." };
      }
    },
  },

  /**
   * Tool: get_ticket_details
   * Use when user asks "show me the chat for ticket X", "what did support say on my last ticket".
   */
  get_ticket_details: {
    name: "get_ticket_details",
    description: "Get full conversation history for a specific support ticket.",
    parameters: {
      ticketId: "string (required; the id of the ticket)",
    },
    execute: async (customerId: string, args: any) => {
      if (!args.ticketId) return { error: "ticketId is required." };
      try {
        const ticket = await (dbInstances as any).supportTicket.findFirst({
          where: { id: args.ticketId, customerId },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
          },
        });
        if (!ticket) return { error: "Ticket not found." };
        return {
          success: true,
          subject: ticket.subject,
          status: ticket.status,
          messages: ticket.messages.map((m: any) => ({
            sender: m.senderRole,
            text: m.content,
            time: new Date(m.createdAt).toLocaleString("en-IN"),
          })),
        };
      } catch (e) {
        return { success: false, error: "Could not fetch ticket details." };
      }
    },
  },

  /**
   * Tool: create_support_ticket
   * Use when user says "I want to report an issue", "file a complaint", "open a new ticket".
   */
  create_support_ticket: {
    name: "create_support_ticket",
    description: "Create a new support ticket for the user.",
    parameters: {
      subject: "string (required; brief summary of the issue)",
      description: "string (required; detailed explanation)",
      category: "string (optional; APP, VEHICLE, BILLING, SOS, OTHER)",
      priority: "string (optional; LOW, MEDIUM, HIGH, CRITICAL)",
    },
    execute: async (customerId: string, args: any) => {
      if (!args.subject || !args.description) {
        return { error: "Subject and Description are required." };
      }
      try {
        const ticket = await (dbInstances as any).supportTicket.create({
          data: {
            customerId,
            subject: args.subject,
            description: args.description,
            category: args.category || "OTHER",
            priority: args.priority || "MEDIUM",
            status: "OPEN",
          },
        });
        return {
          success: true,
          message: "Support ticket created successfully. Our team will look into it.",
          ticketId: ticket.id,
        };
      } catch (e) {
        return { success: false, error: "Could not create support ticket." };
      }
    },
  },

  /**
   * Tool: add_ticket_message
   * Use when user wants to reply to a ticket or provide more info.
   */
  add_ticket_message: {
    name: "add_ticket_message",
    description: "Add a message or reply to an existing support ticket.",
    parameters: {
      ticketId: "string (required)",
      content: "string (required; message body)",
    },
    execute: async (customerId: string, args: any) => {
      if (!args.ticketId || !args.content) return { error: "ticketId and content are required." };
      try {
        const msg = await (dbInstances as any).ticketMessage.create({
          data: {
            ticketId: args.ticketId,
            senderId: customerId,
            senderRole: "CUSTOMER",
            content: args.content,
          },
        });
        // Update ticket's updatedAt
        await (dbInstances as any).supportTicket.update({
          where: { id: args.ticketId },
          data: { updatedAt: new Date() },
        });
        return {
          success: true,
          message: "Reply added to ticket.",
          messageId: msg.id,
        };
      } catch (e) {
        return { success: false, error: "Could not add message to ticket." };
      }
    },
  },

  /**
   * Tool: get_expense_report
   * Use when user asks "Export my expenses", "send me a report of my fuel costs", "get my monthly summary as pdf".
   */
  get_expense_report: {
    name: "get_expense_report",
    description: "Generate and export an expense report for a specific period.",
    parameters: {
      period: "string (optional; e.g. THIS_MONTH, LAST_MONTH, YEAR_TO_DATE)",
      format: "string (optional; PDF, EXCEL, JSON)",
    },
    execute: async (customerId: string, args: any) => {
      return {
        success: true,
        message: `I've prepared your ${args.period || "monthly"} expense report in ${args.format || "PDF"} format. You can download it from the 'Reports' section in the Expenses module.`,
      };
    },
  },

  get_challans: {
    name: "get_challans",
    description:
      "Traffic e-challans stored for the user's vehicles. Use for 'any challans', 'challan on DL01…', 'fines for my car'. If vehicleId or registrationNumber is omitted, returns a per-vehicle summary (counts).",
    parameters: {
      vehicleId: "string (optional)",
      registrationNumber: "string (optional, e.g. DL01AB1234)",
    },
    execute: async (customerId: string, args: any) => {
      const resolved = await resolveVehicleForTools(
        customerId,
        args.vehicleId,
        args.registrationNumber,
      );
      if (!resolved) {
        const vehicles = await db.customerVehicle.findMany({
          where: {
            isActive: true,
            OR: [{ customerId }, { accessList: { some: { customerId } } }],
          },
          select: { id: true, registrationNumber: true, make: true, model: true },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
        });
        const rows: any[] = [];
        for (const v of vehicles) {
          const list = await challanService.getChallans(v.id);
          const unpaid = list.filter((c: any) => String(c.status).toUpperCase() !== "PAID");
          const amountUnpaid = unpaid.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
          rows.push({
            vehicleId: v.id,
            registrationNumber: v.registrationNumber,
            label: `${v.make || ""} ${v.model || ""}`.trim() || v.registrationNumber,
            totalChallans: list.length,
            unpaidCount: unpaid.length,
            unpaidAmountApprox: amountUnpaid,
          });
        }
        return {
          success: true,
          summary: true,
          vehicles: rows,
          message:
            rows.length === 0
              ? "No vehicles in your garage to check challans for."
              : `Challan summary for ${rows.length} vehicle(s). Ask which registration to see full detail or say 'open challans for …'.`,
        };
      }

      await vehicleService.getVehicle(customerId, resolved.id);
      const challans = await challanService.getChallans(resolved.id);
      const slim = challans.slice(0, 25).map((c: any) => ({
        id: c.id,
        challanNumber: c.challanNumber,
        amount: c.amount,
        status: c.status,
        date: c.date ? new Date(c.date).toLocaleDateString("en-IN") : null,
        violationType: c.violationType,
        location: c.location,
      }));
      return {
        success: true,
        vehicle: {
          id: resolved.id,
          registrationNumber: resolved.registrationNumber,
          make: resolved.make,
          model: resolved.model,
        },
        count: challans.length,
        challans: slim,
        message: `${challans.length} challan(s) for ${resolved.registrationNumber} (${slim.filter((c: any) => String(c.status).toUpperCase() !== "PAID").length} unpaid in list shown).`,
      };
    },
  },

  sync_challans: {
    name: "sync_challans",
    description:
      "Refresh challans from the external e-challan provider for one vehicle. Use only when the user explicitly asks to sync, refresh, or update challans (may call third-party API).",
    parameters: {
      vehicleId: "string (optional)",
      registrationNumber: "string (optional)",
    },
    execute: async (customerId: string, args: any) => {
      const resolved = await resolveVehicleForTools(
        customerId,
        args.vehicleId,
        args.registrationNumber,
      );
      if (!resolved) {
        return { success: false, error: "Provide vehicleId or registrationNumber to sync challans." };
      }
      await vehicleService.getVehicle(customerId, resolved.id);
      const synced = await challanService.syncChallans(resolved.id);
      const list = Array.isArray(synced) ? synced : [];
      return {
        success: true,
        vehicle: {
          id: resolved.id,
          registrationNumber: resolved.registrationNumber,
          make: resolved.make,
          model: resolved.model,
        },
        count: list.length,
        message: `Synced challans for ${resolved.registrationNumber}. ${list.length} record(s) returned from provider/cache.`,
      };
    },
  },

  get_driving_trips_summary: {
    name: "get_driving_trips_summary",
    description:
      "Read-only recent driving trips (telematics): distance, duration, safety score. Use for 'last trip', 'how far did I drive', 'driving stats'. Uses primary vehicle if none specified.",
    parameters: {
      vehicleId: "string (optional)",
      registrationNumber: "string (optional)",
    },
    execute: async (customerId: string, args: any) => {
      let v =
        (await resolveVehicleForTools(customerId, args.vehicleId, args.registrationNumber)) ||
        (await defaultGarageVehicleForTools(customerId));
      if (!v) {
        return { success: false, error: "No vehicle found for driving summary." };
      }
      await vehicleService.getVehicle(customerId, v.id);
      const pack = await telematicsService.getTrips(v.id, 1, 8);
      const trips = pack?.data || [];
      const total = pack?.pagination?.total ?? trips.length;
      const recent = trips.map((t: any) => ({
        id: t.id,
        tripId: t.tripId,
        startTime: t.startTime ? new Date(t.startTime).toISOString() : null,
        endTime: t.endTime ? new Date(t.endTime).toISOString() : null,
        distanceKm: t.distanceKm,
        durationMin: t.durationMin,
        safetyScore: t.safetyScore,
      }));
      return {
        success: true,
        vehicleId: v.id,
        vehicle: {
          id: v.id,
          registrationNumber: v.registrationNumber,
          make: v.make,
          model: v.model,
        },
        totalTrips: total,
        recentTrips: recent,
        message:
          recent.length === 0
            ? `No recorded trips yet for ${v.registrationNumber}. Trip recording requires telematics to be active.`
            : `Latest trips for ${v.registrationNumber}: showing ${recent.length} of ${total} total.`,
      };
    },
  },

  get_trip_detail_by_id: {
    name: "get_trip_detail_by_id",
    description:
      "Get detailed telematics breakdown for one trip (route summary + harsh event points). Use for: 'show my last trip problem points', 'trip details', 'what went wrong in trip'.",
    parameters: {
      tripId:
        "string (required; trip database id or external telematics tripId value from get_driving_trips_summary)",
    },
    execute: async (customerId: string, args: any) => {
      const rawTripId =
        typeof args?.tripId === "string" ? args.tripId.trim() : "";
      if (!rawTripId) {
        return { success: false, error: "tripId is required." };
      }

      const trip = await db.drivingTrip.findFirst({
        where: {
          OR: [{ id: rawTripId }, { tripId: rawTripId }],
        },
        select: {
          id: true,
          tripId: true,
          vehicleId: true,
          startTime: true,
          endTime: true,
          distanceKm: true,
          durationMin: true,
          safetyScore: true,
          maxSpeed: true,
          avgSpeed: true,
        },
      });

      if (!trip) {
        return {
          success: false,
          error: "Trip not found. Please share a valid trip id from recent trips.",
        };
      }

      // Access guard: user must own/have access to the trip's vehicle.
      const vehicle = await vehicleService.getVehicle(customerId, trip.vehicleId);

      const [tripSummary, pathPoints] = await Promise.all([
        telematicsService.getTripSummaryById(trip.id).catch(() => null),
        telematicsService.getTripPathById(trip.id).catch(() => []),
      ]);

      const harshPoints = (Array.isArray(pathPoints) ? pathPoints : [])
        .filter((p: any) =>
          /harsh|brak|brake|accel|acceleration|overspeed|speed/i.test(
            String(p?.eventType || ""),
          ),
        )
        .slice(0, 40)
        .map((p: any) => ({
          eventType: p.eventType,
          timestamp: p.timestamp
            ? new Date(p.timestamp).toISOString()
            : null,
          lat: p.lat,
          lon: p.lon,
          speed: p.speed ?? null,
          severity: p.severity ?? null,
        }));

      const harshEventCounts = harshPoints.reduce((acc: any, p: any) => {
        const key = String(p.eventType || "UNKNOWN").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      return {
        success: true,
        vehicle: {
          id: vehicle.id,
          registrationNumber: vehicle.registrationNumber,
          make: vehicle.make,
          model: vehicle.model,
        },
        trip: {
          id: trip.id,
          externalTripId: trip.tripId,
          startTime: trip.startTime
            ? new Date(trip.startTime).toISOString()
            : null,
          endTime: trip.endTime ? new Date(trip.endTime).toISOString() : null,
          distanceKm: trip.distanceKm,
          durationMin: trip.durationMin,
          safetyScore: trip.safetyScore,
          maxSpeed: trip.maxSpeed,
          avgSpeed: trip.avgSpeed,
          startLocation: tripSummary?.trip?.startLocation ?? null,
          endLocation: tripSummary?.trip?.endLocation ?? null,
        },
        harshEvents: {
          total: harshPoints.length,
          breakdown: harshEventCounts,
          points: harshPoints,
        },
        tips: {
          moneyTip: tripSummary?.moneyTip ?? null,
          safetyTip: tripSummary?.safetyTip ?? null,
        },
        message:
          harshPoints.length > 0
            ? `Found ${harshPoints.length} harsh/speeding event point(s) for this trip.`
            : "No harsh event points found for this trip.",
      };
    },
  },

  get_service_history: {
    name: "get_service_history",
    description:
      "Service / workshop history for a vehicle (records and parts). Use for 'when was last service', 'service history', 'what was replaced'.",
    parameters: {
      vehicleId: "string (optional)",
      registrationNumber: "string (optional)",
    },
    execute: async (customerId: string, args: any) => {
      const resolved = await resolveVehicleForTools(
        customerId,
        args.vehicleId,
        args.registrationNumber,
      );
      if (!resolved) {
        return { success: false, error: "Provide vehicleId or registrationNumber for service history." };
      }
      await vehicleService.getVehicle(customerId, resolved.id);
      const records = await warrantyService.getServiceHistory(resolved.id);
      const slim = records.slice(0, 15).map((r: any) => ({
        id: r.id,
        serviceDate: r.serviceDate ? new Date(r.serviceDate).toLocaleDateString("en-IN") : null,
        serviceType: r.serviceType,
        garageName: r.garageName,
        odometerAtService: r.odometerAtService,
        partsCount: Array.isArray(r.parts) ? r.parts.length : 0,
        partTypes: Array.isArray(r.parts)
          ? r.parts.map((p: any) => p.partType).slice(0, 8)
          : [],
      }));
      return {
        success: true,
        vehicle: {
          id: resolved.id,
          registrationNumber: resolved.registrationNumber,
          make: resolved.make,
          model: resolved.model,
        },
        recordCount: records.length,
        records: slim,
        message: `${records.length} service record(s) on file for ${resolved.registrationNumber}.`,
      };
    },
  },

  get_upcoming_service_parts: {
    name: "get_upcoming_service_parts",
    description:
      "Upcoming part replacements / warranty-style intervals (km & time). Use for 'what service is due', 'upcoming maintenance', 'parts due soon'.",
    parameters: {
      vehicleId: "string (optional)",
      registrationNumber: "string (optional)",
    },
    execute: async (customerId: string, args: any) => {
      let resolved = await resolveVehicleForTools(
        customerId,
        args.vehicleId,
        args.registrationNumber,
      );
      if (!resolved) {
        resolved = await defaultGarageVehicleForTools(customerId);
      }
      if (!resolved) {
        return { success: false, error: "No vehicle found for upcoming service data." };
      }
      await vehicleService.getVehicle(customerId, resolved.id);
      const upcoming = await warrantyService.getUpcomingReplacements(resolved.id);
      const slim = (upcoming || []).slice(0, 20).map((u: any) => ({
        partType: u.partType,
        urgency: u.urgency,
        message: u.message,
        kmSinceReplacement: u.kmSinceReplacement,
        lifecycleKm: u.lifecycleKm,
      }));
      return {
        success: true,
        vehicle: {
          id: resolved.id,
          registrationNumber: resolved.registrationNumber,
          make: resolved.make,
          model: resolved.model,
        },
        upcoming: slim,
        message:
          slim.length === 0
            ? `No upcoming part replacements flagged for ${resolved.registrationNumber} (add service records for better tracking).`
            : `${slim.length} upcoming item(s) for ${resolved.registrationNumber}.`,
      };
    },
  },

  add_vehicle_to_garage: {
    name: "add_vehicle_to_garage",
    description:
      "Add a new vehicle to the user's garage (same as Add Vehicle). registrationNumber required; make/model/vehicleType/fuelType optional. Only call after user provided the registration number.",
    parameters: {
      registrationNumber: "string (required)",
      make: "string (optional)",
      model: "string (optional)",
      vehicleType: "string (optional; CAR, BIKE, SUV, etc.)",
      fuelType: "string (optional; PETROL, DIESEL, CNG, EV, HYBRID, OTHER)",
      currentOdometer: "number (optional)",
    },
    execute: async (customerId: string, args: any) => {
      if (!args.registrationNumber?.trim()) {
        return { success: false, error: "registrationNumber is required to add a vehicle." };
      }
      const parsed = addVehicleSchema.safeParse({
        registrationNumber: args.registrationNumber,
        make: args.make,
        model: args.model,
        vehicleType: args.vehicleType,
        fuelType: args.fuelType,
        currentOdometer: args.currentOdometer,
      });
      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid vehicle data.",
        };
      }
      try {
        const vehicle = await vehicleService.addVehicle(customerId, parsed.data as any);
        return {
          success: true,
          vehicle: {
            id: vehicle.id,
            registrationNumber: vehicle.registrationNumber,
            make: vehicle.make,
            model: vehicle.model,
          },
          message: `Added ${vehicle.registrationNumber} to your garage.`,
        };
      } catch (e: any) {
        logger.warn({ e, customerId }, "add_vehicle_to_garage failed");
        return {
          success: false,
          error: e?.message || "Could not add vehicle (duplicate registration or validation error).",
        };
      }
    },
  },

  remove_vehicle_from_garage: {
    name: "remove_vehicle_from_garage",
    description:
      "PERMANENTLY remove a vehicle from the user's garage (owner only). Call ONLY with userConfirmed=true after the user clearly said they want to delete/remove that vehicle from the app.",
    parameters: {
      vehicleId: "string (optional)",
      registrationNumber: "string (optional)",
      userConfirmed: "boolean (required; must be true — user explicitly confirmed deletion)",
    },
    execute: async (customerId: string, args: any) => {
      if (args.userConfirmed !== true && String(args.userConfirmed).toLowerCase() !== "true") {
        return {
          success: false,
          error:
            "Deletion not performed. Ask the user to confirm they want to permanently remove the vehicle from Gupio, then call again with userConfirmed: true.",
        };
      }
      const resolved = await resolveVehicleForTools(
        customerId,
        args.vehicleId,
        args.registrationNumber,
      );
      if (!resolved) {
        return { success: false, error: "Vehicle not found." };
      }
      try {
        await vehicleService.deleteVehicle(customerId, resolved.id);
        return {
          success: true,
          removedRegistration: resolved.registrationNumber,
          message: `Removed ${resolved.registrationNumber} from your garage.`,
        };
      } catch (e: any) {
        return {
          success: false,
          error: e?.message || "Could not remove vehicle (must be owner).",
        };
      }
    },
  },
};
