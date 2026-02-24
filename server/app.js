require("dotenv").config();
const express = require("express");
const cors = require("cors");

const systemRoutes = require("./routes/system.routes");
const debugRoutes = require("./routes/debug.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/debug", debugRoutes);
app.use("/api/system", systemRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Backend running successfully" });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
