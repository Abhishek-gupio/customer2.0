import { z } from "zod";

// Expense enums (mirrors Prisma schema — self-contained to avoid import issues)
export const ExpenseCategory = {
  FUEL: "FUEL",
  TOLL: "TOLL",
  PARKING: "PARKING",
  SERVICE: "SERVICE",
  INSURANCE: "INSURANCE",
  CHALLAN: "CHALLAN",
  EMI: "EMI",
  OTHER: "OTHER",
} as const;

export const ExpenseSource = {
  MANUAL: "MANUAL",
  SMS: "SMS",
  NOTIFICATION: "NOTIFICATION",
  VOICE: "VOICE",
  RECEIPT: "RECEIPT",
  UPI: "UPI",
} as const;

export type ExpenseCategory =
  (typeof ExpenseCategory)[keyof typeof ExpenseCategory];
export type ExpenseSource = (typeof ExpenseSource)[keyof typeof ExpenseSource];

export const createExpenseSchema = z.object({
  vehicleId: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  category: z.enum([
    "FUEL",
    "TOLL",
    "PARKING",
    "SERVICE",
    "INSURANCE",
    "CHALLAN",
    "EMI",
    "OTHER",
  ]),
  date: z.string().datetime().optional(),
  merchantName: z.string().optional(),
  // Free-text location fallback (e.g. "Indiranagar, Bangalore")
  location: z.string().optional(),
  // Structured Google Places payload (driver spends → owner audit)
  placeId: z.string().optional(),
  placeName: z.string().optional(),
  placeAddress: z.string().optional(),
  placeLat: z.number().optional(),
  placeLng: z.number().optional(),
  notes: z.string().optional(),
  source: z
    .enum(["MANUAL", "SMS", "NOTIFICATION", "VOICE", "RECEIPT", "UPI"])
    .optional()
    .default("MANUAL"),
  odometerReading: z.number().optional(),
  receiptUrl: z.string().optional(),
  mimeType: z.string().optional(),
  parts: z
    .array(
      z.object({
        partType: z.string().min(1),
        partName: z.string().optional(),
        brand: z.string().optional(),
        cost: z.number().optional(),
        warrantyMonths: z.number().optional(),
        warrantyKm: z.number().optional(),
      }),
    )
    .optional(),
});

export const updateExpenseSchema = z.object({
  vehicleId: z.string().optional(),
  amount: z.number().positive().optional(),
  category: z
    .enum([
      "FUEL",
      "TOLL",
      "PARKING",
      "SERVICE",
      "INSURANCE",
      "CHALLAN",
      "EMI",
      "OTHER",
    ])
    .optional(),
  date: z.string().datetime().optional(),
  merchantName: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const parseExpenseSchema = z.object({
  text: z.string().min(1, "Text is required"),
  source: z
    .enum(["MANUAL", "SMS", "NOTIFICATION", "VOICE", "RECEIPT", "UPI"])
    .optional()
    .default("SMS"),
  timestamp: z.string().datetime().optional(),
});

export const expenseBudgetSchema = z.object({
  category: z.enum([
    "FUEL",
    "TOLL",
    "PARKING",
    "SERVICE",
    "INSURANCE",
    "CHALLAN",
    "EMI",
    "OTHER",
  ]),
  amount: z.number().positive(),
  period: z.enum(["WEEKLY", "MONTHLY"]).default("MONTHLY"),
  notifyThreshold: z.number().min(1).max(100).default(80),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ParseExpenseInput = z.infer<typeof parseExpenseSchema>;
export type ExpenseBudgetInput = z.infer<typeof expenseBudgetSchema>;
