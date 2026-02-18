export type ExpenseType = "Fuel" | "Service" | "Tolls" | "Insurance";

export interface Expense {
  id: string;
  title: string;
  type: ExpenseType;
  amount: number;
  date: string;
  source: string;
  icon: string;
  color: string;
}

export const expenses: Expense[] = [
  {
    id: "1",
    title: "Fuel",
    type: "Fuel",
    amount: 2200,
    date: "Yesterday",
    source: "SMS",
    icon: "gas-pump",
    color: "#4caf50",
  },
  {
    id: "2",
    title: "Fuel",
    type: "Fuel",
    amount: 1800,
    date: "Today",
    source: "Manual",
    icon: "gas-pump",
    color: "#4caf50",
  },
  {
    id: "3",
    title: "Fuel",
    type: "Fuel",
    amount: 3200,
    date: "2 days ago",
    source: "SMS",
    icon: "gas-pump",
    color: "#4caf50",
  },
  {
    id: "4",
    title: "Service",
    type: "Service",
    amount: 4500,
    date: "Today",
    source: "Manual",
    icon: "tools",
    color: "#ff9800",
  },
  {
    id: "5",
    title: "Service",
    type: "Service",
    amount: 2500,
    date: "1 week ago",
    source: "Garage",
    icon: "tools",
    color: "#ff9800",
  },
  {
    id: "6",
    title: "Tolls",
    type: "Tolls",
    amount: 300,
    date: "Yesterday",
    source: "FASTag",
    icon: "road",
    color: "#2196f3",
  },
  {
    id: "7",
    title: "Tolls",
    type: "Tolls",
    amount: 450,
    date: "3 days ago",
    source: "FASTag",
    icon: "road",
    color: "#2196f3",
  },
  {
    id: "8",
    title: "Insurance",
    type: "Insurance",
    amount: 12000,
    date: "1 month ago",
    source: "Policy",
    icon: "shield-alt",
    color: "#9c27b0",
  },
  {
    id: "9",
    title: "Insurance",
    type: "Insurance",
    amount: 6000,
    date: "6 months ago",
    source: "Policy",
    icon: "shield-alt",
    color: "#9c27b0",
  },
  {
    id: "10",
    title: "Fuel",
    type: "Fuel",
    amount: 2100,
    date: "3 days ago",
    source: "SMS",
    icon: "gas-pump",
    color: "#4caf50",
  },
];
