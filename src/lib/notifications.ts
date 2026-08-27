export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
}

export function getNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem("medistock.notifications");
  return stored ? JSON.parse(stored) : [];
}

export function saveNotifications(items: NotificationItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("medistock.notifications", JSON.stringify(items));
  window.dispatchEvent(new Event("medistock.notifications_changed"));
}

export function addNotification(title: string, description: string) {
  const items = getNotifications();
  const newItem: NotificationItem = {
    id: Math.random().toString(36).substring(2, 11),
    title,
    description,
    timestamp: new Date().toISOString(),
    unread: true,
  };
  saveNotifications([newItem, ...items]);
}

export function markAllAsRead() {
  const items = getNotifications();
  const updated = items.map((item) => ({ ...item, unread: false }));
  saveNotifications(updated);
}

export function clearNotifications() {
  saveNotifications([]);
}
