from django.contrib import admin
from django.urls import path
from views import (
    patient_register, patient_login,
    doctor_register, doctor_login,
    doctor_list, doctor_profile_update, doctor_duration_update,
    doctor_add_slot, doctor_remove_slot,
    book_appointment, add_delay, complete_appointment,
    patient_dashboard, doctor_dashboard
)

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/patient/register/", patient_register),
    path("api/patient/login/", patient_login),

    path("api/doctor/register/", doctor_register),
    path("api/doctor/login/", doctor_login),

    path("api/doctors/", doctor_list),
    path("api/doctors/<int:doctor_id>/profile/", doctor_profile_update),
    path("api/doctors/<int:doctor_id>/duration/", doctor_duration_update),
    path("api/doctors/<int:doctor_id>/add-slot/", doctor_add_slot),
    path("api/doctors/<int:doctor_id>/remove-slot/", doctor_remove_slot),
    path("api/doctors/<int:doctor_id>/dashboard/", doctor_dashboard),

    path("api/appointments/book/", book_appointment),
    path("api/appointments/<int:appointment_id>/delay/", add_delay),
    path("api/appointments/<int:appointment_id>/complete/", complete_appointment),

    path("api/patients/<int:patient_id>/dashboard/", patient_dashboard),
]