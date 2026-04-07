import { format, parse, isValid } from 'date-fns';

export const getExpenseIcon = (category: string) => {
    switch (category.toUpperCase()) {
        case 'FUEL':
            return 'gas-pump';
        case 'SERVICE':
            return 'tools';
        case 'TOLL':
        case 'TOLLS':
            return 'road';
        case 'INSURANCE':
            return 'shield-alt';
        case 'PARKING':
            return 'parking';
        case 'CHALLAN':
            return 'file-invoice-dollar';
        case 'EMI':
            return 'money-check-alt';
        case 'REPAIR':
            return 'hammer';
        default:
            return 'receipt';
    }
};

export const getExpenseColor = (category: string) => {
    switch (category.toUpperCase()) {
        case 'FUEL':
            return '#4caf50'; // Green
        case 'SERVICE':
            return '#ff9800'; // Orange
        case 'TOLL':
        case 'TOLLS':
            return '#2196f3'; // Blue
        case 'INSURANCE':
            return '#9c27b0'; // Purple
        case 'PARKING':
            return '#607d8b'; // Blue Grey
        case 'CHALLAN':
            return '#f44336'; // Red
        case 'EMI':
            return '#3f51b5'; // Indigo
        case 'REPAIR':
            return '#ff5722'; // Deep Orange
        default:
            return '#9e9e9e'; // Grey
    }
};

export const formatDate = (dateString: string, formatStr?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (!isValid(date)) return dateString;

    if (formatStr) {
        return format(date, formatStr);
    }

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return format(date, 'MMM dd, yyyy');
    }
};

export const parseDateInput = (dateString: string): Date | null => {
    // Expected format: dd-mm-yyyy
    try {
        const parsedDate = parse(dateString, 'dd-MM-yyyy', new Date());
        if (isValid(parsedDate)) {
            return parsedDate;
        }
        return null;
    } catch (error) {
        return null;
    }
};

export const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
};
