const QueueCare = (() => {
  let patientChartRef = null;
  let doctorChartRef = null;
  const seed = {
    doctors: [
      {
        id: 'doc-1',
        name: 'Dr. Ahsan Rahman',
        specialty: 'Cardiology',
        diseases: ['Chest Pain', 'Heart Checkup', 'High Blood Pressure'],
        hospital: 'Green Life Heart Center',
        location: 'Dhanmondi, Dhaka',
        experience: '12 years',
        nextSlot: '11:30 AM',
        fee: 900,
        rating: 4.9,
        todayQueue: 18
      },
      {
        id: 'doc-2',
        name: 'Dr. Samia Islam',
        specialty: 'Dermatology',
        diseases: ['Skin Rash', 'Acne', 'Hair Fall'],
        hospital: 'City Care Hospital',
        location: 'Uttara, Dhaka',
        experience: '9 years',
        nextSlot: '01:15 PM',
        fee: 700,
        rating: 4.8,
        todayQueue: 11
      },
      {
        id: 'doc-3',
        name: 'Dr. Tanvir Hasan',
        specialty: 'Orthopedics',
        diseases: ['Back Pain', 'Joint Pain', 'Bone Injury'],
        hospital: 'Medistar Specialized Clinic',
        location: 'Mirpur, Dhaka',
        experience: '10 years',
        nextSlot: '04:00 PM',
        fee: 800,
        rating: 4.7,
        todayQueue: 14
      },
      {
        id: 'doc-4',
        name: 'Dr. Nusrat Jahan',
        specialty: 'Neurology',
        diseases: ['Migraine', 'Nerve Pain', 'Dizziness'],
        hospital: 'Neuro Plus Hospital',
        location: 'Banani, Dhaka',
        experience: '11 years',
        nextSlot: '06:30 PM',
        fee: 1000,
        rating: 4.9,
        todayQueue: 9
      }
    ],
    patientQueue: {
      totalInLine: 12,
      mySerial: 27,
      etaMinutes: 38,
      doctorId: 'doc-1',
      status: 'Waiting',
      bookedDate: '2026-04-06',
      slot: '11:30 AM'
    },
    patientHistory: [
      { doctor: 'Dr. Ahsan Rahman', specialty: 'Cardiology', date: '2026-01-12', hospital: 'Green Life Heart Center', summary: 'Follow-up for blood pressure review' },
      { doctor: 'Dr. Samia Islam', specialty: 'Dermatology', date: '2025-11-03', hospital: 'City Care Hospital', summary: 'Treatment for skin allergy' },
      { doctor: 'Dr. Tanvir Hasan', specialty: 'Orthopedics', date: '2025-08-21', hospital: 'Medistar Specialized Clinic', summary: 'Back pain consultation' }
    ],
    doctorPatients: [
      { name: 'Rakib Hossain', date: '2026-04-05', issue: 'Chest pain', reports: ['ECG Report', 'Blood Pressure Summary', 'Prescription v2'], status: 'In Consultation' },
      { name: 'Sarah Akter', date: '2026-04-04', issue: 'Follow-up review', reports: ['Echo Result', 'Lab Report'], status: 'Completed' },
      { name: 'Jamal Uddin', date: '2026-04-03', issue: 'High blood pressure', reports: ['Prescription', 'BP Trend Sheet'], status: 'Completed' },
      { name: 'Priya Saha', date: '2026-03-30', issue: 'Routine heart checkup', reports: ['Consultation Note'], status: 'Completed' }
    ],
    doctorQueue: {
      nowServing: 'Rakib Hossain',
      token: 23,
      eta: '8 mins',
      next: [
        { name: 'Sarah Akter', wait: '5 mins' },
        { name: 'Jamal Uddin', wait: '12 mins' },
        { name: 'Priya Saha', wait: '20 mins' }
      ]
    },
    reportsTrend: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      appointments: [14, 19, 16, 21, 18, 24],
      wait: [22, 20, 18, 16, 14, 15]
    },
    patientProfile: {
      name: 'Opu Fornemen',
      phone: '018XXXXXXXX',
      email: 'patient@queuecare.test'
    },
    doctorProfile: {
      name: 'Dr. Ahsan Rahman',
      email: 'doctor@queuecare.test',
      hospital: 'Green Life Heart Center'
    }
  };

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function boot() {
    if (!localStorage.getItem('qc_seeded')) {
      write('qc_doctors', seed.doctors);
      write('qc_patient_queue', seed.patientQueue);
      write('qc_patient_history', seed.patientHistory);
      write('qc_doctor_patients', seed.doctorPatients);
      write('qc_doctor_queue', seed.doctorQueue);
      write('qc_reports_trend', seed.reportsTrend);
      write('qc_patient_profile', seed.patientProfile);
      write('qc_doctor_profile', seed.doctorProfile);
      write('qc_patient_users', [{ name: 'Demo Patient', email: 'patient@queuecare.test', password: '12345678' }]);
      write('qc_doctor_users', [{ name: 'Dr. Ahsan Rahman', email: 'doctor@queuecare.test', password: '12345678', specialty: 'Cardiology', hospital: 'Green Life Heart Center' }]);
      localStorage.setItem('qc_seeded', 'true');
    }
  }

  function currentUser(role) {
    return read(`qc_auth_${role}`, null);
  }

  function setUser(role, user) {
    write(`qc_auth_${role}`, user);
  }

  function logout(role) {
    localStorage.removeItem(`qc_auth_${role}`);
  }

  function requireRole(role) {
    const user = currentUser(role);
    if (!user) {
      window.location.href = role === 'patient' ? 'patient-login.html' : 'doctor-login.html';
      return null;
    }
    return user;
  }

  function renderNavbar() {
    const mount = document.getElementById('navbarMount');
    if (!mount) return;
    const page = document.body.dataset.page || '';
    const patient = currentUser('patient');
    const doctor = currentUser('doctor');
    const authLinks = patient
      ? `
        <a class="nav-link ${page === 'patient-dashboard' ? 'active' : ''}" href="patient-dashboard.html">Patient Portal</a>
        <a class="nav-link ${page === 'patient-history' ? 'active' : ''}" href="patient-history.html">My History</a>
        <button class="btn btn-outline" onclick="QueueCare.handleLogout('patient')">Logout</button>`
      : doctor
      ? `
        <a class="nav-link ${page === 'doctor-dashboard' ? 'active' : ''}" href="doctor-dashboard.html">Doctor Portal</a>
        <button class="btn btn-outline" onclick="QueueCare.handleLogout('doctor')">Logout</button>`
      : `
        <a class="btn btn-outline" href="patient-login.html">Patient Login</a>
        <a class="btn btn-primary" href="doctor-login.html">Doctor Login</a>`;

    mount.innerHTML = `
      <header class="topbar">
        <div class="container nav">
          <a href="index.html" class="brand">
            <span class="brand-badge">✚</span>
            <span>QueueCare</span>
          </a>
          <nav class="nav-links">
            <a class="nav-link ${page === 'home' ? 'active' : ''}" href="index.html">Home</a>
            <a class="nav-link ${page === 'patient-dashboard' ? 'active' : ''}" href="patient-dashboard.html">Patient</a>
            <a class="nav-link ${page === 'doctor-dashboard' ? 'active' : ''}" href="doctor-dashboard.html">Doctor</a>
          </nav>
          <div class="nav-actions">${authLinks}</div>
        </div>
      </header>`;
  }

  function handleLogout(role) {
    logout(role);
    window.location.href = 'index.html';
  }

  function setupAuth(role, mode) {
    const form = document.getElementById('authForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const email = String(fd.get('email') || '').trim().toLowerCase();
      const password = String(fd.get('password') || '').trim();
      const usersKey = role === 'patient' ? 'qc_patient_users' : 'qc_doctor_users';
      const users = read(usersKey, []);
      const notice = document.getElementById('authNotice');

      if (mode === 'login') {
        const found = users.find((u) => u.email === email && u.password === password);
        if (!found) {
          notice.textContent = 'Invalid credentials. Demo login password is 12345678.';
          notice.className = 'notice';
          return;
        }
        setUser(role, found);
        window.location.href = role === 'patient' ? 'patient-dashboard.html' : 'doctor-dashboard.html';
        return;
      }

      const user = Object.fromEntries(fd.entries());
      if (users.some((u) => u.email === email)) {
        notice.textContent = 'This email is already registered.';
        notice.className = 'notice';
        return;
      }
      users.push(user);
      write(usersKey, users);
      setUser(role, user);
      window.location.href = role === 'patient' ? 'patient-dashboard.html' : 'doctor-dashboard.html';
    });
  }

  function renderPatientDashboard() {
    const user = requireRole('patient');
    if (!user) return;
    const doctors = read('qc_doctors', []);
    const queue = read('qc_patient_queue', {});
    const history = read('qc_patient_history', []);
    const profile = read('qc_patient_profile', {});

    document.getElementById('patientName').textContent = user.name || profile.name || 'Patient';
    document.getElementById('kpiLine').textContent = queue.totalInLine ?? 0;
    document.getElementById('kpiSerial').textContent = queue.mySerial ?? '-';
    document.getElementById('kpiEta').textContent = `${queue.etaMinutes ?? 0} mins`;
    document.getElementById('kpiStatus').textContent = queue.status || 'Waiting';
    document.getElementById('queueDoctor').textContent = doctors.find((d) => d.id === queue.doctorId)?.name || 'Doctor not selected';
    document.getElementById('queueInfo').textContent = `Date: ${queue.bookedDate || '-'} • Slot: ${queue.slot || '-'}`;

    renderDoctorSearch(doctors);
    renderPatientHistoryMini(history);
    renderPatientChart();
    bindAppointmentForm(doctors);
  }

  function renderDoctorSearch(doctors) {
    const mount = document.getElementById('doctorResults');
    if (!mount) return;
    const query = (document.getElementById('doctorSearch')?.value || '').toLowerCase();
    const disease = (document.getElementById('diseaseSearch')?.value || '').toLowerCase();
    const hospital = (document.getElementById('hospitalSearch')?.value || '').toLowerCase();

    const filtered = doctors.filter((doc) => {
      const q = [doc.name, doc.specialty, doc.location].join(' ').toLowerCase();
      const diseases = doc.diseases.join(' ').toLowerCase();
      const hp = doc.hospital.toLowerCase();
      return (!query || q.includes(query)) && (!disease || diseases.includes(disease)) && (!hospital || hp.includes(hospital));
    });

    mount.innerHTML = filtered.map((doc) => `
      <div class="doctor-item">
        <div class="doctor-head">
          <div>
            <h3>${doc.name}</h3>
            <div class="muted">${doc.specialty} • ${doc.experience}</div>
          </div>
          <span class="tag">⭐ ${doc.rating}</span>
        </div>
        <p class="muted">${doc.hospital}, ${doc.location}</p>
        <div class="tag-row">
          ${doc.diseases.map((item) => `<span class="tag gray">${item}</span>`).join('')}
        </div>
        <div class="split" style="margin-top:14px;">
          <div class="small muted">Next Slot: <strong>${doc.nextSlot}</strong> • Fee: ৳${doc.fee} • Queue: ${doc.todayQueue}</div>
          <button class="btn btn-primary" onclick="QueueCare.quickBook('${doc.id}')">Book Appointment</button>
        </div>
      </div>`).join('');

    if (!filtered.length) {
      mount.innerHTML = '<div class="empty-state">No doctor matched your search. Try specialty, disease, or hospital keywords.</div>';
    }
  }

  function quickBook(doctorId) {
    const doctors = read('qc_doctors', []);
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!currentUser('patient')) {
      window.location.href = 'patient-login.html';
      return;
    }
    const queue = read('qc_patient_queue', {});
    queue.doctorId = doctorId;
    queue.bookedDate = new Date().toISOString().slice(0, 10);
    queue.slot = doctor?.nextSlot || 'TBD';
    queue.status = 'Booked';
    queue.totalInLine = Math.max(doctor?.todayQueue || 5, 1);
    queue.mySerial = (doctor?.todayQueue || 10) + 9;
    queue.etaMinutes = queue.totalInLine * 3;
    write('qc_patient_queue', queue);
    alert(`Appointment booked with ${doctor?.name}.`);
    window.location.href = 'patient-dashboard.html';
  }

  function bindSearch() {
    ['doctorSearch', 'diseaseSearch', 'hospitalSearch'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => renderDoctorSearch(read('qc_doctors', [])));
    });
  }

  function bindAppointmentForm(doctors) {
    const form = document.getElementById('appointmentForm');
    const select = document.getElementById('appointmentDoctor');
    if (!form || !select) return;
    select.innerHTML = doctors.map((doc) => `<option value="${doc.id}">${doc.name} — ${doc.specialty}</option>`).join('');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const doc = doctors.find((d) => d.id === fd.get('doctorId'));
      const queue = read('qc_patient_queue', {});
      queue.doctorId = doc.id;
      queue.bookedDate = fd.get('date');
      queue.slot = fd.get('slot');
      queue.status = 'Confirmed';
      queue.totalInLine = Math.max(doc.todayQueue, 1);
      queue.mySerial = doc.todayQueue + 7;
      queue.etaMinutes = queue.totalInLine * 4;
      write('qc_patient_queue', queue);
      const history = read('qc_patient_history', []);
      history.unshift({
        doctor: doc.name,
        specialty: doc.specialty,
        date: fd.get('date'),
        hospital: doc.hospital,
        summary: 'Upcoming appointment booked from patient portal'
      });
      write('qc_patient_history', history);
      document.getElementById('appointmentNotice').textContent = `Appointment confirmed with ${doc.name} on ${fd.get('date')} at ${fd.get('slot')}.`;
      document.getElementById('appointmentNotice').className = 'notice info';
      renderPatientDashboard();
    });
  }

  function renderPatientHistoryMini(history) {
    const mount = document.getElementById('patientHistoryMini');
    if (!mount) return;
    mount.innerHTML = history.slice(0, 4).map((item) => `
      <div class="history-item">
        <div class="history-head">
          <div>
            <strong>${item.doctor}</strong>
            <div class="muted small">${item.specialty}</div>
          </div>
          <span class="tag gray">${item.date}</span>
        </div>
        <p class="muted small">${item.hospital}</p>
        <p class="small">${item.summary}</p>
      </div>`).join('');
  }

  function renderPatientHistoryPage() {
    const user = requireRole('patient');
    if (!user) return;
    const history = read('qc_patient_history', []);
    const profile = read('qc_patient_profile', {});
    document.getElementById('profileName').textContent = user.name || profile.name;
    document.getElementById('profileEmail').textContent = user.email || profile.email;
    document.getElementById('profilePhone').textContent = profile.phone || '-';
    const mount = document.getElementById('fullPatientHistory');
    mount.innerHTML = history.map((item) => `
      <div class="timeline-item">
        <div class="history-head">
          <div>
            <h3>${item.doctor}</h3>
            <div class="muted">${item.specialty} • ${item.hospital}</div>
          </div>
          <span class="tag">${item.date}</span>
        </div>
        <p class="small">${item.summary}</p>
      </div>`).join('');
  }

  function renderDoctorDashboard() {
    const user = requireRole('doctor');
    if (!user) return;
    const queue = read('qc_doctor_queue', {});
    const patients = read('qc_doctor_patients', []);
    document.getElementById('doctorName').textContent = user.name || 'Doctor';
    document.getElementById('doctorNowServing').textContent = `${queue.token ? '#' + queue.token : ''} ${queue.nowServing || '-'}`;
    document.getElementById('doctorEta').textContent = queue.eta || '-';
    document.getElementById('doctorConsulted').textContent = patients.length;
    document.getElementById('doctorReports').textContent = patients.reduce((sum, p) => sum + p.reports.length, 0);

    const queueMount = document.getElementById('doctorQueueList');
    queueMount.innerHTML = (queue.next || []).map((item, index) => `
      <div class="queue-entry">
        <div class="entry-head">
          <div>
            <strong>${index + 1}. ${item.name}</strong>
            <div class="muted small">Predicted wait: ${item.wait}</div>
          </div>
          <span class="tag success">Upcoming</span>
        </div>
      </div>`).join('');

    const table = document.getElementById('doctorPatientsTable');
    table.innerHTML = patients.map((patient) => `
      <tr>
        <td>${patient.name}</td>
        <td>${patient.date}</td>
        <td>${patient.issue}</td>
        <td>${patient.reports.join(', ')}</td>
        <td><span class="tag ${patient.status === 'In Consultation' ? 'warn' : 'success'}">${patient.status}</span></td>
      </tr>`).join('');

    renderDoctorChart();
    bindDoctorActions();
  }

  function bindDoctorActions() {
    const nextBtn = document.getElementById('nextPatientBtn');
    const delayBtn = document.getElementById('addDelayBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const queue = read('qc_doctor_queue', {});
        if (!queue.next || !queue.next.length) return;
        const current = { name: queue.nowServing, date: new Date().toISOString().slice(0, 10), issue: 'Consultation completed', reports: ['Visit Summary'], status: 'Completed' };
        const patients = read('qc_doctor_patients', []);
        if (current.name) patients.unshift(current);
        queue.nowServing = queue.next[0].name;
        queue.token += 1;
        queue.next = queue.next.slice(1);
        write('qc_doctor_queue', queue);
        write('qc_doctor_patients', patients);
        renderDoctorDashboard();
      });
    }
    if (delayBtn) {
      delayBtn.addEventListener('click', () => {
        const queue = read('qc_doctor_queue', {});
        queue.eta = '15 mins';
        write('qc_doctor_queue', queue);
        renderDoctorDashboard();
      });
    }
  }

  function renderPatientChart() {
    const canvas = document.getElementById('patientVisitsChart');
    if (!canvas) return;
    const history = read('qc_patient_history', []);
    const labels = history.map((h) => h.date).reverse();
    const data = history.map((_, i) => i + 1).reverse();
    if (patientChartRef) patientChartRef.destroy();
    patientChartRef = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: 'Visits', data, borderWidth: 3, tension: 0.35, fill: false }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  function renderDoctorChart() {
    const canvas = document.getElementById('doctorAnalyticsChart');
    if (!canvas) return;
    const trend = read('qc_reports_trend', seed.reportsTrend);
    if (doctorChartRef) doctorChartRef.destroy();
    doctorChartRef = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: trend.labels,
        datasets: [
          { label: 'Appointments', data: trend.appointments, borderWidth: 1 },
          { label: 'Avg Wait (mins)', data: trend.wait, borderWidth: 1 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  function init() {
    boot();
    renderNavbar();
    bindSearch();
  }

  return {
    init,
    setupAuth,
    renderPatientDashboard,
    renderPatientHistoryPage,
    renderDoctorDashboard,
    handleLogout,
    quickBook
  };
})();

document.addEventListener('DOMContentLoaded', () => QueueCare.init());