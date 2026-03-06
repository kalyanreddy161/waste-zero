const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const cors = require("cors");
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/RegisterRoutes");
const profileRoutes = require("./routes/ProfileRoutes");
const { ServerApiVersion } = require("mongodb");

const app = express();
const server = http.createServer(app);

/* ======================
   MIDDLEWARE
====================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "http://localhost:5173",
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
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret123",
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      httpOnly: true,
      secure: false, // true only in HTTPS
      sameSite: "lax",
    },
  })
);

/* ======================
   ROUTES  ✅ NOW req.session EXISTS
====================== */
app.use("/auth", authRoutes);
app.use("/", profileRoutes);

//socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("send_message", (data) => {
    console.log("Message:", data);

    io.emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected");
  });
});

/* ======================
   SERVER
====================== */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
