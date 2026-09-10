import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import quizRoutes from "./routes/quiz";

// backend/.env — its own file, separate from frontend/.env. Only read
// at local `npm run dev`/`npm start` time; in Docker, docker-compose's
// `env_file: ./backend/.env` injects these directly into the
// container's environment (no .env file is copied into the image, see
// .dockerignore), so this call is a harmless no-op there.
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/quiz", quizRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API routes available at http://localhost:${PORT}/api/quiz`);
});
