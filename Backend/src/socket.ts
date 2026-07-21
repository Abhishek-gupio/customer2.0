import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { dbInstances } from "@repo/db-customer";
import { logger } from "./config/logger";
import { verifyAccess } from "./modules/auth/jwt";
import type { CustomerPayload } from "./modules/auth/auth.types";
import { verifyAdminAccess } from "./modules/admin/admin.jwt";
import type { AdminPayload } from "./modules/admin/admin.types";
import { verifyDealerAccess, verifyParkingEmployeeAccess } from "./modules/parking/parking.jwt";
import type { DealerPayload, ParkingEmployeePayload } from "./modules/parking/parking.types";

/** Fixed room every authenticated admin socket joins — the "everything, live" feed. */
export const PARKING_ADMIN_ROOM = "parking-admin";

let io: Server;

export class SocketManager {
    private io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    emitToUser(userId: string, event: string, data: any) {
        this.io.to(userId).emit(event, data);
        logger.info({ userId, event }, "Emitted socket event to user room");
    }

    emitToAll(event: string, data: any) {
        this.io.emit(event, data);
    }
}

export let socketManager: SocketManager;

/**
 * How many currently-open sockets each customerId has (a user can have the
 * app open on 2 devices). Presence goes offline only once this drops to 0.
 * In-memory, single-process — matches this codebase's existing accepted
 * caveat for other in-memory state (e.g. the OTP store fallback).
 */
const onlineConnectionCounts = new Map<string, number>();

export function isUserOnline(customerId: string): boolean {
    return (onlineConnectionCounts.get(customerId) ?? 0) > 0;
}

type ConnectionHandler = (socket: Socket) => void;
const connectionHandlers: ConnectionHandler[] = [];

/**
 * Lets a feature module (e.g. messaging's typing-indicator relay) register
 * its own per-connection listeners without this generic transport file
 * needing to know about it — same decoupling style as services/payment-events.ts.
 */
export function onSocketConnection(handler: ConnectionHandler): void {
    connectionHandlers.push(handler);
}

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: { origin: "*" }
    });

    // Verifies the JWT the client sends in the connection handshake
    // (`io(url, { auth: { token, actorType } })`) and stashes the VERIFIED
    // identity on socket.data — "join" below trusts only this, never a
    // client-supplied userId string. `actorType` picks which verifier to try
    // (each JWT kind has its own secret-independent payload shape, so we
    // can't just try all of them and see what parses). A connection without
    // a valid token is still accepted (so unrelated anonymous socket use, if
    // any, keeps working) but simply never gets a verified identity, so it
    // can't join anyone's room.
    io.use((socket: Socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        const actorType = (socket.handshake.auth?.actorType as string | undefined) ?? "customer";
        if (token) {
            try {
                if (actorType === "admin") {
                    socket.data.admin = verifyAdminAccess(token) as AdminPayload;
                } else if (actorType === "dealer") {
                    socket.data.dealer = verifyDealerAccess(token) as DealerPayload;
                } else if (actorType === "parkingEmployee") {
                    socket.data.parkingEmployee = verifyParkingEmployeeAccess(token) as ParkingEmployeePayload;
                } else {
                    socket.data.customer = verifyAccess(token) as CustomerPayload;
                }
            } catch {
                logger.warn({ socketId: socket.id, actorType }, "Socket handshake token invalid — connecting without verified identity");
            }
        }
        next();
    });

    socketManager = new SocketManager(io);

    io.on("connection", (socket) => {
        logger.info({ socketId: socket.id }, "New client connected via Socket.io");

        socket.on("join", async (_unverifiedUserId: string) => {
            const customer = socket.data.customer as CustomerPayload | undefined;
            const admin = socket.data.admin as AdminPayload | undefined;
            const dealer = socket.data.dealer as DealerPayload | undefined;
            const employee = socket.data.parkingEmployee as ParkingEmployeePayload | undefined;

            let room: string | undefined;
            if (customer?.id) {
                room = customer.id;
            } else if (dealer?.id) {
                // Dealer's own id doubles as the parking-live room every one of
                // their employees also joins below — one room, whole team sees it.
                room = dealer.id;
            } else if (employee?.id) {
                try {
                    const record = await dbInstances.parkingEmployee.findUnique({ where: { id: employee.id } });
                    room = record?.dealerId;
                } catch (err) {
                    logger.error({ err, employeeId: employee.id }, "Failed to resolve employee's dealer for socket room join");
                }
            } else if (admin?.id) {
                room = admin.id;
                socket.join(PARKING_ADMIN_ROOM);
                logger.info({ adminId: admin.id, socketId: socket.id }, "Admin joined the global parking-admin room");
            }

            if (!room) {
                logger.warn({ socketId: socket.id }, "Join rejected — no verified identity on this socket");
                return;
            }
            socket.join(room);
            onlineConnectionCounts.set(room, (onlineConnectionCounts.get(room) ?? 0) + 1);
            socket.data.joinedRoom = room;
            logger.info({ room, socketId: socket.id }, "Client joined their room");
        });

        for (const handler of connectionHandlers) handler(socket);

        socket.on("disconnect", () => {
            const joinedRoom = socket.data.joinedRoom as string | undefined;
            if (joinedRoom) {
                const next = (onlineConnectionCounts.get(joinedRoom) ?? 1) - 1;
                if (next <= 0) onlineConnectionCounts.delete(joinedRoom);
                else onlineConnectionCounts.set(joinedRoom, next);
            }
            logger.info({ socketId: socket.id }, "Client disconnected from Socket.io");
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
};
