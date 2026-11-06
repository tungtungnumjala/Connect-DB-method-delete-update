# Course Management — Web–Database Integration Lab

ตัวอย่าง Web Application ที่เชื่อมต่อ **Frontend (HTML/CSS/Vanilla JavaScript)** → **Express API (Node.js)** → **PostgreSQL** ผ่านไลบรารี **node-postgres (`pg`)**

## สิ่งที่ต้องเตรียม

- Node.js ที่รองรับ `--env-file` และ `npm`
- PostgreSQL Server พร้อมบัญชีผู้ดูแลที่มีสิทธิ์สร้าง Database และ Role
- เครื่องมือจัดการ PostgreSQL: **pgAdmin** หรือ **psql**
- Code Editor เช่น VS Code และ Browser ที่มี Developer Tools

ตรวจสอบการติดตั้ง:

```bash
node --version
npm --version
psql --version
```

## สร้างโปรเจกต์ Node.js ตั้งแต่ต้น

เปิด Terminal ในตำแหน่งที่ต้องการเก็บโปรเจกต์:

```bash
mkdir course-management
cd course-management
npm init -y
npm install express pg
npm pkg set type=module
mkdir -p public src database
```

โครงสร้างเมื่อทำเสร็จ:

```text
course-management/
├── public/
│   ├── index.html
│   └── app.js
├── src/
│   ├── db.js
│   └── server.js
├── database/
│   └── schema.sql
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

สร้างไฟล์ตามหัวข้อต่อไปนี้ใน Editor

## สร้าง PostgreSQL Role และ Database

### เชื่อมต่อ PostgreSQL ด้วยบัญชีผู้ดูแล

หากใช้ `psql` และมี Role ชื่อ `postgres`:

```bash
psql -U postgres -d postgres
```

หากใช้ Role ชื่ออื่น ให้แทน `postgres` หลัง `-U` ด้วยชื่อ Role นั้น หรือเชื่อมต่อผ่าน **pgAdmin → Servers → [server]** ด้วยบัญชีผู้ดูแลที่มีสิทธิ์

> **สำคัญ:** `psql -d postgres` โดยไม่ใส่ `-U` จะพยายามใช้ชื่อผู้ใช้ของระบบปฏิบัติการ ถ้าเจอ `role "acs_mac" does not exist` แปลว่า PostgreSQL Instance นี้ไม่มี Role ดังกล่าว ไม่ได้แปลว่า PostgreSQL หยุดทำงาน และไม่ควรลบ/สร้าง Cluster ใหม่เพื่อแก้ปัญหานี้

หลังเข้าถึง `psql` ได้ ให้ตรวจสอบ Roles:

```sql
\du
```

### สร้างบัญชีสำหรับแอปพลิเคชัน

รันด้วยบัญชีผู้ดูแลที่มีสิทธิ์ `CREATEROLE`:

```sql
CREATE ROLE app_user WITH LOGIN PASSWORD 'change_this_password';
```

เปลี่ยนรหัสผ่านตัวอย่างเป็นรหัสผ่านที่ใช้จริงก่อนใช้งาน หาก Role นี้มีอยู่แล้ว **ไม่ต้อง CREATE ซ้ำ**; หากจำเป็นต้องเปลี่ยนรหัสผ่านใช้ `ALTER ROLE app_user WITH PASSWORD 'new_password';`

### สร้าง Database

รันด้วยบัญชีที่มีสิทธิ์ `CREATEDB`:

```sql
CREATE DATABASE course_db;
GRANT CONNECT ON DATABASE course_db TO app_user;
```

> ถ้ามี `course_db` อยู่แล้ว ให้ข้าม `CREATE DATABASE`

เปลี่ยนไปยัง Database ที่เพิ่งสร้าง:

```sql
\c course_db
```

**วิธีผ่าน pgAdmin:** คลิกขวา **Databases → Create → Database...** ตั้งชื่อ `course_db` แล้วเลือก Database นี้ เปิด **Query Tool** เพื่อรัน SQL ในหัวข้อถัดไป ตรวจสอบว่า Query Tool เชื่อมอยู่กับ `course_db` ไม่ใช่ `postgres`

### สร้างตารางและข้อมูลเริ่มต้น

สร้าง `database/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.courses (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    credits INTEGER NOT NULL,
    CONSTRAINT chk_course_credits CHECK (credits BETWEEN 1 AND 6)
);

-- ตัวอย่างข้อมูล
INSERT INTO public.courses (name, credits)
SELECT v.name, v.credits
FROM (VALUES
    ('Web Programming', 3),
    ('Database Systems', 3),
    ('Software Engineering', 3)
) AS v(name, credits)
WHERE NOT EXISTS (SELECT 1 FROM public.courses);
```

หากเชื่อมผ่าน `psql` อยู่ภายใน `course_db` ให้รันไฟล์จาก **Terminal** ด้วยบัญชีเจ้าของตาราง/บัญชีผู้ดูแล:

```bash
psql -U YOUR_ADMIN_ROLE -d course_db -f database/schema.sql
```

หรือคัดลอก SQL ไปที่ **pgAdmin → course_db → Query Tool** แล้วกด Execute

ตรวจสอบด้วย:

```sql
SELECT id, name, credits FROM public.courses ORDER BY id;
```

### ให้สิทธิ์ `app_user` ใน `course_db`

รันใน **Database `course_db`** ด้วยบัญชีเจ้าของตาราง/ผู้ดูแลที่ให้สิทธิ์ได้:

```sql
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO app_user;
```

ทดสอบด้วยบัญชีแอปพลิเคชันจาก Terminal:

```bash
psql -h localhost -p 5432 -U app_user -d course_db
```

เมื่อเข้า `psql` สำเร็จ ลอง:

```sql
SELECT current_user, current_database();
SELECT * FROM public.courses;
```

พิมพ์ `\q` เพื่อออกจาก `psql`

## 4. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` (ใช้รหัสผ่านจริงที่ตั้งใน PostgreSQL):

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_USER=app_user
DB_PASSWORD=change_this_password
DB_NAME=course_db
PORT=3000
```

สร้าง `.env.example` ด้วยรูปแบบเดียวกันแต่ใช้ Placeholder แทนรหัสผ่านจริง เพื่อให้ผู้อื่นตั้งค่าตามได้

สร้าง `.gitignore`:

```gitignore
node_modules/
.env
```

**ห้าม Commit `.env` ที่มีรหัสผ่านจริง** และไม่ควรส่ง Database Credentials ไปยัง Browser

## 5. สร้าง PostgreSQL Connection Pool

ไฟล์ `src/db.js`:

```javascript
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});
```

`pool.query()` ใช้กับ Query อิสระได้สะดวกเพราะ Pool ยืมและคืน Connection ให้ แต่เมื่อทำ Transaction หลายคำสั่งในอนาคตต้องใช้ Client เดียวกันตลอด Transaction

## 6. สร้าง Express API

ไฟล์ `src/server.js`:

```javascript
import express from "express";
import { pool } from "./db.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

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
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
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

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Server running on port ${port}`));
```

**สังเกตความแตกต่าง:** PostgreSQL ใช้ `$1`, `$2` แทน Parameter Values และ `pg` คืนข้อมูลผ่าน `result.rows` ส่วนการเพิ่มข้อมูลใช้ `INSERT ... RETURNING` เพื่ออ่านค่า ID ที่ PostgreSQL สร้างให้

## 7. สร้าง Frontend

### 7.1 HTML + CSS (`public/index.html`)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Course Management</title>
    <style>
      * {
        box-sizing: border-box;
      }
      body {
        font-family: system-ui, sans-serif;
        margin: 0;
        padding: 24px;
        background: #f4f6fa;
        color: #1e293b;
      }
      main {
        max-width: 860px;
        margin: auto;
      }
      section {
        background: white;
        padding: 22px;
        margin: 18px 0;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
      }
      form {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 12px;
      }
      label {
        display: grid;
        gap: 6px;
        flex: 1;
        min-width: 150px;
      }
      input {
        padding: 10px;
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
      }
      button {
        border: 0;
        padding: 11px 16px;
        border-radius: 6px;
        color: white;
        background: #2563eb;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.55;
        cursor: wait;
      }
      #refresh-button {
        background: #475569;
      }
      #status {
        padding: 12px;
        border-radius: 6px;
        background: #e2e8f0;
      }
      #status.success {
        background: #dcfce7;
        color: #166534;
      }
      #status.error {
        background: #fee2e2;
        color: #991b1b;
      }
      #status.loading {
        background: #dbeafe;
        color: #1e40af;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin-top: 14px;
      }
      th,
      td {
        padding: 11px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
      }
      .heading-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
    </style>
    <script src="/app.js" defer></script>
  </head>
  <body>
    <main>
      <h1>Course Management</h1>
      <p>Web–Database Integration: Express + PostgreSQL</p>
      <div id="status" role="status" aria-live="polite">Ready</div>

      <section>
        <h2>Add New Course</h2>
        <form id="course-form">
          <label
            >Course Name
            <input
              id="course-name"
              type="text"
              maxlength="150"
              required
              placeholder="e.g. Web Programming"
            />
          </label>
          <label
            >Credits
            <input
              id="course-credits"
              type="number"
              min="1"
              max="6"
              step="1"
              value="3"
              required
            />
          </label>
          <button id="add-button" type="submit">Add Course</button>
        </form>
      </section>

      <section>
        <div class="heading-row">
          <h2>Available Courses</h2>
          <button id="refresh-button" type="button">Refresh</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Course Name</th>
              <th>Credits</th>
            </tr>
          </thead>
          <tbody id="course-list"></tbody>
        </table>
        <p id="empty-message" hidden>No courses found.</p>
      </section>
    </main>
  </body>
</html>
```

### 7.2 Fetch API + DOM (`public/app.js`)

```javascript
const form = document.querySelector("#course-form");
const nameInput = document.querySelector("#course-name");
const creditsInput = document.querySelector("#course-credits");
const courseList = document.querySelector("#course-list");
const emptyMessage = document.querySelector("#empty-message");
const statusBox = document.querySelector("#status");
const addButton = document.querySelector("#add-button");
const refreshButton = document.querySelector("#refresh-button");

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = type;
}

function renderCourses(courses) {
  courseList.replaceChildren();
  emptyMessage.hidden = courses.length > 0;
  for (const course of courses) {
    const tr = document.createElement("tr");
    for (const value of [course.id, course.name, course.credits]) {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.appendChild(td);
    }
    courseList.appendChild(tr);
  }
}

async function loadCourses() {
  refreshButton.disabled = true;
  showStatus("Loading courses...", "loading");
  try {
    const response = await fetch("/api/courses");
    if (!response.ok) throw new Error(`GET failed: HTTP ${response.status}`);
    const courses = await response.json();
    if (!Array.isArray(courses)) throw new Error("Invalid API response");
    renderCourses(courses);
    showStatus(`Loaded ${courses.length} courses.`, "success");
    return true;
  } catch (error) {
    console.error(error);
    showStatus(error.message, "error");
    return false;
  } finally {
    refreshButton.disabled = false;
  }
}

async function createCourse(name, credits) {
  const response = await fetch("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, credits }),
  });
  if (!response.ok) {
    let message = `POST failed: HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body.error === "string") message = body.error;
    } catch {
      /* Keep generic error */
    }
    throw new Error(message);
  }
  return response.json();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const credits = Number(creditsInput.value);
  if (
    !name ||
    name.length > 150 ||
    !Number.isInteger(credits) ||
    credits < 1 ||
    credits > 6
  ) {
    showStatus("Please enter valid course data.", "error");
    return;
  }
  addButton.disabled = true;
  showStatus("Creating course...", "loading");
  try {
    const created = await createCourse(name, credits);
    form.reset();
    const refreshed = await loadCourses();
    showStatus(
      refreshed
        ? `Course "${created.name}" created successfully.`
        : "Course created, but list refresh failed.",
      refreshed ? "success" : "error"
    );
  } catch (error) {
    console.error(error);
    showStatus(error.message, "error");
  } finally {
    addButton.disabled = false;
  }
});

refreshButton.addEventListener("click", loadCourses);
loadCourses();
```

ใช้ `textContent` ในการแสดงข้อมูลแทนการนำข้อมูลที่รับมาจาก API มาประกอบเป็น `innerHTML` โดยตรง

## 8. เริ่มระบบ

จากโฟลเดอร์หลักของโปรเจกต์:

```bash
node --env-file=.env src/server.js
```

เมื่อเห็น `Server running on port 3000` ให้เปิด:

- **Frontend:** <http://localhost:3000/>
- **GET API:** <http://localhost:3000/api/courses>

> ข้อความว่า Server เริ่มทำงานแล้ว **ไม่ได้ยืนยัน** ว่า PostgreSQL เชื่อมต่อได้สำเร็จ การเชื่อมต่อจริงจะถูกทดสอบเมื่อเรียก Query จึงควรทดลอง GET API ด้วย

## 9. ทดสอบ API และฐานข้อมูล

**GET — ทุกวิชา**

```bash
curl -i http://localhost:3000/api/courses
```

คาดหวัง `200 OK` และ JSON Array (ค่าจริงขึ้นกับข้อมูลใน Database)

**POST — เพิ่มรายวิชา**

```bash
curl -i -X POST http://localhost:3000/api/courses \
  -H 'Content-Type: application/json' \
  -d '{"name":"Computer Networks","credits":3}'
```

คาดหวัง `201 Created` และ JSON Object ของรายวิชาใหม่พร้อม `id`

**POST — ข้อมูลไม่ถูกต้อง**

```bash
curl.exe -i -X POST http://localhost:3000/api/courses \
  -H 'Content-Type: application/json' \
  -d '{"name":"Invalid Course","credits":-2}'
```

คาดหวัง `400 Bad Request`

ตรวจข้อมูลที่ PostgreSQL:

```sql
SELECT id, name, credits FROM public.courses ORDER BY id;
```

เปิด Browser Developer Tools → **Network** เพื่อดู Request Method, Status, Request Payload และ Response ของ GET/POST

## 10. Troubleshooting

| ปัญหาที่พบ                            | ความหมาย                                            | วิธีแก้เบื้องต้น                                                      |
| ------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| `role "acs_mac" does not exist`       | `psql` ใช้ชื่อ macOS โดยอัตโนมัติ แต่ Role นี้ไม่มี | ระบุ `-U` ด้วยชื่อ PostgreSQL Role ที่มีอยู่จริง                      |
| `role "app_user" does not exist`      | ยังไม่ได้สร้างบัญชีสำหรับแอป                        | Login ด้วยบัญชีผู้ดูแลแล้ว `CREATE ROLE app_user ...`                 |
| `password authentication failed`      | Credentials หรือ Authentication ไม่ตรง              | ตรวจ Password, `.env`, ค่า Host/Port และวิธี Authentication           |
| `database "course_db" does not exist` | ชื่อ Database ยังไม่มีใน Server ที่เชื่อมต่อ        | สร้าง `course_db` หรือแก้ชื่อใน `.env`                                |
| `relation "courses" does not exist`   | ตารางยังไม่อยู่ใน Database/Schema ที่ใช้งาน         | ตรวจ DB_NAME และรัน `schema.sql` ใน `course_db`                       |
| `permission denied for schema public` | Role ไม่ได้รับสิทธิ์ใช้ Schema                      | `GRANT USAGE ON SCHEMA public TO app_user;`                           |
| `permission denied for table courses` | Role ไม่มีสิทธิ์ Query/Insert Table                 | `GRANT SELECT, INSERT, UPDATE, DELETE ...`                            |
| `ECONNREFUSED`                        | ไม่สามารถติดต่อ Database ที่ Host/Port ระบุ         | ตรวจว่าบริการ PostgreSQL ทำงานและ Host/Port ถูกต้อง                   |
| `EADDRINUSE: address already in use`  | Port ของ Express ถูกใช้งาน                          | ปิด Process เดิมหรือเปลี่ยน `PORT`                                    |
| Frontend เปิดได้ แต่ไม่มี Course      | API/การเชื่อมต่อ/JavaScript มีปัญหา                 | เปิด DevTools → Network และตรวจ Terminal ของ Express                  |
| `Cannot GET /`                        | Static files ไม่ถูกเสิร์ฟหรือรันผิดโฟลเดอร์         | ตรวจ `public/index.html`, `express.static("public")` และ Run จาก Root |

ถ้าไม่ทราบบัญชีผู้ดูแล ให้ตรวจ PostgreSQL Installation และ Existing Roles ผ่าน pgAdmin/เครื่องมือที่เชื่อมต่ออยู่ก่อน **ไม่ควรลบฐานข้อมูลหรือรัน `initdb` ใหม่โดยไม่ตรวจสอบข้อมูลเดิม**

## 11. คำถามทบทวน

1. เหตุใด Frontend จึงไม่ควรเชื่อมต่อ PostgreSQL ด้วย Database Credentials โดยตรง?
2. `Pool` ต่างจากการสร้าง `Client` ใหม่ในทุก Request อย่างไร?
3. `result.rows` คืออะไร และต่างจาก `result.rowCount` อย่างไร?
4. เหตุใด PostgreSQL Query จึงใช้ `$1` และ `$2` แทนการต่อ String จาก Input?
5. `INSERT ... RETURNING` ช่วยให้ Backend ตอบ POST Request อย่างไร?
6. เมื่อ GET API ตอบ 500 จะใช้ Browser Network Panel, Backend Log และ `psql` ตรวจสอบอย่างไร?

**Challenge:** เพิ่ม `PUT /api/courses/:id` และ `DELETE /api/courses/:id` พร้อมตรวจสอบ Input และ Authorization ที่เหมาะสม
