const API_URL = 'https://grading-portal-system-production.up.railway.app/api';

// get token from localStorage
function getToken() {
  return localStorage.getItem('token');
}

// reusable fetch function
async function apiRequest(endpoint, method = 'GET', body = null) {

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  };

  if(body) options.body = JSON.stringify(body);

  let response, data;

  try {
    response = await fetch(`${API_URL}${endpoint}`, options);
  } catch(err) {
    // network error — server is down or no connection
    // do NOT logout, just throw so caller handles it
    throw new Error('Cannot connect to server. Please check your connection.');
  }

  try {
    data = await response.json();
  } catch(e) {
    data = {};
  }

  // 401 = token expired or invalid
  // only redirect if we actually have a token stored
  // this prevents redirect loops
  if(response.status === 401){
    const storedToken = localStorage.getItem('token');
    if(storedToken){
      // token exists but server rejected it — truly expired
      console.warn('Token expired — redirecting to login');
      localStorage.clear();

      // redirect to the right login page based on folder depth
      const isInSubfolder = window.location.pathname
        .split('/').length > 2;
      window.location.href = isInSubfolder
        ? '../index.html'
        : 'index.html';
    }
    return;
  }

  // 403 = forbidden but still logged in
  // do NOT logout — just throw so caller handles it
  if(response.status === 403){
    throw new Error(data.message || 'Access denied');
  }

  if(response.status === 404){
    throw new Error(data.message || 'Not found');
  }

  if(!response.ok){
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}