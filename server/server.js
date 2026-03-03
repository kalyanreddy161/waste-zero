const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const authRoutes = require("./routes/RegisterRoutes");
const profileRoutes = require("./routes/ProfileRoutes");
const opportunitiesRoutes = require("./routes/OpportunitiesRoutes");
const applicationRoutes = require("./routes/ApplicationRoutes");
const notificationRoutes = require("./routes/NotificationRoutes");

const app = express();

/* ======================
   MIDDLEWARE
====================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

/* ======================
   DATABASE
====================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

/* ======================
   SESSION STORE
====================== */
const store = new MongoDBStore({
  uri: process.env.MONGO_URI,
  collection: "mySession",
});

store.on("error", (error) => {
  console.error("SESSION STORE ERROR:", error);
});

/* ======================
   SESSION MIDDLEWARE  ✅ MUST BE BEFORE ROUTES
====================== */
// create session middleware instance so it can be reused by socket.io
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "secret123",
  resave: false,
  saveUninitialized: false,
  store: store,
  // Make the session cookie persistent across browser restarts by setting maxAge.
  // Configure via env `SESSION_MAX_AGE` (milliseconds). Default: 7 days.
  cookie: {
    httpOnly: true,
    secure: false, // true only in HTTPS
    sameSite: "lax",
    maxAge: process.env.SESSION_MAX_AGE
      ? parseInt(process.env.SESSION_MAX_AGE, 10)
      : 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

app.use(sessionMiddleware);

const uploadRoutes = require("./routes/UploadRoutes");

/* ======================
   SERVER
====================== */
const PORT = process.env.PORT || 3000;

// mount routes
app.use("/auth", authRoutes);
app.use("/", profileRoutes);
app.use("/", opportunitiesRoutes);
app.use(applicationRoutes); // application routes register their own paths
app.use(notificationRoutes);
app.use("/api", uploadRoutes);

// create http server and attach socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

// reuse the express session middleware for socket connections
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.use((socket, next) => {
  const req = socket.request;
  if (req.session && req.session.isAuthenticated && req.session.user && req.session.user.id) {
    return next();
  }
  return next(new Error("unauthorized"));
});

io.on("connection", (socket) => {
  try {
    const req = socket.request;
    const userId = req.session.user.id;
    // join a room named after the user id for targeted messages
    socket.join(String(userId));
    console.log("socket connected for user:", userId);

    socket.on("disconnect", () => {
      // any cleanup if needed
    });
  } catch (err) {
    console.error("socket connection error:", err);
  }
});

// expose io globally so controllers/utilities can use it (simple approach)
global.io = io;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
