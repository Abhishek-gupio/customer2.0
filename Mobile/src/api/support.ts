import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAccessToken } from '../services/storage';

const API_URL = `${API_BASE_URL}/api/v1`;

function authHeaders(): Record<string, string> {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export const supportApi = {
    async getFaqs() {
        const response = await axios.get(`${API_URL}/support/faqs`, {
            headers: authHeaders(),
        });
        return response.data;
    },

    async getTickets() {
        const response = await axios.get(`${API_URL}/support/tickets`, {
            headers: authHeaders(),
        });
        return response.data;
    },

    async getTicket(ticketId: string) {
        const response = await axios.get(`${API_URL}/support/tickets/${ticketId}`, {
            headers: authHeaders(),
        });
        return response.data;
    },

    async createTicket(data: { subject: string; description: string; category: string; priority?: string }) {
        const response = await axios.post(`${API_URL}/support/tickets`, data, {
            headers: authHeaders(),
        });
        return response.data;
    },

    async addMessage(ticketId: string, content: string) {
        const response = await axios.post(`${API_URL}/support/tickets/${ticketId}/messages`, { content }, {
            headers: authHeaders(),
        });
        return response.data;
    },

    async getChatFlow(flowId?: string) {
        const response = await axios.get(`${API_URL}/support/chat-flow`, {
            params: { flowId },
            headers: authHeaders(),
        });
        return response.data;
    }
};
