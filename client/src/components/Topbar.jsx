import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLoading } from "../Services/LoadingContext";
import { useMe, API_BASE } from "../Services/useMe";
import {
  clearConversationNotificationsFromCache,
  getUnreadNotificationCount,
  mergeNotificationIntoCache,
  removeNotificationFromCache,
  useNotifications,
} from "../Services/useNotifications";
import socket from "../services/socket";
import pushService from "../Services/pushService";
import NotificationPanel, {
  formatNotification,
  truncateNotificationPreview,
} from "./NotificationPanel";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  DARK_THEME,
  LIGHT_THEME,
  resolveThemePreference,
  setThemePreference,
  syncThemeWithStorage,
  syncThemeWithSystemPreference,
} from "../Services/theme";
import useIsMobile from "../Services/useIsMobile";
import "../styles/Topbar.css";
import MessageBox from "./MessageBox";
import Loading from "./Loading";

// ✅ Import SVG icons
import profile from "../assets/icons/profile.svg";
import settings from "../assets/icons/settings.svg";
import logout from "../assets/icons/logout.svg";
import searchIcon from "../assets/icons/search.svg";
import NotificationBell from "./NotificationBell";

const MESSAGE_SUBJECTS = new Set([
  "User Report",
  "ACCOUNT SUSPENSION",
  "ACCOUNT RESTRICTION",
]);

const getStructuredMessageSubject = (content = "") => {
  const firstLine = String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "";
  return MESSAGE_SUBJECTS.has(firstLine) ? firstLine : "";
};

export default function Topbar({ onMenuClick }) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const isAdmin = me?.role === "admin";
  const initial = me?.fullName ? me.fullName.trim().charAt(0).toUpperCase() : "G";
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { setLoading } = useLoading();

  const [notification, setNotification] = useState({ open: false, message: "", type: "info", closing: false });
  const [showNotifications, setShowNotifications] = useState(false);
  const [theme, setTheme] = useState(() => resolveThemePreference());
  const { data: notifications = [] } = useNotifications();
  const isMobile = useIsMobile();

  // Search window state
  const [searchInput, setSearchInput] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchTab, setSearchTab] = useState("opportunities"); // "opportunities" or "mine"
  const [searchApplications, setSearchApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const searchResultsRef = useRef(null);
  // Track processed notification <-> message reference IDs to avoid double-counting
  const processedNotifRefs = useRef(new Set());
  const notificationSoundRef = useRef(null);
  const notificationSoundUnlockedRef = useRef(false);
  const isDarkMode = theme === DARK_THEME;
  const unread = useMemo(() => getUnreadNotificationCount(notifications), [notifications]);
  const toggleNotifications = () => {
    setShowNotifications((s) => {
      const next = !s;
      if (next) setOpen(false);
      return next;
    });
  };

  const toggleUserMenu = () => {
    setOpen((s) => {
      const next = !s;
      if (next) setShowNotifications(false);
      return next;
    });
  };

  const showMessage = (msg, type = "info", duration = 3000) => {
    setNotification({ open: true, message: msg, type, closing: false });
    window.setTimeout(() => {
      setNotification((s) => ({ ...s, closing: true }));
      window.setTimeout(() => setNotification({ open: false, message: "", type: "info", closing: false }), 300);
    }, duration);
  };

  const playNotificationSound = () => {
    const audio = notificationSoundRef.current;
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
      const maybePromise = audio.play();
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(() => {
          try {
            const fallbackAudio = new Audio("/notify.mp3");
            fallbackAudio.preload = "auto";
            fallbackAudio.play().catch(() => { });
          } catch (fallbackError) { }
        });
      }
    } catch (error) { }
  };

  const primeNotificationSound = () => {
    const audio = notificationSoundRef.current;
    if (!audio || notificationSoundUnlockedRef.current) return;

    notificationSoundUnlockedRef.current = true;

    try {
      audio.muted = true;
      audio.currentTime = 0;
      const maybePromise = audio.play();
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
          })
          .catch(() => {
            notificationSoundUnlockedRef.current = false;
            audio.muted = false;
          });
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }
    } catch (error) {
      notificationSoundUnlockedRef.current = false;
      audio.muted = false;
    }
  };

  const shouldPlayNotificationSound = (payload) => {
    if (!payload || !me) {
      return false;
    }

    const myId = String(me._id || me.id || "");
    if (payload.type) {
      if (payload.senderId && myId && String(payload.senderId) === myId) {
        return false;
      }

      return ["message", "application", "accepted", "rejected", "pickup_completed", "pickup_accepted"].includes(payload.type);
    }

    const senderId = payload.sender_id?._id || payload.sender_id;
    if (senderId && myId && String(senderId) === myId) {
      return false;
    }

    return Boolean(payload.conversationId || payload.sender_id);
  };

  useEffect(() => {
    if (typeof Audio === "undefined") return undefined;

    const audio = new Audio("/notify.mp3");
    audio.preload = "auto";
    try { audio.load(); } catch (e) { }
    notificationSoundRef.current = audio;

    const unlockEvents = ["pointerdown", "keydown", "touchstart"];
    const handleUnlock = () => primeNotificationSound();
    unlockEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUnlock, { passive: true });
    });

    return () => {
      unlockEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUnlock);
      });
      notificationSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cleanupSystemTheme = syncThemeWithSystemPreference(setTheme);
    const cleanupStoredTheme = syncThemeWithStorage(setTheme);
    const onThemeChange = (event) => {
      const nextTheme = event?.detail?.theme;
      if (nextTheme === DARK_THEME || nextTheme === LIGHT_THEME) {
        setTheme(nextTheme);
      }
    };

    window.addEventListener("themechange", onThemeChange);

    return () => {
      cleanupSystemTheme();
      cleanupStoredTheme();
      window.removeEventListener("themechange", onThemeChange);
    };
  }, []);

  const handleThemeToggle = (event) => {
    const nextTheme = event.target.checked ? DARK_THEME : LIGHT_THEME;
    setTheme(setThemePreference(nextTheme));
  };

  // Check sessionStorage for any global message set before navigation (e.g., login/register/logout)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('global_message');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.message) {
          showMessage(parsed.message, parsed.type || 'info');
        }
        sessionStorage.removeItem('global_message');
      }
    } catch (e) { }
  }, [me]);

  // Connect socket once the user session is confirmed (works for both NGO and volunteer)
  useEffect(() => {
    if (!me) return; // wait until we know who the user is
    if (!socket.connected) {
      socket.connect();
    }
  }, [me]);

  useEffect(() => {
    const handleSuspended = async (payload) => {
      try {
        setShowNotifications(false);
        setOpen(false);
        try { await pushService.unsubscribePush(); } catch (e) { }
        socket.disconnect();
        queryClient.clear();
        try {
          sessionStorage.setItem(
            "global_message",
            JSON.stringify({
              message: payload?.message || "Your account has been temporarily suspended.",
              type: "error",
            })
          );
        } catch (e) { }
      } finally {
        navigate("/");
      }
    };

    socket.on("account:suspended", handleSuspended);
    return () => {
      socket.off("account:suspended", handleSuspended);
    };
  }, [navigate, queryClient]);

  useEffect(() => {
    const handleAccountRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ["me"] }).catch(() => { });
    };

    socket.on("account:status-updated", handleAccountRefresh);
    socket.on("account:restored", handleAccountRefresh);

    return () => {
      socket.off("account:status-updated", handleAccountRefresh);
      socket.off("account:restored", handleAccountRefresh);
    };
  }, [queryClient]);

  // Initialize push subscription and visibility handlers when socket connects
  useEffect(() => {
    if (!me) return;
    if (!socket) return;
    let cleanupVis = null;
    const onConnected = async () => {
      try {
        // Try subscribe (permission prompt may show)
        await pushService.subscribeForPush();
        cleanupVis = pushService.initVisibilityHandlers(socket);
      } catch (e) { }
    };

    if (socket.connected) onConnected();
    socket.on('connect', onConnected);

    return () => {
      try { socket.off('connect', onConnected); } catch (e) { }
      try { if (cleanupVis) cleanupVis(); } catch (e) { }
    };
  }, [me]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);

    // socket listeners for incoming notifications
    const processedIds = new Set();
    const onNew = (payload) => {
      if (!payload) return;

      const notificationId = payload.id || payload._id;
      if (notificationId) {
        if (processedIds.has(String(notificationId))) return;
        processedIds.add(String(notificationId));
        // keep set size reasonable
        if (processedIds.size > 200) {
          const first = processedIds.values().next().value;
          processedIds.delete(first);
        }
      }

      mergeNotificationIntoCache(queryClient, payload);

      try {
        if (payload.referenceId) {
          if (processedNotifRefs.current.has(String(payload.referenceId))) return;
          processedNotifRefs.current.add(String(payload.referenceId));
          if (processedNotifRefs.current.size > 200) {
            const first = processedNotifRefs.current.values().next().value;
            processedNotifRefs.current.delete(first);
          }
        }
      } catch (e) { }

      // mark conversation as unread if payload includes conversationId
      try {
        const convId = payload && ((payload.meta && payload.meta.conversationId) || payload.conversationId || null);
        if (convId) {
          queryClient.setQueryData(['conversations'], (old = []) =>
            old.map((c) => (String(c._id) === String(convId) ? { ...c, _hasUnread: true } : c))
          );
        }
      } catch (e) { }
      // trigger bell animation via global event
      window.dispatchEvent(new CustomEvent('notify:incoming', { detail: payload }));
    };
    socket.on('notification', onNew);
    const onNotificationRemoved = ({ id }) => {
      if (id) {
        removeNotificationFromCache(queryClient, id);
      }
    };
    const onConversationCleared = ({ conversationId, ids }) => {
      if (conversationId) {
        clearConversationNotificationsFromCache(queryClient, conversationId);
        return;
      }

      if (Array.isArray(ids)) {
        ids.forEach((id) => removeNotificationFromCache(queryClient, id));
      }
    };
    socket.on('notification:removed', onNotificationRemoved);
    socket.on('notification:conversation-cleared', onConversationCleared);
    // Listen for conversation-level clears (Messages opened a conversation)
    const onClearConv = (ev) => {
      try {
        const convId = ev && ev.detail && ev.detail.conversationId;
        if (convId) {
          clearConversationNotificationsFromCache(queryClient, convId);
        }
        // clear per-conversation unread marker
        try {
          if (convId) {
            queryClient.setQueryData(['conversations'], (old = []) =>
              old.map((c) => (String(c._id) === String(convId) ? { ...c, _hasUnread: false } : c))
            );
          }
        } catch (e) { }
        setShowNotifications(false);
      } catch (e) { }
    };
    window.addEventListener('notify:clear-conversation', onClearConv);
    const onClosePanel = () => setShowNotifications(false);
    window.addEventListener('notify:close-panel', onClosePanel);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      socket.off('notification', onNew);
      socket.off('notification:removed', onNotificationRemoved);
      socket.off('notification:conversation-cleared', onConversationCleared);
      window.removeEventListener('notify:clear-conversation', onClearConv);
      window.removeEventListener('notify:close-panel', onClosePanel);
    };
  }, [queryClient]);

  // Show on-screen toast (MessageBox) for incoming notifications/messages
  useEffect(() => {
    const handler = async (ev) => {
      const payload = ev && ev.detail ? ev.detail : null;
      try {
        if (!payload) return;

        if (shouldPlayNotificationSound(payload)) {
          playNotificationSound();
        }

        // Notification from server (has .type) or a message object (has sender_id/conversationId)
        if (payload.type) {
           if (payload.type === 'pickup_completed') {
             setNotification({
               open: true,
               message: { title: 'pickup completed', content: `Your pickup is completed. Click to open.`, icon: 'pickup' },
               type: 'success',
               closing: false
             });
           } else if (payload.type === 'pickup_accepted') {
             const ngo = payload.meta?.ngoName || 'an NGO';
             setNotification({
               open: true,
               message: { title: 'your pickup is accepted', content: `Your pickup is accepted by ${ngo}.`, icon: 'pickup' },
               type: 'info',
               closing: false
             });
           } else {
             const formatted = formatNotification(payload, me);
             setNotification({
               open: true,
               message: { title: formatted.title.toLowerCase(), content: formatted.body, icon: payload.type },
               type: payload.type === 'accepted' ? 'success' : payload.type === 'rejected' ? 'error' : 'info',
               closing: false
             });
           }
        } else if (payload && (payload.conversationId || payload.sender_id)) {
          // Direct message object (from receive-message)
          const sender = payload.sender_id || {};
          const senderName = sender.fullName || sender.name || (payload.name) || 'Someone';
          const subject = getStructuredMessageSubject(payload.content || "");
          let content = '';
          if (me?.role === "admin" && subject === "User Report") {
            content = "";
          } else if (payload.attachments && payload.attachments.length > 0) {
            const t = payload.attachments[0].type;
            content = t === 'image' ? '📷 Photo' : t === 'audio' ? '🎵 Audio' : '📄 File';
          } else content = payload.content || '';
          const contentPreview =
            me?.role === "admin" && subject === "User Report"
              ? ""
              : truncateNotificationPreview(`${senderName} : ${content}`);
          setNotification({
            open: true,
            message: {
              title: me?.role === "admin" && subject === "User Report" ? 'user report' : 'message',
              content: contentPreview,
              icon: 'message'
            },
            type: 'info',
            closing: false
          });
        }
        // auto close
        window.setTimeout(() => {
          setNotification((s) => ({ ...s, closing: true }));
          window.setTimeout(() => setNotification({ open: false, message: "", type: "info", closing: false }), 300);
        }, 3500);
      } catch (e) { }
    };
    window.addEventListener('notify:incoming', handler);
    return () => window.removeEventListener('notify:incoming', handler);
  }, [me]);

  // Global socket listeners for opportunity create/update/delete
  useEffect(() => {
    const normalizeOpportunity = (opp) => {
      if (!opp) return opp;
      const copy = { ...opp };
      const desc = copy.description || "";
      const m = desc.match(/\(Date:\s*([^\)]+)\)\s*$/);
      if (m) {
        const extracted = m[1].trim();
        copy.description = desc.replace(/\s*\(Date:\s*[^\)]+\)\s*$/, "").trim();
        copy.date = copy.date || extracted;
      }
      return copy;
    };

    const onCreated = (payload) => {
      try {
        const opp = normalizeOpportunity(payload && payload.opportunity ? payload.opportunity : payload);
        queryClient.setQueryData(["opportunities"], (old) => {
          const arr = Array.isArray(old) ? old.slice() : [];
          const exists = arr.findIndex((x) => String(x._id || x.id) === String(opp._id || opp.id));
          if (exists !== -1) {
            arr[exists] = opp;
          } else {
            arr.unshift(opp);
          }
          return arr;
        });
      } catch (e) { }
    };

    const onUpdated = (payload) => {
      try {
        const opp = normalizeOpportunity(payload && payload.opportunity ? payload.opportunity : payload);
        queryClient.setQueryData(["opportunities"], (old) => {
          const arr = Array.isArray(old) ? old.slice() : [];
          const idx = arr.findIndex((x) => String(x._id || x.id) === String(opp._id || opp.id));
          if (idx !== -1) arr[idx] = opp;
          else arr.unshift(opp);
          return arr;
        });
      } catch (e) { }
    };

    const onDeleted = (payload) => {
      try {
        const id = payload && (payload.id || payload._id || payload) ? String(payload.id || payload._id || payload) : null;
        if (!id) return;
        queryClient.setQueryData(["opportunities"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((x) => String(x._id || x.id) !== id);
        });
      } catch (e) { }
    };

    const attachHandlers = () => {
      try {
        socket.off('opportunity:created', onCreated);
        socket.off('opportunity:updated', onUpdated);
        socket.off('opportunity:deleted', onDeleted);
      } catch (e) { }
      socket.on('opportunity:created', onCreated);
      socket.on('opportunity:updated', onUpdated);
      socket.on('opportunity:deleted', onDeleted);
    };

    attachHandlers();

    const onConnect = () => attachHandlers();
    const onDisconnect = () => { };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      try {
        socket.off('opportunity:created', onCreated);
        socket.off('opportunity:updated', onUpdated);
        socket.off('opportunity:deleted', onDeleted);
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
      } catch (e) { }
    };
  }, [me, queryClient]);

  // Global socket listeners for pickup events
  useEffect(() => {
    if (!socket) return;
    
    const updatePickupCache = (pickup) => {
      try {
        queryClient.setQueryData(["pickups"], (old) => {
           if (!old) return [pickup];
           const index = old.findIndex(p => String(p._id) === String(pickup._id));
           if (index > -1) {
              const next = [...old];
              next[index] = pickup;
              return next;
           }
           return [pickup, ...old];
        });
      } catch (e) { }
    };

    const deletePickupCache = (payload) => {
      try {
        const id = payload && (payload.id || payload._id || payload) ? String(payload.id || payload._id || payload) : null;
        if (!id) return;
        queryClient.setQueryData(["pickups"], (old) => {
           if (!old) return [];
           return old.filter(p => String(p._id) !== String(id));
        });
      } catch (e) { }
    };

    const handlePickupCompleted = (data) => {
      if (me && String(data.initiatorId) === String(me._id || me.id)) return;

      queryClient.setQueryData(["dashboard"], (old) => {
        if (!old) return old;
        return {
          ...old,
          co2Saved: (old.co2Saved || 0) + (data.co2Saved || 0),
          completedCount: (old.completedCount || 0) + 1
        };
      });

      updatePickupCache(data);
    };

    const attachHandlers = () => {
      try {
        socket.off('pickup:created', updatePickupCache);
        socket.off('pickup:updated', updatePickupCache);
        socket.off('pickup:accepted', updatePickupCache);
        socket.off('pickup:completed', handlePickupCompleted);
        socket.off('pickup:deleted', deletePickupCache);
      } catch (e) { }

      socket.on('pickup:created', updatePickupCache);
      socket.on('pickup:updated', updatePickupCache);
      socket.on('pickup:accepted', updatePickupCache);
      socket.on('pickup:completed', handlePickupCompleted);
      socket.on('pickup:deleted', deletePickupCache);
    };

    attachHandlers();

    return () => {
      try {
        socket.off('pickup:created', updatePickupCache);
        socket.off('pickup:updated', updatePickupCache);
        socket.off('pickup:accepted', updatePickupCache);
        socket.off('pickup:completed', handlePickupCompleted);
        socket.off('pickup:deleted', deletePickupCache);
      } catch (e) {}
    };
  }, [me, queryClient]);

  // Global socket listeners for chat events so UI updates even when Messages
  // component is not mounted. This ensures volunteers/NGOs see incoming chats
  // and new conversations without having to visit the Messages page.
  useEffect(() => {
    const onReceiveMessage = (msg) => {
      try {
        const convId = String(msg.conversationId);
        const sender = msg.sender_id || {};
        const shapedConv = {
          _id: convId,
          type: 'direct',
          name: sender.fullName || '',
          username: sender.username || '',
          otherUserId: sender._id || msg.sender_id,
          lastMessage: { content: msg.content || (msg.attachments?.[0]?.type === 'image' ? '📷 Photo' : msg.attachments?.[0]?.type === 'audio' ? '🎵 Audio' : '📄 File'), timestamp: msg.timestamp },
          updatedAt: msg.timestamp,
        };

        if (shapedConv?.lastMessage) {
          shapedConv.lastMessage.content =
            getStructuredMessageSubject(msg.content || "") ||
            shapedConv.lastMessage.content;
        }

        queryClient.setQueryData(['conversations'], (old = []) => {
          const exists = old.some((c) => String(c._id) === convId);
          const merged = exists
            ? old.map((c) => (String(c._id) === convId ? { ...c, ...shapedConv } : c))
            : [shapedConv, ...old];
          return merged.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        });

        // Don't increment unread when the user is actively viewing Messages
        // or when the message belongs to the conversation they're actively
        // viewing (avoid bell increments while reading the open chat).
        try {
          if (typeof window !== 'undefined' && window.__IN_MESSAGES) return;
          if (typeof window !== 'undefined' && window.__ACTIVE_CONV_ID && String(window.__ACTIVE_CONV_ID) === convId) return;
        } catch (e) { }

        // Ignore messages originating from myself (multi-tab sender echo)
        try {
          const senderId = msg.sender_id && (msg.sender_id._id || msg.sender_id);
          if (senderId && me && String(senderId) === String(me._id || me.id)) return;
        } catch (e) { }

        // Notify topbar (unread count) and emit global event for UI badges
        // If a notification for this same message has already been processed
        // (or vice-versa), avoid double-incrementing the unread count.
        try {
          const mid = String(msg._id || msg.id);
          if (mid && processedNotifRefs.current.has(mid)) return;
          if (mid) {
            processedNotifRefs.current.add(mid);
            if (processedNotifRefs.current.size > 200) {
              const first = processedNotifRefs.current.values().next().value;
              processedNotifRefs.current.delete(first);
            }
          }
        } catch (e) { }

        // mark conversation as having unread messages (used by Messages chat list)
        try {
          const convId = String(msg.conversationId);
          if (convId) {
            queryClient.setQueryData(['conversations'], (old = []) =>
              old.map((c) => (String(c._id) === convId ? { ...c, _hasUnread: true } : c))
            );
          }
        } catch (e) { }

        window.dispatchEvent(new CustomEvent('notify:incoming', { detail: msg }));
      } catch (e) { }
    };

    const onConversationCreated = ({ conversation }) => {
      try {
        if (!conversation) return;
        queryClient.setQueryData(['conversations'], (old = []) => {
          const exists = old.some((c) => String(c._id) === String(conversation._id));
          const merged = exists
            ? old.map((c) => (String(c._id) === String(conversation._id) ? { ...c, ...conversation } : c))
            : [conversation, ...old];
          return merged.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        });
      } catch (e) { }
    };

    socket.on('receive-message', onReceiveMessage);
    socket.on('conversation-created', onConversationCreated);

    return () => {
      socket.off('receive-message', onReceiveMessage);
      socket.off('conversation-created', onConversationCreated);
    };
  }, [queryClient]);

  // Fetch search applications when searching
  useEffect(() => {
    if (!me || me.role !== "volunteer" || searchInput.trim() === "") {
      setSearchApplications([]);
      return;
    }

    const fetchApplications = async () => {
      setApplicationsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/applications/my`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const applications = Array.isArray(data) ? data : [];

        // Filter applications that match the search input
        const searchLower = searchInput.toLowerCase();
        const filtered = applications.filter((app) => {
          const opp = app.opportunityId;
          if (!opp) return false;
          const title = opp.title || "";
          const desc = opp.description || "";
          return title.toLowerCase().includes(searchLower) || desc.toLowerCase().includes(searchLower);
        });
        setSearchApplications(filtered);
      } catch (e) {
        setSearchApplications([]);
      } finally {
        setApplicationsLoading(false);
      }
    };

    fetchApplications();
  }, [searchInput, me]);

  // Listen to topbar search input changes
  useEffect(() => {
    const topInput = document.querySelector('.topbar-search');
    if (!topInput) return;

    const onInput = (e) => {
      const value = e.target?.value || "";
      setSearchInput(value);
      setShowSearchResults(value.trim().length > 0);
    };

    const onFocus = () => {
      if (searchInput.trim().length > 0) {
        setShowSearchResults(true);
      }
    };

    topInput.addEventListener('input', onInput);
    topInput.addEventListener('focus', onFocus);

    return () => {
      topInput.removeEventListener('input', onInput);
      topInput.removeEventListener('focus', onFocus);
    };
  }, [searchInput]);

  // Close search results on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(e.target)) {
        const topInput = document.querySelector('.topbar-search');
        if (!topInput || !topInput.contains(e.target)) {
          setShowSearchResults(false);
        }
      }
    };

    if (showSearchResults) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showSearchResults]);

  // Clear search input when navigating away
  useEffect(() => {
    return () => {
      const topInput = document.querySelector('.topbar-search');
      if (topInput) {
        topInput.value = '';
      }
      setSearchInput("");
      setShowSearchResults(false);
    };
  }, []);

  const normalizeOpportunity = (opp) => {
    if (!opp) return opp;
    const copy = { ...opp };
    const desc = copy.description || "";
    const m = desc.match(/\(Date:\s*([^\)]+)\)\s*$/);
    if (m) {
      const extracted = m[1].trim();
      copy.description = desc.replace(/\s*\(Date:\s*[^\)]+\)\s*$/, "").trim();
      copy.date = copy.date || extracted;
    }
    return copy;
  };

  // Fetch opportunities with proper normalization
  const { data: cachedOpportunities } = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/opportunities`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load opportunities');
      const data = await res.json();
      return Array.isArray(data) ? data.map(normalizeOpportunity) : [];
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const filteredSearchResults = useMemo(() => {
    if (!cachedOpportunities || searchInput.trim() === "") {
      return [];
    }

    const searchLower = searchInput.toLowerCase();
    let results = cachedOpportunities.map(normalizeOpportunity).filter((opp) => {
      const title = opp.title || "";
      const desc = opp.description || "";
      return title.toLowerCase().includes(searchLower) || desc.toLowerCase().includes(searchLower);
    });

    // Filter based on tab
    if (searchTab === "mine" && me?.role === "ngo") {
      const myId = me?.id || me?._id;
      results = results.filter((o) => {
        const owner = o.ngo_id || o.NGO_ID;
        const ownerId = (owner && owner._id) || owner;
        return ownerId && String(ownerId) === String(myId);
      });
    }

    return results;
  }, [cachedOpportunities, searchInput, searchTab, me]);

  return (
    <div className="topbar">
      <div className="topbar-left">
        {isMobile && (
          <button
            className="topbar-menu-btn"
            aria-label="Open navigation"
            onClick={() => onMenuClick && onMenuClick()}
          >
            <span />
            <span />
            <span />
          </button>
        )}
        <div className="topbar-search-wrapper">
          <img src={searchIcon} alt="Search" className="search-icon" />
          <input
            className="topbar-search"
            placeholder={isAdmin ? "search opportunity" : "Search pickups, opportunities..."}
            value={searchInput}
            onChange={(e) => {
              const value = e.target.value;
              setSearchInput(value);
              setShowSearchResults(value.trim().length > 0);
              // Dispatch input event for Opportunities component to listen
              e.target.dispatchEvent(new Event('input', { bubbles: true }));
            }}
            onFocus={() => {
              if (searchInput.trim().length > 0) {
                setShowSearchResults(true);
              }
            }}
          />
        </div>

        {/* Search Results Window */}
        {showSearchResults && (
          <div
            ref={searchResultsRef}
            className="topbar-search-results"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toggle Switch */}
            {me && !isAdmin && (
              <label className="search-results-switch" aria-label="Toggle Search Filter">
                <input
                  type="checkbox"
                  checked={searchTab === "mine"}
                  onChange={(e) => setSearchTab(e.target.checked ? "mine" : "opportunities")}
                />
                <span>Opportunities</span>
                <span>{me.role === "volunteer" ? "My Applications" : "My Opportunities"}</span>
              </label>
            )}

            {/* Results */}
            <div className="search-results-container">
              {isAdmin || searchTab === "opportunities" ? (
                filteredSearchResults.length === 0 ? (
                  <div className="search-no-results">No opportunities found</div>
                ) : (
                  <div className="search-results-list">
                    {filteredSearchResults.map((opp) => (
                      <div
                        key={opp._id || opp.id}
                        className="search-result-item"
                        onClick={() => {
                          const topInput = document.querySelector('.topbar-search');
                          if (topInput) {
                            topInput.value = '';
                          }
                          setSearchInput("");
                          setShowSearchResults(false);
                          navigate(`/home/opportunities`, { state: { openId: opp._id || opp.id } });
                        }}
                      >
                        <div className="search-result-title">{opp.title}</div>
                        <div className="search-result-meta">
                          {opp.date && <span className="search-result-date">{opp.date}</span>}
                          {opp.city && <span className="search-result-city">{opp.city}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : me?.role === "volunteer" ? (
                applicationsLoading ? (
                  <div className="search-no-results">Loading...</div>
                ) : searchApplications.length === 0 ? (
                  <div className="search-no-results">No applications found</div>
                ) : (
                  <div className="search-results-list">
                    {searchApplications.map((app) => {
                      const opp = app.opportunityId || {};
                      return (
                        <div
                          key={app._id || app.id}
                          className="search-result-item"
                          onClick={() => {
                            const topInput = document.querySelector('.topbar-search');
                            if (topInput) {
                              topInput.value = '';
                            }
                            setSearchInput("");
                            setShowSearchResults(false);
                            navigate(`/home/opportunities`, { state: { openId: opp._id || opp.id } });
                          }}
                        >
                          <div className="search-result-title">{opp.title}</div>
                          <div className="search-result-meta">
                            {opp.date && <span className="search-result-date">{opp.date}</span>}
                            <span className={`search-result-status search-result-status-${(app.status || 'pending').toLowerCase()}`}>
                              {(app.status || 'pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                filteredSearchResults.length === 0 ? (
                  <div className="search-no-results">No opportunities found</div>
                ) : (
                  <div className="search-results-list">
                    {filteredSearchResults.map((opp) => (
                      <div
                        key={opp._id || opp.id}
                        className="search-result-item"
                        onClick={() => {
                          const topInput = document.querySelector('.topbar-search');
                          if (topInput) {
                            topInput.value = '';
                          }
                          setSearchInput("");
                          setShowSearchResults(false);
                          navigate(`/home/opportunities`, { state: { openId: opp._id || opp.id } });
                        }}
                      >
                        <div className="search-result-title">{opp.title}</div>
                        <div className="search-result-meta">
                          {opp.date && <span className="search-result-date">{opp.date}</span>}
                          {opp.city && <span className="search-result-city">{opp.city}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <div className="topbar-right" ref={menuRef}>
        <div className="icon-btn" aria-label="notifications" style={{ position: 'relative' }}>
          <div onClick={toggleNotifications} style={{ cursor: 'pointer' }}>
            <NotificationBell />
            {unread > 0 && (
              <div style={{ position: 'absolute', right: 0, top: -4, background: 'var(--danger)', color: 'var(--text-inverse)', borderRadius: '10px', padding: '2px 6px', fontSize: 12, boxShadow: 'var(--shadow-soft)' }}>
                {unread}
              </div>
            )}
          </div>

          {showNotifications && (
            <div className="notification-popover">
              <div className="notification-popover__header">
                <div>
                  <div className="notification-popover__title">Notifications</div>
                  <div className="notification-popover__meta">{unread} unread</div>
                </div>
                <button
                  type="button"
                  className="notification-popover__close"
                  aria-label="Close notifications"
                  onClick={() => setShowNotifications(false)}
                >
                  ×
                </button>
              </div>
              <div className="notification-popover__body">
                <NotificationPanel />
              </div>
            </div>
          )}
        </div>
        <div className="user-circle" title={me?.fullName || "Guest"} onClick={toggleUserMenu}>{initial}</div>

        {open && (
          <div className="topbar-menu">
            <div className="menu-content">
              <div className="menu-name">{me?.fullName || "Guest"}</div>
              <label className="menu-theme-row">
                <div className="menu-theme-copy">
                  <span>Dark Mode</span>
                  <small>{isDarkMode ? "Enabled" : "Disabled"}</small>
                </div>
                <input
                  className="menu-theme-toggle"
                  type="checkbox"
                  role="switch"
                  aria-label="Toggle dark mode"
                  checked={isDarkMode}
                  onChange={handleThemeToggle}
                />
              </label>
              <button className="menu-item" onClick={() => { setOpen(false); navigate('/home/profile'); }}><img src={profile} alt="Profile" className="menu-icon" /> Profile</button>
              <button className="menu-item" onClick={() => { setOpen(false); navigate('/home/settings'); }}><img src={settings} alt="Settings" className="menu-icon" /> Settings</button>
              <button
                className="menu-item menu-logout"
                onClick={async () => {
                  setOpen(false);
                  try {
                    // show global loader during logout
                    setLoading(true);
                    await fetch(`${API_BASE}/auth/logout`, {
                      method: "POST",
                      credentials: "include"
                    });
                    // Remove push subscription for this device before disconnect
                    try { await pushService.unsubscribePush(); } catch (e) { }
                    // Disconnect socket so it doesn't reconnect with stale session
                    socket.disconnect();
                    // Clear all cached data on logout
                    queryClient.clear();
                    // set a global message to show on the landing page
                    try { sessionStorage.setItem('global_message', JSON.stringify({ message: 'Logout successful', type: 'success' })); } catch (e) { }
                  } catch (err) {
                    // ignore network errors
                  } finally {
                    setLoading(false);
                  }
                  navigate('/');
                }}
              >
                <img src={logout} alt="Logout" className="menu-icon" /> Logout
              </button>
            </div>
          </div>
        )}
      </div>
      {notification.open && (
        <MessageBox message={notification.message} type={notification.type} closing={notification.closing} />
      )}
      <Loading isLoading={false} />
    </div>
  );
}
