import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "./useMe";

const MESSAGE_SUBJECTS = new Set([
  "User Report",
  "ACCOUNT SUSPENSION",
  "ACCOUNT RESTRICTION",
]);

export const notificationsQueryKey = ["notifications"];

const extractMessageSubject = (content = "") => {
  const firstLine = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "";
  return MESSAGE_SUBJECTS.has(firstLine) ? firstLine : "";
};

const normalizeOpportunity = (opp) => {
  if (!opp) return opp;
  const copy = { ...opp };
  const desc = copy.description || "";
  const match = desc.match(/\(Date:\s*([^\)]+)\)\s*$/);

  if (match) {
    const extracted = match[1].trim();
    copy.description = desc.replace(/\s*\(Date:\s*[^\)]+\)\s*$/, "").trim();
    copy.date = copy.date || extracted;
  }

  return copy;
};

const enrichNotification = async (notification) => {
  if (!notification) return notification;

  if (notification.type === "message" && notification.referenceId) {
    try {
      const response = await fetch(`${API_BASE}/api/chat/messages/${notification.referenceId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const message = await response.json();
        return {
          ...notification,
          _message: message,
          conversationId: notification.conversationId || message.conversationId || null,
          meta: {
            ...(notification.meta || {}),
            messageSubject:
              notification.meta?.messageSubject || extractMessageSubject(message?.content || ""),
          },
        };
      }
    } catch (e) { }

    return notification;
  }

  const applicationId =
    notification.application_id ||
    ((notification.type === "application" || notification.type === "accepted" || notification.type === "rejected")
      ? notification.referenceId
      : null);

  if (applicationId) {
    try {
      const response = await fetch(`${API_BASE}/applications/${applicationId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const application = await response.json();
        if (application?.opportunityId) {
          application.opportunityId = normalizeOpportunity(application.opportunityId);
        }
        return {
          ...notification,
          application,
        };
      }
    } catch (e) { }
  }

  return notification;
};

export const fetchNotificationsData = async () => {
  const response = await fetch(`${API_BASE}/notifications`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load notifications");
  }

  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : [];
  return Promise.all(list.map(enrichNotification));
};

export const notificationQueryOptions = {
  queryKey: notificationsQueryKey,
  queryFn: fetchNotificationsData,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
};

export const useNotifications = () => useQuery(notificationQueryOptions);

const normalizeNotificationId = (notification) =>
  notification?._id || notification?.id || null;

export const mergeNotificationIntoCache = (queryClient, notification) => {
  if (!queryClient || !notification) return;

  const normalized = {
    ...notification,
    _id: normalizeNotificationId(notification),
  };

  if (!normalized._id) return;

  queryClient.setQueryData(notificationsQueryKey, (current = []) => {
    const existingIndex = current.findIndex(
      (entry) => String(normalizeNotificationId(entry)) === String(normalized._id)
    );

    if (existingIndex === -1) {
      return [normalized, ...current];
    }

    const next = current.slice();
    next[existingIndex] = {
      ...next[existingIndex],
      ...normalized,
      _id: normalized._id,
    };
    return next;
  });
};

export const removeNotificationFromCache = (queryClient, notificationId) => {
  if (!queryClient || !notificationId) return;

  queryClient.setQueryData(notificationsQueryKey, (current = []) =>
    current.filter(
      (notification) => String(normalizeNotificationId(notification)) !== String(notificationId)
    )
  );
};

export const clearConversationNotificationsFromCache = (queryClient, conversationId) => {
  if (!queryClient || !conversationId) return;

  queryClient.setQueryData(notificationsQueryKey, (current = []) =>
    current.filter((notification) => {
      const notificationConversationId =
        notification.conversationId ||
        notification._message?.conversationId ||
        notification.meta?.conversationId;

      return String(notificationConversationId || "") !== String(conversationId);
    })
  );
};

export const updateApplicationStatusInNotificationCache = (
  queryClient,
  applicationId,
  status,
  notificationId
) => {
  if (!queryClient || !applicationId || !status) return;

  queryClient.setQueryData(notificationsQueryKey, (current = []) =>
    current.map((notification) => {
      const matchesNotification = notificationId && String(notification._id) === String(notificationId);
      const matchesApplication =
        notification.application && String(notification.application._id) === String(applicationId);

      if (!matchesNotification && !matchesApplication) {
        return notification;
      }

      return {
        ...notification,
        read: matchesNotification ? true : notification.read,
        application: notification.application
          ? {
              ...notification.application,
              status,
            }
          : notification.application,
      };
    })
  );
};

export const markNotificationRead = async (queryClient, notificationId) => {
  if (!notificationId) return false;

  const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
    method: "PUT",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to clear notification");
  }

  removeNotificationFromCache(queryClient, notificationId);
  return true;
};

export const clearConversationNotifications = async (queryClient, conversationId) => {
  if (!conversationId) return false;

  const response = await fetch(`${API_BASE}/notifications/clear-chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });

  if (!response.ok) {
    throw new Error("Failed to clear notifications");
  }

  clearConversationNotificationsFromCache(queryClient, conversationId);
  return true;
};

export const getUnreadNotificationCount = (notifications = []) =>
  notifications.reduce((count, notification) => count + (notification?.read ? 0 : 1), 0);
