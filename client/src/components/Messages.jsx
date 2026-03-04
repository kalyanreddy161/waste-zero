import React, { useState, useRef, useEffect } from "react";
import "../styles/NavbarComponents-styles/Messages.css";

/* ─────────────── DUMMY DATA ─────────────── */
const CURRENT_USER = { id: "me", name: "You", initials: "YO" };

const DUMMY_CHATS = [
  {
    id: "c1",
    name: "Riya Sharma",
    initials: "RS",
    avatarVariant: "",
    lastMessage: "🎵 Audio",
    lastMessageType: "audio",
    time: "15:28",
    unread: 2,
    online: true,
  },
  {
    id: "c2",
    name: "Eco Warriors NGO",
    initials: "EW",
    avatarVariant: "secondary",
    lastMessage: "Thanks for joining the cleanup!",
    lastMessageType: "text",
    time: "14:05",
    unread: 0,
    online: false,
  },
  {
    id: "c3",
    name: "Arjun Mehta",
    initials: "AM",
    avatarVariant: "accent",
    lastMessage: "📄 Project_Proposal.pdf",
    lastMessageType: "doc",
    time: "11:22",
    unread: 1,
    online: true,
  },
  {
    id: "c4",
    name: "WasteZero Team",
    initials: "WZ",
    avatarVariant: "secondary",
    lastMessage: "📷 Photo",
    lastMessageType: "image",
    time: "Yesterday",
    unread: 0,
    online: false,
  },
  {
    id: "c5",
    name: "Priya Patel",
    initials: "PP",
    avatarVariant: "",
    lastMessage: "See you at the event!",
    lastMessageType: "text",
    time: "Yesterday",
    unread: 0,
    online: false,
  },
];

const DUMMY_SEARCH_USERS = [
  { id: "u1", name: "Rahul Kumar", initials: "RK", avatarVariant: "secondary", role: "Volunteer" },
  { id: "u2", name: "Sneha Reddy", initials: "SR", avatarVariant: "", role: "NGO Admin" },
  { id: "u3", name: "Mohammed Ali", initials: "MA", avatarVariant: "accent", role: "Volunteer" },
];

const DUMMY_MESSAGES = {
  c1: [
    {
      id: "m1",
      senderId: "other",
      type: "text",
      content: "Hey! Did you see the event update? 🌿",
      time: "14:50",
    },
    {
      id: "m2",
      senderId: "me",
      type: "text",
      content: "Yes! I just registered. Super excited about the clean-up drive 🎉",
      time: "14:52",
    },
    {
      id: "m3",
      senderId: "other",
      type: "image",
      content: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
      fileName: "cleanup_poster.jpg",
      time: "14:55",
    },
    {
      id: "m4",
      senderId: "me",
      type: "text",
      content: "Wow, looks amazing! Sharing this with the team right away.",
      time: "14:57",
    },
    {
      id: "m5",
      senderId: "other",
      type: "audio",
      content: "https://ik.imagekit.io/demo/sample-audio.mp3",
      duration: "0:15",
      time: "15:10",
    },
    {
      id: "m6",
      senderId: "me",
      type: "doc",
      content: "https://example.com/volunteer_guide.pdf",
      fileName: "Volunteer_Guide.pdf",
      fileSize: "1.2 MB",
      time: "15:20",
    },
    {
      id: "m7",
      senderId: "other",
      type: "text",
      content: "Perfect, see you there! 👋",
      time: "15:28",
    },
  ],
  c2: [
    {
      id: "m1",
      senderId: "other",
      type: "text",
      content: "Welcome to Eco Warriors! Glad to have you onboard.",
      time: "Yesterday",
    },
    {
      id: "m2",
      senderId: "me",
      type: "text",
      content: "Thank you! Looking forward to contributing.",
      time: "Yesterday",
    },
    {
      id: "m3",
      senderId: "other",
      type: "text",
      content: "Thanks for joining the cleanup!",
      time: "14:05",
    },
  ],
  c3: [
    {
      id: "m1",
      senderId: "other",
      type: "doc",
      content: "https://example.com/project_proposal.pdf",
      fileName: "Project_Proposal.pdf",
      fileSize: "3.5 MB",
      time: "11:22",
    },
    {
      id: "m2",
      senderId: "me",
      type: "text",
      content: "Got the document, will review and get back to you!",
      time: "11:25",
    },
  ],
  c4: [
    {
      id: "m1",
      senderId: "other",
      type: "image",
      content: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&q=80",
      fileName: "team_photo.jpg",
      time: "Yesterday",
    },
  ],
  c5: [
    {
      id: "m1",
      senderId: "me",
      type: "text",
      content: "Looking forward to the event!",
      time: "Yesterday",
    },
    {
      id: "m2",
      senderId: "other",
      type: "text",
      content: "See you at the event!",
      time: "Yesterday",
    },
  ],
};

/* ─────────────── SUB-COMPONENTS ─────────────── */

/* Avatar */
function Avatar({ initials, variant = "", size = 46 }) {
  return (
    <div
      className={`msg-chat-avatar${variant ? ` ${variant}` : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.37 }}
    >
      {initials}
    </div>
  );
}

/* ─── Chat list item ─── */
function ChatItem({ chat, isActive, onClick }) {
  const previewIcon =
    chat.lastMessageType === "audio"
      ? "🎵 "
      : chat.lastMessageType === "image"
        ? "📷 "
        : chat.lastMessageType === "doc"
          ? "📄 "
          : "";

  return (
    <div
      className={`msg-chat-item${isActive ? " active" : ""}`}
      onClick={() => onClick(chat)}
    >
      <div style={{ position: "relative" }}>
        <Avatar initials={chat.initials} variant={chat.avatarVariant} />
        {chat.online && (
          <span
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#08C18A",
              border: "2px solid #fff",
            }}
          />
        )}
      </div>
      <div className="msg-chat-info">
        <div className="msg-chat-name">{chat.name}</div>
        <div className="msg-chat-preview">
          <span className="preview-icon">{previewIcon}</span>
          {chat.lastMessage.replace(/^[🎵📷📄]\s*/, "")}
        </div>
      </div>
      <div className="msg-chat-meta">
        <span className="msg-chat-time">{chat.time}</span>
        {chat.unread > 0 && (
          <span className="msg-unread-badge">{chat.unread}</span>
        )}
      </div>
    </div>
  );
}

/* ─── Text Message ─── */
function TextMessage({ msg, isSent, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={`msg-row ${isSent ? "sent" : "received"} msg-fade-in`}>
      {!isSent && (
        <div className="msg-row-avatar">
          {DUMMY_CHATS.find(() => true)?.initials?.slice(0, 2) || "U"}
        </div>
      )}
      <div className="msg-bubble-wrap">
        <div className="msg-bubble">
          {msg.content}
          {/* Dropdown arrow */}
          <button
            className="msg-dropdown-trigger"
            onClick={() => setOpen((v) => !v)}
            title="Options"
          >
            <DownArrowIcon />
          </button>
          {/* Dropdown menu */}
          {open && (
            <div className="msg-dropdown-menu" ref={menuRef}>
              {isSent && (
                <button
                  className="msg-dropdown-item danger"
                  onClick={() => { setOpen(false); onDelete(msg.id); }}
                >
                  <TrashIcon /> Delete
                </button>
              )}
              {!isSent && (
                <button
                  className="msg-dropdown-item"
                  onClick={() => setOpen(false)}
                >
                  <CopyIcon /> Copy
                </button>
              )}
            </div>
          )}
        </div>
        <div className="msg-bubble-time">
          {msg.time}
          {isSent && (
            <span className="msg-ticks read">
              <CheckDoubleIcon />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Image Message ─── */
function ImageMessage({ msg, isSent, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = msg.content;
    link.download = msg.fileName || "image.jpg";
    link.target = "_blank";
    link.click();
  };

  return (
    <div className={`msg-row ${isSent ? "sent" : "received"} msg-fade-in`}>
      {!isSent && <div className="msg-row-avatar">UC</div>}
      <div className="msg-bubble-wrap">
        <div className="msg-bubble media-bubble" style={{ padding: 0, background: "none", boxShadow: "none" }}>
          <div className="msg-image-wrap">
            <img src={msg.content} alt={msg.fileName || "image"} />
            {/* Hover overlay with download */}
            <div className="msg-image-overlay">
              <button onClick={handleDownload}>
                <DownloadIcon /> Download
              </button>
            </div>
          </div>
          {/* Dropdown */}
          <button
            className="msg-dropdown-trigger"
            onClick={() => setOpen((v) => !v)}
            title="Options"
            style={{ position: "absolute", top: 6, right: isSent ? "auto" : -28, left: isSent ? -28 : "auto" }}
          >
            <DownArrowIcon />
          </button>
          {open && (
            <div className="msg-dropdown-menu" ref={menuRef}>
              <button className="msg-dropdown-item" onClick={() => { handleDownload(); setOpen(false); }}>
                <DownloadIcon /> Download
              </button>
              {isSent && (
                <button
                  className="msg-dropdown-item danger"
                  onClick={() => { setOpen(false); onDelete(msg.id); }}
                >
                  <TrashIcon /> Delete
                </button>
              )}
            </div>
          )}
        </div>
        <div className="msg-bubble-time">
          {msg.time}
          {isSent && <span className="msg-ticks read"><CheckDoubleIcon /></span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Audio Message ─── */
function AudioMessage({ msg, isSent, onDelete }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(35);
  const [open, setOpen] = useState(false);
  const menuRef = useRef();
  const audioRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => { });
    }
    setPlaying((v) => !v);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const pct = (audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100;
    setProgress(pct);
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
  };

  return (
    <div className={`msg-row ${isSent ? "sent" : "received"} msg-fade-in`}>
      {!isSent && <div className="msg-row-avatar">UC</div>}
      <div className="msg-bubble-wrap">
        <div className="msg-bubble">
          <audio
            ref={audioRef}
            src={msg.content}
            muted={muted}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setPlaying(false)}
            style={{ display: "none" }}
          />
          <div className="msg-audio-player">
            <button className="msg-audio-play-btn" onClick={togglePlay} title={playing ? "Pause" : "Play"}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="msg-audio-controls">
              <div
                className="msg-audio-progress"
                onClick={handleProgressClick}
                title="Seek"
              >
                <div className="msg-audio-filled" style={{ width: `${progress}%` }} />
              </div>
              <div className="msg-audio-bottom">
                <span className="msg-audio-time-info">0:15</span>
                <button
                  className="msg-audio-mute-btn"
                  onClick={() => setMuted((v) => !v)}
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <MuteIcon /> : <VolumeIcon />}
                </button>
              </div>
            </div>
          </div>
          {/* Dropdown */}
          <button
            className="msg-dropdown-trigger"
            onClick={() => setOpen((v) => !v)}
            title="Options"
          >
            <DownArrowIcon />
          </button>
          {open && (
            <div className="msg-dropdown-menu" ref={menuRef}>
              {isSent && (
                <button
                  className="msg-dropdown-item danger"
                  onClick={() => { setOpen(false); onDelete(msg.id); }}
                >
                  <TrashIcon /> Delete
                </button>
              )}
              {!isSent && (
                <button className="msg-dropdown-item" onClick={() => setOpen(false)}>
                  <DownloadIcon /> Download
                </button>
              )}
            </div>
          )}
        </div>
        <div className="msg-bubble-time">
          {msg.time}
          {isSent && <span className="msg-ticks read"><CheckDoubleIcon /></span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Document Message ─── */
function DocMessage({ msg, isSent, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = msg.content;
    link.download = msg.fileName || "document";
    link.target = "_blank";
    link.click();
  };

  return (
    <div className={`msg-row ${isSent ? "sent" : "received"} msg-fade-in`}>
      {!isSent && <div className="msg-row-avatar">UC</div>}
      <div className="msg-bubble-wrap">
        <div className="msg-bubble">
          <div className="msg-doc-box">
            <div className="msg-doc-icon">
              <DocIcon />
            </div>
            <div className="msg-doc-info">
              <div className="msg-doc-name">{msg.fileName || "Document"}</div>
              <div className="msg-doc-size">{msg.fileSize || "—"}</div>
            </div>
            <button
              className="msg-doc-dl-btn"
              onClick={handleDownload}
              title="Download"
            >
              <DownloadIcon />
            </button>
          </div>
          {/* Dropdown */}
          <button
            className="msg-dropdown-trigger"
            onClick={() => setOpen((v) => !v)}
            title="Options"
          >
            <DownArrowIcon />
          </button>
          {open && (
            <div className="msg-dropdown-menu" ref={menuRef}>
              <button className="msg-dropdown-item" onClick={() => { handleDownload(); setOpen(false); }}>
                <DownloadIcon /> Download
              </button>
              {isSent && (
                <button
                  className="msg-dropdown-item danger"
                  onClick={() => { setOpen(false); onDelete(msg.id); }}
                >
                  <TrashIcon /> Delete
                </button>
              )}
            </div>
          )}
        </div>
        <div className="msg-bubble-time">
          {msg.time}
          {isSent && <span className="msg-ticks read"><CheckDoubleIcon /></span>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── MAIN COMPONENT ─────────────── */
const Messages = () => {
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputText, setInputText] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const messagesEndRef = useRef(null);

  /* Load messages when chat changes */
  useEffect(() => {
    if (activeChat) {
      setMessages((prev) => ({
        ...prev,
        [activeChat.id]: DUMMY_MESSAGES[activeChat.id] || [],
      }));
    }
  }, [activeChat]);

  /* Scroll to bottom */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChat]);

  /* ── Search users ── */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    // Simulate API search
    const filtered = DUMMY_SEARCH_USERS.filter((u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setSearchResults(filtered);
  }, [searchQuery]);

  /* ── Select chat ── */
  const handleSelectChat = (chat) => {
    setActiveChat(chat);
  };

  /* ── Select from search ── */
  const handleSelectSearchUser = (user) => {
    const newChat = {
      id: user.id,
      name: user.name,
      initials: user.initials,
      avatarVariant: user.avatarVariant,
      lastMessage: "Start a conversation",
      lastMessageType: "text",
      time: "Now",
      unread: 0,
      online: true,
    };
    setActiveChat(newChat);
    setIsSearchMode(false);
    setSearchQuery("");
  };

  /* ── Send message ── */
  const handleSend = () => {
    if (!inputText.trim() || !activeChat) return;
    const newMsg = {
      id: `m${Date.now()}`,
      senderId: "me",
      type: "text",
      content: inputText.trim(),
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    };
    setMessages((prev) => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), newMsg],
    }));
    setInputText("");
  };

  /* ── Delete message ── */
  const handleDelete = (chatId, msgId) => {
    setMessages((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).filter((m) => m.id !== msgId),
    }));
    // TODO: emit socket event & delete from DB
  };

  const currentMessages = activeChat ? messages[activeChat.id] || [] : [];

  return (
    <div className="msg-page">
      {/* ═══════════ LEFT PANEL ═══════════ */}
      <div className="msg-left-panel">
        <div className="msg-panel-header">
          <h2>Messages</h2>
          <p>{DUMMY_CHATS.length} conversations</p>
        </div>

        {isSearchMode ? (
          /* ─── Search Mode ─── */
          <div className="msg-search-panel">
            <div className="msg-search-header">
              <button
                className="msg-search-back-btn"
                onClick={() => { setIsSearchMode(false); setSearchQuery(""); }}
                title="Back"
              >
                <BackArrowIcon />
              </button>
              <div className="msg-search-input-wrap">
                <SearchIcon />
                <input
                  className="msg-search-input"
                  placeholder="Search users by name..."
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#b0bab7", padding: 0 }}
                    onClick={() => setSearchQuery("")}
                  >
                    <XIcon />
                  </button>
                )}
              </div>
            </div>

            <div className="msg-search-results">
              {!searchQuery && (
                <div className="msg-search-empty">
                  <SearchIcon />
                  <p>Search for a user to start chatting</p>
                </div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <div className="msg-search-empty">
                  <p>No users found for "{searchQuery}"</p>
                </div>
              )}
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="msg-chat-item"
                  onClick={() => handleSelectSearchUser(user)}
                >
                  <Avatar initials={user.initials} variant={user.avatarVariant} />
                  <div className="msg-chat-info">
                    <div className="msg-chat-name">{user.name}</div>
                    <div className="msg-chat-preview">{user.role}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "#08C18A", fontWeight: 600 }}>Chat</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ─── Chat List Mode ─── */
          <>
            <div className="msg-chat-list">
              {DUMMY_CHATS.map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  isActive={activeChat?.id === chat.id}
                  onClick={handleSelectChat}
                />
              ))}
            </div>

            {/* Floating New Chat Button */}
            <button
              className="msg-new-chat-btn"
              onClick={() => setIsSearchMode(true)}
              title="New Chat"
            >
              <PenIcon />
            </button>
          </>
        )}
      </div>

      {/* ═══════════ RIGHT PANEL ═══════════ */}
      <div className="msg-right-panel">
        {!activeChat ? (
          /* ─── Empty State ─── */
          <div className="msg-empty-state">
            <div className="empty-icon">
              <ChatBubbleIcon />
            </div>
            <h3>Your Messages</h3>
            <p>Select a conversation or start a new one</p>
          </div>
        ) : (
          <>
            {/* ─── Conversation Header ─── */}
            <div className="msg-conv-header">
              <Avatar initials={activeChat.initials} variant={activeChat.avatarVariant} size={40} />
              <div className="header-info">
                <div className="header-name">{activeChat.name}</div>
                <div className="header-status">
                  {activeChat.online ? "● Online" : "Last seen recently"}
                </div>
              </div>
              <div className="header-actions">
                <button className="msg-icon-btn" title="Search in chat"><SearchIcon /></button>
                <button className="msg-icon-btn" title="More options"><DotsIcon /></button>
              </div>
            </div>

            {/* ─── Messages Area ─── */}
            <div className="msg-messages-area">
              {/* Date Divider */}
              <div className="msg-date-divider">
                <span>Today</span>
              </div>

              {currentMessages.map((msg) => {
                const isSent = msg.senderId === "me";
                const deleteMsg = (id) => handleDelete(activeChat.id, id);

                if (msg.type === "text") {
                  return (
                    <TextMessage
                      key={msg.id}
                      msg={msg}
                      isSent={isSent}
                      onDelete={deleteMsg}
                    />
                  );
                }
                if (msg.type === "image") {
                  return (
                    <ImageMessage
                      key={msg.id}
                      msg={msg}
                      isSent={isSent}
                      onDelete={deleteMsg}
                    />
                  );
                }
                if (msg.type === "audio") {
                  return (
                    <AudioMessage
                      key={msg.id}
                      msg={msg}
                      isSent={isSent}
                      onDelete={deleteMsg}
                    />
                  );
                }
                if (msg.type === "doc") {
                  return (
                    <DocMessage
                      key={msg.id}
                      msg={msg}
                      isSent={isSent}
                      onDelete={deleteMsg}
                    />
                  );
                }
                return null;
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* ─── Input Bar ─── */}
            <div className="msg-input-bar">
              <div className="msg-input-wrap">
                <button className="msg-emoji-btn" title="Emoji">
                  <EmojiIcon />
                </button>
                <input
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <button className="msg-attach-btn" title="Attach file">
                  <AttachIcon />
                </button>
              </div>
              <button className="msg-send-btn" onClick={handleSend} title="Send">
                <SendIcon />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─────────────── SVG ICONS ─────────────── */
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const VolumeIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

const MuteIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);

const DownArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
    <path d="M7 10l5 5 5-5z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
  </svg>
);

const DocIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BackArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const PenIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

const EmojiIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
  </svg>
);

const AttachIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
  </svg>
);

const CheckDoubleIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M0.41 13.41L6 19l1.41-1.42L1.83 12zm20.36-6.58L11 17.17l-4.59-4.58L5 14l6 6 12-12zM18 7l-1.41-1.42-6.35 6.35 1.42 1.41z" />
  </svg>
);

const ChatBubbleIcon = () => (
  <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
  </svg>
);

const DotsIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);

export default Messages;
