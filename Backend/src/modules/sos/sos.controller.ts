
import { Request, Response } from "express";
import { sosService } from "../../services/sos.service";
import { SOSType } from "@repo/db-customer";

interface AuthenticatedRequest extends Request {
    user?: {
        customerId: string;
    };
}

export const createSOS = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { customerId } = req.user!;
        const { latitude, longitude, type, address, metadata } = req.body;

        if (!latitude || !longitude || !type) {
            return res.status(400).json({ message: "Latitude, longitude, and type are required" });
        }

        const sos = await sosService.createSOS(customerId, latitude, longitude, type as SOSType, address, metadata);
        res.status(201).json(sos);
    } catch (error) {
        console.error("Error creating SOS:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const resolveSOS = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const sos = await sosService.resolveSOS(id as string);
        res.status(200).json(sos);
    } catch (error) {
        console.error("Error resolving SOS:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getNearbyHelp = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { latitude, longitude, type } = req.query;

        if (!latitude || !longitude || !type) {
            return res.status(400).json({ message: "Latitude, longitude, and type are required" });
        }

        const help = await sosService.getNearbyHelp(
            parseFloat(latitude as string),
            parseFloat(longitude as string),
            type as SOSType
        );
        res.status(200).json(help);
    } catch (error) {
        console.error("Error fetching nearby help:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const addContact = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { customerId } = req.user!;
        const { name, phoneNumber, relation, priority } = req.body;

        if (!name || !phoneNumber) {
            return res.status(400).json({ message: "Name and phone number are required" });
        }

        const contact = await sosService.addContact(customerId, { name, phoneNumber, relation, priority });
        res.status(201).json(contact);
    } catch (error) {
        console.error("Error adding contact:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getContacts = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { customerId } = req.user!;
        const contacts = await sosService.getContacts(customerId);
        res.status(200).json(contacts);
    } catch (error) {
        console.error("Error fetching contacts:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteContact = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { customerId } = req.user!;
        const { id } = req.params;
        await sosService.deleteContact(customerId, String(id));
        res.status(204).send();
    } catch (error) {
        console.error("Error deleting contact:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
