// ==============================
// STUDENT PROTECTION
// ==============================

const token = localStorage.getItem('token');
const role  = localStorage.getItem('userRole');

if(!token || role !== 'student'){
  window.location.href = '../index.html';
}


// ==============================
// CACHED DATA
// ==============================

let studentProfile  = null;
let allGrades       = [];
let availableYears  = [];


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

// get GPA description and remarks based on score
function getGPA(score) {
  if(score === null || score === undefined || isNaN(score)){
    return { description: '—', remarks: '—', pass: null };
  }
  if(score >= 90) return { description: 'Outstanding',         remarks: 'Passed', pass: true  };
  if(score >= 85) return { description: 'Very Satisfactory',  remarks: 'Passed', pass: true  };
  if(score >= 80) return { description: 'Satisfactory',       remarks: 'Passed', pass: true  };
  if(score >= 75) return { description: 'Fairly Satisfactory',remarks: 'Passed', pass: true  };
  return             { description: 'Did Not Meet Expectations', remarks: 'Failed', pass: false };
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

  if(element && element.tagName === 'LI'){
    element.classList.add('active');
  }

  // Close sidebar on mobile after navigating (same as teacher)
  if(window.innerWidth <= 768){
    closeSidebar();
  }

  if(sectionId === 'dashboardSection') loadDashboard();
  if(sectionId === 'gradesSection')    loadGrades();
  if(sectionId === 'profileSection')   loadProfile();
}


// ==============================
// SIDEBAR
// ==============================

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const main    = document.querySelector('.main');

  if(window.innerWidth <= 768){
    // mobile: slide in/out with overlay
    const isOpen = sidebar.classList.contains('active');
    if(isOpen){
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    } else {
      sidebar.classList.add('active');
      overlay.classList.add('active');
    }
  } else {
    // desktop: collapse/expand and shift main content
    sidebar.classList.toggle('hidden');
    main.classList.toggle('full');
  }
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('active');
  document.getElementById('sidebarOverlay').classList.remove('active');
}


// ==============================
// DROPDOWN + DARK MODE
// ==============================

function toggleDropdown() {
  document.getElementById('dropdownMenu').classList.toggle('show');
}

window.onclick = function(e) {
  // close dropdown if clicking outside user menu
  if(!e.target.closest('.user-menu')){
    const dd = document.getElementById('dropdownMenu');
    if(dd) dd.classList.remove('show');
  }

  // close sidebar on mobile if clicking outside sidebar and burger button
  if(window.innerWidth <= 768){
    const sidebar = document.querySelector('.sidebar');
    if(
      sidebar.classList.contains('active') &&
      !e.target.closest('.sidebar') &&
      !e.target.closest('.menu-btn')
    ){
      sidebar.classList.remove('active');
      const overlay = document.getElementById('sidebarOverlay');
      if(overlay) overlay.classList.remove('active');
    }
  }
};

function toggleDarkMode() {
  document.body.classList.toggle('dark');
  localStorage.setItem('studentTheme',
    document.body.classList.contains('dark') ? 'dark' : 'light'
  );
}

if(localStorage.getItem('studentTheme') === 'dark'){
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
// LOAD PROFILE
// ==============================

async function loadProfile() {

  try {

    if(!studentProfile){
      studentProfile = await apiRequest('/students/my-profile');
    }

    const p = studentProfile;

    setEl('profileName',    p.full_name   || '—');
    setEl('profileLRN',     p.lrn         || '—');
    setEl('profileGrade',   p.grade_level || '—');
    setEl('profileSection2',p.section     || '—');
    setEl('profileAdviser', p.adviser     || '—');
    setEl('profileYear',    p.school_year || '—');
    setEl('profileStatus',
      p.status === 'activated'
        ? '✅ Activated'
        : '⏳ Not Activated'
    );

  } catch(err) {
    console.error('Load profile error:', err.message);
  }
}


// ==============================
// DASHBOARD
// ==============================

async function loadDashboard() {

  const username = localStorage.getItem('username') || 'Student';
  
  setEl('sidebarName', username);


  // load profile
  try {

    if(!studentProfile){
      studentProfile = await apiRequest('/students/my-profile');
    }

    const p = studentProfile;

    const initial = (p.full_name || 'S')[0].toUpperCase();
    setEl('dashAvatar',   initial);
    setEl('dashFullName', p.full_name   || '—');
    setEl('dashLRN',      p.lrn         || '—');
    setEl('dashGradeLevel', p.grade_level || '—');
    setEl('dashSection',    p.section     || '—');
    setEl('dashSchoolYear', p.school_year || '—');

    setEl('dashGradeCard',   p.grade_level || '—');
    setEl('dashSectionCard', p.section     || '—');
    setEl('dashYearCard',    p.school_year || '—');

  } catch(err) {
    console.error('Load profile error:', err.message);
  }

  // load active quarter
  try {
    const activeYear = await apiRequest('/school-years/active');
    setEl('dashQuarterCard',
      ordinal(activeYear.active_quarter) + ' Semester'
    );
  } catch(err) {
    setEl('dashQuarterCard', '—');
  }

  // load recent grades
  try {

    const grades = await apiRequest('/grades/my-grades');
    allGrades = grades;

    const tbody = document.getElementById('dashRecentGrades');
    if(!tbody) return;

    // show only active school year grades, most recent 6
    const activeGrades = grades
      .filter(g => g.is_active)
      .slice(0, 6);

    if(activeGrades.length === 0){
      tbody.innerHTML = `
        <tr>
          <td colspan="4"
            style="text-align:center; color:gray; padding:20px;">
            No approved grades yet
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = activeGrades.map(g => {
      const gpa = getGPA(parseFloat(g.score));
      return `
        <tr>
          <td style="padding:9px 12px;">${g.subject_name}</td>
          <td style="padding:9px 12px; text-align:center;">
            ${ordinal(parseInt(g.quarter))} Sem
          </td>
          <td style="padding:9px 12px; text-align:center;
            font-weight:bold;
            color:${gpa.pass ? '#007700' : '#cc0000'};">
            ${g.score}
          </td>
          <td style="padding:9px 12px; text-align:center;
            font-size:12px; font-weight:bold;
            color:${gpa.pass ? '#007700' : '#cc0000'};">
            ${gpa.remarks}
          </td>
        </tr>
      `;
    }).join('');

  } catch(err) {
    console.error('Load grades error:', err.message);
  }
}


// ==============================
// LOAD GRADES — builds year list
// and triggers report card render
// ==============================

async function loadGrades() {

  try {

    const grades = await apiRequest('/grades/my-grades');
    allGrades = grades;

    // get unique school years from grades
    const yearMap = {};
    grades.forEach(g => {
      if(!yearMap[g.school_year_id]){
        yearMap[g.school_year_id] = {
          id:        g.school_year_id,
          label:     g.school_year,
          is_active: g.is_active
        };
      }
    });

    availableYears = Object.values(yearMap).sort((a, b) => b.id - a.id);

    // populate year selector
    const yearSelect = document.getElementById('gradeYearFilter');
    if(yearSelect){
      if(availableYears.length === 0){
        yearSelect.innerHTML =
          '<option value="">No grades available yet</option>';
      } else {
        yearSelect.innerHTML = availableYears.map(y =>
          `<option value="${y.id}" ${y.is_active ? 'selected' : ''}>
            ${y.label}${y.is_active ? ' (Current)' : ''}
          </option>`
        ).join('');
      }
    }

    // fill profile info on report card
    if(!studentProfile){
      studentProfile = await apiRequest('/students/my-profile');
    }

    renderReportCard();

  } catch(err) {
    console.error('Load grades error:', err.message);
  }
}


// ==============================
// RENDER REPORT CARD
// called when year changes or
// grades are first loaded
// dynamically shows Q1-QN based
// on total_quarters from active year
// ==============================

async function renderReportCard() {

  const yearSelect  = document.getElementById('gradeYearFilter');
  const selectedId  = yearSelect ? parseInt(yearSelect.value) : null;

  if(!selectedId){
    const tbody = document.getElementById('reportCardTable');
    if(tbody){
      tbody.innerHTML = `
        <tr>
          <td colspan="7"
            style="text-align:center; color:gray; padding:20px;">
            No grades available yet
          </td>
        </tr>
      `;
    }
    return;
  }

  // get profile info for the selected year
  const p = studentProfile;
  if(p){
    setEl('rcName',        p.full_name   || '—');
    setEl('rcAdviser',     p.adviser     || '—');
    setEl('rcGradeSection',
      `${p.grade_level || '—'} — Section ${p.section || '—'}`
    );
    setEl('rcSchoolYear',  p.school_year || '—');
  }

  // filter grades for selected year
  const yearGrades = allGrades.filter(
    g => g.school_year_id === selectedId
  );

  // get how many semesters this year has
  // try from the active year config first
  let totalSemesters = 4; // default

  try {
    const activeYear = await apiRequest('/school-years/active');
    // if viewing active year use its config
    const selectedYear = availableYears.find(y => y.id === selectedId);
    if(selectedYear && selectedYear.is_active){
      totalSemesters = activeYear.total_quarters || 4;
    }
  } catch(err) {
    // keep default
  }

  // build subject → quarter map
  // { 'Mathematics': { '1st': 88, '2nd': null, ... } }
  const subjectMap = {};

  yearGrades.forEach(g => {

    if(!subjectMap[g.subject_name]){
      subjectMap[g.subject_name] = {};
    }

    // map quarter label to semester number
    const semNum = parseInt(g.quarter);
    const semKey = ordinal(semNum);
    subjectMap[g.subject_name][semKey] = parseFloat(g.score);
  });

  const subjects = Object.keys(subjectMap).sort();

  const tbody = document.getElementById('reportCardTable');
  if(!tbody) return;

  if(subjects.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="${totalSemesters + 3}"
          style="text-align:center; color:gray; padding:20px;">
          No approved grades for this school year yet
        </td>
      </tr>
    `;
    return;
  }

  // update table header dynamically based on total semesters
  const thead = document.querySelector('#gradesSection .report-table thead tr');
  if(thead){
    const semHeaders = Array.from({ length: totalSemesters }, (_, i) =>
      `<th>S${i + 1}</th>`
    ).join('');

    thead.innerHTML = `
      <th style="width:35%;">SUBJECTS</th>
      ${semHeaders}
      <th>AVERAGE</th>
      <th>REMARKS</th>
    `;
  }

  // build rows
  let overallTotal  = 0;
  let overallCount  = 0;

  const rows = subjects.map(subject => {

    const semScores = subjectMap[subject];
    let subjectTotal = 0;
    let subjectCount = 0;

    // build semester cells
    const semCells = Array.from({ length: totalSemesters }, (_, i) => {
      const key   = ordinal(i + 1);
      const score = semScores[key];

      if(score !== undefined && score !== null){
        subjectTotal += score;
        subjectCount++;
        const gpa = getGPA(score);
        return `
          <td class="${gpa.pass ? 'grade-pass' : 'grade-fail'}">
            ${score.toFixed(0)}
          </td>
        `;
      }

      return `<td class="grade-none">—</td>`;
    }).join('');

    // calculate average only if all semesters have grades
    let avgCell     = `<td class="grade-none">—</td>`;
    let remarksCell = `<td class="grade-none">—</td>`;

    if(subjectCount === totalSemesters){
      const avg = subjectTotal / totalSemesters;
      const gpa = getGPA(avg);

      overallTotal += avg;
      overallCount++;

      avgCell = `
        <td style="font-weight:bold;
          color:${gpa.pass ? '#007700' : '#cc0000'};">
          ${avg.toFixed(2)}
        </td>
      `;
      remarksCell = `
        <td style="font-weight:bold; font-size:12px;
          color:${gpa.pass ? '#007700' : '#cc0000'};">
          ${gpa.remarks}
        </td>
      `;
    } else if(subjectCount > 0){
      // partial — show running average
      const partialAvg = subjectTotal / subjectCount;
      avgCell = `
        <td style="color:gray; font-size:12px;">
          ${partialAvg.toFixed(2)}*
        </td>
      `;
      remarksCell = `
        <td style="color:gray; font-size:12px;">
          In Progress
        </td>
      `;
    }

    return `
      <tr>
        <td>${subject}</td>
        ${semCells}
        ${avgCell}
        ${remarksCell}
      </tr>
    `;

  }).join('');

  // build overall final average row
  let finalRow = '';

  if(overallCount > 0){
    const finalAvg = overallTotal / overallCount;
    const finalGPA = getGPA(finalAvg);
    const emptyCells = Array.from(
      { length: totalSemesters }, () => '<td></td>'
    ).join('');

    finalRow = `
      <tr class="final-row">
        <td>FINAL GRADE</td>
        ${emptyCells}
        <td style="font-weight:bold;
          color:${finalGPA.pass ? '#007700' : '#cc0000'};">
          ${finalAvg.toFixed(2)}
        </td>
        <td style="font-weight:bold;
          color:${finalGPA.pass ? '#007700' : '#cc0000'};">
          ${finalGPA.remarks}
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = rows + finalRow;
}


// ==============================
// PAGE LOAD
// ==============================

window.onload = function() {
  const username = localStorage.getItem('username') || 'Student';

  setEl('sidebarName', username);
 
  loadDashboard();
};