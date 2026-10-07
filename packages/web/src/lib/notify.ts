"use client";

/**
 * Ask once, at the moment the user starts a run, whether we may notify them when it finishes.
 */
export async function requestCompletionNotifications() {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    // Some browsers only allow callback-style requests; skip quietly.
  }
}

export function notifyCompletion(title: string, body: string, href: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  const n = new Notification(title, { body, icon: "/icon.svg", tag: href });
  n.onclick = () => {
    window.focus();
    window.location.assign(href);
    n.close();
  };
}
