const name = "sk-coder-notifications"
export function notificationsEnabled() { return localStorage.getItem(name) === "true" }
export function setNotificationsEnabled(value: boolean) { localStorage.setItem(name, String(value)) }
export async function requestWebPermission() { if (!("Notification" in window)) return "denied" as NotificationPermission; return Notification.requestPermission() }
