// ==============================
// ADMIN PROTECTION
// ==============================

const token = localStorage.getItem('token');
const role  = localStorage.getItem('userRole');

if(!token || role !== 'admin'){
  window.location.href = '../index.html';
}


// ==============================
// CACHED DATA
// ==============================

let allStudents = [];
let allTeachers = [];
let allSubjects = [];
let allUploads  = [];


// ==============================
// HELPERS
// ==============================

function setEl(id, value) {
  const el = document.getElementById(id);
  if(el) el.innerText = value;
}

function ordinal(n) {
  const map = { 1:'1st', 2:'2nd', 3:'3rd', 4:'4th' };
  return map[n] || n + 'th';
}

function escapeQuotes(str) {
  if(!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

function showToast(message, type = 'info') {
  const existing = document.getElementById('toastNotif');
  if(existing) existing.remove();

  const colors = {
    info:    '#333',
    success: '#007700',
    error:   '#cc0000',
    warning: '#cc8800'
  };

  const toast = document.createElement('div');
  toast.id    = 'toastNotif';
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px;
    background:${colors[type] || '#333'}; color:white;
    padding:12px 20px; border-radius:10px; font-size:13px;
    font-weight:bold; box-shadow:0 4px 14px rgba(0,0,0,.2);
    z-index:99999; opacity:0; transition:opacity .3s;
    max-width:300px;
  `;
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '1'; }, 10);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}


// ==============================
// SHOW SECTION
// ==============================

function showSection(sectionId, element) {
  document.querySelectorAll('.section')
    .forEach(s => s.classList.remove('active-section'));

  document.getElementById(sectionId)
    .classList.add('active-section');

  document.querySelectorAll('.sidebar ul li')
    .forEach(li => li.classList.remove('active'));

  if (element && element.tagName === 'LI') {
    element.classList.add('active');
  }

  // Close sidebar on mobile
  if (window.innerWidth <= 726) {
    closeSidebar();
  }

  if(sectionId === 'dashboardSection') loadDashboard();
  if(sectionId === 'studentsSection')  loadStudents();
  if(sectionId === 'teachersSection')  loadTeachers();
  if(sectionId === 'subjectsSection')  loadSubjects();
  if(sectionId === 'gradesSection')    loadUploads();
  if(sectionId === 'reportsSection')   loadReports();
  if(sectionId === 'archivedSection')  loadArchived();
  if(sectionId === 'settingsSection')  loadSettings();
}


// ==============================
// SIDEBAR + DROPDOWN
// ==============================

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (window.innerWidth <= 726) {
    const isOpen = sidebar.classList.contains('active');
    if (isOpen) {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    } else {
      sidebar.classList.add('active');
      overlay.classList.add('active');
    }
  } else {
    sidebar.classList.toggle('hidden');
    document.querySelector('.main').classList.toggle('full');
  }
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('active');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

function toggleDropdown() {
  document.getElementById('dropdownMenu').classList.toggle('show');
}

window.onclick = function(e) {
  if (!e.target.closest('.user-menu')) {
    const dd = document.getElementById('dropdownMenu');
    if (dd) dd.classList.remove('show');
  }
};


// ==============================
// DARK MODE
// ==============================

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('adminTheme',
    document.body.classList.contains('dark') ? 'dark' : 'light'
  );
}

if(localStorage.getItem('adminTheme') === 'dark'){
  document.body.classList.add('dark');
}


// ==============================
// LOGOUT
// ==============================

function logout() {
  if(confirm('Are you sure you want to logout?')){
    localStorage.clear();
    window.location.href = '../index.html';
  }
}


// ==============================
// DASHBOARD
// ==============================

async function loadDashboard() {

  let students = [], teachers = [], subjects = [];

  try {
    students = await apiRequest('/students');
    allStudents = students;
  } catch(e) { console.error('students:', e.message); }

  try {
    teachers = await apiRequest('/teachers');
    allTeachers = teachers;
  } catch(e) { console.error('teachers:', e.message); }

  try {
    subjects = await apiRequest('/subjects');
    allSubjects = subjects;
  } catch(e) { console.error('subjects:', e.message); }

  setEl('dashTotalStudents', students.length);
  setEl('dashTotalTeachers', teachers.length);
  setEl('dashTotalSubjects', subjects.length);

  const notActivatedStudents =
    students.filter(s => s.status === 'not_activated').length;
  const notActivatedTeachers =
    teachers.filter(t => t.status === 'not_activated').length;

  try {
    const counts = await apiRequest('/grades/uploads/counts');
    setEl('dashPendingUploads', counts.pending || 0);
    const pendingEl = document.getElementById('pendingTasksList');
    if(pendingEl){
      pendingEl.innerHTML = `
        <li>⏳ ${counts.pending || 0} grade uploads waiting approval</li>
        <li>👨‍🎓 ${notActivatedStudents} student accounts not yet activated</li>
        <li>👩‍🏫 ${notActivatedTeachers} teacher accounts not yet activated</li>
      `;
    }
  } catch(e) {
    setEl('dashPendingUploads', '—');
  }

  try {
    const activeYear = await apiRequest('/school-years/active');
    setEl('dashSchoolYear',    activeYear.label || '—');
    setEl('dashActiveQuarter',
      ordinal(activeYear.active_quarter) + ' Semester'
    );
  } catch(e) {
    setEl('dashSchoolYear',    '—');
    setEl('dashActiveQuarter', '—');
  }

  try {
    const uploads = await apiRequest('/grades/uploads');
    const recentList = document.getElementById('recentActivityList');
    if(recentList){
      const recent = uploads.slice(0, 5);
      recentList.innerHTML = recent.length === 0
        ? '<li style="color:gray;">No recent activity yet</li>'
        : recent.map(u => `
            <li>
              ${u.status === 'locked'   ? '🔒' :
                u.status === 'approved' ? '✅' :
                u.status === 'rejected' ? '❌' : '⏳'}
              ${u.teacher_name} — ${u.subject_name}
              Q${u.quarter} ${u.grade_level}-${u.section}
            </li>
          `).join('');
    }
  } catch(e) {
    const recentList = document.getElementById('recentActivityList');
    if(recentList){
      recentList.innerHTML =
        '<li style="color:gray;">No recent activity yet</li>';
    }
  }
}


// ==============================
// STUDENTS
// ==============================

// ── selection mode state
let studentSelectionMode = false;
let selectedStudentIds   = new Set();

async function loadStudents() {

  try {
    const students = await apiRequest('/students');
    allStudents = students;

    const activated    = students.filter(s => s.status === 'activated').length;
    const notActivated = students.filter(s => s.status === 'not_activated').length;

    setEl('totalStudents',      students.length);
    setEl('registeredStudents', activated);
    setEl('pendingStudents',    notActivated);

    loadSectionsIntoDropdown('sectionFilter');
    renderStudentTable(students);
  } catch(err) {
    console.error('Load students error:', err.message);
  }

  try {
    const activeYear = await apiRequest('/school-years/active');
    setEl('studentsSchoolYear', activeYear.label || '—');
  } catch(err) {
    setEl('studentsSchoolYear', '—');
  }

}

function renderStudentTable(students) {

  const tbody = document.getElementById('studentTable');
  if(!tbody) return;

  selectedStudentIds = new Set();
  updateStudentBulkButtons();

  if(students.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="${studentSelectionMode ? 8 : 7}"
          style="text-align:center; color:gray; padding:30px;">
          No students found
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr id="student-row-${s.id}">
      ${studentSelectionMode ? `
        <td style="text-align:center;">
          <input type="checkbox"
            id="chk-student-${s.id}"
            onchange="toggleStudentSelection(${s.id})"
            style="width:16px; height:16px; cursor:pointer;">
        </td>
      ` : ''}
      <td>${s.lrn}</td>
      <td>${s.full_name}</td>
      <td>${s.grade_level || '—'}</td>
      <td>${s.section     || '—'}</td>
      <td>
        ${s.status === 'activated'
          ? '<span style="color:green;">✅ Activated</span>'
          : '<span style="color:orange;">⏳ Not Activated</span>'
        }
      </td>
      <td>
        <button onclick="editStudent(
          ${s.id},
          '${escapeQuotes(s.full_name)}',
          '${escapeQuotes(s.grade_level || '')}',
          '${escapeQuotes(s.section     || '')}',
          
        )">✏ Edit</button>
      </td>
    </tr>
  `).join('');
}

function filterStudents() {
  const search  = (document.getElementById('searchStudent')?.value || '').toLowerCase();
  const grade   = document.getElementById('gradeFilter')?.value || '';
  const section = document.getElementById('sectionFilter')?.value || '';
  const status  = document.getElementById('statusFilter')?.value || '';

  const filtered = allStudents.filter(s => {
    const matchSearch  =
      s.full_name.toLowerCase().includes(search) ||
      s.lrn.toLowerCase().includes(search);
    const matchGrade   = !grade   || s.grade_level === grade;
    const matchSection = !section || s.section === section;
    const matchStatus  = !status  || s.status === status;
    return matchSearch && matchGrade && matchSection && matchStatus;
  });

  renderStudentTable(filtered);
}

function searchStudent() { filterStudents(); }

// ── STUDENT EDIT MODE

function toggleStudentEditMode() {

  studentSelectionMode = !studentSelectionMode;
  selectedStudentIds   = new Set();

  const btn = document.getElementById('studentEditModeBtn');
  if(btn){
    btn.innerText        = studentSelectionMode ? '✖ Cancel' : '☑ Edit Mode';
    btn.style.background = studentSelectionMode ? '#555' : '#800000';
  }

  const bar = document.getElementById('studentBulkBar');
  if(bar) bar.style.display = studentSelectionMode ? 'flex' : 'none';

  // update table head
  const thead = document.getElementById('studentTableHead');
  if(thead){
    if(studentSelectionMode){
      thead.innerHTML = `
        <th style="width:40px; text-align:center;">
          <input type="checkbox"
            id="selectAllStudents"
            onchange="toggleSelectAllStudents()"
            style="width:16px; height:16px; cursor:pointer;">
        </th>
        <th>LRN</th>
        <th>Full Name</th>
        <th>Grade Level</th>
        <th>Section</th>
        <th>Status</th>
        <th>Actions</th>
      `;
    } else {
      thead.innerHTML = `
        <th>LRN</th>
        <th>Full Name</th>
        <th>Grade Level</th>
        <th>Section</th>
        <th>Status</th>
        <th>Actions</th>
      `;
    }
  }

  renderStudentTable(allStudents);
}

function toggleStudentSelection(id) {
  if(selectedStudentIds.has(id)){
    selectedStudentIds.delete(id);
  } else {
    selectedStudentIds.add(id);
  }
  updateStudentBulkButtons();
}

function toggleSelectAllStudents() {
  const selectAll  = document.getElementById('selectAllStudents');
  const checkboxes = document.querySelectorAll('[id^="chk-student-"]');
  if(selectAll.checked){
    checkboxes.forEach(chk => {
      chk.checked = true;
      selectedStudentIds.add(
        parseInt(chk.id.replace('chk-student-', ''))
      );
    });
  } else {
    checkboxes.forEach(chk => { chk.checked = false; });
    selectedStudentIds.clear();
  }
  updateStudentBulkButtons();
}

function updateStudentBulkButtons() {
  const count      = selectedStudentIds.size;
  const countEl    = document.getElementById('selectedStudentCount');
  const archiveBtn = document.getElementById('bulkArchiveStudentBtn');
  const deleteBtn  = document.getElementById('bulkDeleteStudentBtn');

  if(countEl) countEl.innerText = count > 0 ? `${count} selected` : '';

  if(archiveBtn){
    archiveBtn.disabled      = count === 0;
    archiveBtn.style.opacity = count === 0 ? '0.5' : '1';
  }
  if(deleteBtn){
    deleteBtn.disabled      = count === 0;
    deleteBtn.style.opacity = count === 0 ? '0.5' : '1';
  }
}

async function bulkArchiveStudents() {
  const ids = Array.from(selectedStudentIds);
  if(ids.length === 0){ alert('No students selected.'); return; }

  const names = ids.map(id => {
    const row = document.getElementById(`student-row-${id}`);
    if(row){
      const cells = row.querySelectorAll('td');
      // in selection mode: checkbox(0), lrn(1), name(2)
      return cells[2]?.innerText || `Student ID ${id}`;
    }
    return `Student ID ${id}`;
  });

  openArchiveReasonModal('student', ids, names);
}

async function bulkDeleteStudents() {
  const ids = Array.from(selectedStudentIds);
  if(ids.length === 0){ alert('No students selected.'); return; }
  if(!confirm(
    `⚠ PERMANENTLY DELETE ${ids.length} selected student(s)?\n\n` +
    `This cannot be undone. All records will be lost.`
  )) return;
  if(!confirm('Final confirmation — this is irreversible.')) return;
  try {
    const result = await apiRequest('/students/bulk/delete', 'POST', { ids });
    alert(`✅ ${result.message}`);
    studentSelectionMode = false;
    toggleStudentEditMode();
    loadStudents();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

// ── STUDENT MODALS

function openAddStudent() {
  loadSectionsIntoDropdown('inputSection');
  document.getElementById('studentModal').style.display = 'flex';
}

function closeStudentModal() {
  document.getElementById('studentModal').style.display = 'none';
  document.getElementById('studentForm').reset();
  setEl('studentModalError', '');
}

async function submitStudent() {

  const lrn         = document.getElementById('inputLRN').value.trim();
  const full_name   = document.getElementById('inputName').value.trim();
  const grade_level = document.getElementById('inputGrade').value;
  const section     = document.getElementById('inputSection').value;
  const adviser     = document.getElementById('inputAdviser').value.trim();
  const errorEl     = document.getElementById('studentModalError');

  if(errorEl) errorEl.innerText = '';

  if(!lrn || !full_name || !grade_level || !section){
    if(errorEl) errorEl.innerText = 'LRN, name, grade, and section are required.';
    return;
  }

  try {
    const result = await apiRequest('/students', 'POST', {
      lrn, full_name, grade_level, section, adviser
    });
    alert(
      `✅ Student added!\n\n` +
      `Temporary Password: ${result.temp_password}\n\n` +
      `Give this to the student for account activation.`
    );
    closeStudentModal();
    loadStudents();
  } catch(err) {
    if(errorEl) errorEl.innerText = err.message;
  }
}

let editingStudentId = null;

function editStudent(id, name, grade, section, adviser) {
  editingStudentId = id;
  document.getElementById('editStudentName').value    = name;
  document.getElementById('editStudentGrade').value   = grade;
  document.getElementById('editStudentAdviser').value = adviser;
  setEl('editStudentError', '');
  document.getElementById('editStudentModal').style.display = 'flex';

  // load sections then set the current value
  loadSectionsIntoDropdown('editStudentSection').then(() => {
    const sel = document.getElementById('editStudentSection');
    if(sel) sel.value = section;
  });
}

function closeEditStudentModal() {
  document.getElementById('editStudentModal').style.display = 'none';
  setEl('editStudentError', '');
}

async function submitEditStudent() {

  const full_name   = document.getElementById('editStudentName').value.trim();
  const grade_level = document.getElementById('editStudentGrade').value;
  const section     = document.getElementById('editStudentSection').value;
  const adviser     = document.getElementById('editStudentAdviser').value.trim();
  const errorEl     = document.getElementById('editStudentError');

  if(errorEl) errorEl.innerText = '';

  if(!full_name || !grade_level || !section){
    if(errorEl) errorEl.innerText = 'All fields are required.';
    return;
  }

  try {
    await apiRequest(`/students/${editingStudentId}`, 'PUT', {
      full_name, grade_level, section, adviser
    });
    closeEditStudentModal();
    loadStudents();
  } catch(err) {
    if(errorEl) errorEl.innerText = err.message;
  }
}

async function archiveStudent(id, name) {
  if(!confirm(
    `Archive "${name}"?\n\n` +
    `The account will be deactivated but all records are kept.`
  )) return;
  try {
    await apiRequest(`/students/${id}/archive`, 'PUT');
    alert('Student archived successfully.');
    loadStudents();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

// ── EXCEL IMPORT

function importExcel() {
  document.getElementById('importResult').innerHTML = '';
  document.getElementById('studentImportFile').value = '';
  document.getElementById('importModal').style.display = 'flex';
}

function closeImportModal() {
  document.getElementById('importModal').style.display = 'none';
  document.getElementById('importResult').innerHTML = '';
  document.getElementById('studentImportFile').value = '';
}

async function submitImport() {

  const fileInput = document.getElementById('studentImportFile');
  const resultEl  = document.getElementById('importResult');
  const btn       = document.getElementById('importBtn');

  resultEl.innerHTML = '';

  if(!fileInput || !fileInput.files[0]){
    resultEl.innerHTML = `
      <div style="background:#fff0f0; border:1px solid #f0c0c0;
        border-radius:8px; padding:14px; color:#cc0000;">
        ❌ Please select an Excel file first.
      </div>
    `;
    return;
  }

  const file = fileInput.files[0];
  const ext  = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  if(!['.xlsx', '.xls'].includes(ext)){
    resultEl.innerHTML = `
      <div style="background:#fff0f0; border:1px solid #f0c0c0;
        border-radius:8px; padding:14px; color:#cc0000;">
        ❌ Invalid file type. Only .xlsx and .xls files are accepted.
      </div>
    `;
    return;
  }

  btn.disabled  = true;
  btn.innerText = '⏳ Processing...';
  resultEl.innerHTML = `
    <div style="text-align:center; color:gray; padding:20px;">
      ⏳ Reading file and importing students...
    </div>
  `;

  const formData = new FormData();
  formData.append('studentFile', file);

  try {

    const response = await fetch(
      'https://grading-portal-system-production.up.railway.app/api/students/import',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      }
    );

    const data = await response.json();

    btn.disabled  = false;
    btn.innerText = '📂 Import Students';

    if(!response.ok){
      resultEl.innerHTML = `
        <div style="background:#fff0f0; border:1px solid #f0c0c0;
          border-radius:8px; padding:16px; color:#cc0000;">
          <p style="font-weight:bold; margin-bottom:6px;">❌ Import Failed</p>
          <p>${data.message}</p>
        </div>
      `;
      return;
    }

    const importedColor = data.imported > 0 ? 'green'   : 'gray';
    const failedColor   = data.failed   > 0 ? '#cc0000' : 'gray';

    let html = `
      <div style="border-radius:8px; overflow:hidden;
        border:1px solid #ddd; margin-bottom:12px;">
        <div style="background:#800000; color:white;
          padding:14px 16px; font-weight:bold; font-size:15px;">
          ✅ Import Complete
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr;
          gap:1px; background:#eee;">
          <div style="background:white; padding:14px; text-align:center;">
            <p style="font-size:12px; color:gray; margin-bottom:4px;">Total Rows</p>
            <p style="font-size:22px; font-weight:bold;">${data.total}</p>
          </div>
          <div style="background:white; padding:14px; text-align:center;">
            <p style="font-size:12px; color:gray; margin-bottom:4px;">Imported</p>
            <p style="font-size:22px; font-weight:bold; color:${importedColor};">${data.imported}</p>
          </div>
          <div style="background:white; padding:14px; text-align:center;">
            <p style="font-size:12px; color:gray; margin-bottom:4px;">Failed</p>
            <p style="font-size:22px; font-weight:bold; color:${failedColor};">${data.failed}</p>
          </div>
        </div>
        <div style="background:#f9f9f9; padding:12px 16px;
          font-size:13px; border-top:1px solid #eee;">
          <strong>School Year:</strong> ${data.school_year} &nbsp;|&nbsp;
          <strong>Grade Level:</strong> ${data.grade_level} &nbsp;|&nbsp;
          <strong>Section:</strong> ${data.section}
        </div>
      </div>
    `;

    if(data.errors && data.errors.length > 0){
      html += `
        <div style="background:#fff8f0; border:1px solid #f0d0b0;
          border-radius:8px; padding:14px; margin-bottom:12px;">
          <p style="font-weight:bold; color:#cc6600; margin-bottom:8px;">
            ⚠ ${data.errors.length} Error(s):
          </p>
          <div style="max-height:200px; overflow-y:auto;
            font-size:13px; line-height:1.8;">
            ${data.errors.map(e => `<p>• ${e}</p>`).join('')}
          </div>
        </div>
      `;
    }

    if(data.imported > 0){
      html += `
        <div style="background:#f0fff0; border:1px solid #b0d0b0;
          border-radius:8px; padding:12px; font-size:13px; color:#007700;">
          ✅ ${data.imported} student(s) imported. Accounts set to
          <strong>Not Activated</strong>.
        </div>
      `;
    }

    resultEl.innerHTML = html;
    loadStudents();

  } catch(err) {
    btn.disabled  = false;
    btn.innerText = '📂 Import Students';
    resultEl.innerHTML = `
      <div style="background:#fff0f0; border:1px solid #f0c0c0;
        border-radius:8px; padding:14px; color:#cc0000;">
        ❌ Cannot connect to server.<br><small>${err.message}</small>
      </div>
    `;
  }
}


// ==============================
// TEACHERS
// ==============================

// ── selection mode state
let teacherSelectionMode = false;
let selectedTeacherIds   = new Set();

async function loadTeachers() {

  try {
    const teachers = await apiRequest('/teachers');
    allTeachers = teachers;

    const activated    = teachers.filter(t => t.status === 'activated').length;
    const notActivated = teachers.filter(t => t.status === 'not_activated').length;

    setEl('teacherCount',           teachers.length);
    setEl('registeredTeacherCount', activated);
    setEl('pendingTeacherCount',    notActivated);

    renderTeacherTable(teachers);
  } catch(err) {
    console.error('Load teachers error:', err.message);
    const tbody = document.getElementById('teacherTable');
    if(tbody){
      tbody.innerHTML = `
        <tr>
          <td colspan="5"
            style="text-align:center; color:red; padding:30px;">
            Error loading teachers.
          </td>
        </tr>
      `;
    }
  }

  try {
    const activeYear = await apiRequest('/school-years/active');
    setEl('teachersSchoolYear', activeYear.label || '—');
  } catch(err) {
    setEl('teachersSchoolYear', '—');
  }
}

function renderTeacherTable(teachers) {
  const tbody = document.getElementById('teacherTable');
  if(!tbody) return;

  selectedTeacherIds = new Set();
  updateTeacherBulkButtons();

  if(teachers.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="${teacherSelectionMode ? 6 : 5}"
          style="text-align:center; color:gray; padding:30px;">
          No teachers found
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = teachers.map(t => `
    <tr id="teacher-row-${t.id}">
      ${teacherSelectionMode ? `
        <td style="text-align:center;">
          <input type="checkbox"
            id="chk-teacher-${t.id}"
            onchange="toggleTeacherSelection(${t.id})"
            style="width:16px; height:16px; cursor:pointer;">
        </td>
      ` : ''}
      <td>${t.prc_id}</td>
      <td>${t.full_name}</td>
      <td>
        <span style="color:#800000; cursor:pointer; text-decoration:underline;"
          onclick="openAssignModal(${t.id}, '${escapeQuotes(t.full_name)}')">
          View / Manage
        </span>
      </td>
      <td>
        ${t.status === 'activated'
          ? '<span style="color:green;">✅ Activated</span>'
          : '<span style="color:orange;">⏳ Not Activated</span>'
        }
      </td>
      <td>
        <button onclick="openAssignModal(${t.id}, '${escapeQuotes(t.full_name)}')">
          📚 Assign
        </button>
      </td>
    </tr>
  `).join('');
}

function filterTeachers() {
  const search = (document.getElementById('teacherSearch')?.value || '').toLowerCase();
  const status = document.getElementById('teacherStatusFilter')?.value || '';

  const filtered = allTeachers.filter(t => {
    const matchSearch =
      t.full_name.toLowerCase().includes(search) ||
      t.prc_id.toLowerCase().includes(search);
    const matchStatus = !status || t.status === status;
    return matchSearch && matchStatus;
  });

  renderTeacherTable(filtered);
}

// ── TEACHER EDIT MODE

function toggleTeacherEditMode() {

  teacherSelectionMode = !teacherSelectionMode;
  selectedTeacherIds   = new Set();

  const btn = document.getElementById('teacherEditModeBtn');
  if(btn){
    btn.innerText        = teacherSelectionMode ? '✖ Cancel' : '☑ Edit Mode';
    btn.style.background = teacherSelectionMode ? '#555' : '#800000';
  }

  const bar = document.getElementById('teacherBulkBar');
  if(bar) bar.style.display = teacherSelectionMode ? 'flex' : 'none';

  const thead = document.getElementById('teacherTableHead');
  if(thead){
    if(teacherSelectionMode){
      thead.innerHTML = `
        <th style="width:40px; text-align:center;">
          <input type="checkbox"
            id="selectAllTeachers"
            onchange="toggleSelectAllTeachers()"
            style="width:16px; height:16px; cursor:pointer;">
        </th>
        <th>PRC ID</th>
        <th>Full Name</th>
        <th>Assignments</th>
        <th>Account Status</th>
        <th>Actions</th>
      `;
    } else {
      thead.innerHTML = `
        <th>PRC ID</th>
        <th>Full Name</th>
        <th>Assignments</th>
        <th>Account Status</th>
        <th>Actions</th>
      `;
    }
  }

  renderTeacherTable(allTeachers);
}

function toggleTeacherSelection(id) {
  if(selectedTeacherIds.has(id)){
    selectedTeacherIds.delete(id);
  } else {
    selectedTeacherIds.add(id);
  }
  updateTeacherBulkButtons();
}

function toggleSelectAllTeachers() {
  const selectAll  = document.getElementById('selectAllTeachers');
  const checkboxes = document.querySelectorAll('[id^="chk-teacher-"]');
  if(selectAll.checked){
    checkboxes.forEach(chk => {
      chk.checked = true;
      selectedTeacherIds.add(
        parseInt(chk.id.replace('chk-teacher-', ''))
      );
    });
  } else {
    checkboxes.forEach(chk => { chk.checked = false; });
    selectedTeacherIds.clear();
  }
  updateTeacherBulkButtons();
}

function updateTeacherBulkButtons() {
  const count      = selectedTeacherIds.size;
  const countEl    = document.getElementById('selectedTeacherCount');
  const archiveBtn = document.getElementById('bulkArchiveTeacherBtn');
  const deleteBtn  = document.getElementById('bulkDeleteTeacherBtn');

  if(countEl) countEl.innerText = count > 0 ? `${count} selected` : '';

  if(archiveBtn){
    archiveBtn.disabled      = count === 0;
    archiveBtn.style.opacity = count === 0 ? '0.5' : '1';
  }
  if(deleteBtn){
    deleteBtn.disabled      = count === 0;
    deleteBtn.style.opacity = count === 0 ? '0.5' : '1';
  }
}

async function bulkArchiveTeachers() {
  const ids = Array.from(selectedTeacherIds);
  if(ids.length === 0){ alert('No teachers selected.'); return; }

  const names = ids.map(id => {
    const row = document.getElementById(`teacher-row-${id}`);
    if(row){
      const cells = row.querySelectorAll('td');
      // in selection mode: checkbox(0), prc_id(1), name(2)
      return cells[2]?.innerText || `Teacher ID ${id}`;
    }
    return `Teacher ID ${id}`;
  });

  openArchiveReasonModal('teacher', ids, names);
}

async function bulkDeleteTeachers() {
  const ids = Array.from(selectedTeacherIds);
  if(ids.length === 0){ alert('No teachers selected.'); return; }
  if(!confirm(
    `⚠ PERMANENTLY DELETE ${ids.length} selected teacher(s)?\n\nThis cannot be undone.`
  )) return;
  if(!confirm('Are you absolutely sure? This is irreversible.')) return;
  try {
    const result = await apiRequest('/teachers/bulk/delete', 'POST', { ids });
    alert(`✅ ${result.message}`);
    teacherSelectionMode = false;
    toggleTeacherEditMode();
    loadTeachers();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

// ── TEACHER MODALS

function openTeacherModal() {
  document.getElementById('teacherModal').style.display = 'flex';
}

function closeTeacherModal() {
  document.getElementById('teacherModal').style.display = 'none';
  document.getElementById('teacherForm').reset();
  setEl('teacherModalError', '');
}

async function submitTeacher() {

  const prc_id    = document.getElementById('inputPRCID').value.trim();
  const full_name = document.getElementById('inputTeacherName').value.trim();
  const errorEl   = document.getElementById('teacherModalError');

  if(errorEl) errorEl.innerText = '';

  if(!prc_id || !full_name){
    if(errorEl) errorEl.innerText = 'PRC ID and full name are required.';
    return;
  }

  try {
    const result = await apiRequest('/teachers', 'POST', { prc_id, full_name });
    alert(
      `✅ Teacher added!\n\n` +
      `Temporary Password: ${result.temp_password}\n\n` +
      `Give this to the teacher for account activation.`
    );
    closeTeacherModal();
    loadTeachers();
  } catch(err) {
    if(errorEl) errorEl.innerText = err.message;
  }
}

async function archiveTeacher(id, name) {
  if(!confirm(
    `Archive "${name}"?\n\nAccount will be deactivated but all records are kept.`
  )) return;
  try {
    await apiRequest(`/teachers/${id}/archive`, 'PUT');
    alert('Teacher archived successfully.');
    loadTeachers();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

// ── ASSIGN MODAL

let assigningTeacherId = null;

async function openAssignModal(teacherId, teacherName) {

  assigningTeacherId = teacherId;
  setEl('assignTeacherTitle', `📚 Assignments — ${teacherName}`);
  setEl('assignTeacherError', '');

  try {
    const subjects = await apiRequest('/subjects');
    const select   = document.getElementById('assignSubject');
    if(select){
      select.innerHTML = subjects.length === 0
        ? '<option>No subjects yet — add subjects first</option>'
        : subjects.map(s =>
            `<option value="${s.id}">${s.name} (${s.grade_level})</option>`
          ).join('');
    }
  } catch(err) {
    console.error('Load subjects for assign:', err.message);
  }
  await loadSectionsIntoDropdown('assignSection');
  await refreshExistingAssignments(teacherId);
  document.getElementById('assignModal').style.display = 'flex';
}

async function refreshExistingAssignments(teacherId) {
  const list = document.getElementById('existingAssignmentsList');
  if(!list) return;

  try {
    const assignments = await apiRequest(`/teachers/${teacherId}/assignments`);
    if(assignments.length === 0){
      list.innerHTML =
        '<li style="color:gray; padding:4px 0;">No assignments yet</li>';
    } else {
      list.innerHTML = assignments.map(a => `
        <li style="display:flex; justify-content:space-between;
          align-items:center; padding:6px 0;
          border-bottom:1px solid #eee; font-size:13px;">
          <span>📚 ${a.subject_name} — ${a.grade_level} Section ${a.section}</span>
          <button onclick="removeAssignment(${a.id}, ${teacherId})"
            style="background:none; color:red; border:none;
              cursor:pointer; font-size:12px;">
            ✖ Remove
          </button>
        </li>
      `).join('');
    }
  } catch(err) {
    list.innerHTML = '<li style="color:red;">Could not load assignments</li>';
  }
}

async function removeAssignment(assignmentId, teacherId) {
  if(!confirm('Remove this assignment?')) return;
  try {
    await apiRequest(`/teachers/assignment/${assignmentId}`, 'DELETE');
    await refreshExistingAssignments(teacherId);
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

function closeAssignModal() {
  document.getElementById('assignModal').style.display = 'none';
  setEl('assignTeacherError', '');
  loadTeachers();
}

async function submitAssignment() {

  const subject_id  = document.getElementById('assignSubject')?.value;
  const grade_level = document.getElementById('assignGrade')?.value;
  const section     = document.getElementById('assignSection')?.value;
  const errorEl     = document.getElementById('assignTeacherError');

  if(errorEl) errorEl.innerText = '';

  if(!subject_id){
    if(errorEl) errorEl.innerText = 'Please select a subject.';
    return;
  }

  try {
    await apiRequest('/teachers/assign', 'POST', {
      teacher_id: assigningTeacherId,
      subject_id,
      grade_level,
      section
    });
    await refreshExistingAssignments(assigningTeacherId);
    if(errorEl){
      errorEl.style.color = 'green';
      errorEl.innerText   = '✅ Assignment added successfully.';
      setTimeout(() => {
        errorEl.innerText   = '';
        errorEl.style.color = 'red';
      }, 2000);
    }
  } catch(err) {
    if(errorEl) errorEl.innerText = err.message;
  }
}

function assignTeacher() {
  alert('Click the Assign button next to a specific teacher.');
}


// ==============================
// SUBJECTS
// ==============================

// ── selection mode state
let subjectSelectionMode = false;
let selectedSubjectIds   = new Set();

async function loadSubjects() {

  try {
    const subjects = await apiRequest('/subjects');
    allSubjects = subjects;
    setEl('totalSubjects', subjects.length);
    renderSubjectTable(subjects);
  } catch(err) {
    console.error('Load subjects error:', err.message);
  }

  try {
    const activeYear = await apiRequest('/school-years/active');
    setEl('subjectsSchoolYear', activeYear.label || '—');
  } catch(err) {
    setEl('subjectsSchoolYear', '—');
  }
}

function renderSubjectTable(subjects) {

  const tbody = document.getElementById('subjectTable');
  if(!tbody) return;

  selectedSubjectIds = new Set();
  updateSubjectBulkButtons();

  if(subjects.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="${subjectSelectionMode ? 5 : 4}"
          style="text-align:center; color:gray; padding:30px;">
          No subjects found
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = subjects.map(s => `
    <tr id="subject-row-${s.id}">
      ${subjectSelectionMode ? `
        <td style="text-align:center;">
          <input type="checkbox"
            id="chk-subject-${s.id}"
            onchange="toggleSubjectSelection(${s.id})"
            style="width:16px; height:16px; cursor:pointer;">
        </td>
      ` : ''}
      <td>${s.name}</td>
      <td>${s.grade_level}</td>
      <td>${s.description || '—'}</td>
    </tr>
  `).join('');
}

function filterSubjects() {
  const search = (document.getElementById('subjectSearch')?.value || '').toLowerCase();
  const grade  = document.getElementById('subjectGradeFilter')?.value || '';

  const filtered = allSubjects.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search);
    const matchGrade  = !grade || s.grade_level === grade;
    return matchSearch && matchGrade;
  });

  renderSubjectTable(filtered);
}

// ── SUBJECT EDIT MODE

function toggleSubjectEditMode() {

  subjectSelectionMode = !subjectSelectionMode;
  selectedSubjectIds   = new Set();

  const btn = document.getElementById('subjectEditModeBtn');
  if(btn){
    btn.innerText        = subjectSelectionMode ? '✖ Cancel' : '☑ Edit Mode';
    btn.style.background = subjectSelectionMode ? '#555' : '#800000';
  }

  const bar = document.getElementById('subjectBulkBar');
  if(bar) bar.style.display = subjectSelectionMode ? 'flex' : 'none';

  // update table head
  const thead = document.getElementById('subjectTableHead');
  if(thead){
    if(subjectSelectionMode){
      thead.innerHTML = `
        <th style="width:40px; text-align:center;">
          <input type="checkbox"
            id="selectAllSubjects"
            onchange="toggleSelectAllSubjects()"
            style="width:16px; height:16px; cursor:pointer;">
        </th>
        <th>Subject Name</th>
        <th>Grade Level</th>
        <th>Description</th>
      `;
    } else {
      thead.innerHTML = `
        <th>Subject Name</th>
        <th>Grade Level</th>
        <th>Description</th>
      `;
    }
  }

  renderSubjectTable(allSubjects);
}

function toggleSubjectSelection(id) {
  if(selectedSubjectIds.has(id)){
    selectedSubjectIds.delete(id);
  } else {
    selectedSubjectIds.add(id);
  }
  updateSubjectBulkButtons();
}

function toggleSelectAllSubjects() {
  const selectAll  = document.getElementById('selectAllSubjects');
  const checkboxes = document.querySelectorAll('[id^="chk-subject-"]');
  if(selectAll.checked){
    checkboxes.forEach(chk => {
      chk.checked = true;
      selectedSubjectIds.add(
        parseInt(chk.id.replace('chk-subject-', ''))
      );
    });
  } else {
    checkboxes.forEach(chk => { chk.checked = false; });
    selectedSubjectIds.clear();
  }
  updateSubjectBulkButtons();
}

function updateSubjectBulkButtons() {
  const count      = selectedSubjectIds.size;
  const countEl    = document.getElementById('selectedSubjectCount');
  const archiveBtn = document.getElementById('bulkArchiveSubjectBtn');
  const deleteBtn  = document.getElementById('bulkDeleteSubjectBtn');

  if(countEl) countEl.innerText = count > 0 ? `${count} selected` : '';

  if(archiveBtn){
    archiveBtn.disabled      = count === 0;
    archiveBtn.style.opacity = count === 0 ? '0.5' : '1';
  }
  if(deleteBtn){
    deleteBtn.disabled      = count === 0;
    deleteBtn.style.opacity = count === 0 ? '0.5' : '1';
  }
}

async function bulkArchiveSubjectsSelected() {
  const ids = Array.from(selectedSubjectIds);
  if(ids.length === 0){ alert('No subjects selected.'); return; }

  const names = ids.map(id => {
    const row = document.getElementById(`subject-row-${id}`);
    if(row){
      const cells = row.querySelectorAll('td');
      // in selection mode: checkbox(0), name(1)
      return cells[1]?.innerText || `Subject ID ${id}`;
    }
    return `Subject ID ${id}`;
  });

  openArchiveReasonModal('subject', ids, names);
}

async function bulkDeleteSubjectsSelected() {
  const ids = Array.from(selectedSubjectIds);
  if(ids.length === 0){ alert('No subjects selected.'); return; }
  if(!confirm(
    `⚠ DELETE ${ids.length} subject(s) permanently?\n\n` +
    `Subjects with existing grade records cannot be deleted.\n` +
    `Consider archiving instead.`
  )) return;

  try {
    const results = await Promise.allSettled(
      ids.map(id => apiRequest(`/subjects/${id}`, 'DELETE'))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed    = results.filter(r => r.status === 'rejected').length;
    let msg = `✅ ${succeeded} subject(s) deleted.`;
    if(failed > 0) msg += `\n⚠ ${failed} could not be deleted.`;
    alert(msg);
    subjectSelectionMode = false;
    toggleSubjectEditMode();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

// ── SUBJECT MODALS

function openAddSubject() {
  document.getElementById('subjectModal').style.display = 'flex';
}

function closeSubjectModal() {
  document.getElementById('subjectModal').style.display = 'none';
  document.getElementById('subjectForm').reset();
  setEl('subjectModalError', '');
}

async function submitSubject() {

  const name        = document.getElementById('inputSubjectName').value.trim();
  const grade_level = document.getElementById('inputSubjectGrade').value;
  const description = document.getElementById('inputSubjectDesc').value.trim();
  const errorEl     = document.getElementById('subjectModalError');

  if(errorEl) errorEl.innerText = '';

  if(!name || !grade_level){
    if(errorEl) errorEl.innerText = 'Subject name and grade level are required.';
    return;
  }

  try {
    await apiRequest('/subjects', 'POST', { name, grade_level, description });
    closeSubjectModal();
    loadSubjects();
  } catch(err) {
    if(errorEl) errorEl.innerText = err.message;
  }
}

let editingSubjectId = null;

function editSubject(id, name, grade, description) {
  editingSubjectId = id;
  document.getElementById('editSubjectName').value  = name;
  document.getElementById('editSubjectGrade').value = grade;
  document.getElementById('editSubjectDesc').value  = description;
  setEl('editSubjectError', '');
  document.getElementById('editSubjectModal').style.display = 'flex';
}

function closeEditSubjectModal() {
  document.getElementById('editSubjectModal').style.display = 'none';
  setEl('editSubjectError', '');
}

async function submitEditSubject() {

  const name        = document.getElementById('editSubjectName').value.trim();
  const grade_level = document.getElementById('editSubjectGrade').value;
  const description = document.getElementById('editSubjectDesc').value.trim();
  const errorEl     = document.getElementById('editSubjectError');

  if(errorEl) errorEl.innerText = '';

  if(!name || !grade_level){
    if(errorEl) errorEl.innerText = 'Subject name and grade level are required.';
    return;
  }

  try {
    await apiRequest(`/subjects/${editingSubjectId}`, 'PUT', {
      name, grade_level, description
    });
    closeEditSubjectModal();
    loadSubjects();
  } catch(err) {
    if(errorEl) errorEl.innerText = err.message;
  }
}

async function archiveSubject(id, name) {
  if(!confirm(
    `Archive subject "${name}"?\n\n` +
    `It won't appear in active lists but historical grades are kept.`
  )) return;
  try {
    await apiRequest(`/subjects/${id}/archive`, 'PUT');
    alert('Subject archived successfully.');
    loadSubjects();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

async function deleteSubject(id) {
  await archiveSubject(id, 'this subject');
}


// ==============================
// ARCHIVE WITH REASON MODAL
// ==============================

let pendingArchiveType = null;
let pendingArchiveIds  = [];

function openArchiveReasonModal(type, ids, names) {

  pendingArchiveType = type;
  pendingArchiveIds  = ids;

  const titles = {
    student: 'Archive Student(s)',
    teacher: 'Archive Teacher(s)',
    subject: 'Archive Subject(s)'
  };

  const subtitles = {
    student:
      'Archived students are removed from active class lists. ' +
      'Their grades and enrollment history are preserved.',
    teacher:
      'Archived teachers are removed from active assignments. ' +
      'Their submitted grades remain intact.',
    subject:
      'Archived subjects are removed from new assignments. ' +
      'Historical grades using this subject are preserved.'
  };

  setEl('archiveReasonTitle',    titles[type]    || 'Archive Record');
  setEl('archiveReasonSubtitle', subtitles[type] || '');

  const namesEl = document.getElementById('archiveReasonNames');
  if(namesEl){
    namesEl.innerHTML = names.map(n =>
      `<p style="margin:3px 0;">📌 ${n}</p>`
    ).join('');
  }

  const input = document.getElementById('archiveReasonInput');
  if(input) input.value = '';

  document.getElementById('archiveReasonModal').style.display = 'flex';
}

function closeArchiveReasonModal() {
  document.getElementById('archiveReasonModal').style.display = 'none';
  pendingArchiveType = null;
  pendingArchiveIds  = [];
}

async function confirmArchiveWithReason() {

  const reason = (
    document.getElementById('archiveReasonInput')?.value || ''
  ).trim();

  const btn = document.getElementById('archiveReasonConfirmBtn');
  if(btn){ btn.disabled = true; btn.innerText = '⏳ Archiving...'; }

  // capture count BEFORE closing modal clears the arrays
  const archiveCount = pendingArchiveIds.length;
  const archiveType  = pendingArchiveType;

  try {

    if(archiveType === 'student'){

      const result = await apiRequest('/students/bulk/archive', 'POST', {
        ids:    pendingArchiveIds,
        reason: reason
      });

      closeArchiveReasonModal();
      studentSelectionMode = false;
      toggleStudentEditMode();
      loadStudents();
      showToast(
        `✅ ${archiveCount} student(s) archived successfully`,
        'success'
      );

    } else if(archiveType === 'teacher'){

      const result = await apiRequest('/teachers/bulk/archive', 'POST', {
        ids:    pendingArchiveIds,
        reason: reason
      });

      closeArchiveReasonModal();
      teacherSelectionMode = false;
      toggleTeacherEditMode();
      loadTeachers();
      showToast(
        `✅ ${archiveCount} teacher(s) archived successfully`,
        'success'
      );

    } else if(archiveType === 'subject'){

      const result = await apiRequest('/subjects/bulk/archive', 'POST', {
        ids:    pendingArchiveIds,
        reason: reason
      });

      closeArchiveReasonModal();
      subjectSelectionMode = false;
      toggleSubjectEditMode();
      loadSubjects();
      showToast(
        `✅ ${archiveCount} subject(s) archived successfully`,
        'success'
      );
    }

  } catch(err) {
    alert('Error: ' + err.message);
  } finally {
    if(btn){ btn.disabled = false; btn.innerText = '🗄 Confirm Archive'; }
  }
}


// ==============================
// GRADE UPLOADS
// ==============================

async function loadUploads() {

  try {
    const [uploads, counts] = await Promise.all([
      apiRequest('/grades/uploads'),
      apiRequest('/grades/uploads/counts')
    ]);

    allUploads = uploads;

    setEl('totalUploads',    counts.total    || 0);
    setEl('pendingUploads',  counts.pending  || 0);
    setEl('approvedUploads', counts.approved || 0);
    setEl('rejectedUploads', counts.rejected || 0);
    setEl('lockedUploads',   counts.locked   || 0);

    renderUploadTable(uploads);

    // load dynamic filters
    loadUploadSubjectFilter();
    loadUploadSectionFilter();

  } catch(err) {
    console.error('Load uploads error:', err.message);
  }
}

async function loadUploadSubjectFilter() {
  try {
    const subjects = await apiRequest('/grades/uploads/subjects');
    const select   = document.getElementById('uploadSubjectFilter');
    if(!select) return;
    const current  = select.value;
    select.innerHTML =
      '<option value="">All Subjects</option>' +
      subjects.map(s =>
        `<option value="${s.id}"
          ${String(s.id) === String(current) ? 'selected' : ''}>
          ${s.name}
        </option>`
      ).join('');
  } catch(err) {
    console.error('Load upload subjects error:', err.message);
  }
}

async function loadUploadSectionFilter() {
  try {
    const sections = await apiRequest('/grades/uploads/sections');
    const select   = document.getElementById('uploadSectionFilter');
    if(!select) return;
    const current  = select.value;
    select.innerHTML =
      '<option value="">All Sections</option>' +
      sections.map(s =>
        `<option value="${s}"
          ${s === current ? 'selected' : ''}>
          ${s}
        </option>`
      ).join('');
  } catch(err) {
    console.error('Load upload sections error:', err.message);
  }
}

function renderUploadTable(uploads) {

  const tbody = document.getElementById('uploadTable');
  if(!tbody) return;

  if(uploads.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="10"
          style="text-align:center; color:gray; padding:30px;">
          No uploads found
        </td>
      </tr>
    `;
    return;
  }

  const statusLabel = {
    pending:  '⏳ Pending',
    approved: '✅ Approved',
    rejected: '❌ Rejected',
    locked:   '🔒 Locked',
    draft:    '📝 Draft'
  };

  tbody.innerHTML = uploads.map(u => `
    <tr>
      <td>#${u.id}</td>
      <td>${u.teacher_name}</td>
      <td>${u.subject_name}</td>
      <td>${u.quarter} Semester</td>
      <td>${u.grade_level}</td>
      <td>${u.section}</td>
      <td>${u.school_year}</td>
      <td>${new Date(u.submitted_at).toLocaleDateString()}</td>
      <td>${statusLabel[u.status] || u.status}</td>
      <td>
        <button onclick="reviewUpload(${u.id})">👁 Review</button>
      </td>
    </tr>
  `).join('');
}

function filterUploadsByStatus(status) {
  const filtered = status
    ? allUploads.filter(u => u.status === status)
    : allUploads;
  renderUploadTable(filtered);
}

function searchUploads() {
  const search    = (document.getElementById('searchTeacherUpload')?.value || '').toLowerCase();
  const subjectId = document.getElementById('uploadSubjectFilter')?.value  || '';
  const quarter   = document.getElementById('uploadQuarterFilter')?.value  || '';
  const grade     = document.getElementById('uploadGradeFilter')?.value    || '';
  const section   = document.getElementById('uploadSectionFilter')?.value  || '';
  const status    = document.getElementById('uploadStatusFilter')?.value   || '';

  const filtered = allUploads.filter(u => {
    const matchSearch  =
      u.teacher_name.toLowerCase().includes(search) ||
      u.subject_name.toLowerCase().includes(search);
    const matchSubject = !subjectId || String(u.subject_id) === subjectId;
    const matchQuarter = !quarter   || u.quarter     === quarter;
    const matchGrade   = !grade     || u.grade_level === grade;
    const matchSection = !section   || u.section     === section;
    const matchStatus  = !status    || u.status      === status;
    return matchSearch && matchSubject && matchQuarter && matchGrade && matchSection && matchStatus;
  });

  renderUploadTable(filtered);
}

// ── REVIEW MODAL

let currentReviewUploadId     = null;
let currentReviewUploadStatus = null;

async function reviewUpload(id) {

  currentReviewUploadId = id;

  try {

    const data   = await apiRequest(`/grades/uploads/${id}`);
    const u      = data.upload;
    const grades = data.grades;

    currentReviewUploadStatus = u.status;

    setEl('reviewModalTitle',
      `${u.subject_name} — ${u.grade_level} Section ${u.section} | ${u.quarter} Semester`
    );
    setEl('reviewModalTeacher',
      `Teacher: ${u.teacher_name} (${u.prc_id}) | ` +
      `Submitted: ${new Date(u.submitted_at).toLocaleDateString()}`
    );

    const statusColors = {
      pending:  '#cc8800',
      approved: '#007700',
      rejected: '#cc0000',
      locked:   '#555555'
    };
    const statusLabels = {
      pending:  '⏳ Pending Review',
      approved: '✅ Approved',
      rejected: '❌ Rejected',
      locked:   '🔒 Locked'
    };

    const statusEl = document.getElementById('reviewModalStatus');
    if(statusEl){
      statusEl.innerText   = statusLabels[u.status] || u.status;
      statusEl.style.color = statusColors[u.status] || '#333';
    }

    setEl('reviewTotalStudents', data.total);
    setEl('reviewPassing',       data.passing);
    setEl('reviewFailing',       data.failing);
    setEl('reviewSchoolYear',    u.school_year);

    // teacher note
    const noteBox  = document.getElementById('reviewTeacherNote');
    const noteText = document.getElementById('reviewTeacherNoteText');
    if(noteBox && noteText){
      if(u.teacher_note){
        noteText.innerText    = u.teacher_note;
        noteBox.style.display = 'block';
      } else {
        noteBox.style.display = 'none';
      }
    }

    // grade table
    const tbody = document.getElementById('reviewGradeTable');
    if(tbody){
      tbody.innerHTML = grades.length === 0
        ? `<tr><td colspan="5"
              style="text-align:center; color:gray; padding:20px;">
              No grades found in this upload
            </td></tr>`
        : grades.map((g, i) => {
            const passing = g.score >= 75;
            return `
              <tr style="background:${i % 2 === 0 ? '#fafafa' : 'white'};">
                <td style="padding:9px;">${i + 1}</td>
                <td style="padding:9px; font-size:12px; color:gray;">${g.lrn}</td>
                <td style="padding:9px;">${g.student_name}</td>
                <td style="padding:9px; font-weight:bold;
                  color:${passing ? '#007700' : '#cc0000'};">${g.score}</td>
                <td style="padding:9px; font-size:12px;
                  color:${passing ? '#007700' : '#cc0000'};">
                  ${passing ? '✅ Passed' : '❌ Failed'}
                </td>
              </tr>
            `;
          }).join('');
    }

    const rejectBox = document.getElementById('rejectReasonBox');
    if(rejectBox) rejectBox.style.display = 'none';

    buildReviewActionButtons(u.status, id);
    document.getElementById('reviewModal').style.display = 'flex';

  } catch(err) {
    alert('Error loading upload: ' + err.message);
  }
}

function buildReviewActionButtons(status, uploadId) {

  const container = document.getElementById('reviewActionButtons');
  if(!container) return;
  container.innerHTML = '';

  if(status === 'pending'){

    const approveBtn = document.createElement('button');
    approveBtn.innerText     = '✅ Approve Upload';
    approveBtn.style.cssText =
      'padding:11px 20px; background:#007700; color:white; ' +
      'border:none; border-radius:8px; cursor:pointer; ' +
      'font-size:14px; font-weight:bold;';
    approveBtn.onclick = () => confirmApprove(uploadId);
    container.appendChild(approveBtn);

    const rejectBtn = document.createElement('button');
    rejectBtn.innerText     = '❌ Reject Upload';
    rejectBtn.style.cssText =
      'padding:11px 20px; background:#cc0000; color:white; ' +
      'border:none; border-radius:8px; cursor:pointer; ' +
      'font-size:14px; font-weight:bold;';
    rejectBtn.onclick = () => showRejectInput(uploadId);
    container.appendChild(rejectBtn);
  }

  if(status === 'approved'){

    const unapproveBtn = document.createElement('button');
    unapproveBtn.innerText     = '↩ Return to Pending';
    unapproveBtn.style.cssText =
      'padding:11px 20px; background:#cc8800; color:white; ' +
      'border:none; border-radius:8px; cursor:pointer; ' +
      'font-size:14px; font-weight:bold;';
    unapproveBtn.onclick = () => confirmUnapprove(uploadId);
    container.appendChild(unapproveBtn);

    const lockBtn = document.createElement('button');
    lockBtn.innerText     = '🔒 Lock and Finalize';
    lockBtn.style.cssText =
      'padding:11px 20px; background:#555; color:white; ' +
      'border:none; border-radius:8px; cursor:pointer; ' +
      'font-size:14px; font-weight:bold;';
    lockBtn.onclick = () => confirmLock(uploadId);
    container.appendChild(lockBtn);

    const info = document.createElement('p');
    info.style.cssText = 'font-size:12px; color:gray; margin:6px 0 0; width:100%;';
    info.innerText =
      'Grades are visible to students. ' +
      'Use Return to Pending to hide them if corrections are needed.';
    container.appendChild(info);
  }

  if(status === 'rejected'){

    const returnBtn = document.createElement('button');
    returnBtn.innerText     = '↩ Return to Pending';
    returnBtn.style.cssText =
      'padding:11px 20px; background:#cc8800; color:white; ' +
      'border:none; border-radius:8px; cursor:pointer; ' +
      'font-size:14px; font-weight:bold;';
    returnBtn.onclick = () => confirmUnapprove(uploadId);
    container.appendChild(returnBtn);

    const info = document.createElement('p');
    info.style.cssText = 'font-size:12px; color:gray; margin:6px 0 0; width:100%;';
    info.innerText =
      'This upload was rejected. ' +
      'Return to Pending to allow the teacher to resubmit corrected grades.';
    container.appendChild(info);
  }

  if(status === 'locked'){
    const info = document.createElement('p');
    info.style.cssText = 'font-size:13px; color:#555; font-weight:bold; margin:0;';
    info.innerText = '🔒 These grades are permanently locked and cannot be changed.';
    container.appendChild(info);
  }
}

function showRejectInput(uploadId) {
  const box = document.getElementById('rejectReasonBox');
  if(box){
    box.style.display = 'block';
    box.scrollIntoView({ behavior:'smooth', block:'center' });
  }
  const container = document.getElementById('reviewActionButtons');
  if(!container) return;
  container.querySelectorAll('button').forEach(btn => {
    if(btn.innerText.includes('Reject Upload')){
      btn.innerText        = '❌ Confirm Rejection';
      btn.style.background = '#800000';
      btn.onclick          = () => submitRejectFromModal(uploadId);
    }
  });
}

async function confirmApprove(id) {
  if(!confirm(
    'Approve this upload?\n\n' +
    'All grades will immediately become visible to students.'
  )) return;
  try {
    await apiRequest(`/grades/uploads/${id}/approve`, 'PUT');
    alert('✅ Upload approved. Grades are now visible to students.');
    closeReviewModal();
    loadUploads();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

async function submitRejectFromModal(id) {
  const remarks = document.getElementById('rejectRemarksInput')?.value.trim();
  if(!remarks){ alert('Please enter a reason for rejection.'); return; }
  try {
    await apiRequest(`/grades/uploads/${id}/reject`, 'PUT', { remarks });
    alert('❌ Upload rejected. Teacher will see your remarks.');
    closeReviewModal();
    loadUploads();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

async function confirmUnapprove(id) {
  if(!confirm(
    '↩ Return this upload to Pending?\n\n' +
    'Grades will no longer be visible to students.\n' +
    'The teacher can resubmit corrected grades.'
  )) return;
  try {
    await apiRequest(`/grades/uploads/${id}/unapprove`, 'PUT');
    alert('↩ Upload returned to pending. Grades are hidden from students.');
    closeReviewModal();
    loadUploads();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

async function confirmLock(id) {
  if(!confirm(
    '🔒 Lock and finalize these grades?\n\n' +
    'This is PERMANENT. Grades cannot be changed after locking.\n' +
    'Only do this at the end of the grading period.'
  )) return;
  if(!confirm('Final confirmation — this cannot be undone.')) return;
  try {
    await apiRequest(`/grades/uploads/${id}/lock`, 'PUT');
    alert('🔒 Grades permanently locked and finalized.');
    closeReviewModal();
    loadUploads();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

function closeReviewModal() {
  document.getElementById('reviewModal').style.display = 'none';
  currentReviewUploadId     = null;
  currentReviewUploadStatus = null;
  const box   = document.getElementById('rejectReasonBox');
  const input = document.getElementById('rejectRemarksInput');
  const note  = document.getElementById('reviewTeacherNote');
  if(box)   box.style.display   = 'none';
  if(input) input.value         = '';
  if(note)  note.style.display  = 'none';
}

// stubs for old button references
function approveUpload(id) { confirmApprove(id); }
function openRejectModal(id) { reviewUpload(id); }
function submitReject() { submitRejectFromModal(currentReviewUploadId); }
function lockUpload(id) { confirmLock(id); }


// ==============================
// REPORTS
// ==============================

let currentReport     = 'schoolYear';
let currentReportData = [];

function setActiveReportBtn(type) {
  ['students','teachers','gradeUpload','schoolYear'].forEach(t => {
    const btn = document.getElementById(`rptBtn-${t}`);
    if(btn){
      btn.style.background = t === type ? '#800000' : '#ccc';
      btn.style.color      = t === type ? 'white'   : '#333';
    }
  });
}

async function loadReports() {

  try {
    const summary = await apiRequest('/reports/summary');
    setEl('reportsTotalStudents',   summary.total_students    || 0);
    setEl('reportsTotalTeachers',   summary.total_teachers    || 0);
    setEl('reportsApprovedUploads', summary.approved_uploads  || 0);
    setEl('reportsSchoolYear',      summary.active_school_year || '—');

    const years = await apiRequest('/school-years');
    const yearSelect = document.getElementById('reportSchoolYearFilter');
    if(yearSelect){
      yearSelect.innerHTML =
        '<option value="">All School Years</option>' +
        years.map(y =>
          `<option value="${y.id}" ${y.is_active ? 'selected' : ''}>
            ${y.label}${y.is_active ? ' (Active)' : ''}
          </option>`
        ).join('');
    }

    loadSectionsIntoDropdown('reportSectionFilter');
    loadSchoolYearHistory();
  } catch(err) {
    console.error('Load reports error:', err.message);
  }
}

function studentReport()     { currentReport = 'student';    setActiveReportBtn('students');    loadStudentReport();     }
function teacherReport()     { currentReport = 'teacher';    setActiveReportBtn('teachers');    loadTeacherReport();     }
function gradeUploadReport() { currentReport = 'gradeUpload';setActiveReportBtn('gradeUpload'); loadGradeUploadReport(); }
function schoolYearHistory() { currentReport = 'schoolYear'; setActiveReportBtn('schoolYear');  loadSchoolYearHistory(); }

function refreshCurrentReport() {
  const search = document.getElementById('reportSearchInput');
  if(search) search.value = '';
  const refreshers = {
    student:     loadStudentReport,
    teacher:     loadTeacherReport,
    gradeUpload: loadGradeUploadReport,
    schoolYear:  loadSchoolYearHistory
  };
  if(refreshers[currentReport]) refreshers[currentReport]();
}

async function loadStudentReport() {
  const schoolYearId = document.getElementById('reportSchoolYearFilter')?.value || '';
  const gradeLevel   = document.getElementById('reportGradeFilter')?.value       || '';
  const section      = document.getElementById('reportSectionFilter')?.value     || '';
  setReportTableLoading(8);
  try {
    const params = new URLSearchParams();
    if(schoolYearId) params.append('school_year_id', schoolYearId);
    if(gradeLevel)   params.append('grade_level',    gradeLevel);
    if(section)      params.append('section',        section);
    const students = await apiRequest(`/reports/students?${params.toString()}`);
    currentReportData = students;
    const thead = document.getElementById('reportsTableHead');
    if(thead) thead.innerHTML = `
      <th>LRN</th><th>Full Name</th><th>Grade Level</th><th>Section</th>
      <th>School Year</th><th>Account Status</th><th>Record</th>
    `;
    renderReportTable(students, 'student');
  } catch(err) { console.error('Student report error:', err.message); }
}

async function loadTeacherReport() {
  const schoolYearId = document.getElementById('reportSchoolYearFilter')?.value || '';
  setReportTableLoading(7);
  try {
    const params = new URLSearchParams();
    if(schoolYearId) params.append('school_year_id', schoolYearId);
    const teachers = await apiRequest(`/reports/teachers?${params.toString()}`);
    currentReportData = teachers;
    const thead = document.getElementById('reportsTableHead');
    if(thead) thead.innerHTML = `
      <th>PRC ID</th><th>Full Name</th><th>Subject</th><th>Grade Level</th>
      <th>Section</th><th>School Year</th><th>Account Status</th>
    `;
    renderReportTable(teachers, 'teacher');
  } catch(err) { console.error('Teacher report error:', err.message); }
}

async function loadGradeUploadReport() {
  const schoolYearId = document.getElementById('reportSchoolYearFilter')?.value || '';
  const quarter      = document.getElementById('reportQuarterFilter')?.value    || '';
  const status       = document.getElementById('reportStatusFilter')?.value     || '';
  setReportTableLoading(9);
  try {
    const params = new URLSearchParams();
    if(schoolYearId) params.append('school_year_id', schoolYearId);
    if(quarter)      params.append('quarter',        quarter);
    if(status)       params.append('status',         status);
    const uploads = await apiRequest(`/reports/grade-uploads?${params.toString()}`);
    currentReportData = uploads;
    const thead = document.getElementById('reportsTableHead');
    if(thead) thead.innerHTML = `
      <th>Teacher</th><th>Subject</th><th>Class</th><th>Semester</th>
      <th>School Year</th><th>Total Students</th><th>Passing</th>
      <th>Failing</th><th>Status</th>
    `;
    renderReportTable(uploads, 'gradeUpload');
  } catch(err) { console.error('Grade upload report error:', err.message); }
}

async function loadSchoolYearHistory() {
  setReportTableLoading(8);
  try {
    const history = await apiRequest('/reports/school-years');
    currentReportData = history;
    const thead = document.getElementById('reportsTableHead');
    if(thead) thead.innerHTML = `
      <th>School Year</th><th>Status</th><th>Total Semesters</th>
      <th>Students</th><th>Teachers</th><th>Uploads</th>
      <th>Approved</th><th>Pending</th>
    `;
    renderReportTable(history, 'schoolYear');
  } catch(err) { console.error('School year history error:', err.message); }
}

function renderStudentRows(data) {
  return data.map(s => `
    <tr>
      <td style="font-size:12px;color:gray;">${s.lrn || '—'}</td>
      <td>${s.full_name}</td>
      <td>${s.grade_level || '—'}</td>
      <td>${s.section     || '—'}</td>
      <td>${s.school_year || '—'}</td>
      <td>${s.account_status === 'activated'
        ? '<span style="color:green;">✅ Activated</span>'
        : '<span style="color:orange;">⏳ Not Activated</span>'
      }</td>
      <td>${s.is_archived
        ? '<span style="color:gray;">🗄 Archived</span>'
        : '<span style="color:green;">Active</span>'
      }</td>
    </tr>
  `).join('');
}

function renderTeacherRows(data) {
  return data.map(t => `
    <tr>
      <td style="font-size:12px;color:gray;">${t.prc_id}</td>
      <td>${t.full_name}</td>
      <td>${t.subject_name || '—'}</td>
      <td>${t.grade_level  || '—'}</td>
      <td>${t.section      || '—'}</td>
      <td>${t.school_year  || '—'}</td>
      <td>${t.account_status === 'activated'
        ? '<span style="color:green;">✅ Activated</span>'
        : '<span style="color:orange;">⏳ Not Activated</span>'
      }</td>
    </tr>
  `).join('');
}

function renderGradeUploadRows(data) {
  const statusLabel = {
    pending:'⏳ Pending', approved:'✅ Approved',
    rejected:'❌ Rejected', locked:'🔒 Locked'
  };
  return data.map(u => `
    <tr>
      <td>${u.teacher_name}</td>
      <td>${u.subject_name}</td>
      <td>${u.grade_level} — ${u.section}</td>
      <td>${u.quarter} Semester</td>
      <td>${u.school_year}</td>
      <td style="text-align:center;font-weight:bold;">${u.total_students}</td>
      <td style="text-align:center;color:green;font-weight:bold;">${u.passing || 0}</td>
      <td style="text-align:center;color:red;font-weight:bold;">${u.failing || 0}</td>
      <td>${statusLabel[u.status] || u.status}</td>
    </tr>
  `).join('');
}

function renderSchoolYearRows(data) {
  return data.map(h => `
    <tr style="${h.is_active ? 'background:#f0fff0;font-weight:bold;' : ''}">
      <td>${h.label}</td>
      <td>${h.is_active
        ? '<span style="color:green;">✅ Active</span>'
        : '<span style="color:gray;">Completed</span>'
      }</td>
      <td style="text-align:center;">${h.total_quarters || '—'}</td>
      <td style="text-align:center;">${h.total_students || 0}</td>
      <td style="text-align:center;">${h.total_teachers || 0}</td>
      <td style="text-align:center;">${h.total_uploads  || 0}</td>
      <td style="text-align:center;color:green;">${h.approved_uploads || 0}</td>
      <td style="text-align:center;color:orange;">${h.pending_uploads || 0}</td>
    </tr>
  `).join('');
}

function searchReportTable() {
  const search = (document.getElementById('reportSearchInput')?.value || '')
    .toLowerCase().trim();
  if(!search){ renderReportTable(currentReportData, currentReport); return; }
  const filtered = currentReportData.filter(row =>
    Object.values(row).some(val =>
      String(val || '').toLowerCase().includes(search)
    )
  );
  renderReportTable(filtered, currentReport, search);
}

function renderReportTable(data, type, searchTerm = '') {

  const tbody      = document.getElementById('reportsTable');
  const counterBar = document.getElementById('reportCounterBar');
  if(!tbody) return;

  if(counterBar){
    counterBar.style.display = 'block';
    const label = {
      student:'student', teacher:'teacher',
      gradeUpload:'upload', schoolYear:'school year'
    }[type] || 'record';
    counterBar.innerHTML = searchTerm
      ? `🔍 Showing <strong>${data.length}</strong> ${label}(s) matching "<strong>${searchTerm}</strong>"`
      : `📋 Total: <strong>${data.length}</strong> ${label}(s) found`;
  }

  if(data.length === 0){
    const cols = { student:8, teacher:7, gradeUpload:9, schoolYear:8 }[type] || 6;
    tbody.innerHTML = `
      <tr><td colspan="${cols}"
        style="text-align:center;color:gray;padding:30px;">
        ${searchTerm ? `No results for "${searchTerm}"` : 'No records found'}
      </td></tr>
    `;
    return;
  }

  const renderers = {
    student:     renderStudentRows,
    teacher:     renderTeacherRows,
    gradeUpload: renderGradeUploadRows,
    schoolYear:  renderSchoolYearRows
  };

  tbody.innerHTML = renderers[type] ? renderers[type](data) : '';
}

function setReportTableLoading(cols) {
  const tbody = document.getElementById('reportsTable');
  if(tbody) tbody.innerHTML = `
    <tr><td colspan="${cols}"
      style="text-align:center;color:gray;padding:20px;">
      ⏳ Loading...
    </td></tr>
  `;
  const counterBar = document.getElementById('reportCounterBar');
  if(counterBar) counterBar.style.display = 'none';
}


// ==============================
// ARCHIVED RECORDS
// ==============================

let currentViewedYearId  = null;
let currentYearTab       = 'students';
let currentYearTabData   = [];

let archivedStudentsData = [];
let archivedTeachersData = [];
let archivedSubjectsData = [];

let selectedArchivedStudentIds = new Set();
let selectedArchivedTeacherIds = new Set();
let selectedArchivedSubjectIds = new Set();

async function loadArchived() {
  switchArchiveMainTab('years');
}

function switchArchiveMainTab(tab) {

  const tabs = ['years', 'students', 'teachers', 'subjects'];
  tabs.forEach(t => {
    const btn     = document.getElementById(`archiveMainTab-${t}`);
    const content = document.getElementById(`archiveMainContent-${t}`);
    if(btn){
      btn.style.background = t === tab ? '#800000' : '#ccc';
      btn.style.color      = t === tab ? 'white'   : '#333';
    }
    if(content) content.style.display = t === tab ? 'block' : 'none';
  });

  if(tab === 'years')    loadYearCards();
  if(tab === 'students') loadArchivedStudents();
  if(tab === 'teachers') loadArchivedTeachers();
  if(tab === 'subjects') loadArchivedSubjects();
}

// ── SCHOOL YEAR CARDS

async function loadYearCards() {

  const container = document.getElementById('archivedYearCards');
  if(!container) return;

  container.innerHTML = '<p style="color:gray;padding:10px;">Loading...</p>';

  const listView   = document.getElementById('archivedYearListView');
  const detailView = document.getElementById('archivedYearDetailView');
  if(listView)   listView.style.display   = 'block';
  if(detailView) detailView.style.display = 'none';

  try {
    const years = await apiRequest('/reports/school-years');

    if(years.length === 0){
      container.innerHTML =
        '<p style="color:gray;padding:10px;">No school year records found.</p>';
      return;
    }

    container.innerHTML = years.map(y => `
      <div class="card"
        onclick="openYearRecord(${y.id}, '${y.label}', ${y.is_active})"
        style="cursor:pointer; min-width:200px; transition:.2s;
          border:1.5px solid ${y.is_active ? '#800000' : '#eee'};
          ${y.is_active ? 'background:linear-gradient(135deg,#fff5f5,#fff);' : ''}"
        onmouseover="this.style.transform='translateY(-3px)'"
        onmouseout="this.style.transform='translateY(0)'">
        <div style="display:flex; justify-content:space-between;
          align-items:flex-start; margin-bottom:10px;">
          <h3 style="color:#800000; margin:0; font-size:16px;">${y.label}</h3>
          <span style="padding:3px 10px; border-radius:12px; font-size:11px;
            font-weight:bold; background:${y.is_active ? '#800000' : '#555'};
            color:white;">
            ${y.is_active ? 'ACTIVE' : 'COMPLETED'}
          </span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr;
          gap:8px; margin-top:10px; font-size:13px;">
          <div>
            <p style="color:gray;margin:0;font-size:11px;">Students</p>
            <p style="font-weight:bold;margin:2px 0;">${y.total_students || 0}</p>
          </div>
          <div>
            <p style="color:gray;margin:0;font-size:11px;">Teachers</p>
            <p style="font-weight:bold;margin:2px 0;">${y.total_teachers || 0}</p>
          </div>
          <div>
            <p style="color:gray;margin:0;font-size:11px;">Uploads</p>
            <p style="font-weight:bold;margin:2px 0;">${y.total_uploads || 0}</p>
          </div>
          <div>
            <p style="color:gray;margin:0;font-size:11px;">Approved</p>
            <p style="font-weight:bold;margin:2px 0;color:green;">${y.approved_uploads || 0}</p>
          </div>
        </div>
        <p style="font-size:12px;color:#800000;margin:12px 0 0;
          font-weight:bold;text-align:right;">
          Click to view all records →
        </p>
      </div>
    `).join('');

  } catch(err) {
    container.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

async function openYearRecord(yearId, label, isActive) {

  currentViewedYearId = yearId;
  currentYearTab      = 'students';

  const listView   = document.getElementById('archivedYearListView');
  const detailView = document.getElementById('archivedYearDetailView');
  if(listView)   listView.style.display   = 'none';
  if(detailView) detailView.style.display = 'block';

  setEl('archivedYearTitle', `📅 ${label}`);

  const badge = document.getElementById('archivedYearBadge');
  if(badge){
    badge.innerText        = isActive ? 'ACTIVE YEAR' : 'COMPLETED YEAR';
    badge.style.background = isActive ? '#800000' : '#555';
    badge.style.color      = 'white';
  }

  try {
    const summary = await apiRequest(
      `/reports/school-years/${yearId}/record`
    );
    setEl('yearRecordStudents', summary.total_students || 0);
    setEl('yearRecordTeachers', summary.total_teachers || 0);
    setEl('yearRecordUploads',  summary.total_uploads  || 0);
    setEl('yearRecordApproved', summary.approved       || 0);
    setEl('yearRecordLocked',   summary.locked         || 0);
  } catch(err) {
    console.error('Load year summary error:', err.message);
  }

  loadYearTab('students');
}

async function loadYearTab(tab) {

  currentYearTab = tab;

  ['students','teachers','uploads','grades'].forEach(t => {
    const btn = document.getElementById(`yearTab-${t}`);
    if(btn){
      btn.style.background = t === tab ? '#800000' : '#ccc';
      btn.style.color      = t === tab ? 'white'   : '#333';
    }
  });

  const tbody = document.getElementById('yearRecordTable');
  if(tbody){
    tbody.innerHTML = `
      <tr><td colspan="8"
        style="text-align:center;color:gray;padding:20px;">
        ⏳ Loading ${tab} records...
      </td></tr>
    `;
  }

  const searchEl = document.getElementById('yearRecordSearch');
  if(searchEl) searchEl.value = '';
  const counterBar = document.getElementById('yearRecordCounterBar');
  if(counterBar) counterBar.style.display = 'none';

  try {
    const data = await apiRequest(
      `/reports/school-years/${currentViewedYearId}/record?type=${tab}`
    );
    currentYearTabData = data;
    renderYearTabTable(data, tab);
  } catch(err) {
    if(tbody){
      tbody.innerHTML = `
        <tr><td colspan="8"
          style="color:red;text-align:center;padding:30px;">
          Error: ${err.message}
        </td></tr>
      `;
    }
  }
}

function renderYearTabTable(data, tab) {

  const thead = document.getElementById('yearRecordTableHead');
  const tbody = document.getElementById('yearRecordTable');
  if(!tbody) return;

  const statusLabel = {
    pending:'⏳ Pending', approved:'✅ Approved',
    rejected:'❌ Rejected', locked:'🔒 Locked'
  };

  if(tab === 'students'){
    if(thead) thead.innerHTML = `
      <th>LRN</th><th>Full Name</th><th>Grade Level</th>
      <th>Section</th><th>Account Status</th>
    `;
    tbody.innerHTML = data.length === 0
      ? `<tr><td colspan="6" style="text-align:center;color:gray;padding:30px;">
          No students enrolled this school year</td></tr>`
      : data.map(s => `<tr>
          <td style="font-size:12px;color:gray;">${s.lrn}</td>
          <td>${s.full_name}</td>
          <td>${s.grade_level || '—'}</td>
          <td>${s.section     || '—'}</td>
          <td>${s.account_status === 'activated'
            ? '<span style="color:green;">✅ Activated</span>'
            : '<span style="color:orange;">⏳ Not Activated</span>'
          }</td>
        </tr>`).join('');

  } else if(tab === 'teachers'){
    if(thead) thead.innerHTML = `
      <th>PRC ID</th><th>Full Name</th><th>Subject</th>
      <th>Grade Level</th><th>Section</th><th>Account Status</th>
    `;
    tbody.innerHTML = data.length === 0
      ? `<tr><td colspan="6" style="text-align:center;color:gray;padding:30px;">
          No teachers assigned this school year</td></tr>`
      : data.map(t => `<tr>
          <td style="font-size:12px;color:gray;">${t.prc_id}</td>
          <td>${t.full_name}</td>
          <td>${t.subject_name || '—'}</td>
          <td>${t.grade_level  || '—'}</td>
          <td>${t.section      || '—'}</td>
          <td>${t.account_status === 'activated'
            ? '<span style="color:green;">✅ Activated</span>'
            : '<span style="color:orange;">⏳ Not Activated</span>'
          }</td>
        </tr>`).join('');

  } else if(tab === 'uploads'){
    if(thead) thead.innerHTML = `
      <th>Teacher</th><th>Subject</th><th>Class</th><th>Semester</th>
      <th>Total</th><th>Passing</th><th>Failing</th><th>Status</th>
    `;
    tbody.innerHTML = data.length === 0
      ? `<tr><td colspan="8" style="text-align:center;color:gray;padding:30px;">
          No grade uploads this school year</td></tr>`
      : data.map(u => `<tr>
          <td>${u.teacher_name}</td>
          <td>${u.subject_name}</td>
          <td>${u.grade_level} — ${u.section}</td>
          <td>${u.quarter} Semester</td>
          <td style="text-align:center;font-weight:bold;">${u.total_students}</td>
          <td style="text-align:center;color:green;font-weight:bold;">${u.passing || 0}</td>
          <td style="text-align:center;color:red;font-weight:bold;">${u.failing || 0}</td>
          <td>${statusLabel[u.status] || u.status}</td>
        </tr>`).join('');

  } else if(tab === 'grades'){
    if(thead) thead.innerHTML = `
      <th>Student Name</th><th>LRN</th><th>Grade Level</th>
      <th>Section</th><th>Subject</th><th>Semester</th>
      <th>Score</th><th>Status</th>
    `;
    tbody.innerHTML = data.length === 0
      ? `<tr><td colspan="8" style="text-align:center;color:gray;padding:30px;">
          No grades recorded this school year</td></tr>`
      : data.map(g => `<tr>
          <td>${g.student_name}</td>
          <td style="font-size:12px;color:gray;">${g.lrn}</td>
          <td>${g.grade_level}</td>
          <td>${g.section}</td>
          <td>${g.subject_name}</td>
          <td>${g.quarter} Semester</td>
          <td style="font-weight:bold;
            color:${parseFloat(g.score) >= 75 ? 'green' : 'red'};">
            ${g.score}
          </td>
          <td>${statusLabel[g.status] || g.status}</td>
        </tr>`).join('');
  }
}

function searchYearRecord() {
  const search = (document.getElementById('yearRecordSearch')?.value || '')
    .toLowerCase().trim();
  const counterBar = document.getElementById('yearRecordCounterBar');

  if(!search){
    renderYearTabTable(currentYearTabData, currentYearTab);
    if(counterBar) counterBar.style.display = 'none';
    return;
  }

  const filtered = currentYearTabData.filter(row =>
    Object.values(row).some(val =>
      String(val || '').toLowerCase().includes(search)
    )
  );

  renderYearTabTable(filtered, currentYearTab);

  if(counterBar){
    counterBar.style.display = 'block';
    counterBar.innerHTML =
      `🔍 Showing <strong>${filtered.length}</strong> result(s) matching "<strong>${search}</strong>"`;
  }
}

function backToYearList() {
  currentViewedYearId = null;
  const listView   = document.getElementById('archivedYearListView');
  const detailView = document.getElementById('archivedYearDetailView');
  if(listView)   listView.style.display   = 'block';
  if(detailView) detailView.style.display = 'none';
}

// ── ARCHIVED STUDENTS

async function loadArchivedStudents() {
  try {
    const students = await apiRequest('/students/archived');
    archivedStudentsData = students;
    setEl('archivedStudentCount', students.length);
    renderArchivedStudentTable(students);
  } catch(err) { console.error('Load archived students error:', err.message); }
}

function renderArchivedStudentTable(students) {
  const tbody = document.getElementById('archivedStudentTable');
  if(!tbody) return;
  selectedArchivedStudentIds = new Set();
  updateArchivedStudentBulkButtons();
  if(students.length === 0){
    tbody.innerHTML = `<tr><td colspan="8"
      style="text-align:center;color:gray;padding:30px;">
      No archived students</td></tr>`;
    return;
  }
  tbody.innerHTML = students.map(s => `
    <tr>
      <td style="text-align:center;">
        <input type="checkbox"
          id="chk-archived-student-${s.id}"
          onchange="toggleArchivedStudentSelection(${s.id})"
          style="width:16px;height:16px;cursor:pointer;">
      </td>
      <td style="font-size:12px;color:gray;">${s.lrn || '—'}</td>
      <td>${s.full_name}</td>
      <td>${s.grade_level || '—'}</td>
      <td>${s.section     || '—'}</td>
      <td>${s.school_year || '—'}</td>
      <td style="font-size:12px;color:#886600;font-style:italic;max-width:180px;">
        ${s.archive_reason || '—'}
      </td>
      <td style="font-size:12px;color:gray;">
        ${s.archived_at ? new Date(s.archived_at).toLocaleDateString() : '—'}
      </td>
    </tr>
  `).join('');
}

function filterArchivedStudents() {
  const search = (document.getElementById('searchArchivedStudents')?.value || '').toLowerCase();
  const filtered = archivedStudentsData.filter(s =>
    s.full_name.toLowerCase().includes(search) ||
    String(s.lrn).toLowerCase().includes(search)
  );
  renderArchivedStudentTable(filtered);
}

function toggleArchivedStudentSelection(id) {
  if(selectedArchivedStudentIds.has(id)) selectedArchivedStudentIds.delete(id);
  else selectedArchivedStudentIds.add(id);
  updateArchivedStudentBulkButtons();
}

function toggleSelectAllArchivedStudents() {
  const selectAll  = document.getElementById('selectAllArchivedStudents');
  const checkboxes = document.querySelectorAll('[id^="chk-archived-student-"]');
  if(selectAll.checked){
    checkboxes.forEach(chk => {
      chk.checked = true;
      selectedArchivedStudentIds.add(parseInt(chk.id.replace('chk-archived-student-', '')));
    });
  } else {
    checkboxes.forEach(chk => { chk.checked = false; });
    selectedArchivedStudentIds.clear();
  }
  updateArchivedStudentBulkButtons();
}

function updateArchivedStudentBulkButtons() {
  const count      = selectedArchivedStudentIds.size;
  const countEl    = document.getElementById('selectedArchivedStudentCount');
  const restoreBtn = document.getElementById('bulkRestoreStudentBtn');
  const deleteBtn  = document.getElementById('bulkDeleteArchivedStudentBtn');
  if(countEl) countEl.innerText = count > 0 ? `${count} selected` : '';
  if(restoreBtn){ restoreBtn.disabled = count === 0; restoreBtn.style.opacity = count === 0 ? '0.5' : '1'; }
  if(deleteBtn) { deleteBtn.disabled  = count === 0; deleteBtn.style.opacity  = count === 0 ? '0.5' : '1'; }
}

async function bulkRestoreStudents() {
  const ids = Array.from(selectedArchivedStudentIds);
  if(ids.length === 0){ alert('No students selected.'); return; }
  if(!confirm(`Restore ${ids.length} student(s) to active records?`)) return;
  try {
    const result = await apiRequest('/students/bulk/restore', 'POST', { ids });
    alert(`✅ ${result.message}`);
    loadArchivedStudents();
    loadStudents();
  } catch(err) { alert('Error: ' + err.message); }
}

async function bulkDeleteArchivedStudents() {
  const ids = Array.from(selectedArchivedStudentIds);
  if(ids.length === 0){ alert('No students selected.'); return; }
  if(!confirm(`⚠ PERMANENTLY DELETE ${ids.length} student(s)?\n\nThis cannot be undone.`)) return;
  if(!confirm('Final confirmation — this is irreversible.')) return;
  try {
    const result = await apiRequest('/students/bulk/delete', 'POST', { ids });
    alert(`✅ ${result.message}`);
    loadArchivedStudents();
  } catch(err) { alert('Error: ' + err.message); }
}

// ── ARCHIVED TEACHERS

async function loadArchivedTeachers() {
  try {
    const teachers = await apiRequest('/teachers/archived');
    archivedTeachersData = teachers;
    setEl('archivedTeacherCount', teachers.length);
    renderArchivedTeacherTable(teachers);
  } catch(err) { console.error('Load archived teachers error:', err.message); }
}

function renderArchivedTeacherTable(teachers) {
  const tbody = document.getElementById('archivedTeacherTable');
  if(!tbody) return;
  selectedArchivedTeacherIds = new Set();
  updateArchivedTeacherBulkButtons();
  if(teachers.length === 0){
    tbody.innerHTML = `<tr><td colspan="6"
      style="text-align:center;color:gray;padding:30px;">
      No archived teachers</td></tr>`;
    return;
  }
  tbody.innerHTML = teachers.map(t => `
    <tr>
      <td style="text-align:center;">
        <input type="checkbox"
          id="chk-archived-teacher-${t.id}"
          onchange="toggleArchivedTeacherSelection(${t.id})"
          style="width:16px;height:16px;cursor:pointer;">
      </td>
      <td style="font-size:12px;color:gray;">${t.prc_id}</td>
      <td>${t.full_name}</td>
      <td>${t.status === 'activated'
        ? '<span style="color:green;">Was Activated</span>'
        : '<span style="color:gray;">Was Not Activated</span>'
      }</td>
      <td style="font-size:12px;color:#886600;font-style:italic;max-width:180px;">
        ${t.archive_reason || '—'}
      </td>
      <td style="font-size:12px;color:gray;">
        ${t.archived_at ? new Date(t.archived_at).toLocaleDateString() : '—'}
      </td>
    </tr>
  `).join('');
}

function filterArchivedTeachers() {
  const search = (document.getElementById('searchArchivedTeachers')?.value || '').toLowerCase();
  const filtered = archivedTeachersData.filter(t =>
    t.full_name.toLowerCase().includes(search) ||
    String(t.prc_id).toLowerCase().includes(search)
  );
  renderArchivedTeacherTable(filtered);
}

function toggleArchivedTeacherSelection(id) {
  if(selectedArchivedTeacherIds.has(id)) selectedArchivedTeacherIds.delete(id);
  else selectedArchivedTeacherIds.add(id);
  updateArchivedTeacherBulkButtons();
}

function toggleSelectAllArchivedTeachers() {
  const selectAll  = document.getElementById('selectAllArchivedTeachers');
  const checkboxes = document.querySelectorAll('[id^="chk-archived-teacher-"]');
  if(selectAll.checked){
    checkboxes.forEach(chk => {
      chk.checked = true;
      selectedArchivedTeacherIds.add(parseInt(chk.id.replace('chk-archived-teacher-', '')));
    });
  } else {
    checkboxes.forEach(chk => { chk.checked = false; });
    selectedArchivedTeacherIds.clear();
  }
  updateArchivedTeacherBulkButtons();
}

function updateArchivedTeacherBulkButtons() {
  const count      = selectedArchivedTeacherIds.size;
  const countEl    = document.getElementById('selectedArchivedTeacherCount');
  const restoreBtn = document.getElementById('bulkRestoreTeacherBtn');
  const deleteBtn  = document.getElementById('bulkDeleteArchivedTeacherBtn');
  if(countEl) countEl.innerText = count > 0 ? `${count} selected` : '';
  if(restoreBtn){ restoreBtn.disabled = count === 0; restoreBtn.style.opacity = count === 0 ? '0.5' : '1'; }
  if(deleteBtn) { deleteBtn.disabled  = count === 0; deleteBtn.style.opacity  = count === 0 ? '0.5' : '1'; }
}

async function bulkRestoreTeachers() {
  const ids = Array.from(selectedArchivedTeacherIds);
  if(ids.length === 0){ alert('No teachers selected.'); return; }
  if(!confirm(`Restore ${ids.length} teacher(s) to active records?`)) return;
  try {
    const result = await apiRequest('/teachers/bulk/restore', 'POST', { ids });
    alert(`✅ ${result.message}`);
    loadArchivedTeachers();
    loadTeachers();
  } catch(err) { alert('Error: ' + err.message); }
}

async function bulkDeleteArchivedTeachers() {
  const ids = Array.from(selectedArchivedTeacherIds);
  if(ids.length === 0){ alert('No teachers selected.'); return; }
  if(!confirm(`⚠ PERMANENTLY DELETE ${ids.length} teacher(s)?\n\nThis cannot be undone.`)) return;
  if(!confirm('Final confirmation — this is irreversible.')) return;
  try {
    const result = await apiRequest('/teachers/bulk/delete', 'POST', { ids });
    alert(`✅ ${result.message}`);
    loadArchivedTeachers();
  } catch(err) { alert('Error: ' + err.message); }
}

// ── ARCHIVED SUBJECTS

async function loadArchivedSubjects() {
  try {
    const subjects = await apiRequest('/subjects/archived');
    archivedSubjectsData = subjects;
    setEl('archivedSubjectCount', subjects.length);
    renderArchivedSubjectTable(subjects);
  } catch(err) { console.error('Load archived subjects error:', err.message); }
}

function renderArchivedSubjectTable(subjects) {
  const tbody = document.getElementById('archivedSubjectTable');
  if(!tbody) return;
  selectedArchivedSubjectIds = new Set();
  updateArchivedSubjectBulkButtons();
  if(subjects.length === 0){
    tbody.innerHTML = `<tr><td colspan="5"
      style="text-align:center;color:gray;padding:30px;">
      No archived subjects</td></tr>`;
    return;
  }
  tbody.innerHTML = subjects.map(s => `
    <tr>
      <td style="text-align:center;">
        <input type="checkbox"
          id="chk-archived-subject-${s.id}"
          onchange="toggleArchivedSubjectSelection(${s.id})"
          style="width:16px;height:16px;cursor:pointer;">
      </td>
      <td>${s.name}</td>
      <td>${s.grade_level}</td>
      <td style="font-size:12px;color:#886600;font-style:italic;max-width:200px;">
        ${s.archive_reason || '—'}
      </td>
      <td style="font-size:12px;color:gray;">
        ${s.archived_at ? new Date(s.archived_at).toLocaleDateString() : '—'}
      </td>
    </tr>
  `).join('');
}

function toggleArchivedSubjectSelection(id) {
  if(selectedArchivedSubjectIds.has(id)) selectedArchivedSubjectIds.delete(id);
  else selectedArchivedSubjectIds.add(id);
  updateArchivedSubjectBulkButtons();
}

function toggleSelectAllArchivedSubjects() {
  const selectAll  = document.getElementById('selectAllArchivedSubjects');
  const checkboxes = document.querySelectorAll('[id^="chk-archived-subject-"]');
  if(selectAll.checked){
    checkboxes.forEach(chk => {
      chk.checked = true;
      selectedArchivedSubjectIds.add(parseInt(chk.id.replace('chk-archived-subject-', '')));
    });
  } else {
    checkboxes.forEach(chk => { chk.checked = false; });
    selectedArchivedSubjectIds.clear();
  }
  updateArchivedSubjectBulkButtons();
}

function updateArchivedSubjectBulkButtons() {
  const count      = selectedArchivedSubjectIds.size;
  const countEl    = document.getElementById('selectedArchivedSubjectCount');
  const restoreBtn = document.getElementById('bulkRestoreSubjectBtn');
  const deleteBtn  = document.getElementById('bulkDeleteArchivedSubjectBtn');
  if(countEl) countEl.innerText = count > 0 ? `${count} selected` : '';
  if(restoreBtn){ restoreBtn.disabled = count === 0; restoreBtn.style.opacity = count === 0 ? '0.5' : '1'; }
  if(deleteBtn) { deleteBtn.disabled  = count === 0; deleteBtn.style.opacity  = count === 0 ? '0.5' : '1'; }
}

async function bulkRestoreSubjects() {
  const ids = Array.from(selectedArchivedSubjectIds);
  if(ids.length === 0){ alert('No subjects selected.'); return; }
  if(!confirm(`Restore ${ids.length} subject(s)?`)) return;
  try {
    await Promise.all(ids.map(id => apiRequest(`/subjects/${id}/restore`, 'PUT')));
    alert(`✅ ${ids.length} subject(s) restored successfully.`);
    loadArchivedSubjects();
    loadSubjects();
  } catch(err) { alert('Error: ' + err.message); }
}

async function bulkDeleteArchivedSubjects() {
  const ids = Array.from(selectedArchivedSubjectIds);
  if(ids.length === 0){ alert('No subjects selected.'); return; }
  if(!confirm(`⚠ PERMANENTLY DELETE ${ids.length} subject(s)?\n\nSubjects with grade records cannot be deleted.`)) return;
  try {
    const results = await Promise.allSettled(
      ids.map(id => apiRequest(`/subjects/${id}/permanent`, 'DELETE'))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed    = results.filter(r => r.status === 'rejected').length;
    let msg = `✅ ${succeeded} subject(s) permanently deleted.`;
    if(failed > 0) msg += `\n⚠ ${failed} could not be deleted.`;
    alert(msg);
    loadArchivedSubjects();
  } catch(err) { alert('Error: ' + err.message); }
}


// ==============================
// SETTINGS
// ==============================

async function loadSettings() {

  try {
    const activeYear = await apiRequest('/school-years/active');
    setEl('settingsActiveYear',    activeYear.label || '—');
    setEl('settingsTotalQuarters', activeYear.total_quarters || '—');
    setEl('settingsActiveQuarter',
      ordinal(activeYear.active_quarter) + ' Semester'
    );
    setEl('settingsQuarterMode',
      activeYear.mode === 'automatic' ? 'Automatic' : 'Manual'
    );
    setEl('settingsYearDisplay', activeYear.label || '—');
    setEl('dashActiveQuarter',
      ordinal(activeYear.active_quarter) + ' Semester'
    );

    const qSelect = document.getElementById('selectActiveQuarter');
    if(qSelect) qSelect.value = activeYear.active_quarter;
    const mSelect = document.getElementById('selectQuarterMode');
    if(mSelect) mSelect.value = activeYear.mode || 'manual';
    const tSelect = document.getElementById('selectTotalQuarters');
    if(tSelect) tSelect.value = activeYear.total_quarters || 4;

  } catch(err) {
    console.error('Load settings error:', err.message);
    setEl('settingsActiveYear', 'Error — check console');
  }
}

async function saveQuarterSettings() {

  const active_quarter = parseInt(
    document.getElementById('selectActiveQuarter').value
  );
  const mode = document.getElementById('selectQuarterMode').value;
  const total_quarters = parseInt(
    document.getElementById('selectTotalQuarters').value
  );

  try {
    await apiRequest('/school-years/quarter', 'PUT', {
      active_quarter, mode, total_quarters
    });
    alert(
      `✅ Settings saved!\n\n` +
      `Active Quarter: ${ordinal(active_quarter)} Quarter\n` +
      `Mode: ${mode === 'automatic' ? 'Automatic' : 'Manual'}\n` +
      `Total Quarters: ${total_quarters}`
    );
    loadSettings();
  } catch(err) {
    alert('Error: ' + err.message);
  }
}

async function startNewSchoolYear() {

  const label   = document.getElementById('newSchoolYearLabel')?.value.trim();
  const errorEl = document.getElementById('newSchoolYearError');

  if(errorEl) errorEl.innerText = '';

  if(!label){
    if(errorEl) errorEl.innerText = 'Please enter a school year label.';
    return;
  }

  if(!/^\d{4}-\d{4}$/.test(label)){
    if(errorEl) errorEl.innerText = 'Format must be YYYY-YYYY, e.g. 2027-2028';
    return;
  }

  if(!confirm(
    `Start new school year "${label}"?\n\n` +
    `The current school year will be closed and archived.\n` +
    `Students and teachers must be re-enrolled in the new year.\n\n` +
    `All past records remain accessible in Archived Records.`
  )) return;

  try {
    const result = await apiRequest('/school-years/close', 'POST', {
      new_label: label
    });
    alert(`✅ ${result.message}`);
    const input = document.getElementById('newSchoolYearLabel');
    if(input) input.value = '';
    loadDashboard();
    loadSettings();
  } catch(err) {
    if(errorEl) errorEl.innerText = 'Error: ' + err.message;
  }
}

function openNewSchoolYearModal() {
  document.getElementById('newSchoolYearLabel').value = '';
  setEl('schoolYearError', '');
  document.getElementById('schoolYearModal').style.display = 'flex';
}

function closeSchoolYearModal() {
  document.getElementById('schoolYearModal').style.display = 'none';
  setEl('schoolYearError', '');
}

async function submitNewSchoolYear() {

  const label = document.getElementById('newSchoolYearLabel').value.trim();
  const total_quarters = parseInt(
    document.getElementById('newTotalQuarters').value
  );
  const errorEl = document.getElementById('schoolYearError');

  if(errorEl) errorEl.innerText = '';

  if(!label){
    if(errorEl) errorEl.innerText = 'Please enter a school year label.';
    return;
  }

  if(!confirm(
    `Start new school year: ${label}?\n\n` +
    `The current year will become inactive.\n` +
    `All previous data is preserved in reports.`
  )) return;

  try {
    await apiRequest('/school-years', 'POST', { label, total_quarters });
    alert(`✅ New school year ${label} started!`);
    closeSchoolYearModal();
    loadSettings();
    loadDashboard();
  } catch(err) {
    if(errorEl) errorEl.innerText = err.message;
  }
}

function changeAdminUsername() { openChangeCredentialsModal(); }
function changeAdminPassword()  { openChangeCredentialsModal(); }

function openChangeCredentialsModal() {
  document.getElementById('adminCurrentPassword').value = '';
  document.getElementById('adminNewUsername').value     = '';
  document.getElementById('adminNewPassword').value     = '';
  setEl('changeCredentialsError', '');
  document.getElementById('changeCredentialsModal').style.display = 'flex';
}

function closeChangeCredentialsModal() {
  document.getElementById('changeCredentialsModal').style.display = 'none';
  setEl('changeCredentialsError', '');
}

async function submitChangeCredentials() {

  const current_password = document.getElementById('adminCurrentPassword').value;
  const new_username     = document.getElementById('adminNewUsername').value.trim();
  const new_password     = document.getElementById('adminNewPassword').value;
  const errorEl          = document.getElementById('changeCredentialsError');

  if(errorEl) errorEl.innerText = '';

  if(!current_password){
    if(errorEl) errorEl.innerText = 'Current password is required.';
    return;
  }

  if(!new_username && !new_password){
    if(errorEl) errorEl.innerText =
      'Enter a new username, new password, or both.';
    return;
  }

  try {

    const result = await apiRequest(
      '/auth/change-credentials',
      'PUT',
      { current_password, new_username, new_password }
    );

    alert(
      `✅ ${result.message}\n\n` +
      `You will now be logged out.`
    );

    closeChangeCredentialsModal();

    // update localStorage if username changed
    if(result.username_changed && new_username){
      localStorage.setItem('username', new_username);
    }

    // force logout so user logs in with new credentials
    setTimeout(() => {
      localStorage.clear();
      window.location.href = '../index.html';
    }, 1000);

  } catch(err) {
    if(errorEl) errorEl.innerText = err.message;
  }
}


// ==============================
// DYNAMIC SECTIONS
// ==============================

async function loadSectionsIntoDropdown(selectId) {
  try {

    // use enrolled sections — these are sections that
    // actually have students in the active school year
    // so any section from an Excel import will appear here
    const sections = await apiRequest('/sections/enrolled');

    const select = document.getElementById(selectId);
    if(!select) return;

    const current = select.value;

    select.innerHTML =
      '<option value="">All Sections</option>' +
      sections.map(s =>
        `<option value="${s}" ${s === current ? 'selected' : ''}>
          ${s}
        </option>`
      ).join('');

  } catch(err) {
    console.error('Load sections error:', err.message);
  }
}


// ==============================
// PAGE LOAD
// ==============================

window.onload = function() {
  loadDashboard();
};