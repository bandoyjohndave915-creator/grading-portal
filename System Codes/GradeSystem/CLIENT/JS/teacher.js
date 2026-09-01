// ==============================
// TEACHER PROTECTION
// ==============================

const token = localStorage.getItem('token');
const role  = localStorage.getItem('userRole');

if(!token || role !== 'teacher'){
  window.location.href = '../index.html';
}


// ==============================
// CACHED DATA
// ==============================

let myAssignments   = [];
let myUploads       = [];
let allGradeRecords = [];
let teacherRecord   = null;
let parsedFileRows  = [];


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

const statusLabel = {
  pending:  '⏳ Pending Review',
  approved: '✅ Approved',
  rejected: '❌ Rejected',
  locked:   '🔒 Locked',
  draft:    '📝 Draft'
};

const statusClass = {
  pending:  'status-pending',
  approved: 'status-approved',
  rejected: 'status-rejected',
  locked:   'status-locked',
  draft:    'status-draft'
};


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
  if (window.innerWidth <= 768) {
    closeSidebar();
  }

  const loaders = {
    dashboardSection: loadDashboard,
    classesSection:   loadClasses,
    subjectsSection:  loadSubjects,
    gradesSection:    loadGradeRecords,
    uploadSection:    loadUploadForm,
    historySection:   loadHistory,
    settingsSection:  loadSettings
  };

  if (loaders[sectionId]) loaders[sectionId]();
}


// ==============================
// SIDEBAR + DROPDOWN
// ==============================

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const main    = document.querySelector('.main');

  if (window.innerWidth <= 768) {
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
    main.classList.toggle('full');
  }
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('active');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

function toggleDropdown() {
  document.getElementById('dropdownMenu')
    .classList.toggle('show');
}

window.onclick = function(e) {
  if (!e.target.closest('.user-menu')) {
    const dd = document.getElementById('dropdownMenu');
    if (dd) dd.classList.remove('show');
  }


  // close sidebar on mobile if clicking outside sidebar and outside menu button
  if(window.innerWidth <= 768){
    const sidebar = document.querySelector('.sidebar');
    if(
      sidebar.classList.contains('active') &&
      !e.target.closest('.sidebar') &&
      !e.target.closest('.menu-btn')
    ){
      sidebar.classList.remove('active');
    }
  }
}


// ==============================
// DARK MODE
// ==============================

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('teacherTheme',
    document.body.classList.contains('dark') ? 'dark' : 'light'
  );
}

if(localStorage.getItem('teacherTheme') === 'dark'){
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
// GET MY TEACHER RECORD
// dedicated teacher endpoint
// no admin permission needed
// ==============================

async function getTeacherRecord() {
  if(teacherRecord) return teacherRecord;
  try {
    teacherRecord = await apiRequest('/teachers/my-record');
    return teacherRecord;
  } catch(err) {
    console.error('Could not load teacher record:', err.message);
    return null;
  }
}


// ==============================
// DASHBOARD
// ==============================

async function loadDashboard() {

  const username = localStorage.getItem('username') || 'Teacher';
  setEl('topbarName',  username);
  setEl('sidebarName', username);

  // load teacher profile
  try {
    const teacher = await getTeacherRecord();
    if(teacher){
      setEl('profileFullName', teacher.full_name || username);
      setEl('profilePRCID',    teacher.prc_id    || username);
      const initial = (teacher.full_name || username)[0].toUpperCase();
      setEl('profileInitial', initial);
    } else {
      setEl('profileFullName',    'Record not found');
      setEl('profileAssignments', 'Contact your administrator');
    }
  } catch(err) {
    console.error('Teacher record error:', err.message);
  }

  // load assignments
  try {
    const assignments = await apiRequest('/teachers/my-assignments');
    myAssignments = assignments;
    const uniqueSubjects =
      [...new Set(assignments.map(a => a.subject_name))];
    setEl('dashAssignedSubjects', uniqueSubjects.length);
    setEl('dashHandledClasses',   assignments.length);
    if(assignments.length > 0){
      const summary = assignments
        .map(a => `${a.subject_name} — ${a.grade_level} ${a.section}`)
        .join(' | ');
      setEl('profileAssignments', `📚 ${summary}`);
    } else {
      setEl('profileAssignments', 'No assignments yet');
    }
  } catch(err) {
    console.error('Load assignments error:', err.message);
    setEl('dashAssignedSubjects', '—');
    setEl('dashHandledClasses',   '—');
  }

  // load uploads for recent activity
  try {
    const uploads = await apiRequest('/grades/my-uploads');
    myUploads = uploads;

    const pending  = uploads.filter(u => u.status === 'pending').length;
    const approved = uploads.filter(u => u.status === 'approved').length;

    setEl('dashPendingUploads',  pending);
    setEl('dashApprovedUploads', approved);

    // recent activity table — 6 columns including admin remarks
    const tbody = document.getElementById('dashRecentUploads');
    if(tbody){
      const recent = uploads.slice(0, 6);
      tbody.innerHTML = recent.length === 0
        ? `<tr>
            <td colspan="6"
              style="text-align:center; color:gray; padding:20px;">
              No uploads yet
            </td>
          </tr>`
        : recent.map(u => `
            <tr>
              <td>${u.subject_name}</td>
              <td>${u.grade_level}-${u.section}</td>
              <td>${u.quarter} Semester</td>
              <td>${new Date(u.submitted_at).toLocaleDateString()}</td>
              <td class="${statusClass[u.status] || ''}">
                ${statusLabel[u.status] || u.status}
              </td>
              <td style="font-size:12px; color:#cc0000;">
                ${u.status === 'rejected' && u.remarks ? u.remarks : '—'}
              </td>
            </tr>
          `).join('');
    }

  } catch(err) {
    console.error('Load uploads error:', err.message);
    setEl('dashPendingUploads',  '—');
    setEl('dashApprovedUploads', '—');
  }

  // load school year
  try {
    const activeYear = await apiRequest('/school-years/active');
    setEl('dashSchoolYear',    activeYear.label || '—');
    setEl('dashActiveQuarter',
      ordinal(activeYear.active_quarter) + ' Semester'
    );
  } catch(err) {
    setEl('dashSchoolYear',    '—');
    setEl('dashActiveQuarter', '—');
  }
}


// ==============================
// MY CLASSES
// ==============================

async function loadClasses() {

  const container = document.getElementById('classCards');
  if(!container) return;

  container.innerHTML =
    '<p style="color:gray; padding:10px;">Loading classes...</p>';

  try {

    const assignments = await apiRequest('/teachers/my-assignments');
    myAssignments = assignments;

    if(assignments.length === 0){
      container.innerHTML = `
        <p style="color:gray; padding:10px;">
          No classes assigned yet.
          Contact your administrator.
        </p>
      `;
      return;
    }

    container.innerHTML = assignments.map(a => `
      <div class="card class-card"
        onclick="openClass(
          '${a.subject_name}',
          '${a.grade_level}',
          '${a.section}'
        )">
        <p>📚 Subject</p>
        <h2>${a.subject_name}</h2>
        <p style="margin-top:8px;">Class</p>
        <h3>${a.grade_level} — Section ${a.section}</h3>
        <p style="font-size:12px; color:gray; margin-top:12px;">
          Click to view class list
        </p>
      </div>
    `).join('');

  } catch(err) {
    container.innerHTML =
      `<p style="color:red; padding:10px;">
        Error: ${err.message}
      </p>`;
  }
}

async function openClass(subject, grade, section) {

  setEl('selectedClassTitle',
    `${subject} — ${grade} Section ${section}`
  );

  document.querySelectorAll('.section')
    .forEach(s => s.classList.remove('active-section'));
  document.getElementById('classStudentsSection')
    .classList.add('active-section');

  const tbody = document.getElementById('classStudentTable');
  if(tbody){
    tbody.innerHTML = `
      <tr>
        <td colspan="5"
          style="text-align:center; color:gray; padding:20px;">
          Loading students...
        </td>
      </tr>
    `;
  }

  try {

    const students = await apiRequest(
      `/students/by-class?grade_level=${encodeURIComponent(grade)}&section=${encodeURIComponent(section)}`
    );

    if(!tbody) return;

    if(students.length === 0){
      tbody.innerHTML = `
        <tr>
          <td colspan="5"
            style="text-align:center; color:gray; padding:20px;">
            No students found for ${grade} Section ${section}.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = students.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${s.lrn}</td>
        <td>${s.full_name}</td>
        <td>${s.grade_level}</td>
        <td>${s.section}</td>
      </tr>
    `).join('');

  } catch(err) {
    if(tbody){
      tbody.innerHTML = `
        <tr>
          <td colspan="5"
            style="color:red; padding:20px; text-align:center;">
            Error: ${err.message}
          </td>
        </tr>
      `;
    }
    console.error('openClass error:', err.message);
  }
}

function backToClasses() {
  document.querySelectorAll('.section')
    .forEach(s => s.classList.remove('active-section'));
  document.getElementById('classesSection')
    .classList.add('active-section');
}


// ==============================
// MY SUBJECTS
// ==============================

async function loadSubjects() {

  const container = document.getElementById('subjectCards');
  if(!container) return;

  container.innerHTML =
    '<p style="color:gray; padding:10px;">Loading subjects...</p>';

  try {

    const [assignments, uploads, activeYear] = await Promise.all([
      apiRequest('/teachers/my-assignments'),
      apiRequest('/grades/my-uploads'),
      apiRequest('/school-years/active')
    ]);

    myAssignments = assignments;
    myUploads     = uploads;

    if(assignments.length === 0){
      container.innerHTML = `
        <p style="color:gray; padding:10px;">
          No subjects assigned yet.
        </p>
      `;
      return;
    }

    const totalQ = activeYear.total_quarters || 4;

    container.innerHTML = assignments.map(a => {

      const aUploads = uploads.filter(u =>
        u.subject_name === a.subject_name &&
        u.grade_level  === a.grade_level  &&
        u.section      === a.section      &&
        u.school_year  === activeYear.label
      );

      const quarters = Array.from({ length: totalQ }, (_, i) => i + 1);

      const qBadges = quarters.map(q => {

        const qLabel = ordinal(q);
        const upload = aUploads.find(u => u.quarter === qLabel);

        if(!upload){
          return `
            <span class="q-badge q-none">
              Q${q} — Not Uploaded
            </span>
          `;
        }

        const badgeClass = {
          pending:  'q-pending',
          approved: 'q-approved',
          rejected: 'q-rejected',
          locked:   'q-locked'
        };

        const badgeLabel = {
          pending:  `Q${q} ⏳ Pending Review`,
          approved: `Q${q} ✅ Approved`,
          rejected: `Q${q} ❌ Rejected`,
          locked:   `Q${q} 🔒 Locked`
        };

        return `
          <span class="q-badge ${badgeClass[upload.status] || 'q-none'}">
            ${badgeLabel[upload.status] || `Q${q} ${upload.status}`}
          </span>
        `;

      }).join('<br>');

      return `
        <div class="card" style="min-width:220px;">
          <p>📚 Subject</p>
          <h2>${a.subject_name}</h2>
          <p style="margin-top:8px;">Class</p>
          <h3>${a.grade_level} — Section ${a.section}</h3>
          <hr style="margin:12px 0; border-color:#eee;">
          <p style="font-weight:bold; font-size:12px;
            color:#555; margin-bottom:8px; text-transform:uppercase;">
            Semester Upload Status
          </p>
          <div style="line-height:2.2;">${qBadges}</div>
          <button
            onclick="goToUpload(
              '${a.subject_id}',
              '${a.grade_level}',
              '${a.section}'
            )"
            style="width:100%; margin-top:14px; padding:9px;
              background:#800000; color:white; border:none;
              border-radius:8px; cursor:pointer; font-size:13px;
              font-weight:bold;">
            📤 Upload Grades
          </button>
        </div>
      `;

    }).join('');

  } catch(err) {
    container.innerHTML =
      `<p style="color:red; padding:10px;">
        Error: ${err.message}
      </p>`;
    console.error('loadSubjects error:', err.message);
  }
}

function goToUpload(subjectId, grade, section) {
  document.querySelectorAll('.section')
    .forEach(s => s.classList.remove('active-section'));
  document.getElementById('uploadSection')
    .classList.add('active-section');
  document.querySelectorAll('.sidebar ul li')
    .forEach(li => li.classList.remove('active'));

  loadUploadForm().then(() => {
    const sub = document.getElementById('uploadSubjectId');
    if(sub){
      for(const opt of sub.options){
        if(opt.value === String(subjectId)){
          sub.value = opt.value;
          sub.dispatchEvent(new Event('change'));
          break;
        }
      }
    }
  });
}


// ==============================
// GRADE RECORDS
// ==============================

async function loadGradeRecords() {

  try {

    const records = await apiRequest('/grades/my-grade-records');
    allGradeRecords = records;

    // populate subject filter
    const subjectFilter = document.getElementById('gradeSubjectFilter');
    if(subjectFilter){
      const subjects = [...new Set(records.map(r => r.subject_name))].sort();
      subjectFilter.innerHTML =
        '<option value="">All Subjects</option>' +
        subjects.map(s =>
          `<option value="${s}">${s}</option>`
        ).join('');
    }

    // populate section filter dynamically from actual data
    const sectionFilter = document.getElementById('gradeSectionFilter');
    if(sectionFilter){
      const sections = [...new Set(records.map(r => r.section))].sort();
      sectionFilter.innerHTML =
        '<option value="">All Sections</option>' +
        sections.map(s =>
          `<option value="${s}">${s}</option>`
        ).join('');
    }

    renderGradeRecords(records);

  } catch(err) {
    console.error('Load grade records error:', err.message);
    const tbody = document.getElementById('gradeRecordsTable');
    if(tbody){
      tbody.innerHTML = `
        <tr>
          <td colspan="8"
            style="text-align:center; color:red; padding:30px;">
            Error: ${err.message}
          </td>
        </tr>
      `;
    }
  }
}

function renderGradeRecords(records) {

  const tbody = document.getElementById('gradeRecordsTable');
  if(!tbody) return;

  if(records.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="8"
          style="text-align:center; color:gray; padding:30px;">
          No grade records yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.student_name}</td>
      <td>${r.lrn}</td>
      <td>${r.subject_name}</td>
      <td>${r.grade_level}</td>
      <td>${r.section}</td>
      <td>${r.quarter} Semester</td>
      <td style="font-weight:bold;">${r.score}</td>
      <td class="${statusClass[r.status] || ''}">
        ${statusLabel[r.status] || r.status}
      </td>
    </tr>
  `).join('');
}

function filterGrades() {

  const subject =
    document.getElementById('gradeSubjectFilter')?.value || '';
  const section =
    document.getElementById('gradeSectionFilter')?.value || '';
  const quarter =
    document.getElementById('gradeQuarterFilter')?.value || '';
  const status  =
    document.getElementById('gradeStatusFilter')?.value  || '';
  const search  =
    (document.getElementById('gradeSearchInput')?.value || '').toLowerCase();

  const filtered = allGradeRecords.filter(r => {
    const matchSubject = !subject  || r.subject_name === subject;
    const matchSection = !section  || r.section      === section;
    const matchQuarter = !quarter  || r.quarter      === quarter;
    const matchStatus  = !status   || r.status       === status;
    const matchSearch  =
      !search ||
      r.student_name.toLowerCase().includes(search) ||
      r.lrn.toLowerCase().includes(search);
    return matchSubject && matchSection && matchQuarter && matchStatus && matchSearch;
  });

  renderGradeRecords(filtered);
}

async function exportGrades() {

  // build query params from current filters
  const subject = document.getElementById('gradeSubjectFilter')?.value || '';
  const section = document.getElementById('gradeSectionFilter')?.value || '';
  const quarter = document.getElementById('gradeQuarterFilter')?.value || '';
  const status  = document.getElementById('gradeStatusFilter')?.value  || '';

  const params = new URLSearchParams();
  if(subject) params.append('subject', subject);
  if(section) params.append('section', section);
  if(quarter) params.append('quarter', quarter);
  if(status)  params.append('status',  status);

  try {

    const response = await fetch(
      `https://grading-portal-system-production.up.railway.app/api/grades/export?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );

    if(!response.ok){
      const err = await response.json().catch(() => ({}));
      alert(err.message || 'Export failed');
      return;
    }

    const blob     = await response.blob();
    const blobUrl  = URL.createObjectURL(blob);
    const link     = document.createElement('a');
    link.href      = blobUrl;
    link.download  = `grade_records_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

  } catch(err) {
    alert('Export failed: ' + err.message);
    console.error('Export error:', err);
  }
}


// ==============================
// UPLOAD GRADES FORM
// ==============================

async function loadUploadForm() {

  try {

    const [assignments, activeYear] = await Promise.all([
      apiRequest('/teachers/my-assignments'),
      apiRequest('/school-years/active')
    ]);

    myAssignments = assignments;

    const subjectSelect = document.getElementById('uploadSubjectId');
    if(subjectSelect){

      subjectSelect.innerHTML =
        '<option value="">— Select Subject —</option>' +
        assignments.map(a =>
          `<option
            value="${a.subject_id}"
            data-grade="${a.grade_level}"
            data-section="${a.section}"
            data-name="${a.subject_name}">
            ${a.subject_name} — ${a.grade_level} Section ${a.section}
          </option>`
        ).join('');

      subjectSelect.onchange = function() {
        const opt     = this.options[this.selectedIndex];
        const grade   = opt.getAttribute('data-grade')   || '';
        const section = opt.getAttribute('data-section') || '';

        const gradeEl   = document.getElementById('uploadGradeLevel');
        const sectionEl = document.getElementById('uploadSectionName');

        if(gradeEl){
          gradeEl.innerHTML = grade
            ? `<option value="${grade}">${grade}</option>`
            : '<option value="">— Select Subject First —</option>';
        }
        if(sectionEl){
          sectionEl.innerHTML = section
            ? `<option value="${section}">Section ${section}</option>`
            : '<option value="">— Select Subject First —</option>';
        }

        const previewDiv = document.getElementById('previewSection');
        if(previewDiv) previewDiv.style.display = 'none';

        const errEl = document.getElementById('uploadFormError');
        if(errEl) errEl.innerText = '';
      };
    }

    // pre-select active quarter
    const quarterSelect = document.getElementById('uploadQuarter');
    if(quarterSelect && activeYear){
      const activeQ = ordinal(activeYear.active_quarter);
      for(const opt of quarterSelect.options){
        if(opt.value === activeQ){
          opt.selected = true;
          break;
        }
      }
    }

    const previewDiv = document.getElementById('previewSection');
    if(previewDiv) previewDiv.style.display = 'none';

    const errEl = document.getElementById('uploadFormError');
    if(errEl) errEl.innerText = '';

  } catch(err) {
    console.error('Load upload form error:', err.message);
  }
}


// ==============================
// DOWNLOAD GRADE TEMPLATE
// ==============================

async function downloadGradeTemplate() {

  const subjectSelect = document.getElementById('uploadSubjectId');
  const subjectId     = subjectSelect?.value;
  const grade         = document.getElementById('uploadGradeLevel')?.value;
  const section       = document.getElementById('uploadSectionName')?.value;
  const quarter       = document.getElementById('uploadQuarter')?.value;
  const errorEl       = document.getElementById('uploadFormError');

  if(errorEl) errorEl.innerText = '';

  if(!subjectId){
    if(errorEl) errorEl.innerText =
      'Please select a subject before downloading the template.';
    return;
  }
  if(!grade || !section){
    if(errorEl) errorEl.innerText = 'Grade level and section are required.';
    return;
  }
  if(!quarter){
    if(errorEl) errorEl.innerText = 'Please select a quarter.';
    return;
  }

  const btn = document.getElementById('downloadTemplateBtn');
  if(btn){ btn.disabled = true; btn.innerText = '⏳ Generating...'; }

  try {

    const params = new URLSearchParams({
      subject_id: subjectId, grade_level: grade, section, quarter
    });

    const response = await fetch(
      `https://grading-portal-system-production.up.railway.app/api/grades/template?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }
    );

    if(!response.ok){
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to generate template');
    }

    const disposition = response.headers.get('Content-Disposition');
    let filename = 'grade_template.xlsx';
    if(disposition){
      const match = disposition.match(/filename="(.+?)"/);
      if(match) filename = match[1];
    }

    const blob    = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link    = document.createElement('a');
    link.href     = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

  } catch(err) {
    if(errorEl) errorEl.innerText = 'Error: ' + err.message;
    console.error('Download template error:', err);
  } finally {
    if(btn){
      btn.disabled  = false;
      btn.innerText = '⬇ Download Grade Template';
    }
  }
}


// ==============================
// PREVIEW GRADE FILE
// ==============================

async function previewGradeFile() {

  const subjectId = document.getElementById('uploadSubjectId')?.value;
  const grade     = document.getElementById('uploadGradeLevel')?.value;
  const section   = document.getElementById('uploadSectionName')?.value;
  const quarter   = document.getElementById('uploadQuarter')?.value;
  const fileInput = document.getElementById('gradeFile');
  const errorEl   = document.getElementById('uploadFormError');

  if(errorEl) errorEl.innerText = '';

  if(!subjectId){
    if(errorEl) errorEl.innerText = 'Please select a subject first.';
    return;
  }
  if(!grade || !section){
    if(errorEl) errorEl.innerText = 'Grade level and section are required.';
    return;
  }
  if(!quarter){
    if(errorEl) errorEl.innerText = 'Please select a quarter.';
    return;
  }
  if(!fileInput || !fileInput.files[0]){
    if(errorEl) errorEl.innerText = 'Please select an Excel file.';
    return;
  }

  const file = fileInput.files[0];
  const ext  = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if(!['.xlsx', '.xls'].includes(ext)){
    if(errorEl) errorEl.innerText = 'Only .xlsx and .xls files allowed.';
    return;
  }

  const subjectSelect = document.getElementById('uploadSubjectId');
  const subjectName   =
    subjectSelect?.options[subjectSelect.selectedIndex]
      ?.getAttribute('data-name') || 'Subject';

  setEl('previewSubject', subjectName);
  setEl('previewQuarter', quarter + ' Semester');
  setEl('previewClass',   `${grade} — Section ${section}`);

  const previewSection = document.getElementById('previewSection');
  if(previewSection) previewSection.style.display = 'block';

  const tbody = document.getElementById('previewTable');
  if(tbody){
    tbody.innerHTML = `
      <tr>
        <td colspan="5"
          style="text-align:center; color:gray; padding:20px;">
          ⏳ Reading file...
        </td>
      </tr>
    `;
  }

  const formData = new FormData();
  formData.append('subject_id',  subjectId);
  formData.append('grade_level', grade);
  formData.append('section',     section);
  formData.append('quarter',     quarter);
  formData.append('gradeFile',   file);

  try {

    const response = await fetch(
      'https://grading-portal-system-production.up.railway.app/api/grades/preview',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      }
    );

    const data = await response.json();

    if(!response.ok){
      if(errorEl) errorEl.innerText = data.message || 'Preview failed.';
      if(previewSection) previewSection.style.display = 'none';
      return;
    }

    parsedFileRows = data.rows || [];

    const validRows = parsedFileRows.filter(r => r.valid).length;
    const errorRows = parsedFileRows.filter(r => !r.valid).length;

    setEl('previewTotal',  parsedFileRows.length);
    setEl('previewValid',  validRows);
    setEl('previewErrors', errorRows);

    const errBox  = document.getElementById('validationErrorBox');
    const errList = document.getElementById('validationErrorList');

    if(errorRows > 0 && errBox && errList){
      errBox.style.display = 'block';
      errList.innerHTML = parsedFileRows
        .filter(r => !r.valid)
        .map(r => `<p>• Row ${r.row}: ${r.error}</p>`)
        .join('');
    } else if(errBox){
      errBox.style.display = 'none';
    }

    if(tbody){
      tbody.innerHTML = parsedFileRows.map(r => `
        <tr class="${r.valid ? 'row-ok' : 'row-error'}">
          <td style="padding:8px; color:gray; font-size:12px;">${r.row}</td>
          <td style="padding:8px;">${r.name || '—'}</td>
          <td style="padding:8px;">${r.lrn}</td>
          <td style="padding:8px; font-weight:bold;">${r.score}</td>
          <td style="padding:8px; font-size:12px;
            color:${r.valid ? 'green' : 'red'};">
            ${r.valid ? '✅ Valid' : `❌ ${r.error}`}
          </td>
        </tr>
      `).join('');
    }

    const submitBtn = document.getElementById('submitBtn');
    if(submitBtn){
      submitBtn.disabled      = validRows === 0;
      submitBtn.style.opacity = validRows === 0 ? '0.5' : '1';
    }

    setEl('submitError',   '');
    setEl('submitSuccess', '');

  } catch(err) {
    if(errorEl) errorEl.innerText =
      'Cannot connect to server.';
    if(previewSection) previewSection.style.display = 'none';
    console.error('Preview error:', err);
  }
}


// ==============================
// CANCEL PREVIEW
// ==============================

function cancelPreview() {
  const previewSection = document.getElementById('previewSection');
  if(previewSection) previewSection.style.display = 'none';
  const fileInput = document.getElementById('gradeFile');
  if(fileInput) fileInput.value = '';
  parsedFileRows = [];
  setEl('submitError',   '');
  setEl('submitSuccess', '');
}


// ==============================
// SUBMIT UPLOAD GRADES
// ==============================

async function submitUploadGrades() {

  const subjectId  = document.getElementById('uploadSubjectId')?.value;
  const grade      = document.getElementById('uploadGradeLevel')?.value;
  const section    = document.getElementById('uploadSectionName')?.value;
  const quarter    = document.getElementById('uploadQuarter')?.value;
  const fileInput  = document.getElementById('gradeFile');
  const errorEl    = document.getElementById('submitError');
  const successEl  = document.getElementById('submitSuccess');
  const submitBtn  = document.getElementById('submitBtn');

  if(errorEl)   errorEl.innerText   = '';
  if(successEl) successEl.innerText = '';

  if(!fileInput || !fileInput.files[0]){
    if(errorEl) errorEl.innerText = 'Please select a file first.';
    return;
  }

  if(submitBtn){
    submitBtn.disabled  = true;
    submitBtn.innerText = '⏳ Submitting...';
  }

  const formData = new FormData();
  formData.append('subject_id',   subjectId);
  formData.append('grade_level',  grade);
  formData.append('section',      section);
  formData.append('quarter',      quarter);
  formData.append('gradeFile',    fileInput.files[0]);

  try {

    const response = await fetch(
      'https://grading-portal-system-production.up.railway.app/api/grades/upload',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      }
    );

    const data = await response.json();

    if(submitBtn){
      submitBtn.disabled  = false;
      submitBtn.innerText = '📤 Submit to Admin';
    }

    if(!response.ok){
      if(errorEl){
        errorEl.innerText = data.message || 'Upload failed.';
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    let msg = `✅ ${data.message}`;
    if(data.not_found && data.not_found.length > 0){
      msg += `\n⚠ LRNs not found: ${data.not_found.join(', ')}`;
    }
    if(successEl) successEl.innerText = msg;


    setTimeout(() => {
      cancelPreview();
      showSection('historySection', null);
      loadHistory();
    }, 2000);

  } catch(err) {
    if(submitBtn){
      submitBtn.disabled  = false;
      submitBtn.innerText = '📤 Submit to Admin';
    }
    if(errorEl) errorEl.innerText =
      'Cannot connect to server.';
    console.error('Submit error:', err);
  }
}


// ==============================
// UPLOAD HISTORY
// ==============================

async function loadHistory() {

  try {

    const uploads = await apiRequest('/grades/my-uploads');
    myUploads = uploads;

    const pending  = uploads.filter(u => u.status === 'pending').length;
    const approved = uploads.filter(u => u.status === 'approved').length;
    const rejected = uploads.filter(u => u.status === 'rejected').length;

    setEl('historyTotal',    uploads.length);
    setEl('historyPending',  pending);
    setEl('historyApproved', approved);
    setEl('historyRejected', rejected);

    renderHistoryTable(uploads);

  } catch(err) {
    console.error('Load history error:', err.message);
  }
}


// ==============================
// RENDER HISTORY TABLE
// 7 proper columns:
// Subject | Class | Quarter |
// Date | Status | Admin Remarks |
// Actions
// ==============================

function renderHistoryTable(uploads) {

  const tbody = document.getElementById('historyTable');
  if(!tbody) return;

  if(uploads.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="7"
          style="text-align:center; color:gray; padding:30px;">
          No uploads yet
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = uploads.map(u => {

    const statusCell = `
      <td class="${statusClass[u.status] || ''}">
        ${statusLabel[u.status] || u.status}
      </td>
    `;

      // Admin Remarks — only show if status is rejected
      const remarksCell = `
        <td style="font-size:12px; max-width:200px;">
          ${u.status === 'rejected' && u.remarks
            ? `<span style="color:#cc0000;">${u.remarks}</span>`
            : '<span style="color:gray;">—</span>'
          }
        </td>
      `;

    // ── Actions cell — based on status
    let actionsCell = '<td></td>';

    if(u.status === 'rejected'){
      // rejected: show Resubmit button
      actionsCell = `
        <td>
          <button
            onclick="resubmitUpload(${u.id})"
            style="font-size:12px; padding:6px 12px;
              background:#800000; color:white; border:none;
              border-radius:6px; cursor:pointer;">
            ✏ Resubmit
          </button>
        </td>
      `;
    } else if(u.status === 'approved'){
      actionsCell = `
        <td>
          <span style="color:green; font-size:12px; font-weight:bold;">
            ✅ Visible to students
          </span>
        </td>
      `;
    } else if(u.status === 'locked'){
      actionsCell = `
        <td>
          <span style="color:#555; font-size:12px; font-weight:bold;">
            🔒 Finalized
          </span>
        </td>
      `;
    } else if(u.status === 'pending'){
      actionsCell = `
        <td>
          <span style="color:orange; font-size:12px;">
            ⏳ Waiting for admin
          </span>
        </td>
      `;
    }

    return `
      <tr>
        <td>${u.subject_name}</td>
        <td>${u.grade_level} — ${u.section}</td>
        <td>${u.quarter} Semester</td>
        <td>${new Date(u.submitted_at).toLocaleDateString()}</td>
        ${statusCell}
        ${remarksCell}
        ${actionsCell}
      </tr>
    `;

  }).join('');
}


// ==============================
// FILTER HISTORY
// ==============================

function filterHistory() {

  const quarter =
    document.getElementById('historyQuarterFilter')?.value || '';
  const status  =
    document.getElementById('historyStatusFilter')?.value  || '';

  const filtered = myUploads.filter(u => {
    const matchQ = !quarter || u.quarter === quarter;
    const matchS = !status  || u.status  === status;
    return matchQ && matchS;
  });

  renderHistoryTable(filtered);
}


// ==============================
// RESUBMIT UPLOAD
// only available for rejected
// ==============================

function resubmitUpload(id) {
  showSection('uploadSection', null);
  loadUploadForm();
  alert(
    'Please download a fresh template, fill in the corrected grades, ' +
    'and upload it again.\n\n' +
    'Check the Admin Remarks column for what needs to be fixed.'
  );
}


// ==============================
// SETTINGS
// ==============================

async function loadSettings() {

  const username = localStorage.getItem('username') || '—';
  setEl('settingsPRCID', username);

  try {
    const teacher = await getTeacherRecord();
    if(teacher) setEl('settingsFullName', teacher.full_name || '—');
  } catch(err) {
    setEl('settingsFullName', '—');
  }

  try {
    const activeYear = await apiRequest('/school-years/active');
    setEl('settingsSchoolYear',    activeYear.label || '—');
    setEl('settingsActiveQuarter',
      ordinal(activeYear.active_quarter) + ' Semester'
    );
  } catch(err) {
    setEl('settingsSchoolYear',    '—');
    setEl('settingsActiveQuarter', '—');
  }
}

function changePassword() {
  document.getElementById('teacherCurrentPassword').value = '';
  document.getElementById('teacherNewPassword').value     = '';
  document.getElementById('teacherConfirmPassword').value = '';
  setEl('changePasswordError', '');
  document.getElementById('changePasswordModal').style.display = 'flex';
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'none';
  setEl('changePasswordError', '');
}

async function submitChangePassword() {

  const current_password = document.getElementById('teacherCurrentPassword').value;
  const new_password     = document.getElementById('teacherNewPassword').value;
  const confirm_password = document.getElementById('teacherConfirmPassword').value;
  const errorEl          = document.getElementById('changePasswordError');

  if(errorEl) errorEl.innerText = '';

  if(!current_password){
    if(errorEl) errorEl.innerText = 'Current password is required.';
    return;
  }

  if(!new_password){
    if(errorEl) errorEl.innerText = 'New password is required.';
    return;
  }

  if(new_password.length < 6){
    if(errorEl) errorEl.innerText = 'New password must be at least 6 characters.';
    return;
  }

  if(new_password !== confirm_password){
    if(errorEl) errorEl.innerText = 'Passwords do not match.';
    return;
  }

  try {

    const result = await apiRequest(
      '/auth/change-password',
      'PUT',
      { current_password, new_password }
    );

    alert(`✅ ${result.message}`);
    closeChangePasswordModal();

    // logout so teacher logs in with new password
    setTimeout(() => {
      localStorage.clear();
      window.location.href = '../index.html';
    }, 1000);

  } catch(err) {
    if(errorEl) errorEl.innerText = err.message;
  }
}


// ==============================
// PAGE LOAD
// ==============================

window.onload = function() {
  const username = localStorage.getItem('username') || 'Teacher';
  setEl('topbarName',  username);
  setEl('sidebarName', username);
  loadDashboard();
};