const form = document.querySelector("#course-form");
const nameInput = document.querySelector("#course-name");
const creditsInput = document.querySelector("#course-credits");
const courseList = document.querySelector("#course-list");
const emptyMessage = document.querySelector("#empty-message");
const statusBox = document.querySelector("#status");
const addButton = document.querySelector("#add-button");
const cancelButton = document.querySelector("#cancel-button");
const refreshButton = document.querySelector("#refresh-button");
const adminKeyInput = document.querySelector("#admin-key");

let editingId = null; // เอาไไว้ handleId เช็ค edit | add

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = type;
}

// อ่าน error message จาก body ถ้ามี
async function errorFromResponse(response, fallback) {
    const body = await response.json();
    if (typeof body.error === "string") return body.error;
  return fallback;
}

function adminHeaders() {
  return { "x-api-key": adminKeyInput.value };
}

// edit state
function startEdit(course) {
  editingId = course.id;
  nameInput.value = course.name;
  creditsInput.value = course.credits;
  addButton.textContent = "Save Changes";
  cancelButton.hidden = false;
  nameInput.focus();
  showStatus(`Editing course #${course.id}`, "");
}

// back to add state
function resetForm() {
  editingId = null;
  form.reset();
  addButton.textContent = "Add Course";
  cancelButton.hidden = true;
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
    const actions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(course));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "danger";
    deleteBtn.addEventListener("click", () => handleDelete(course));

    actions.append(editBtn, " ", deleteBtn);
    tr.appendChild(actions);
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
    throw new Error(
      await errorFromResponse(response, `POST failed: HTTP ${response.status}`)
    );
  }
  return response.json();
}

async function updateCourse(id, name, credits) {
  const response = await fetch(`/api/courses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ name, credits }),
  });
  if (!response.ok) {
    throw new Error(
      await errorFromResponse(response, `PUT failed: HTTP ${response.status}`)
    );
  }
  return response.json();
}

async function deleteCourse(id) {
  const response = await fetch(`/api/courses/${id}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!response.ok) {
    throw new Error(
      await errorFromResponse(response, `DELETE failed: HTTP ${response.status}`)
    );
  }
}

async function handleDelete(course) {
  if (!confirm(`Delete "${course.name}"?`)) return;
  showStatus("Deleting course...", "loading");
  try {
    await deleteCourse(course.id);
    //reset form ถ้าตรงกับ editId พอดี
    if (editingId === course.id) resetForm();
    const refreshed = await loadCourses();
    showStatus(
      refreshed
        ? `Course "${course.name}" deleted.`
        : "Course deleted, but list refresh failed.",
      refreshed ? "success" : "error"
    );
  } catch (error) {
    console.error(error);
    showStatus(error.message, "error");
  }
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
  const isEditing = editingId !== null;
  addButton.disabled = true;
  showStatus(isEditing ? "Updating course..." : "Creating course...", "loading");
  try {
    const saved = isEditing
      ? await updateCourse(editingId, name, credits)
      : await createCourse(name, credits);
    resetForm();
    const refreshed = await loadCourses();
    const verb = isEditing ? "updated" : "created";
    showStatus(
      refreshed
        ? `Course "${saved.name}" ${verb} successfully.`
        : `Course ${verb}, but list refresh failed.`,
      refreshed ? "success" : "error"
    );
  } catch (error) {
    console.error(error);
    showStatus(error.message, "error");
  } finally {
    addButton.disabled = false;
  }
});

cancelButton.addEventListener("click", () => {
  resetForm();
  showStatus("Edit cancelled.", "");
});

refreshButton.addEventListener("click", loadCourses);
loadCourses();