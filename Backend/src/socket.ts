import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "./config/logger";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: { origin: "*" } // In production, match this to env.CORS_ORIGIN
    });

    io.on("connection", (socket) => {
        logger.info({ socketId: socket.id }, "New client connected via Socket.io");

        socket.on("join", (customerId: string) => {
            socket.join(customerId);
            logger.info({ customerId, socketId: socket.id }, "Client joined customer room");
        });

        socket.on("disconnect", () => {
            logger.info({ socketId: socket.id }, "Client disconnected from Socket.io");
        });
    });
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
};
