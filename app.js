const QueueCare = (() => {
  let patientChartRef = null;
  let doctorChartRef = null;
  let patientWaitInterval = null;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function boot() {
    if (!localStorage.getItem('qc_initialized')) {
      write('qc_patient_users', []);
      write('qc_doctor_users', []);
      write('qc_doctors', []);
      write('qc_appointments', []);
      write('qc_patient_history', []);
      localStorage.setItem('qc_initialized', 'true');
    }
  }

  function getActiveRole() {
    return localStorage.getItem('qc_active_role') || '';
  }

  function getSessionUser() {
    return read('qc_session_user', null);
  }

  function setSession(role, user) {
    localStorage.setItem('qc_active_role', role);
    write('qc_session_user', user);
  }

  function clearSession() {
    localStorage.removeItem('qc_active_role');
    localStorage.removeItem('qc_session_user');
  }

  function currentUser(role) {
    const activeRole = getActiveRole();
    const user = getSessionUser();
    if (activeRole !== role) return null;
    return user;
  }

  function redirectAfterAuth(role) {
    window.location.href = role === 'doctor'
      ? 'doctor-dashboard.html'
      : 'patient-dashboard.html';
  }

  function requireRole(role) {
    const activeRole = getActiveRole();
    const user = getSessionUser();

    if (activeRole === role && user) return user;

    window.location.href = role === 'doctor'
      ? 'doctor-login.html'
      : 'patient-login.html';
    return null;
  }

  function stopPatientWaitUpdates() {
    if (patientWaitInterval) {
      clearInterval(patientWaitInterval);
      patientWaitInterval = null;
    }
  }

  function handleLogout() {
    stopPatientWaitUpdates();
    clearSession();
    window.location.href = 'index.html';
  }

  function getInitials(name) {
    if (!name) return 'U';
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() || '')
      .join('') || 'U';
  }

  function formatMinutesToHMS(totalMinutes) {
    const totalSeconds = Math.max(0, Math.round(Number(totalMinutes || 0) * 60));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0')
    ].join(':');
  }

  function renderNavbar() {
    const mount = document.getElementById('navbarMount');
    if (!mount) return;

    const page = document.body.dataset.page || '';
    const activeRole = getActiveRole();

    let rightLinks = `
      <a class="btn btn-outline" href="patient-login.html">Patient Login</a>
      <a class="btn btn-outline" href="doctor-login.html">Doctor Login</a>
    `;

    if (activeRole === 'patient') {
      rightLinks = `
        <a class="nav-link ${page === 'patient-dashboard' ? 'active' : ''}" href="patient-dashboard.html">Dashboard</a>
        <a class="nav-link ${page === 'patient-history' ? 'active' : ''}" href="patient-history.html">History</a>
        <button class="btn btn-outline" onclick="QueueCare.handleLogout()">Logout</button>
      `;
    }

    if (activeRole === 'doctor') {
      rightLinks = `
        <a class="nav-link ${page === 'doctor-dashboard' ? 'active' : ''}" href="doctor-dashboard.html">Doctor Portal</a>
        <button class="btn btn-outline" onclick="QueueCare.handleLogout()">Logout</button>
      `;
    }

    mount.innerHTML = `
      <header class="topbar">
        <div class="container nav">
          <a href="index.html" class="brand">
            <span class="brand-badge">✚</span>
            <span>QueueCare</span>
          </a>

          <nav class="nav-links">
            <a class="nav-link ${page === 'home' ? 'active' : ''}" href="index.html">Home</a>
          </nav>

          <div class="nav-actions">${rightLinks}</div>
        </div>
      </header>
    `;
  }

  function setupAuth(role, mode) {
    const form = document.getElementById('authForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const fd = new FormData(form);
      const notice = document.getElementById('authNotice');

      const name = String(fd.get('name') || '').trim();
      const email = String(fd.get('email') || '').trim().toLowerCase();
      const password = String(fd.get('password') || '').trim();

      const usersKey = role === 'doctor' ? 'qc_doctor_users' : 'qc_patient_users';
      const users = read(usersKey, []);

      if (mode === 'login') {
        const found = users.find(u => u.email === email && u.password === password);

        if (!found) {
          if (notice) notice.textContent = 'Invalid email or password.';
          return;
        }

        setSession(role, found);
        redirectAfterAuth(role);
        return;
      }

      if (!name || !email || !password) {
        if (notice) notice.textContent = 'Please complete all required fields.';
        return;
      }

      if (users.some(u => u.email === email)) {
        if (notice) notice.textContent = 'An account with this email already exists.';
        return;
      }

      const newUser = Object.fromEntries(fd.entries());
      newUser.name = name;
      newUser.email = email;
      newUser.password = password;

      users.push(newUser);
      write(usersKey, users);

      if (role === 'doctor') {
        const doctors = read('qc_doctors', []);
        doctors.push({
          id: `doc-${Date.now()}`,
          email: newUser.email,
          name: newUser.name,
          specialty: newUser.specialty || '',
          diseases: [],
          hospital: newUser.hospital || '',
          location: '',
          experience: '',
          fee: '',
          duration: 10,
          slots: []
        });
        write('qc_doctors', doctors);
      }

      setSession(role, newUser);
      redirectAfterAuth(role);
    });
  }

  function getLoggedDoctorProfile() {
    const user = currentUser('doctor');
    if (!user) return null;
    const doctors = read('qc_doctors', []);
    return doctors.find(d => d.email === user.email) || null;
  }

  function getDoctorById(id) {
    const doctors = read('qc_doctors', []);
    return doctors.find(d => d.id === id) || null;
  }

  function updateDoctorRecord(updatedDoctor) {
    const doctors = read('qc_doctors', []);
    const index = doctors.findIndex(d => d.id === updatedDoctor.id);
    if (index === -1) return;
    doctors[index] = updatedDoctor;
    write('qc_doctors', doctors);

    const sessionUser = getSessionUser();
    if (sessionUser && sessionUser.email === updatedDoctor.email) {
      sessionUser.name = updatedDoctor.name;
      sessionUser.specialty = updatedDoctor.specialty;
      sessionUser.hospital = updatedDoctor.hospital;
      setSession('doctor', sessionUser);
    }

    const doctorUsers = read('qc_doctor_users', []);
    const userIndex = doctorUsers.findIndex(u => u.email === updatedDoctor.email);
    if (userIndex !== -1) {
      doctorUsers[userIndex].name = updatedDoctor.name;
      doctorUsers[userIndex].specialty = updatedDoctor.specialty;
      doctorUsers[userIndex].hospital = updatedDoctor.hospital;
      write('qc_doctor_users', doctorUsers);
    }
  }

  function parseSlotStart(dateStr, slotStr) {
    if (!dateStr || !slotStr) return null;
    const firstPart = slotStr.split('-')[0]?.trim();
    if (!firstPart) return null;

    const match = firstPart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3].toUpperCase();

    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    const dt = new Date(`${dateStr}T00:00:00`);
    dt.setHours(hour, minute, 0, 0);
    return dt;
  }

  function recalculateDoctorQueue(doctorId) {
    const doctor = getDoctorById(doctorId);
    if (!doctor) return;

    const appointments = read('qc_appointments', []);

    const active = appointments
      .filter(app => app.doctorId === doctorId && app.status !== 'Completed')
      .sort((a, b) => {
        const aTime = parseSlotStart(a.date, a.slot)?.getTime() || 0;
        const bTime = parseSlotStart(b.date, b.slot)?.getTime() || 0;
        if (aTime !== bTime) return aTime - bTime;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

    let cascadingDelay = 0;
    const now = new Date();

    const recalculated = active.map((app, index) => {
      const slotStart = parseSlotStart(app.date, app.slot);
      const baseFromSlot = slotStart ? Math.max(0, Math.ceil((slotStart.getTime() - now.getTime()) / 60000)) : 0;
      const queueOffset = index * Number(doctor.duration || 10);
      cascadingDelay += Number(app.extraDelay || 0);

      return {
        ...app,
        serial: index + 1,
        waitMinutes: baseFromSlot + queueOffset + cascadingDelay
      };
    });

    const activeIds = new Set(recalculated.map(app => app.id));
    const updated = appointments.map(app => {
      if (!activeIds.has(app.id)) return app;
      return recalculated.find(item => item.id === app.id) || app;
    });

    write('qc_appointments', updated);
  }

  function getTotalActiveDelay(doctorId) {
    return read('qc_appointments', [])
      .filter(app => app.doctorId === doctorId && app.status !== 'Completed')
      .reduce((sum, app) => sum + Number(app.extraDelay || 0), 0);
  }

  function renderDoctorSearch(doctors) {
    const mount = document.getElementById('doctorResults');
    if (!mount) return;

    const query = (document.getElementById('doctorSearch')?.value || '').toLowerCase();
    const disease = (document.getElementById('diseaseSearch')?.value || '').toLowerCase();
    const hospital = (document.getElementById('hospitalSearch')?.value || '').toLowerCase();

    const filtered = doctors.filter(doc => {
      const queryText = [doc.name, doc.specialty, doc.location].join(' ').toLowerCase();
      const diseaseText = (doc.diseases || []).join(' ').toLowerCase();
      const hospitalText = (doc.hospital || '').toLowerCase();

      return (!query || queryText.includes(query)) &&
             (!disease || diseaseText.includes(disease)) &&
             (!hospital || hospitalText.includes(hospital));
    });

    if (!filtered.length) {
      mount.innerHTML = '<div class="empty-state">No doctors found yet.</div>';
      return;
    }

    mount.innerHTML = filtered.map(doc => `
      <div class="doctor-item">
        <div class="doctor-head">
          <div>
            <h3>${doc.name || 'Doctor'}</h3>
            <div class="muted">${doc.specialty || 'Specialty not added'}</div>
          </div>
        </div>
        <p class="muted">${doc.hospital || 'Hospital not added'}${doc.location ? ', ' + doc.location : ''}</p>
        <div class="tag-row">
          ${(doc.diseases || []).length
            ? doc.diseases.map(item => `<span class="tag gray">${item}</span>`).join('')
            : '<span class="tag gray">No disease tags yet</span>'}
        </div>
        <div class="split" style="margin-top:14px;">
          <div class="small muted">
            ${doc.experience ? doc.experience : 'Experience not added'}
            ${doc.fee ? ` • Fee: ৳${doc.fee}` : ''}
          </div>
          <button class="btn btn-primary" onclick="QueueCare.quickSelectDoctor('${doc.id}')">Select</button>
        </div>
      </div>
    `).join('');
  }

  function bindSearch() {
    ['doctorSearch', 'diseaseSearch', 'hospitalSearch'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.dataset.bound !== 'true') {
        el.dataset.bound = 'true';
        el.addEventListener('input', () => renderDoctorSearch(read('qc_doctors', [])));
      }
    });
  }

  function populateDoctorSelect() {
    const doctors = read('qc_doctors', []);
    const select = document.getElementById('appointmentDoctor');
    const slotSelect = document.getElementById('appointmentSlot');
    if (!select || !slotSelect) return;

    if (!doctors.length) {
      select.innerHTML = '<option value="">No doctors available</option>';
      slotSelect.innerHTML = '<option value="">No slots available</option>';
      return;
    }

    select.innerHTML = doctors.map(doc => `
      <option value="${doc.id}">${doc.name} — ${doc.specialty || 'Specialty not added'}</option>
    `).join('');

    updatePatientSlotOptions(select.value);

    if (select.dataset.bound !== 'true') {
      select.dataset.bound = 'true';
      select.addEventListener('change', function () {
        updatePatientSlotOptions(this.value);
      });
    }
  }

  function updatePatientSlotOptions(doctorId) {
    const slotSelect = document.getElementById('appointmentSlot');
    if (!slotSelect) return;

    const doctor = getDoctorById(doctorId);

    if (!doctor || !doctor.slots || !doctor.slots.length) {
      slotSelect.innerHTML = '<option value="">No slots published</option>';
      return;
    }

    slotSelect.innerHTML = doctor.slots.map(slot => `
      <option value="${slot}">${slot}</option>
    `).join('');
  }

  function quickSelectDoctor(doctorId) {
    const select = document.getElementById('appointmentDoctor');
    if (!select) return;
    select.value = doctorId;
    updatePatientSlotOptions(doctorId);

    const form = document.getElementById('appointmentForm');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindAppointmentForm() {
    const form = document.getElementById('appointmentForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const patient = requireRole('patient');
      if (!patient) return;

      const fd = new FormData(form);
      const doctorId = String(fd.get('doctorId') || '');
      const date = String(fd.get('date') || '');
      const slot = String(fd.get('slot') || '');
      const doctor = getDoctorById(doctorId);
      const notice = document.getElementById('appointmentNotice');

      if (!doctor) {
        if (notice) notice.textContent = 'Please select a valid doctor.';
        return;
      }

      if (!date || !slot) {
        if (notice) notice.textContent = 'Please select both date and slot.';
        return;
      }

      if (!doctor.slots || !doctor.slots.includes(slot)) {
        if (notice) notice.textContent = 'Selected slot is not available for this doctor.';
        return;
      }

      const appointments = read('qc_appointments', []);
      const duplicate = appointments.find(app =>
        app.doctorId === doctorId &&
        app.date === date &&
        app.slot === slot &&
        app.patientEmail === patient.email &&
        app.status !== 'Completed'
      );

      if (duplicate) {
        if (notice) notice.textContent = 'You already booked this slot.';
        return;
      }

      const newAppointment = {
        id: `apt-${Date.now()}`,
        doctorId: doctor.id,
        doctorName: doctor.name,
        patientEmail: patient.email,
        patientName: patient.name,
        date,
        slot,
        serial: 0,
        waitMinutes: 0,
        extraDelay: 0,
        status: 'Booked',
        createdAt: new Date().toISOString()
      };

      appointments.push(newAppointment);
      write('qc_appointments', appointments);
      recalculateDoctorQueue(doctor.id);

      const updatedAppointments = read('qc_appointments', []);
      const saved = updatedAppointments.find(app => app.id === newAppointment.id);

      const history = read('qc_patient_history', []);
      history.unshift({
        doctor: doctor.name,
        specialty: doctor.specialty || '',
        date,
        hospital: doctor.hospital || '',
        summary: `Appointment booked for ${slot}`
      });
      write('qc_patient_history', history);

      if (notice) {
        notice.textContent = `Appointment confirmed with ${doctor.name}. Your serial is ${saved?.serial || '-'} and estimated wait is ${formatMinutesToHMS(saved?.waitMinutes || 0)}.`;
      }

      updatePatientDashboardLiveOnly();
      renderPatientHistoryMini(read('qc_patient_history', []).filter(Boolean));
      renderPatientChart();
    });
  }

  function getLatestPatientAppointment(patientEmail) {
    const appointments = read('qc_appointments', []);
    const patientApps = appointments
      .filter(app => app.patientEmail === patientEmail && app.status !== 'Completed')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return patientApps[0] || null;
  }

  function renderPatientHistoryMini(history) {
    const mount = document.getElementById('patientHistoryMini');
    if (!mount) return;

    if (!history.length) {
      mount.innerHTML = '<div class="empty-state">No consultation history available yet.</div>';
      return;
    }

    mount.innerHTML = history.slice(0, 5).map(item => `
      <div class="history-item">
        <div class="history-head">
          <div>
            <strong>${item.doctor || '-'}</strong>
            <div class="muted small">${item.specialty || '-'}</div>
          </div>
          <span class="tag gray">${item.date || '-'}</span>
        </div>
        <p class="muted small">${item.hospital || '-'}</p>
        <p class="small">${item.summary || '-'}</p>
      </div>
    `).join('');
  }

  function updatePatientDashboardLiveOnly() {
    const user = currentUser('patient');
    if (!user) return;

    const latestAppointment = getLatestPatientAppointment(user.email);
    const patientName = document.getElementById('patientName');
    const kpiLine = document.getElementById('kpiLine');
    const kpiSerial = document.getElementById('kpiSerial');
    const kpiEta = document.getElementById('kpiEta');
    const kpiStatus = document.getElementById('kpiStatus');
    const queueDoctor = document.getElementById('queueDoctor');
    const queueInfo = document.getElementById('queueInfo');

    if (patientName) patientName.textContent = user.name || 'Patient';

    if (latestAppointment) {
      recalculateDoctorQueue(latestAppointment.doctorId);
      const refreshed = getLatestPatientAppointment(user.email);

      if (kpiLine) kpiLine.textContent = Math.max((refreshed?.serial || 1) - 1, 0);
      if (kpiSerial) kpiSerial.textContent = refreshed?.serial || '-';
      if (kpiEta) kpiEta.textContent = formatMinutesToHMS(refreshed?.waitMinutes || 0);
      if (kpiStatus) kpiStatus.textContent = refreshed?.status || '-';
      if (queueDoctor) queueDoctor.textContent = refreshed?.doctorName || 'No doctor selected';
      if (queueInfo) queueInfo.textContent = `Date: ${refreshed?.date || '-'} • Slot: ${refreshed?.slot || '-'}`;
    } else {
      if (kpiLine) kpiLine.textContent = 0;
      if (kpiSerial) kpiSerial.textContent = '-';
      if (kpiEta) kpiEta.textContent = '-';
      if (kpiStatus) kpiStatus.textContent = 'No Active Appointment';
      if (queueDoctor) queueDoctor.textContent = 'No doctor selected';
      if (queueInfo) queueInfo.textContent = 'Date: - • Slot: -';
    }
  }

  function renderPatientDashboard() {
    const user = requireRole('patient');
    if (!user) return;

    const doctors = read('qc_doctors', []);
    const history = read('qc_patient_history', []).filter(Boolean);

    updatePatientDashboardLiveOnly();
    renderDoctorSearch(doctors);
    populateDoctorSelect();
    bindAppointmentForm();
    renderPatientHistoryMini(history.filter(item => item.doctor));
    renderPatientChart();
  }

  function renderPatientHistoryPage() {
    const user = requireRole('patient');
    if (!user) return;

    const appointments = read('qc_appointments', [])
      .filter(app => app.patientEmail === user.email)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    const profileAvatar = document.getElementById('profileAvatar');
    const mount = document.getElementById('fullPatientHistory');

    if (profileName) profileName.textContent = user.name || '-';
    if (profileEmail) profileEmail.textContent = user.email || '-';
    if (profilePhone) profilePhone.textContent = user.phone || '-';
    if (profileAvatar) profileAvatar.textContent = getInitials(user.name);

    if (!mount) return;

    if (!appointments.length) {
      mount.innerHTML = '<div class="empty-state">No patient history has been recorded yet.</div>';
      return;
    }

    mount.innerHTML = appointments.map(app => `
      <div class="timeline-item">
        <div class="history-head">
          <div>
            <h3>${app.doctorName || '-'}</h3>
            <div class="muted">Slot: ${app.slot || '-'} • Serial: ${app.serial || '-'}</div>
          </div>
          <span class="tag">${app.date || '-'}</span>
        </div>
        <p class="small">Status: ${app.status || '-'} • Wait: ${formatMinutesToHMS(app.waitMinutes || 0)}</p>
      </div>
    `).join('');
  }

  function loadDoctorProfileIntoForm(doctor) {
    const map = {
      doctorProfileName: doctor.name || '',
      doctorProfileSpecialty: doctor.specialty || '',
      doctorProfileHospital: doctor.hospital || '',
      doctorProfileLocation: doctor.location || '',
      doctorProfileExperience: doctor.experience || '',
      doctorProfileFee: doctor.fee || '',
      doctorProfileDiseases: (doctor.diseases || []).join(', '),
      doctorDurationInput: doctor.duration || 10
    };

    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
  }

  function renderDoctorScheduleTags(doctor) {
    const mount = document.getElementById('doctorScheduleList');
    if (!mount) return;

    if (!doctor.slots || !doctor.slots.length) {
      mount.innerHTML = '<span class="tag gray">No slots added yet</span>';
      return;
    }

    mount.innerHTML = doctor.slots.map(slot => `
      <span class="tag">
        ${slot}
        <button type="button" class="tag-remove" onclick="QueueCare.removeDoctorSlot('${slot.replace(/'/g, "\\'")}')">×</button>
      </span>
    `).join('');
  }

  function bindDoctorProfileForm() {
    const form = document.getElementById('doctorProfileForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const freshDoctor = getLoggedDoctorProfile();
      if (!freshDoctor) return;

      const updatedDoctor = {
        ...freshDoctor,
        name: document.getElementById('doctorProfileName').value.trim(),
        specialty: document.getElementById('doctorProfileSpecialty').value.trim(),
        hospital: document.getElementById('doctorProfileHospital').value.trim(),
        location: document.getElementById('doctorProfileLocation').value.trim(),
        experience: document.getElementById('doctorProfileExperience').value.trim(),
        fee: document.getElementById('doctorProfileFee').value.trim(),
        diseases: document.getElementById('doctorProfileDiseases').value
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      };

      updateDoctorRecord(updatedDoctor);

      const notice = document.getElementById('doctorProfileNotice');
      if (notice) notice.textContent = 'Doctor profile updated successfully.';
    });
  }

  function bindDoctorScheduleForm() {
    const form = document.getElementById('doctorScheduleForm');
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const freshDoctor = getLoggedDoctorProfile();
      if (!freshDoctor) return;

      const slotInput = document.getElementById('doctorSlotInput');
      const notice = document.getElementById('doctorScheduleNotice');
      const slot = slotInput.value.trim();

      if (!slot) {
        if (notice) notice.textContent = 'Please enter a valid slot.';
        return;
      }

      const updatedDoctor = {
        ...freshDoctor,
        slots: [...(freshDoctor.slots || [])]
      };

      if (!updatedDoctor.slots.includes(slot)) {
        updatedDoctor.slots.push(slot);
      }

      updateDoctorRecord(updatedDoctor);
      slotInput.value = '';
      renderDoctorScheduleTags(updatedDoctor);

      if (notice) notice.textContent = 'Time slot added successfully.';
    });
  }

  function removeDoctorSlot(slot) {
    const doctor = getLoggedDoctorProfile();
    if (!doctor) return;

    const updatedDoctor = {
      ...doctor,
      slots: (doctor.slots || []).filter(item => item !== slot)
    };

    updateDoctorRecord(updatedDoctor);
    renderDoctorScheduleTags(updatedDoctor);
  }

  function updateDuration() {
    const doctor = getLoggedDoctorProfile();
    if (!doctor) return;

    const input = document.getElementById('doctorDurationInput');
    const notice = document.getElementById('doctorQueueNotice');
    const value = Number(input?.value || 10);

    if (!value || value < 1) {
      if (notice) notice.textContent = 'Please enter a valid duration in minutes.';
      return;
    }

    const updatedDoctor = {
      ...doctor,
      duration: value
    };

    updateDoctorRecord(updatedDoctor);
    recalculateDoctorQueue(doctor.id);
    updateDoctorDashboardViewOnly();

    if (notice) notice.textContent = `Consultation time updated to ${value} minutes per patient.`;
  }

  function applyDelayToAppointment(appointmentId) {
    const doctor = getLoggedDoctorProfile();
    if (!doctor) return;

    const input = document.getElementById(`delay-input-${appointmentId}`);
    const notice = document.getElementById('doctorQueueNotice');
    const delay = Number(input?.value || 0);

    if (!delay || delay < 1) {
      if (notice) notice.textContent = 'Please enter a valid delay amount.';
      return;
    }

    const appointments = read('qc_appointments', []);
    const index = appointments.findIndex(app => app.id === appointmentId);
    if (index === -1) return;

    appointments[index].extraDelay = Number(appointments[index].extraDelay || 0) + delay;
    write('qc_appointments', appointments);

    recalculateDoctorQueue(doctor.id);
    updateDoctorDashboardViewOnly();

    if (notice) {
      notice.textContent = `${delay} minutes delay added from serial #${appointments[index].serial}. This delay also affects the patients below in queue.`;
    }
  }

  function bindDoctorActions(doctor) {
    const nextBtn = document.getElementById('nextPatientBtn');
    if (nextBtn && nextBtn.dataset.bound !== 'true') {
      nextBtn.dataset.bound = 'true';
      nextBtn.addEventListener('click', function () {
        const appointments = read('qc_appointments', []);
        const active = appointments
          .filter(app => app.doctorId === doctor.id && app.status !== 'Completed')
          .sort((a, b) => a.serial - b.serial);

        if (!active.length) return;

        const currentId = active[0].id;
        const updated = appointments.map(app =>
          app.id === currentId ? { ...app, status: 'Completed' } : app
        );

        write('qc_appointments', updated);
        recalculateDoctorQueue(doctor.id);
        updateDoctorDashboardViewOnly();
      });
    }
  }

  function updateDoctorDashboardViewOnly() {
    const doctor = getLoggedDoctorProfile();
    if (!doctor) return;

    recalculateDoctorQueue(doctor.id);

    const refreshedDoctor = getLoggedDoctorProfile();
    const appointments = read('qc_appointments', [])
      .filter(app => app.doctorId === refreshedDoctor.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const activeQueue = appointments
      .filter(app => app.status !== 'Completed')
      .sort((a, b) => a.serial - b.serial);

    const doctorName = document.getElementById('doctorName');
    const doctorNowServing = document.getElementById('doctorNowServing');
    const doctorQueueCount = document.getElementById('doctorQueueCount');
    const doctorEta = document.getElementById('doctorEta');
    const doctorConsulted = document.getElementById('doctorConsulted');
    const queueMount = document.getElementById('doctorQueueList');
    const table = document.getElementById('doctorPatientsTable');

    if (doctorName) doctorName.textContent = refreshedDoctor.name || 'Doctor';
    if (doctorNowServing) doctorNowServing.textContent = activeQueue[0] ? activeQueue[0].patientName : '-';
    if (doctorQueueCount) doctorQueueCount.textContent = activeQueue.length;
    if (doctorEta) doctorEta.textContent = `${getTotalActiveDelay(refreshedDoctor.id)} mins`;
    if (doctorConsulted) doctorConsulted.textContent = appointments.length;

    if (queueMount) {
      if (!activeQueue.length) {
        queueMount.innerHTML = '<div class="empty-state">No patients in queue right now.</div>';
      } else {
        queueMount.innerHTML = activeQueue.map(app => `
          <div class="queue-entry">
            <div class="entry-head">
              <div>
                <strong>#${app.serial} — ${app.patientName}</strong>
                <div class="muted small">${app.date} • ${app.slot}</div>
              </div>
              <span class="tag success">${formatMinutesToHMS(app.waitMinutes)}</span>
            </div>
          </div>
        `).join('');
      }
    }

    if (table) {
      if (!appointments.length) {
        table.innerHTML = `
          <tr>
            <td colspan="8" class="muted">No appointment requests available yet.</td>
          </tr>
        `;
      } else {
        table.innerHTML = appointments
          .sort((a, b) => {
            if (a.status === 'Completed' && b.status !== 'Completed') return 1;
            if (a.status !== 'Completed' && b.status === 'Completed') return -1;
            return a.serial - b.serial;
          })
          .map(app => `
            <tr>
              <td>${app.serial || '-'}</td>
              <td>${app.patientName || '-'}</td>
              <td>${app.date || '-'}</td>
              <td>${app.slot || '-'}</td>
              <td>${formatMinutesToHMS(app.waitMinutes || 0)}</td>
              <td>${app.extraDelay || 0} mins</td>
              <td><span class="tag ${app.status === 'Completed' ? 'gray' : 'success'}">${app.status || '-'}</span></td>
              <td>
                ${app.status === 'Completed' ? '-' : `
                  <div class="inline-actions">
                    <input class="inline-delay-input" type="number" id="delay-input-${app.id}" min="1" placeholder="Delay" />
                    <button class="btn btn-outline small-btn" type="button" onclick="QueueCare.applyDelayToAppointment('${app.id}')">Add Delay</button>
                  </div>
                `}
              </td>
            </tr>
          `).join('');
      }
    }

    renderDoctorChart(appointments);
  }

  function renderDoctorDashboard() {
    const user = requireRole('doctor');
    if (!user) return;

    const doctor = getLoggedDoctorProfile();
    if (!doctor) return;

    loadDoctorProfileIntoForm(doctor);
    renderDoctorScheduleTags(doctor);
    bindDoctorProfileForm();
    bindDoctorScheduleForm();
    bindDoctorActions(doctor);
    updateDoctorDashboardViewOnly();
  }

  function renderPatientChart() {
    const canvas = document.getElementById('patientVisitsChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const user = currentUser('patient');
    if (!user) return;

    const history = read('qc_appointments', []).filter(app => app.patientEmail === user.email);
    const labels = history.length ? history.map(h => h.date).reverse() : ['No Data'];
    const data = history.length ? history.map((_, i) => i + 1).reverse() : [0];

    if (patientChartRef) patientChartRef.destroy();

    patientChartRef = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Visits',
          data,
          borderWidth: 3,
          tension: 0.35,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  function renderDoctorChart(appointments) {
    const canvas = document.getElementById('doctorAnalyticsChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const active = appointments.filter(app => app.status !== 'Completed').length;
    const completed = appointments.filter(app => app.status === 'Completed').length;
    const waits = appointments.map(app => Number(app.waitMinutes || 0));
    const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;

    if (doctorChartRef) doctorChartRef.destroy();

    doctorChartRef = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Active', 'Completed', 'Avg Wait'],
        datasets: [{
          label: 'Overview',
          data: [active, completed, avgWait],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  function startPatientWaitUpdates() {
    stopPatientWaitUpdates();

    const page = document.body.dataset.page || '';
    const activeRole = getActiveRole();

    if (!(page === 'patient-dashboard' && activeRole === 'patient')) return;

    patientWaitInterval = setInterval(() => {
      updatePatientDashboardLiveOnly();
    }, 1000);
  }

  function init() {
    boot();
    renderNavbar();
    bindSearch();
    startPatientWaitUpdates();
  }

  return {
    init,
    setupAuth,
    renderPatientDashboard,
    renderPatientHistoryPage,
    renderDoctorDashboard,
    handleLogout,
    quickSelectDoctor,
    removeDoctorSlot,
    updateDuration,
    applyDelayToAppointment
  };
})();

document.addEventListener('DOMContentLoaded', () => QueueCare.init());