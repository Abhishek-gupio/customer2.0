import { api, doRefresh } from './api';
import { API_BASE_URL } from '../config';
import { getAccessToken, getPrimaryVehicleId } from './storage';
import { vehicleService, type Vehicle } from './vehicleService';
import { setWarrantyStatusNeedsRefresh } from '../utils/refreshManager';
import { useExpenseStore } from '../store/expenseStore';
import { listDocuments, type DocumentResponse } from './documentService';
import { getProfile, updateProfile, type ProfileResponse, type UpdateProfilePayload } from './profileService';
import { getDeviceLocation, isPreciseFix } from './deviceLocation';
import { placesService, type NearbyPlaceType } from './placesService';
import { sosService, type SOSType } from './sosService';

// ============================================================================
// Types
// ============================================================================
export interface ChatMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    metadata?: {
        voiceUrl?: string;
        toolResults?: any[];
        agentSteps?: any[];
        hadImage?: boolean;
    };
    createdAt: string;
}

export interface ChatSession {
    id: string;
    title: string;
    updatedAt: string;
}

export interface SuggestedAction {
    label: string;
    prompt: string;
    /** When set, the app navigates instead of sending `prompt` as a new AI message. */
    navigate?: {
        screen: string;
        params?: Record<string, unknown>;
    };
}

export interface ChatResponse {
    data: {
        sessionId?: string;
        message: string;
        voiceUrl?: string | null;
        contextUsed: number;
        toolResults?: any[];
        agentSteps?: any[];
        suggestedActions?: SuggestedAction[];
        navigate?: { screen: string; params?: Record<string, unknown> };
    };
}

export interface SessionsResponse {
    data: ChatSession[];
}

export interface HistoryResponse {
    data: {
        id: string;
        title: string;
        summary?: string;
        messages: ChatMessage[];
    };
}

export interface AnalyticsResponse {
    data: {
        period: string;
        totalInteractions: number;
        avgResponseTimeMs: number;
        toolUsage: { tool: string; count: number }[];
        feedback: {
            thumbsUp: number;
            thumbsDown: number;
            satisfactionRate: number | null;
        };
        dailyUsage: { date: string; count: number }[];
    };
}

// SSE chunk types
export interface SSEChunk {
    type: 'session' | 'chunk' | 'tool_start' | 'tool_result' | 'tool_error' | 'done' | 'error';
    sessionId?: string;
    text?: string;
    tool?: string;
    message?: string;
    result?: any;
    error?: string;
    voiceUrl?: string;
    contextUsed?: number;
    toolResults?: any[];
    suggestedActions?: SuggestedAction[];
    navigate?: { screen: string; params?: Record<string, unknown> };
}

type ChatVehicleContext = {
    id: string;
    registrationNumber: string;
    make?: string;
    model?: string;
    fuelType?: string;
    vehicleType?: string;
    currentOdometer?: number;
    color?: string;
    registrationDate?: string;
    manufacturingMonthYear?: string;
    engineNumber?: string;
    chassisNumber?: string;
    ownerName?: string;
    rto?: string;
    vehicleClass?: string;
    insuranceUpto?: string;
    pollutionUpto?: string;
    fitnessUpto?: string;
    rcStatus?: string;
    mileage?: string;
    healthScore?: number;
    rtoDetails?: any;
};

type MonthlyExpenseContext = {
    monthLabel: string;
    total: number;
    count: number;
    categories: Array<{ category: string; total: number; count: number }>;
    recentItems: Array<{ category: string; amount: number; date: string }>;
};

type VehicleDocumentContext = {
    total: number;
    documents: Array<{
        type: string;
        documentNumber: string | null;
        expiryDate?: string | null;
        issueDate?: string | null;
        verificationStatus?: string;
    }>;
};

type LocalChatResolution = {
    sessionId?: string;
    message: string;
    voiceUrl?: null;
    contextUsed: number;
    toolResults?: any[];
    agentSteps?: any[];
    suggestedActions?: SuggestedAction[];
    navigate?: { screen: string; params?: Record<string, unknown> };
};

type ProfileUpdateIntent = {
    payload: UpdateProfilePayload;
    confirmation: string;
};

type VehicleFactAnswer = {
    value?: string | number | null;
    fallback: string;
    label: string;
};

const normalizeSelectedPartTypes = (partTypes: string[]): string[] => {
    const normalized = new Set<string>();

    for (const partType of partTypes) {
        const value = String(partType || '').trim().toUpperCase();
        if (!value) continue;

        if (value === 'TYRES') {
            normalized.add('TYRES_FRONT');
            normalized.add('TYRES_REAR');
            continue;
        }

        normalized.add(value);
    }

    return Array.from(normalized);
};

type EmergencyIntent = {
    type: SOSType;
    message?: string;
};

type ChatUserContext = {
    id: string;
    fullName?: string;
    phoneNumber?: string;
    email?: string;
    createdAt?: string;
};

let primaryVehicleCache:
    | {
        vehicle: ChatVehicleContext | null;
        fetchedAt: number;
    }
    | null = null;

let vehicleCountCache:
    | {
        count: number;
        fetchedAt: number;
    }
    | null = null;

const PRIMARY_VEHICLE_CACHE_TTL_MS = 60_000;
let userProfileCache:
    | {
        profile: ChatUserContext | null;
        fetchedAt: number;
    }
    | null = null;

function getEffectiveUserMessage(message: string): string {
    const trimmed = message.trim();
    if (!trimmed) return trimmed;

    const match = trimmed.match(/user (?:request|message):\s*([\s\S]*)$/i);
    return match?.[1]?.trim() || trimmed;
}

function pickPrimaryVehicle(list: Vehicle[]): Vehicle | null {
    if (!Array.isArray(list) || list.length === 0) return null;
    const cachedPrimaryId = getPrimaryVehicleId();
    return (
        list.find((vehicle) => vehicle?.isPrimary) ||
        (cachedPrimaryId ? list.find((vehicle) => vehicle?.id === cachedPrimaryId) : null) ||
        list[0] ||
        null
    );
}

function mapVehicleContext(vehicle: Vehicle | null): ChatVehicleContext | null {
    if (!vehicle?.id || !vehicle?.registrationNumber) return null;
    return {
        id: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        fuelType: vehicle.fuelType,
        vehicleType: vehicle.vehicleType,
        currentOdometer: vehicle.currentOdometer,
        color: vehicle.color,
        registrationDate: vehicle.registrationDate,
        manufacturingMonthYear: vehicle.manufacturingMonthYear,
        engineNumber: vehicle.engineNumber,
        chassisNumber: vehicle.chassisNumber,
        ownerName: vehicle.ownerName,
        rto: vehicle.rto,
        vehicleClass: vehicle.vehicleClass,
        insuranceUpto: vehicle.insuranceUpto,
        pollutionUpto: vehicle.pollutionUpto,
        fitnessUpto: vehicle.fitnessUpto,
        rcStatus: vehicle.rcStatus,
        mileage: vehicle.mileage,
        healthScore: vehicle.healthScore?.overallScore,
        rtoDetails: vehicle.rtoDetails,
    };
}

async function getPrimaryVehicleContext(forceRefresh = false): Promise<ChatVehicleContext | null> {
    const now = Date.now();
    if (
        !forceRefresh &&
        primaryVehicleCache &&
        now - primaryVehicleCache.fetchedAt < PRIMARY_VEHICLE_CACHE_TTL_MS
    ) {
        return primaryVehicleCache.vehicle;
    }

    try {
        const vehicles = await vehicleService.getVehicles();
        const primaryVehicle = mapVehicleContext(pickPrimaryVehicle(vehicles));
        primaryVehicleCache = {
            vehicle: primaryVehicle,
            fetchedAt: now,
        };
        return primaryVehicle;
    } catch {
        return primaryVehicleCache?.vehicle ?? null;
    }
}

async function getVehicleCount(forceRefresh = false): Promise<number | null> {
    const now = Date.now();
    if (
        !forceRefresh &&
        vehicleCountCache &&
        now - vehicleCountCache.fetchedAt < PRIMARY_VEHICLE_CACHE_TTL_MS
    ) {
        return vehicleCountCache.count;
    }

    try {
        const vehicles = await vehicleService.getVehicles();
        const count = Array.isArray(vehicles) ? vehicles.length : 0;
        vehicleCountCache = {
            count,
            fetchedAt: now,
        };
        return count;
    } catch {
        return vehicleCountCache?.count ?? null;
    }
}

function mapUserContext(profile: ProfileResponse | null): ChatUserContext | null {
    if (!profile?.id) return null;
    return {
        id: profile.id,
        fullName: profile.fullName,
        phoneNumber: profile.phoneNumber,
        email: profile.email,
        createdAt: profile.createdAt,
    };
}

async function getUserContext(forceRefresh = false): Promise<ChatUserContext | null> {
    const now = Date.now();
    if (
        !forceRefresh &&
        userProfileCache &&
        now - userProfileCache.fetchedAt < PRIMARY_VEHICLE_CACHE_TTL_MS
    ) {
        return userProfileCache.profile;
    }

    try {
        const profile = mapUserContext(await getProfile());
        userProfileCache = {
            profile,
            fetchedAt: now,
        };
        return profile;
    } catch {
        return userProfileCache?.profile ?? null;
    }
}

function buildVehicleScopedMessage(message: string, vehicle: ChatVehicleContext | null): string {
    const trimmedMessage = getEffectiveUserMessage(message);
    if (!trimmedMessage || !vehicle) return trimmedMessage;

    const vehicleSummary = [
        `Vehicle ID: ${vehicle.id}`,
        `Registration Number: ${vehicle.registrationNumber}`,
        vehicle.make ? `Make: ${vehicle.make}` : null,
        vehicle.model ? `Model: ${vehicle.model}` : null,
        vehicle.vehicleType ? `Vehicle Type: ${vehicle.vehicleType}` : null,
        vehicle.fuelType ? `Fuel Type: ${vehicle.fuelType}` : null,
        typeof vehicle.currentOdometer === 'number' ? `Current Odometer: ${vehicle.currentOdometer}` : null,
        vehicle.color ? `Color: ${vehicle.color}` : null,
        vehicle.registrationDate ? `Registration Date: ${vehicle.registrationDate}` : null,
        vehicle.manufacturingMonthYear ? `Manufacturing Month/Year: ${vehicle.manufacturingMonthYear}` : null,
        vehicle.engineNumber ? `Engine Number: ${vehicle.engineNumber}` : null,
        vehicle.chassisNumber ? `Chassis Number: ${vehicle.chassisNumber}` : null,
        vehicle.ownerName ? `Owner Name: ${vehicle.ownerName}` : null,
        vehicle.rto ? `RTO: ${vehicle.rto}` : null,
        vehicle.vehicleClass ? `Vehicle Class: ${vehicle.vehicleClass}` : null,
        vehicle.insuranceUpto ? `Insurance Valid Upto: ${vehicle.insuranceUpto}` : null,
        vehicle.pollutionUpto ? `PUC Valid Upto: ${vehicle.pollutionUpto}` : null,
        vehicle.fitnessUpto ? `Fitness Valid Upto: ${vehicle.fitnessUpto}` : null,
        vehicle.rcStatus ? `RC Status: ${vehicle.rcStatus}` : null,
        vehicle.mileage ? `Mileage: ${vehicle.mileage}` : null,
        typeof vehicle.healthScore === 'number' ? `Health Score: ${vehicle.healthScore}` : null,
    ]
        .filter(Boolean)
        .join('\n');

    const extraVehicleDetails = vehicle.rtoDetails
        ? `Additional primary vehicle details (JSON): ${JSON.stringify(vehicle.rtoDetails)}`
        : null;

    return [
        'System instruction: Reply using only the selected primary vehicle details below.',
        'Do not answer with other vehicles, generic fleet data, or cross-vehicle comparisons.',
        'If the request needs data beyond this vehicle, say that only the selected primary vehicle is in scope.',
        '',
        'Selected primary vehicle:',
        vehicleSummary,
        extraVehicleDetails ?? '',
        '',
        `User request: ${trimmedMessage}`,
    ].filter(Boolean).join('\n');
}

function buildUserScopedMessage(message: string, user: ChatUserContext | null): string {
    const trimmedMessage = getEffectiveUserMessage(message);
    if (!trimmedMessage || !user) return trimmedMessage;

    const userSummary = [
        `User ID: ${user.id}`,
        user.fullName ? `Full Name: ${user.fullName}` : null,
        user.phoneNumber ? `Phone Number: ${user.phoneNumber}` : null,
        user.email ? `Email: ${user.email}` : null,
        user.createdAt ? `Account Created At: ${user.createdAt}` : null,
    ]
        .filter(Boolean)
        .join('\n');

    return [
        'System instruction: Reply using the user details below when the request is about the user or account.',
        'Do not invent user profile information beyond what is provided.',
        '',
        'User details:',
        userSummary,
        '',
        `User request: ${trimmedMessage}`,
    ].filter(Boolean).join('\n');
}

function isExpenseQuery(message: string): boolean {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return false;
    const isInsuranceDocumentQuestion =
        text.includes('insurance') &&
        /(expiry|expire|expiring|validity|valid till|renewal|renew|document|documents|policy|rc|puc|fitness)/.test(text);

    if (isInsuranceDocumentQuestion) return false;

    return /(expense|expenses|spent|spend|cost|fuel|service|toll|parking|premium|claim)/.test(text);
}

function isDocumentQuery(message: string): boolean {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return false;
    return /(document|documents|insurance|rc|registration certificate|puc|pollution|fitness|expiry|renewal|challan|challans)/.test(text);
}

function isPrimaryVehicleScopedQuery(message: string): boolean {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return false;
    return (
        isExpenseQuery(text) ||
        isDocumentQuery(text) ||
        /(vehicle|car|bike|garage|odometer|mileage|fuel|registration|reg no|number plate|engine|chassis|owner|service|maintenance|health|reminder|insurance|rc|puc|challan)/.test(text)
    );
}

function isUserQuery(message: string): boolean {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return false;
    return /(my profile|profile|my details|user details|my name|my number|phone number|mobile number|my email|email address|account details|customer details|change my name|update my name|set my name|edit my name|change my email|update my email|set my email|edit my email|change my phone|update my phone|set my phone|edit my phone|change my mobile|update my mobile|set my mobile|edit my mobile|update profile|edit profile)/.test(text);
}

function getLocalUserFactAnswer(message: string, user: ChatUserContext | null): string | null {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text || !user) return null;
    const isUpdateRequest =
        /(change|update|set|edit)\s+my\s+(name|email|phone|mobile|number)|update profile|edit profile/.test(text) ||
        /\bmy\s+name\s+(?:is|should\s+be)\b/.test(text) ||
        /\bmy\s+(?:email|gmail|mail|mail id|email id)\s+(?:is|should\s+be)\b/.test(text) ||
        /\bmy\s+(?:phone|mobile|number|phone number|mobile number)\s+(?:is|should\s+be)\b/.test(text);
    if (isUpdateRequest) return null;

    if (/\bwhat is my name\b|\bmy name\b|\bwho am i\b/.test(text)) {
        return user.fullName?.trim()
            ? `Your name is ${user.fullName.trim()}.`
            : 'Your name is not available right now.';
    }

    if (/\bwhat is my email\b|\bmy email\b|\bemail address\b/.test(text)) {
        return user.email?.trim()
            ? `Your email is ${user.email.trim()}.`
            : 'Your email is not available right now.';
    }

    if (/\bwhat is my phone number\b|\bmy phone number\b|\bmy mobile number\b|\bmy number\b/.test(text)) {
        return user.phoneNumber?.trim()
            ? `Your phone number is ${user.phoneNumber.trim()}.`
            : 'Your phone number is not available right now.';
    }

    return null;
}

function extractProfileUpdateIntent(message: string): ProfileUpdateIntent | null {
    const trimmed = getEffectiveUserMessage(message);
    if (!trimmed) return null;
    const normalizedForEmail = trimmed
        .replace(/\bat the rate\b/gi, '@')
        .replace(/\bat\b/gi, '@')
        .replace(/\bdot\b/gi, '.')
        .replace(/\sgmail\b/gi, ' email')
        .replace(/\smail id\b/gi, ' email')
        .replace(/\semail id\b/gi, ' email')
        .replace(/\s+/g, ' ')
        .trim();

    if (/(?:change|update|edit|modify)\s+my\s+profile$|(?:change|update|edit|modify)\s+profile$/.test(normalizedForEmail.toLowerCase())) {
        return {
            payload: {},
            confirmation: 'Tell me what you want to change in your profile, like your name, email, or phone number.',
        };
    }

    if (/(?:change|update|edit|set)\s+(?:my\s+)?(?:profile picture|profile photo|picture|photo|avatar|dp|display picture)/.test(normalizedForEmail.toLowerCase())) {
        return {
            payload: {},
            confirmation: 'To update your profile picture, open your profile and choose a photo from camera or gallery.',
        };
    }

    const patterns: Array<{
        field: keyof UpdateProfilePayload;
        regexes: RegExp[];
        formatter: (value: string) => string;
    }> = [
        {
            field: 'fullName',
            regexes: [
                /(?:change|update|set|edit)\s+my\s+name\s+(?:to|as)\s+(.+)$/i,
                /(?:change|update|set|edit)\s+name\s+(?:to|as)\s+(.+)$/i,
                /my\s+name\s+(?:is|should\s+be)\s+(.+)$/i,
                /call\s+me\s+(.+)$/i,
            ],
            formatter: (value) => `Your name has been updated to ${value}.`,
        },
        {
            field: 'email',
            regexes: [
                /(?:change|update|set|edit)\s+my\s+(?:email|gmail|mail|mail id|email id)\s+(?:to|as)\s+(.+)$/i,
                /(?:change|update|set|edit)\s+my\s+email\s+(?:to|as)\s+(.+)$/i,
                /my\s+(?:email|gmail|mail|mail id|email id)\s+(?:is|should\s+be)\s+(.+)$/i,
                /my\s+email\s+(?:is|should\s+be)\s+(.+)$/i,
            ],
            formatter: (value) => `Your email has been updated to ${value}.`,
        },
        {
            field: 'phoneNumber',
            regexes: [
                /(?:change|update|set|edit)\s+my\s+(?:phone|mobile|number|phone number|mobile number)\s+(?:to|as)\s+(.+)$/i,
                /my\s+(?:phone|mobile|number|phone number|mobile number)\s+(?:is|should\s+be)\s+(.+)$/i,
            ],
            formatter: (value) => `Your phone number has been updated to ${value}.`,
        },
    ];

    for (const pattern of patterns) {
        for (const regex of pattern.regexes) {
            const source = pattern.field === 'email' ? normalizedForEmail : trimmed;
            const match = source.match(regex);
            const rawValue = match?.[1]?.trim();
            if (!rawValue) continue;

            const cleanedValue = rawValue.replace(/[.。]$/, '').trim();
            if (!cleanedValue) continue;

            if (pattern.field === 'email') {
                const normalizedEmail = cleanedValue.replace(/\s+/g, '').toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
                    return {
                        payload: {},
                        confirmation: 'Please say a valid email address to update your profile.',
                    };
                }
                return {
                    payload: { email: normalizedEmail },
                    confirmation: pattern.formatter(normalizedEmail),
                };
            }

            if (pattern.field === 'phoneNumber') {
                const digits = cleanedValue.replace(/\D/g, '');
                if (digits.length !== 10) {
                    return {
                        payload: {},
                        confirmation: 'Please say a valid 10 digit phone number to update your profile.',
                    };
                }
                return {
                    payload: { phoneNumber: digits },
                    confirmation: pattern.formatter(digits),
                };
            }

            return {
                payload: { fullName: cleanedValue },
                confirmation: pattern.formatter(cleanedValue),
            };
        }
    }

    return null;
}

async function getVehicleDocumentContext(vehicleId: string): Promise<VehicleDocumentContext | null> {
    try {
        const documents = await listDocuments();
        const vehicleDocuments = documents.filter((document: DocumentResponse) => document?.vehicleId === vehicleId);
        return {
            total: vehicleDocuments.length,
            documents: vehicleDocuments.map((doc) => ({
                type: doc.type ?? '',
                documentNumber: doc.documentNumber ?? null,
                issueDate: doc.issueDate ?? null,
                expiryDate: doc.expiryDate ?? null,
                issuerName: doc.issuerName ?? null,
                verificationStatus: doc.verificationStatus || 'PENDING',
                source: doc.source || 'UNKNOWN',
            })),
        };
    } catch {
        return null;
    }
}

function appendDocumentContext(message: string, documentContext: VehicleDocumentContext | null): string {
    if (!documentContext) return message;

    const documentLines =
        documentContext.documents.length > 0
            ? documentContext.documents
                .map((document) =>
                    [
                        `Type: ${document.type}`,
                        document.documentNumber ? `Number: ${document.documentNumber}` : null,
                        document.issueDate ? `Issue Date: ${document.issueDate}` : null,
                        document.expiryDate ? `Expiry Date: ${document.expiryDate}` : null,
                        document.verificationStatus ? `Verification: ${document.verificationStatus}` : null,
                    ]
                        .filter(Boolean)
                        .join(', '),
                )
                .join('\n')
            : 'No uploaded documents found for this primary vehicle.';

    return [
        message,
        '',
        `Primary vehicle documents found: ${documentContext.total}`,
        'Document details:',
        documentLines,
        'Instruction: For document-related questions, answer only from the primary vehicle document details above.',
    ].join('\n');
}

function isExpenseSummaryQuery(message: string): boolean {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return false;

    const mentionsExpense = isExpenseQuery(text);
    const mentionsPeriod = /(month|monthly|this month|current month|total|summary|breakdown)/.test(text);

    return mentionsExpense && mentionsPeriod;
}

function getLocalVehicleFactAnswer(
    message: string,
    vehicle: ChatVehicleContext | null,
): VehicleFactAnswer | null {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text || !vehicle) return null;
    const looksLikeExpenseIntent =
        /(add|log|create|save)\s+.*expense|expense\s+(of|for)|spent\s+\d+/.test(text) ||
        /(add|log|create|save|spent|pay|paid|refuel|refueled)\s+.*\b(fuel|petrol|diesel|cng|service|maintenance|toll|parking|insurance|challan|fine|other)\b/.test(text);
    if (looksLikeExpenseIntent) {
        return null;
    }

    if (/\bcolor\b|\bcolour\b/.test(text)) {
        return {
            value: vehicle.color,
            label: 'color',
            fallback: 'Your vehicle color is not available right now.',
        };
    }

    if (/\bmake\b|\bbrand\b/.test(text)) {
        return {
            value: vehicle.make,
            label: 'make',
            fallback: 'Your vehicle make is not available right now.',
        };
    }

    if (/\bmodel\b/.test(text)) {
        return {
            value: vehicle.model,
            label: 'model',
            fallback: 'Your vehicle model is not available right now.',
        };
    }

    if (/\bfuel\b|\bfuel type\b/.test(text)) {
        return {
            value: vehicle.fuelType,
            label: 'fuel type',
            fallback: 'Your vehicle fuel type is not available right now.',
        };
    }

    if (/\bregistration\b|\breg number\b|\bnumber plate\b/.test(text)) {
        return {
            value: vehicle.registrationNumber,
            label: 'registration number',
            fallback: 'Your vehicle registration number is not available right now.',
        };
    }

    if (/\bowner\b|\bowner name\b/.test(text)) {
        return {
            value: vehicle.ownerName,
            label: 'owner name',
            fallback: 'Your vehicle owner name is not available right now.',
        };
    }

    return null;
}

/**
 * Permissive routing gate only — decides whether a message looks expense-shaped enough to send
 * to the backend voice-expense parser. Deliberately does NOT extract amount/category itself
 * (that regressed to first-number-in-sentence / first-matching-category bugs); all real parsing
 * happens server-side via expenseParsingService's Gemini-backed parser. Kept permissive (biased
 * toward over-triggering) because anything that falls through lands on a weaker, un-language-aware
 * fallback (the per-message intent pre-check inside the backend chat pipeline).
 */
function looksExpenseShaped(message: string): boolean {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return false;

    const hasExpenseCategory = /\b(fuel|petrol|diesel|cng|service|maintenance|toll|parking|insurance|challan|fine|other)\b/.test(text);
    const hasAmount = /(?:rs\.?|rupees?|inr|₹)?\s*\d+(?:\.\d+)?/i.test(text);
    const hasCreateVerb = /\b(add|log|create|save|spent|pay|paid|refuel|refueled|service|serviced)\b/.test(text);

    return (
        /(add|log|create|save)\s+.*expense|expense\s+(of|for)|spent\s+\d+/.test(text) ||
        /(add|log|create|save)\s+.*\b(fuel|petrol|diesel|cng|service|maintenance|toll|parking|insurance|challan|fine|other)\b/.test(text) ||
        (hasExpenseCategory && hasAmount && hasCreateVerb)
    );
}

/** Matches a spoken/typed Indian registration number, e.g. "KA 01 AB 1234" or "ka01ab1234". */
function extractRegistrationNumberHint(message: string): string | undefined {
    const text = getEffectiveUserMessage(message);
    const match = text.match(/\b([A-Za-z]{2}[\s-]?\d{1,2}[\s-]?[A-Za-z]{1,2}[\s-]?\d{4})\b/);
    return match ? match[1].replace(/[\s-]/g, '').toUpperCase() : undefined;
}

function looksLikeAddVehicleCommand(message: string): boolean {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return false;
    return (
        (/\b(add|register)\b/.test(text) && /\b(vehicle|car|bike|scooter)\b/.test(text)) ||
        (/\badd\b/.test(text) && /\bgarage\b/.test(text))
    );
}

/**
 * "Add a vehicle" style commands don't commit anything server-side — AddVehicle.tsx already
 * has its own RTO-verify-then-confirm wizard, and a voice action that wrote straight to the DB
 * would bypass that safety step for a real asset registration. So this just opens the screen,
 * pre-filling the registration number if one was mentioned in the same breath (reusing the
 * existing initialRegistrationNumber prop the screen already supports for typed input).
 */
async function tryResolveLocalAddVehicleIntent(
    message: string,
    sessionId: string | undefined,
): Promise<LocalChatResolution | null> {
    if (!looksLikeAddVehicleCommand(message)) return null;

    const registrationNumber = extractRegistrationNumberHint(message);

    return {
        sessionId,
        message: registrationNumber
            ? `Opening the add vehicle screen for ${registrationNumber}.`
            : 'Opening the add vehicle screen — what is the registration number?',
        voiceUrl: null,
        contextUsed: registrationNumber ? 1 : 0,
        toolResults: [],
        agentSteps: [],
        navigate: {
            screen: 'AddVehicle',
            ...(registrationNumber ? { params: { registrationNumber } } : {}),
        },
    };
}

/** Which warranty-tracked parts a SERVICE expense mentions, e.g. "engine oil", "brake pads". */
function extractServicePartTypes(text: string): string[] {
    const lower = text.toLowerCase();
    return normalizeSelectedPartTypes(
        [
            { regex: /\bengine oil\b|\boil change\b|\boil service\b|\bengine oil change\b/, partType: 'ENGINE_OIL' },
            { regex: /\bbattery\b/, partType: 'BATTERY' },
            { regex: /\boil filter\b/, partType: 'OIL_FILTER' },
            { regex: /\bair filter\b/, partType: 'AIR_FILTER' },
            { regex: /\bbrake pads\b|\bbrake pad\b/, partType: 'BRAKE_PADS' },
            { regex: /\bbrake discs\b|\bbrake disc\b|\bdisc brake\b|\bdisc brakes\b/, partType: 'BRAKE_DISCS' },
            { regex: /\bfront tyre\b|\bfront tires\b|\bfront tire\b|\bfront tyres\b/, partType: 'TYRES_FRONT' },
            { regex: /\brear tyre\b|\brear tires\b|\brear tire\b|\brear tyres\b/, partType: 'TYRES_REAR' },
            { regex: /\btyres\b|\btires\b|\btyre\b|\btire\b/, partType: 'TYRES' },
            { regex: /\bclutch plate\b|\bclutch\b/, partType: 'CLUTCH_PLATE' },
            { regex: /\bspark plugs\b|\bspark plug\b/, partType: 'SPARK_PLUGS' },
            { regex: /\bcoolant\b/, partType: 'COOLANT' },
            { regex: /\btiming belt\b/, partType: 'TIMING_BELT' },
            { regex: /\bac filter\b|\bcabin filter\b|\bac service filter\b/, partType: 'AC_FILTER' },
            { regex: /\bwiper\b|\bwiper blade\b|\bwipers\b/, partType: 'WIPER_BLADES' },
            { regex: /\bheadlight\b|\bheadlight bulb\b|\bbulb\b/, partType: 'HEADLIGHT_BULB' },
        ]
            .filter((item) => item.regex.test(lower))
            .map((item) => item.partType),
    );
}

type VoiceExpenseVehicleHint = { vehicleId?: string; registrationNumber?: string };

type VoiceExpenseDraft = {
    amount: number;
    category: string;
    merchantName?: string | null;
    date?: string | null;
    notes?: string | null;
    rawText?: string | null;
    previewedAt?: string | null;
};

type PendingExpenseDraft = {
    draft: VoiceExpenseDraft;
    vehicleHint: VoiceExpenseVehicleHint;
    sourceMessage: string;
    expiresAt: number;
};

const PENDING_EXPENSE_DRAFT_TTL_MS = 3 * 60 * 1000;
const pendingExpenseDrafts = new Map<string, PendingExpenseDraft>();

function ensureExpenseSessionKey(sessionId?: string): string {
    return sessionId || `voice-expense-${Math.random().toString(36).slice(2)}`;
}

/** Fire-and-forget-free: recreates the old client parser's SERVICE+parts → warranty linkage. */
/** Spoken odometer mention, e.g. "odometer 45230", "at 45230 km" — falls back to the vehicle's
 * stored reading server-side (expense-warranty.service.ts's syncExpenseToWarranty) when absent. */
function extractSpokenOdometerReading(text: string): number | undefined {
    const match = text.match(/\b(?:odometer|odo|at)\s+(\d{2,7})\s*(?:km|kms|kilometers?)?\b/i)
        || text.match(/\b(\d{2,7})\s*(?:km|kms|kilometers?)\b/i);
    if (!match) return undefined;
    const value = Number(match[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function maybeCreateServiceRecordForExpense(
    sourceMessage: string,
    category: string,
    expense: { id?: string; vehicleId?: string | null; date?: string },
): Promise<void> {
    if (category !== 'SERVICE' || !expense.vehicleId) return;
    const effectiveMessage = getEffectiveUserMessage(sourceMessage);
    const partTypes = extractServicePartTypes(effectiveMessage);
    if (partTypes.length === 0) return;

    const odometerAtService = extractSpokenOdometerReading(effectiveMessage);

    setWarrantyStatusNeedsRefresh();

    await api
        .post('/v1/expenses/warranty/service-records', {
            vehicleId: expense.vehicleId,
            expenseId: expense.id,
            serviceType: 'REGULAR_SERVICE',
            serviceDate: expense.date || new Date().toISOString(),
            parts: partTypes.map((partType) => ({ partType })),
            ...(odometerAtService != null ? { odometerAtService } : {}),
        })
        .catch(() => {});
}

function buildExpenseConfirmationQuestion(preview: any): string {
    const amountLabel = `Rs. ${Number(preview.expense.amount).toLocaleString('en-IN')}`;
    const categoryLabel = String(preview.expense.category || '').toLowerCase();
    if (preview.vehicle?.ambiguous) {
        const options = (preview.vehicle.candidates || [])
            .map((v: any) => v.registrationNumber)
            .filter(Boolean)
            .join(' or ');
        return options
            ? `Which vehicle should I log ${amountLabel} for ${categoryLabel} — ${options}?`
            : `Which vehicle should I log this ${categoryLabel} expense for?`;
    }
    return `Should I log ${amountLabel} for ${categoryLabel}? Say yes to confirm.`;
}

async function buildExpenseCommitResolution(
    sessionId: string,
    sourceMessage: string,
    commitResponse: any,
): Promise<LocalChatResolution> {
    const data = (commitResponse as any)?.data ?? commitResponse;
    const base = {
        sessionId,
        voiceUrl: null as null,
        agentSteps: [] as any[],
    };

    if (data?.stale) {
        return {
            ...base,
            message: data.reason || 'That expense draft expired. Please say the command again.',
            contextUsed: 0,
            toolResults: [],
        };
    }

    if (data?.requiresVehicleSelection) {
        const options = (data.candidates || [])
            .map((v: any) => v.registrationNumber)
            .filter(Boolean)
            .join(' or ');
        return {
            ...base,
            message: options
                ? `Which vehicle should I log this for — ${options}?`
                : 'Which vehicle should I log this expense for?',
            contextUsed: 0,
            toolResults: [{ kind: 'expense_pending_confirmation' }],
        };
    }

    if (data?.skipped) {
        return {
            ...base,
            message: data.reason || 'That looks like an expense you already logged — skipping.',
            contextUsed: 0,
            toolResults: [],
        };
    }

    if (data?.success && data?.expense) {
        useExpenseStore.getState().notifyCreated({
            id: data.expense.id,
            amount: data.expense.amount,
            category: data.expense.category,
            vehicleId: data.expense.vehicleId,
        });

        await maybeCreateServiceRecordForExpense(sourceMessage, data.expense.category, data.expense);

        const category = String(data.expense.category || '');
        const categoryLabel = category ? `${category.charAt(0)}${category.slice(1).toLowerCase()}` : 'Expense';
        return {
            ...base,
            message: `${categoryLabel} expense of Rs. ${Number(data.expense.amount).toLocaleString('en-IN')} added successfully.`,
            contextUsed: 1,
            toolResults: [
                {
                    kind: 'expense_created',
                    category: data.expense.category,
                    amount: data.expense.amount,
                    vehicleId: data.expense.vehicleId,
                },
            ],
            navigate: { screen: 'Expenses' },
        };
    }

    return {
        ...base,
        message: 'I could not save that expense. Please try again.',
        contextUsed: 0,
        toolResults: [],
    };
}

function isVehicleCountQuery(message: string): boolean {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return false;

    const asksCount = /(how many|number of|count of)/.test(text);
    const asksGarageVehicles = /(vehicles|vehicle|cars|car|bikes|bike|garage|my garage)/.test(text);

    return asksCount && asksGarageVehicles;
}

function isWarrantyStatusQuery(message: string): boolean {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return false;

    return /(warranty|warrenty)/.test(text) && /(status|active|expired|expire|valid|coverage|covered)/.test(text);
}

function getNearbyPlaceType(message: string): NearbyPlaceType | null {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return null;

    if (!/(nearest|nearby|close by|closeby|around me|near me)/.test(text)) {
        return null;
    }

    if (/\brestaurant\b|\brestaurants\b|\bfood\b|\beatery\b/.test(text)) return 'restaurant';
    if (/\bhospital\b|\bhospitals\b|\bclinic\b/.test(text)) return 'hospital';
    if (/\bpolice\b|\bpolice station\b/.test(text)) return 'police';
    if (/\bhotel\b|\blodging\b|\bstay\b/.test(text)) return 'lodging';
    if (/\bmechanic\b|\bcar repair\b|\bgarage\b/.test(text)) return 'car_repair';
    if (/\bparking\b/.test(text)) return 'parking';
    if (/\bcharging\b|\bev charge\b|\belectric charging\b/.test(text)) return 'electric_charging_station';
    if (/\bfuel\b|\bpetrol pump\b|\bgas station\b|\bdiesel\b|\bcng station\b/.test(text)) return 'gas_station';

    return null;
}

function getNearbyPlaceLabel(type: NearbyPlaceType): string {
    switch (type) {
        case 'restaurant':
            return 'restaurants';
        case 'hospital':
            return 'hospitals';
        case 'police':
            return 'police stations';
        case 'lodging':
            return 'hotels';
        case 'car_repair':
            return 'mechanics';
        case 'parking':
            return 'parking places';
        case 'electric_charging_station':
            return 'charging stations';
        case 'gas_station':
        default:
            return 'fuel stations';
    }
}

function extractEmergencyIntent(message: string): EmergencyIntent | null {
    const text = getEffectiveUserMessage(message).toLowerCase();
    if (!text) return null;

    const isGenericHelpQuestion =
        /\bhow can you help me\b|\bhow can u help me\b|\bwhat can you do\b|\bwhat can u do\b|\bhelp\b/.test(text) &&
        !/\bsos\b|\bemergency\b|\bpanic\b|\baccident\b|\bmedical\b|\bambulance\b|\bpolice\b|\bfire\b/.test(text);

    if (isGenericHelpQuestion) return null;

    const isEmergencyRequest =
        /\bsos\b|\bemergency\b|\bpanic\b|\baccident\b|\bmedical emergency\b|\bcall police\b|\bcall ambulance\b|\bfire emergency\b|\btrigger sos\b|\bsend sos\b|\bemergency alert\b/.test(text);

    if (!isEmergencyRequest) return null;

    let type: SOSType = 'OTHER';
    if (/\bmedical\b|\bambulance\b|\bhospital\b/.test(text)) type = 'MEDICAL';
    else if (/\bfire\b/.test(text)) type = 'FIRE';
    else if (/\bpolice\b|\bcrime\b/.test(text)) type = 'POLICE';
    else if (/\bmechanic\b|\bbreakdown\b|\bvehicle problem\b/.test(text)) type = 'MECHANICAL';
    else if (/\baccident\b|\bcrash\b|\bcollision\b/.test(text)) type = 'ACCIDENT';

    return {
        type,
        message: getEffectiveUserMessage(message),
    };
}

function toNumber(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(value as any);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatExpenseDate(date: Date): string {
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

async function getMonthlyExpenseContext(vehicleId: string): Promise<MonthlyExpenseContext | null> {
    try {
        const response = await api.get<any>(`/v1/expenses?vehicleId=${vehicleId}`);
        const items =
            response?.data?.expenses ??
            response?.data?.data?.expenses ??
            response?.data?.data ??
            response?.expenses ??
            response?.data ??
            [];

        const expenseItems = Array.isArray(items) ? items : [];
        if (expenseItems.length === 0) return null;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthItems = expenseItems.filter((item: any) => {
            const date = toDate(item?.date);
            return !!date && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        if (monthItems.length === 0) {
            return {
                monthLabel: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                total: 0,
                count: 0,
                categories: [],
                recentItems: [],
            };
        }

        const categoryMap = new Map<string, { total: number; count: number }>();
        for (const item of monthItems) {
            const category = String(item?.category || 'OTHER').toUpperCase();
            const amount = toNumber(item?.amount);
            const current = categoryMap.get(category) ?? { total: 0, count: 0 };
            current.total += amount;
            current.count += 1;
            categoryMap.set(category, current);
        }

        const recentItems = [...monthItems]
            .sort((a, b) => (toDate(b?.date)?.getTime() ?? 0) - (toDate(a?.date)?.getTime() ?? 0))
            .slice(0, 5)
            .map((item: any) => {
                const date = toDate(item?.date);
                return {
                    category: String(item?.category || 'OTHER').toUpperCase(),
                    amount: toNumber(item?.amount),
                    date: date ? formatExpenseDate(date) : 'Unknown date',
                };
            });

        return {
            monthLabel: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            total: monthItems.reduce((sum: number, item: any) => sum + toNumber(item?.amount), 0),
            count: monthItems.length,
            categories: [...categoryMap.entries()]
                .map(([category, value]) => ({
                    category,
                    total: value.total,
                    count: value.count,
                }))
                .sort((a, b) => b.total - a.total),
            recentItems,
        };
    } catch {
        return null;
    }
}

function appendExpenseContext(message: string, monthlyExpense: MonthlyExpenseContext | null): string {
    if (!monthlyExpense) return message;

    const categorySummary =
        monthlyExpense.categories.length > 0
            ? monthlyExpense.categories
                .map(
                    (item) =>
                        `${item.category}: ${item.total.toLocaleString('en-IN')} across ${item.count} expense${item.count > 1 ? 's' : ''}`,
                )
                .join('\n')
            : 'No expense categories found for this month.';

    const recentSummary =
        monthlyExpense.recentItems.length > 0
            ? monthlyExpense.recentItems
                .map(
                    (item) =>
                        `${item.date}: ${item.category} - ${item.amount.toLocaleString('en-IN')}`,
                )
                .join('\n')
            : 'No recent expenses recorded this month.';

    return [
        message,
        '',
        `Expense context for ${monthlyExpense.monthLabel}:`,
        `Monthly total: ${monthlyExpense.total.toLocaleString('en-IN')}`,
        `Number of expenses this month: ${monthlyExpense.count}`,
        'Category totals:',
        categorySummary,
        'Recent expenses this month:',
        recentSummary,
        'Instruction: When the user asks for monthly expense totals or summary, use the full monthly total and category breakdown above, not only the recent expenses.',
    ].join('\n');
}

function formatCurrency(amount: number): string {
    return `Rs. ${amount.toLocaleString('en-IN')}`;
}

function buildMonthlyExpenseAnswer(
    vehicle: ChatVehicleContext | null,
    monthlyExpense: MonthlyExpenseContext | null,
): string | null {
    if (!vehicle || !monthlyExpense) return null;

    const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim() || vehicle.registrationNumber;

    if (monthlyExpense.count === 0) {
        return `For ${vehicleLabel} (${vehicle.registrationNumber}), your total expense for ${monthlyExpense.monthLabel} is ${formatCurrency(0)}. No expenses are recorded this month.`;
    }

    const topCategories = monthlyExpense.categories
        .slice(0, 3)
        .map((item) => `${item.category}: ${formatCurrency(item.total)}`)
        .join(', ');

    return `For ${vehicleLabel} (${vehicle.registrationNumber}), your total expense for ${monthlyExpense.monthLabel} is ${formatCurrency(monthlyExpense.total)} across ${monthlyExpense.count} expense${monthlyExpense.count > 1 ? 's' : ''}. Category breakdown: ${topCategories}.`;
}

async function tryResolveLocalExpenseAnswer(
    message: string,
    sessionId: string | undefined,
    vehicle: ChatVehicleContext | null,
): Promise<LocalChatResolution | null> {
    if (!vehicle?.id || !isExpenseSummaryQuery(message)) return null;

    const monthlyExpense = await getMonthlyExpenseContext(vehicle.id);
    if (!monthlyExpense) return null;

    const answer = buildMonthlyExpenseAnswer(vehicle, monthlyExpense);
    if (!answer) return null;

    return {
        sessionId,
        message: answer,
        voiceUrl: null,
        contextUsed: monthlyExpense.count,
        toolResults: [],
        agentSteps: [],
        suggestedActions: [
            { label: 'Log expense', prompt: 'Add an expense for my vehicle' },
            { label: 'Monthly expenses', prompt: 'Show monthly expenses' },
        ],
    };
}

async function tryResolveLocalVehicleAnswer(
    message: string,
    sessionId: string | undefined,
    vehicle: ChatVehicleContext | null,
): Promise<LocalChatResolution | null> {
    const fact = getLocalVehicleFactAnswer(message, vehicle);
    if (!fact) return null;

    const value =
        typeof fact.value === 'string'
            ? fact.value.trim()
            : typeof fact.value === 'number'
              ? String(fact.value)
              : '';

    return {
        sessionId,
        message: value ? `Your vehicle ${fact.label} is ${value}.` : fact.fallback,
        voiceUrl: null,
        contextUsed: value ? 1 : 0,
        toolResults: [],
        agentSteps: [],
        navigate: { screen: 'VehicleList' },
    };
}

async function tryResolveLocalVehicleCountAnswer(
    message: string,
    sessionId: string | undefined,
): Promise<LocalChatResolution | null> {
    if (!isVehicleCountQuery(message)) return null;

    const count = await getVehicleCount();
    if (count == null) return null;

    const noun = count === 1 ? 'vehicle' : 'vehicles';
    return {
        sessionId,
        message: `You have ${count} ${noun} in your garage.`,
        voiceUrl: null,
        contextUsed: count,
        toolResults: [],
        agentSteps: [],
        navigate: { screen: 'VehicleList' },
    };
}

async function tryResolveLocalWarrantyStatus(
    message: string,
    sessionId: string | undefined,
    vehicle: ChatVehicleContext | null,
): Promise<LocalChatResolution | null> {
    if (!vehicle?.id || !isWarrantyStatusQuery(message)) return null;

    try {
        const [statusRes, upcomingRes] = await Promise.all([
            api.get<any>(`/v1/expenses/warranty/vehicles/${vehicle.id}/status`),
            api.get<any[]>(`/v1/expenses/warranty/vehicles/${vehicle.id}/upcoming`),
        ]);

        const statusData = (statusRes as any)?.data ?? statusRes;
        const upcomingData = (upcomingRes as any)?.data ?? upcomingRes;
        const items = Array.isArray(upcomingData) ? upcomingData : [];

        const overdueCount = items.filter((item: any) => item?.urgency === 'OVERDUE').length;
        const dueSoonCount = items.filter((item: any) => item?.urgency === 'DUE_SOON' || item?.urgency === 'DUE_BY_KM').length;
        const activeCount = items.filter((item: any) => item?.urgency === 'ACTIVE').length;

        const summaryParts: string[] = [];
        if (typeof statusData?.activeCount === 'number') {
            summaryParts.push(`${statusData.activeCount} active`);
        } else if (activeCount > 0) {
            summaryParts.push(`${activeCount} active`);
        }
        if (typeof statusData?.expiredCount === 'number') {
            summaryParts.push(`${statusData.expiredCount} expired`);
        } else if (overdueCount > 0) {
            summaryParts.push(`${overdueCount} overdue`);
        }
        if (dueSoonCount > 0) {
            summaryParts.push(`${dueSoonCount} due soon`);
        }

        const firstUpcoming = items.find((item: any) => item?.message);
        const detail = firstUpcoming?.message ? ` ${firstUpcoming.message}` : '';

        const messageText =
            summaryParts.length > 0
                ? `Your warranty status is ${summaryParts.join(', ')}.${detail}`.trim()
                : items.length > 0
                  ? `I found ${items.length} warranty items for your vehicle.${detail}`
                  : 'I could not find any warranty status details right now.';

        return {
            sessionId,
            message: messageText,
            voiceUrl: null,
            contextUsed: items.length,
            toolResults: [],
            agentSteps: [],
            navigate: { screen: 'WarrantyStatus' },
        };
    } catch {
        return {
            sessionId,
            message: 'I could not fetch your warranty status right now.',
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }
}

/**
 * Handles a "yes"/"no"/vehicle-name reply to a pending expense confirmation question from a
 * previous turn. Must run BEFORE the general expense-shaped gate (and every other local
 * resolver) so a bare "yes" isn't swallowed by an unrelated matcher. Returns null if there is
 * no pending draft for this session, or if the reply doesn't look like an answer to it — in
 * either case the caller falls through to normal handling.
 */
async function tryResolvePendingExpenseConfirmation(
    message: string,
    sessionId: string | undefined,
): Promise<LocalChatResolution | null> {
    if (!sessionId) return null;
    const pending = pendingExpenseDrafts.get(sessionId);
    if (!pending) return null;
    pendingExpenseDrafts.delete(sessionId);

    if (Date.now() > pending.expiresAt) return null;

    const text = getEffectiveUserMessage(message).trim().toLowerCase();
    const isAffirmative = /^(yes|yep|yeah|confirm|correct|ok|okay|haan|sure|go ahead)\b/.test(text);
    const isNegative = /^(no|nope|cancel|nah|don't|stop)\b/.test(text);
    const registrationHint = extractRegistrationNumberHint(message);

    if (isNegative) {
        return {
            sessionId,
            message: 'Okay, I have not logged that expense.',
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }

    if (!isAffirmative && !registrationHint) {
        // Doesn't look like an answer to the pending question — abandon rather than guess.
        return null;
    }

    const vehicleHint: VoiceExpenseVehicleHint = registrationHint
        ? { registrationNumber: registrationHint }
        : pending.vehicleHint;

    try {
        const commitResponse = await api.post<any>('/v1/expenses/parse/voice/commit', {
            draft: pending.draft,
            ...vehicleHint,
        });
        return buildExpenseCommitResolution(sessionId, pending.sourceMessage, commitResponse);
    } catch {
        return {
            sessionId,
            message: 'I could not save that expense right now. Please try again.',
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }
}

async function tryResolveLocalExpenseCreate(
    message: string,
    sessionId: string | undefined,
): Promise<LocalChatResolution | null> {
    if (!looksExpenseShaped(message)) return null;

    const text = getEffectiveUserMessage(message);
    const registrationHint = extractRegistrationNumberHint(message);
    const vehicleHint: VoiceExpenseVehicleHint = registrationHint
        ? { registrationNumber: registrationHint }
        : {};

    let previewResponse: any;
    try {
        previewResponse = await api.post<any>('/v1/expenses/parse/voice/text', {
            text,
            dryRun: true,
            ...vehicleHint,
        });
    } catch {
        return null; // fall through to general chat rather than fail the whole turn
    }

    const preview = (previewResponse as any)?.data ?? previewResponse;
    if (!preview?.success) return null;
    if (!preview.expense || !(Number(preview.expense.amount) > 0)) {
        return {
            sessionId,
            message: 'Tell me the expense amount, for example add fuel expense 500.',
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }

    const key = ensureExpenseSessionKey(sessionId);
    const draft: VoiceExpenseDraft = {
        amount: preview.expense.amount,
        category: preview.expense.category,
        merchantName: preview.expense.merchantName,
        date: preview.expense.date,
        notes: preview.expense.notes,
        rawText: preview.expense.rawText,
        previewedAt: preview.previewedAt,
    };
    const resolvedVehicleHint: VoiceExpenseVehicleHint = registrationHint
        ? { registrationNumber: registrationHint }
        : preview.vehicle?.vehicleId
          ? { vehicleId: preview.vehicle.vehicleId }
          : {};

    if (!preview.requiresConfirmation) {
        try {
            const commitResponse = await api.post<any>('/v1/expenses/parse/voice/commit', {
                draft,
                ...resolvedVehicleHint,
            });
            return buildExpenseCommitResolution(key, message, commitResponse);
        } catch {
            return {
                sessionId: key,
                message: 'I could not save that expense right now. Please try again.',
                voiceUrl: null,
                contextUsed: 0,
                toolResults: [],
                agentSteps: [],
            };
        }
    }

    pendingExpenseDrafts.set(key, {
        draft,
        vehicleHint: resolvedVehicleHint,
        sourceMessage: message,
        expiresAt: Date.now() + PENDING_EXPENSE_DRAFT_TTL_MS,
    });

    return {
        sessionId: key,
        message: buildExpenseConfirmationQuestion(preview),
        voiceUrl: null,
        contextUsed: 0,
        toolResults: [{ kind: 'expense_pending_confirmation' }],
        agentSteps: [],
    };
}

export async function tryResolveLocalNearbyPlaces(
    message: string,
    sessionId: string | undefined,
): Promise<LocalChatResolution | null> {
    const placeType = getNearbyPlaceType(message);
    if (!placeType) return null;

    try {
        const coords = await getDeviceLocation();
        if (!coords) {
            return {
                sessionId,
                message: `I could not get your location, so I cannot look up nearby ${getNearbyPlaceLabel(placeType)}. Please turn on location and try again.`,
                voiceUrl: null,
                contextUsed: 0,
                toolResults: [],
                agentSteps: [],
            };
        }

        const places = await placesService.getNearby(
            coords.latitude,
            coords.longitude,
            placeType,
            10000,
        );

        if (!places.length) {
            return {
                sessionId,
                message: `I could not find any nearby ${getNearbyPlaceLabel(placeType)} right now.`,
                voiceUrl: null,
                contextUsed: 0,
                toolResults: [],
                agentSteps: [],
            };
        }

        const topPlaces = places
            .slice(0, 3)
            .map((place) => `${place.name}${place.distanceText ? ` at ${place.distanceText}` : ''}`)
            .join(', ');

        return {
            sessionId,
            message: `The nearest ${getNearbyPlaceLabel(placeType)} are ${topPlaces}.`,
            voiceUrl: null,
            contextUsed: places.length,
            toolResults: [],
            agentSteps: [],
        };
    } catch {
        return {
            sessionId,
            message: `I could not fetch nearby ${getNearbyPlaceLabel(placeType)} right now.`,
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }
}

export async function tryResolveLocalEmergencyAlert(
    message: string,
    sessionId: string | undefined,
): Promise<LocalChatResolution | null> {
    const intent = extractEmergencyIntent(message);
    if (!intent) return null;

    try {
        // Real device GPS, not an IP-derived guess: responders are dispatched to these
        // coordinates. `getDeviceLocation` is time-bounded on every leg so an emergency can
        // never hang waiting for a fix.
        const coords = await getDeviceLocation();
        if (!coords) {
            return {
                sessionId,
                message:
                    "I could not get your location, so I have not sent the alert. Please turn on location and try again, or use the SOS button to send it manually.",
                voiceUrl: null,
                contextUsed: 0,
                toolResults: [],
                agentSteps: [],
            };
        }

        const response = await sosService.triggerSOS({
            location: {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy,
            },
            type: intent.type,
            message: intent.message,
            metadata: { locationSource: coords.source },
        });

        // Tell the user when the fix is coarse — a silently-imprecise emergency location is
        // worse than a stated one, because they can decide whether to add detail.
        const accuracyCaveat = isPreciseFix(coords)
            ? ''
            : ' Your exact location could not be confirmed, so please share a landmark if you can.';

        return {
            sessionId,
            message: `${intent.type.toLowerCase()} emergency alert triggered successfully.${accuracyCaveat}`,
            voiceUrl: null,
            contextUsed: 1,
            toolResults: [
                {
                    kind: 'sos',
                    sosAlertId: response.sosAlertId,
                    type: intent.type,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                },
            ],
            agentSteps: [],
        };
    } catch (error: any) {
        return {
            sessionId,
            message: error?.message || 'I could not trigger the emergency alert right now.',
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }
}

async function tryResolveLocalProfileUpdate(
    message: string,
    sessionId: string | undefined,
): Promise<LocalChatResolution | null> {
    const intent = extractProfileUpdateIntent(message);
    if (!intent) return null;

    if (Object.keys(intent.payload).length === 0) {
        return {
            sessionId,
            message: intent.confirmation,
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }

    await updateProfile(intent.payload);
    await getUserContext(true);

    return {
        sessionId,
        message: intent.confirmation,
        voiceUrl: null,
        contextUsed: 1,
        toolResults: [
            {
                kind: 'profile_updated',
                fields: Object.keys(intent.payload),
            },
        ],
        agentSteps: [],
    };
}

async function tryResolveLocalUserFactAnswer(
    message: string,
    sessionId: string | undefined,
    user: ChatUserContext | null,
): Promise<LocalChatResolution | null> {
    const answer = getLocalUserFactAnswer(message, user);
    if (!answer) return null;

    return {
        sessionId,
        message: answer,
        voiceUrl: null,
        contextUsed: 1,
        toolResults: [],
        agentSteps: [],
    };
}

// ============================================================================
// Chat Service
// ============================================================================
export const chatService = {
    async getPrimaryVehicleSpeechContext(): Promise<ChatVehicleContext | null> {
        return getPrimaryVehicleContext();
    },

    async refreshUserContext(): Promise<ChatUserContext | null> {
        return getUserContext(true);
    },

    /**
     * List all chat sessions
     */
    async listSessions(): Promise<ChatSession[]> {
        const result = await api.get<SessionsResponse>('/v1/chat/sessions');
        return result.data;
    },

    /**
     * Get chat history for a session
     */
    async getHistory(sessionId: string): Promise<HistoryResponse['data']> {
        const result = await api.get<HistoryResponse>(
            `/v1/chat/sessions/${sessionId}`,
        );
        return result.data;
    },

    /**
     * Get chat analytics
     */
    async getAnalytics(days = 30): Promise<AnalyticsResponse['data']> {
        const result = await api.get<AnalyticsResponse>(
            `/v1/chat/analytics?days=${days}`,
        );
        return result.data;
    },

    /**
     * Submit feedback (thumbs up/down)
     */
    async submitFeedback(sessionId: string, score: 1 | -1): Promise<void> {
        await api.post('/v1/chat/feedback', { sessionId, score });
    },
};
