import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { expenseService } from "../modules/expense/expense.service";
import { CreateExpenseInput, ExpenseCategory } from "../modules/expense/expense.validators";
import { warrantyService } from "./warranty.service";
import { documentService } from "../modules/document/document.service";

const db = dbInstances as any;

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
            category: "string (FUEL, TOLL, SERVICE, PARKING, INSURANCE, CHALLAN, OTHER) (required)",
            merchantName: "string (optional, e.g. Shell, McDonald's)",
            location: "string (optional, e.g. Delhi, Mumbai)",
            notes: "string (optional)",
            date: "string (optional, ISO format or natural lang like 'yesterday')",
            vehicleId: "string (optional ID)",
            registrationNumber: "string (optional, e.g. DL01AB1234)"
        },
        execute: async (customerId: string, args: any) => {
            // Validate basic inputs
            if (!args.amount || !args.category) {
                return { success: false, error: "Amount and Category are required." };
            }

            // Map AI category to Enum if needed
            const validCategories = ["FUEL", "TOLL", "SERVICE", "PARKING", "INSURANCE", "CHALLAN", "EMI", "OTHER"];
            const category = validCategories.includes(args.category.toUpperCase())
                ? args.category.toUpperCase() as ExpenseCategory
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
                    where: { customerId, registrationNumber: { contains: args.registrationNumber.replace(/\s/g, ''), mode: 'insensitive' } },
                    select: { id: true }
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
                source: "VOICE"
            };

            const result = await expenseService.createExpense(customerId, input);
            const successMessage = `Expense of ₹${result.expense.amount} for ${result.expense.category} added successfully.`;

            // Update the expense notes with the success message for better record keeping
            await db.expense.update({
                where: { id: result.expense.id },
                data: { notes: input.notes ? `${input.notes} | ${successMessage}` : successMessage }
            });

            return {
                success: true,
                message: successMessage,
                expenseId: result.expense.id
            };
        }
    },

    /**
     * Tool: update_expense
     * Use when user says "Change my last fuel amount to 600" or "Correct that merchant name"
     */
    update_expense: {
        name: "update_expense",
        description: "Update an existing expense record. Provide the expenseId or the AI will try to find the last one.",
        parameters: {
            expenseId: "string (optional, will use last if not provided)",
            amount: "number (optional)",
            category: "string (optional)",
            merchantName: "string (optional)",
            location: "string (optional)",
            notes: "string (optional)"
        },
        execute: async (customerId: string, args: any) => {
            let id = args.expenseId;

            // If no ID, find the latest expense for this user
            if (!id) {
                const latest = await db.expense.findFirst({
                    where: { customerId },
                    orderBy: { createdAt: "desc" },
                    select: { id: true }
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
                data
            });

            const successMessage = `Expense updated successfully. New amount: ₹${updated.amount}`;

            // Store the update message in the record
            await db.expense.update({
                where: { id, customerId },
                data: { notes: successMessage }
            });

            return {
                success: true,
                message: successMessage,
                updatedFields: Object.keys(data)
            };
        }
    },

    /**
     * Tool: get_vehicle_status
     * Use when user asks about car health, odometer, or status.
     */
    get_vehicle_status: {
        name: "get_vehicle_status",
        description: "Get status, odometer, and health of a specific vehicle",
        parameters: {
            vehicleId: "string (optional, usually inferred from context)", // If null, fetches all
            registrationNumber: "string (optional)"
        },
        execute: async (customerId: string, args: any) => {
            const where: any = { customerId, isActive: true };

            if (args.vehicleId) {
                where.id = args.vehicleId;
            } else if (args.registrationNumber) {
                where.registrationNumber = { contains: args.registrationNumber.replace(/\s/g, ''), mode: 'insensitive' };
            }

            const vehicles = await db.customerVehicle.findMany({
                where,
                select: {
                    id: true,
                    make: true,
                    model: true,
                    registrationNumber: true,
                    currentOdometer: true,
                    fuelType: true,
                    healthScore: { select: { overallScore: true } }
                }
            });

            if (vehicles.length === 0) return { message: "No active vehicles found." };

            return {
                success: true,
                vehicles: vehicles.map((v: any) => ({
                    name: `${v.make} ${v.model} (${v.registrationNumber})`,
                    odometer: `${v.currentOdometer} km`,
                    fuel: v.fuelType,
                    health: v.healthScore ? `${v.healthScore.overallScore}%` : "Not calculated"
                }))
            };
        }
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
            amount: "number"
        },
        execute: async (customerId: string, args: any) => {
            if (!args.category || !args.amount) {
                return { error: "Category and Amount required." };
            }

            await expenseService.setBudget(customerId, {
                category: args.category.toUpperCase(),
                amount: parseFloat(args.amount),
                period: "MONTHLY",
                notifyThreshold: 80 // Default to 80% notification
            });

            return { success: true, message: `Monthly budget of ₹${args.amount} set for ${args.category}.` };
        }
    },

    /**
     * Tool: get_expenses_summary
     * Use when user asks "How much did I spend?" or "Show my fuel costs"
     */
    get_expenses_summary: {
        name: "get_expenses_summary",
        description: "Get a summary of expenses by category or a total for a period",
        parameters: {
            category: "string (optional, e.g. FUEL)",
            days: "number (optional, default 30 days)"
        },
        execute: async (customerId: string, args: any) => {
            const days = args.days || 30;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const where: any = {
                customerId,
                date: { gte: startDate }
            };
            if (args.category) {
                where.category = args.category.toUpperCase();
            }

            const expenses = await db.expense.findMany({
                where,
                select: { amount: true, category: true, date: true }
            });

            if (expenses.length === 0) return { message: `No expenses found for the last ${days} days.` };

            const total = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
            const breakdown = expenses.reduce((acc: any, e: any) => {
                acc[e.category] = (acc[e.category] || 0) + e.amount;
                return acc;
            }, {});

            return {
                success: true,
                total: `₹${total}`,
                period: `Last ${days} days`,
                breakdown
            };
        }
    },

    /**
     * Tool: get_maintenance_advisor
     * Use when user asks "Is my car ready for a trip?" or "Show my car health"
     */
    get_maintenance_advisor: {
        name: "get_maintenance_advisor",
        description: "Analyze vehicle health, part warranty, and upcoming service needs",
        parameters: {
            vehicleId: "string (optional)"
        },
        execute: async (customerId: string, args: any) => {
            const vehicle = await db.customerVehicle.findFirst({
                where: args.vehicleId ? { id: args.vehicleId, customerId } : { customerId, isActive: true },
                select: { id: true, make: true, model: true }
            });

            if (!vehicle) return { error: "No vehicle found to analyze." };

            const [warranty, replacements, adr] = await Promise.all([
                warrantyService.getWarrantyStatus(vehicle.id),
                warrantyService.getUpcomingReplacements(vehicle.id),
                warrantyService.calculateAverageDailyRunning(vehicle.id)
            ]);

            return {
                success: true,
                vehicle: `${vehicle.make} ${vehicle.model}`,
                averageDailyRunning: `${Math.round(adr)} km/day`,
                urgentIssues: replacements.filter(r => r.urgency === "OVERDUE").map(r => r.message),
                upcomingService: replacements.filter(r => r.urgency !== "OVERDUE").map(r => r.message),
                warrantyStatus: {
                    active: warranty.active.length,
                    expiringSoon: warranty.expiring.map(e => e.message),
                    expiredCount: warranty.expired.length
                }
            };
        }
    },

    /**
     * Tool: get_document_status
     * Use when user asks "When is my RC expiring?" or "Are my papers clear?"
     */
    get_document_status: {
        name: "get_document_status",
        description: "Check status and expiry of vehicle documents (RC, Insurance, PUC)",
        parameters: {
            vehicleId: "string (optional)"
        },
        execute: async (customerId: string, args: any) => {
            const docs = await db.customerDocument.findMany({
                where: {
                    customerId,
                    vehicleId: args.vehicleId || undefined,
                    verificationStatus: "VERIFIED"
                },
                select: { type: true, expiryDate: true, documentNumber: true, vehicle: { select: { make: true, model: true } } }
            });

            if (docs.length === 0) return { message: "No verified documents found." };

            const now = new Date();
            const status = docs.map((d: any) => {
                const isExpired = d.expiryDate && new Date(d.expiryDate) < now;
                return {
                    type: d.type,
                    vehicle: d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}` : "General",
                    expiry: d.expiryDate ? new Date(d.expiryDate).toLocaleDateString("en-IN") : "No expiry set",
                    status: isExpired ? "Expired" : "Valid"
                };
            });

            return { success: true, documents: status };
        }
    },

    /**
     * Tool: get_smart_recommendations
     * Use when user asks "How can I save money?" or "Give me some tips"
     */
    get_smart_recommendations: {
        name: "get_smart_recommendations",
        description: "Get personalized AI recommendations to save fuel, money, or improve car health",
        parameters: {},
        execute: async (customerId: string) => {
            const [vehicles, expenses] = await Promise.all([
                db.customerVehicle.findMany({ where: { customerId, isActive: true }, include: { healthScore: true } }),
                db.expense.findMany({ where: { customerId, category: "FUEL" }, orderBy: { date: "desc" }, take: 5 })
            ]);

            const recs = [];

            // 1. Health based
            for (const v of vehicles) {
                if (v.healthScore && v.healthScore.overallScore < 70) {
                    recs.push(`⚠️ Your ${v.make} ${v.model} has a low health score (${v.healthScore.overallScore}). We recommend a full checkup.`);
                }
            }

            // 2. Fuel based
            if (expenses.length >= 2) {
                recs.push("💡 We noticed your fuel frequency increased. Consider checking tyre pressure to improve mileage.");
            }

            // 3. Document based (fallback)
            recs.push("🔍 Reminder: Regularly uploading service bills helps me predict your part lifecycle better.");

            return {
                success: true,
                recommendations: recs
            };
        }
    }
};
