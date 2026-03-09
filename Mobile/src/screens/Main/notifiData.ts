export type NotificationType =
  | "insurance"
  | "service"
  | "expense"
  | "fuel"
  | "alert"
  | "maintenance";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

export const notifications: NotificationItem[] = [
  {
    id: "1",
    type: "insurance",
    title: "Insurance Expiring Soon",
    description: "Your vehicle insurance will expire on Mar 15, 2025",
    time: "2 hours ago",
    unread: true,
  },
  {
    id: "2",
    type: "service",
    title: "Service Completed",
    description: "Your vehicle service has been completed successfully",
    time: "1 day ago",
    unread: true,
  },
  {
    id: "3",
    type: "expense",
    title: "Expense Added",
    description: "Fuel expense of ₹2,500 has been recorded",
    time: "2 days ago",
    unread: false,
  },
  {
    id: "4",
    type: "maintenance",
    title: "Maintenance Reminder",
    description: "Engine oil change due in 500 km",
    time: "3 days ago",
    unread: false,
  },

  {
    id: "5",
    type: "fuel",
    title: "Fuel Refill Logged",
    description: "₹1,800 fuel refill recorded for your vehicle",
    time: "4 days ago",
    unread: true,
  },
  {
    id: "6",
    type: "service",
    title: "Service Reminder",
    description: "Your next vehicle service is due in 10 days",
    time: "5 days ago",
    unread: false,
  },
  {
    id: "7",
    type: "insurance",
    title: "Policy Renewal Reminder",
    description: "Renew your insurance to avoid coverage interruption",
    time: "1 week ago",
    unread: false,
  },
  {
    id: "8",
    type: "expense",
    title: "Parking Expense Added",
    description: "Parking fee of ₹120 has been added",
    time: "1 week ago",
    unread: false,
  },
  {
    id: "9",
    type: "maintenance",
    title: "Tire Pressure Check",
    description: "Recommended to check tire pressure for better mileage",
    time: "8 days ago",
    unread: false,
  },
  {
    id: "10",
    type: "alert",
    title: "Low Battery Warning",
    description: "Your vehicle battery voltage is below normal range",
    time: "10 days ago",
    unread: true,
  },
  {
    id: "11",
    type: "expense",
    title: "Toll Payment Recorded",
    description: "Toll payment of ₹90 has been logged",
    time: "11 days ago",
    unread: false,
  },
  {
    id: "12",
    type: "maintenance",
    title: "Brake Inspection Suggested",
    description: "Brake pads should be inspected during next service",
    time: "12 days ago",
    unread: false,
  }
];