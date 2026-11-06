import crypto from "node:crypto";
import express from "express";
import { pool } from "./db.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

const MAX_INT4 = 2147483647;

//validation
function validateCourse(data) {
  return (
    typeof data?.name === "string" &&
    data.name.trim().length > 0 &&
    data.name.length <= 150 &&
    Number.isInteger(data.credits) &&
    data.credits >= 1 &&
    data.credits <= 6
  );
}

//parrseID
function parseId(raw) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_INT4 ? id : null;
}

// Authorization
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    // return 503 -> ไม่ได้ตั้งค่า
    return res.status(503).json({ error: "Admin API key is not configured" });
  }
  const provided = req.get("x-api-key");
  if (!provided) {
    // return 401 -> ไม่ได้กรอก
    return res.status(401).json({ error: "Authentication required" });
  }
  // Hash ก่อนเพื่อให้ความยาวเท่ากัน
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

app.get("/api/courses", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, credits FROM public.courses ORDER BY id"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("GET /api/courses:", error);
    res.status(500).json({ error: "Unable to retrieve courses" });
  }
});

app.get("/api/courses/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid course ID" });
  }
  try {
    const result = await pool.query(
      "SELECT id, name, credits FROM public.courses WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("GET /api/courses/:id:", error);
    res.status(500).json({ error: "Unable to retrieve course" });
  }
});

app.post("/api/courses", async (req, res) => {
  if (!validateCourse(req.body)) {
    return res.status(400).json({ error: "Invalid course data" });
  }
  const { name, credits } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO public.courses (name, credits)
       VALUES ($1, $2)
       RETURNING id, name, credits`,
      [name.trim(), credits]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("POST /api/courses:", error);
    res.status(500).json({ error: "Unable to create course" });
  }
});

// put ต้องส่ง name และ credits
app.put("/api/courses/:id", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid course ID" });
  }
  if (!validateCourse(req.body)) {
    return res.status(400).json({ error: "Invalid course data" });
  }
  const { name, credits } = req.body;
  try {
    const result = await pool.query(
      `UPDATE public.courses
       SET name = $1, credits = $2
       WHERE id = $3
       RETURNING id, name, credits`,
      [name.trim(), credits, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("PUT /api/courses/:id:", error);
    res.status(500).json({ error: "Unable to update course" });
  }
});

// delete ลบรายวิชา ตอบ 204
app.delete("/api/courses/:id", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Invalid course ID" });
  }
  try {
    const result = await pool.query(
      "DELETE FROM public.courses WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.status(204).end();
  } catch (error) {
    console.error("DELETE /api/courses/:id:", error);
    res.status(500).json({ error: "Unable to delete course" });
  }
});

// json ที่ส่งมาผิดรูปแบบ -> 400 แทนที่จะเป็น 500
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Server running on port ${port}`));