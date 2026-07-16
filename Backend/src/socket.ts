import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "./config/logger";
import { verifyAccess } from "./modules/auth/jwt";
import type { CustomerPayload } from "./modules/auth/auth.types";

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

    // Verifies the customer JWT the client sends in the connection handshake
    // (`io(url, { auth: { token } })`) and stashes the VERIFIED identity on
    // socket.data — "join" below trusts only this, never a client-supplied
    // userId string. A connection without a valid token is still accepted
    // (so unrelated anonymous socket use, if any, keeps working) but simply
    // never gets a verified identity, so it can't join anyone's room.
    io.use((socket: Socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        if (token) {
            try {
                socket.data.customer = verifyAccess(token) as CustomerPayload;
            } catch {
                logger.warn({ socketId: socket.id }, "Socket handshake token invalid — connecting without verified identity");
            }
        }
        next();
    });

    socketManager = new SocketManager(io);

    io.on("connection", (socket) => {
        logger.info({ socketId: socket.id }, "New client connected via Socket.io");

        socket.on("join", (_unverifiedUserId: string) => {
            const verified = socket.data.customer as CustomerPayload | undefined;
            if (!verified?.id) {
                logger.warn({ socketId: socket.id }, "Join rejected — no verified identity on this socket");
                return;
            }
            socket.join(verified.id);
            onlineConnectionCounts.set(verified.id, (onlineConnectionCounts.get(verified.id) ?? 0) + 1);
            socket.data.joinedRoom = verified.id;
            logger.info({ userId: verified.id, socketId: socket.id }, "Client joined their personal room");
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
