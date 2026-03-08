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
const uploadRoutes = require("./routes/UploadRoutes");
const pickupRoutes = require("./routes/pickupRoutes"); // ✅ added

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
   SESSION MIDDLEWARE
====================== */
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "secret123",
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: process.env.SESSION_MAX_AGE
      ? parseInt(process.env.SESSION_MAX_AGE, 10)
      : 7 * 24 * 60 * 60 * 1000,
  },
});

app.use(sessionMiddleware);

/* ======================
   ROUTES
====================== */

app.use("/auth", authRoutes);
app.use("/", profileRoutes);
app.use("/", opportunitiesRoutes);
app.use(applicationRoutes);
app.use(notificationRoutes);
app.use("/api", uploadRoutes);
app.use("/api/pickups", pickupRoutes); // ✅ pickup API connected

/* ======================
   SERVER
====================== */

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

/* ======================
   SOCKET SESSION
====================== */

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.use((socket, next) => {
  const req = socket.request;

  if (
    req.session &&
    req.session.isAuthenticated &&
    req.session.user &&
    req.session.user.id
  ) {
    return next();
  }

  return next(new Error("unauthorized"));
});

io.on("connection", (socket) => {
  try {
    const req = socket.request;
    const userId = req.session.user.id;

    socket.join(String(userId));
    console.log("socket connected for user:", userId);

    socket.on("disconnect", () => {});
  } catch (err) {
    console.error("socket connection error:", err);
  }
});

global.io = io;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});