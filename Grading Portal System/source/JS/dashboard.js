
function showSection(sectionId, element) {
  // hide all sections
  const sections = document.querySelectorAll(".section");
  sections.forEach(sec => sec.classList.remove("active-section"));

  // show selected
  document.getElementById(sectionId).classList.add("active-section");

  // remove active from all menu
  const items = document.querySelectorAll(".sidebar ul li");
  items.forEach(item => item.classList.remove("active"));

  // highlight clicked
  element.classList.add("active");
}

//FOR SIDEBAR
function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");

  if (window.innerWidth <= 768) {
    sidebar.classList.toggle("active");
  } else {
    sidebar.classList.toggle("hidden");
    document.querySelector(".main").classList.toggle("full");
  }
}

function toggleDropdown() {
  document.getElementById("dropdownMenu").classList.toggle("show");
}

// Close when clicking outside
window.onclick = function(e) {
  if (!e.target.closest(".user-menu")) {
    document.getElementById("dropdownMenu").classList.remove("show");
  }
};

// Actions
function logout(){
  localStorage.removeItem("adminLoggedIn");
  window.location.href = "../index.html";

}


//Darkmode
function toggleDarkMode() {
  document.body.classList.toggle("dark");
}