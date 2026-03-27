import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "./config/logger";

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

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: { origin: "*" }
    });

    socketManager = new SocketManager(io);

    io.on("connection", (socket) => {
        logger.info({ socketId: socket.id }, "New client connected via Socket.io");

        socket.on("join", (userId: string) => {
            socket.join(userId);
            logger.info({ userId, socketId: socket.id }, "Client joined their personal room");
        });

        socket.on("disconnect", () => {
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
