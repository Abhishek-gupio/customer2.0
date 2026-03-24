export type NotificationType =
  | "insurance"
  | "service"
  | "expense"
  | "fuel"
  | "alert"
  | "maintenance"
  | "parking"
  | "odometer";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  pinned?: boolean;
}
