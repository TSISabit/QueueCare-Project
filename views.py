from datetime import datetime
from django.contrib.auth.hashers import make_password, check_password
from django.db.models import Q
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from models import Doctor, Patient, DoctorSlot, Appointment
from serializers import DoctorSerializer, PatientSerializer, AppointmentSerializer
from utils import recalculate_doctor_queue, broadcast_doctor, broadcast_patient, broadcast_for_appointment


@api_view(["POST"])
def patient_register(request):
    email = request.data.get("email", "").strip().lower()
    if Patient.objects.filter(email=email).exists():
        return Response({"error": "Patient already exists"}, status=400)

    patient = Patient.objects.create(
        name=request.data.get("name", "").strip(),
        email=email,
        password=make_password(request.data.get("password", "").strip()),
        phone=request.data.get("phone", "").strip(),
    )
    return Response(PatientSerializer(patient).data)


@api_view(["POST"])
def patient_login(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "").strip()

    patient = Patient.objects.filter(email=email).first()
    if not patient or not check_password(password, patient.password):
        return Response({"error": "Invalid credentials"}, status=400)

    return Response(PatientSerializer(patient).data)


@api_view(["POST"])
def doctor_register(request):
    email = request.data.get("email", "").strip().lower()
    if Doctor.objects.filter(email=email).exists():
        return Response({"error": "Doctor already exists"}, status=400)

    doctor = Doctor.objects.create(
        name=request.data.get("name", "").strip(),
        email=email,
        password=make_password(request.data.get("password", "").strip()),
        specialty=request.data.get("specialty", "").strip(),
        hospital=request.data.get("hospital", "").strip(),
    )
    return Response(DoctorSerializer(doctor).data)


@api_view(["POST"])
def doctor_login(request):
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "").strip()

    doctor = Doctor.objects.filter(email=email).first()
    if not doctor or not check_password(password, doctor.password):
        return Response({"error": "Invalid credentials"}, status=400)

    return Response(DoctorSerializer(doctor).data)


@api_view(["GET"])
def doctor_list(request):
    search = request.GET.get("search", "").strip()
    disease = request.GET.get("disease", "").strip()
    hospital = request.GET.get("hospital", "").strip()

    qs = Doctor.objects.all()

    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(specialty__icontains=search) | Q(location__icontains=search))
    if disease:
        qs = qs.filter(diseases__icontains=disease)
    if hospital:
        qs = qs.filter(hospital__icontains=hospital)

    return Response(DoctorSerializer(qs, many=True).data)


@api_view(["POST"])
def doctor_profile_update(request, doctor_id):
    doctor = Doctor.objects.get(id=doctor_id)

    doctor.name = request.data.get("name", doctor.name).strip()
    doctor.specialty = request.data.get("specialty", doctor.specialty).strip()
    doctor.hospital = request.data.get("hospital", doctor.hospital).strip()
    doctor.location = request.data.get("location", doctor.location).strip()
    doctor.experience = request.data.get("experience", doctor.experience).strip()
    doctor.fee = request.data.get("fee", doctor.fee).strip()
    doctor.diseases = request.data.get("diseases", doctor.diseases).strip()
    doctor.save()

    broadcast_doctor(doctor.id)
    return Response(DoctorSerializer(doctor).data)


@api_view(["POST"])
def doctor_duration_update(request, doctor_id):
    doctor = Doctor.objects.get(id=doctor_id)
    doctor.duration = int(request.data.get("duration", doctor.duration))
    doctor.save()

    recalculate_doctor_queue(doctor.id)
    broadcast_doctor(doctor.id)
    return Response({"success": True, "duration": doctor.duration})


@api_view(["POST"])
def doctor_add_slot(request, doctor_id):
    doctor = Doctor.objects.get(id=doctor_id)
    slot_label = request.data.get("slot", "").strip()

    if not slot_label:
        return Response({"error": "Slot is required"}, status=400)

    if not DoctorSlot.objects.filter(doctor=doctor, slot_label=slot_label).exists():
        DoctorSlot.objects.create(doctor=doctor, slot_label=slot_label)

    broadcast_doctor(doctor.id)
    return Response({"success": True})


@api_view(["POST"])
def doctor_remove_slot(request, doctor_id):
    doctor = Doctor.objects.get(id=doctor_id)
    slot_label = request.data.get("slot", "").strip()
    DoctorSlot.objects.filter(doctor=doctor, slot_label=slot_label).delete()

    broadcast_doctor(doctor.id)
    return Response({"success": True})


@api_view(["POST"])
def book_appointment(request):
    doctor = Doctor.objects.get(id=request.data.get("doctor_id"))
    patient = Patient.objects.get(id=request.data.get("patient_id"))
    date_str = request.data.get("date")
    slot = request.data.get("slot", "").strip()

    if not DoctorSlot.objects.filter(doctor=doctor, slot_label=slot).exists():
        return Response({"error": "Slot not available"}, status=400)

    date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()

    appointment = Appointment.objects.create(
        doctor=doctor,
        patient=patient,
        date=date_obj,
        slot=slot,
        status="Booked"
    )

    recalculate_doctor_queue(doctor.id)
    appointment.refresh_from_db()

    broadcast_for_appointment(appointment)
    return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def add_delay(request, appointment_id):
    appointment = Appointment.objects.get(id=appointment_id)
    delay = int(request.data.get("delay", 0))
    appointment.extra_delay += delay
    appointment.save(update_fields=["extra_delay"])

    recalculate_doctor_queue(appointment.doctor_id)

    updated = Appointment.objects.get(id=appointment.id)
    broadcast_for_appointment(updated)
    broadcast_doctor(updated.doctor_id)

    return Response({"success": True})


@api_view(["POST"])
def complete_appointment(request, appointment_id):
    appointment = Appointment.objects.get(id=appointment_id)
    appointment.status = "Completed"
    appointment.save(update_fields=["status"])

    recalculate_doctor_queue(appointment.doctor_id)
    broadcast_for_appointment(appointment)
    broadcast_doctor(appointment.doctor_id)

    return Response({"success": True})


@api_view(["GET"])
def patient_dashboard(request, patient_id):
    patient = Patient.objects.get(id=patient_id)
    latest = Appointment.objects.filter(patient=patient, status="Booked").order_by("-created_at").first()

    if not latest:
        return Response({"latest": None})

    return Response({
        "latest": {
            "id": latest.id,
            "doctor_name": latest.doctor.name,
            "date": str(latest.date),
            "slot": latest.slot,
            "serial": latest.serial,
            "wait_minutes": latest.wait_minutes,
            "status": latest.status,
        }
    })


@api_view(["GET"])
def doctor_dashboard(request, doctor_id):
    doctor = Doctor.objects.get(id=doctor_id)
    recalculate_doctor_queue(doctor.id)
    appointments = Appointment.objects.filter(doctor=doctor).order_by("date", "created_at")
    return Response({
        "doctor": DoctorSerializer(doctor).data,
        "appointments": AppointmentSerializer(appointments, many=True).data,
        "total_delay": sum(a.extra_delay for a in appointments if a.status == "Booked")
    })

from pathlib import Path
from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import render


def frontend_page(request, filename="index.html"):
    allowed_pages = {
        "index.html",
        "patient-login.html",
        "patient-register.html",
        "patient-dashboard.html",
        "patient-history.html",
        "doctor-login.html",
        "doctor-register.html",
        "doctor-dashboard.html",
    }

    if filename not in allowed_pages:
        raise Http404("Page not found")

    return render(request, filename)


def frontend_asset(request, filename):
    allowed_assets = {
        "styles.css": "text/css",
        "app.js": "application/javascript",
    }

    if filename not in allowed_assets:
        raise Http404("Asset not found")

    file_path = Path(settings.BASE_DIR) / filename

    if not file_path.exists():
        raise Http404("File not found")

    return FileResponse(
        open(file_path, "rb"),
        content_type=allowed_assets[filename]
    )