from datetime import datetime
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone
from models import Appointment, Doctor

def parse_slot_start(date_obj, slot_str):
    try:
        start_text = slot_str.split("-")[0].strip()
        dt = datetime.strptime(
            f"{date_obj.strftime('%Y-%m-%d')} {start_text}",
            "%Y-%m-%d %I:%M %p"
        )
        return timezone.make_aware(dt, timezone.get_current_timezone())
    except Exception:
        return None

def recalculate_doctor_queue(doctor_id):
    doctor = Doctor.objects.get(id=doctor_id)
    active = Appointment.objects.filter(
        doctor_id=doctor_id,
        status="Booked"
    ).order_by("date", "created_at")

    now = timezone.localtime()
    cascading_delay = 0

    for index, app in enumerate(active):
        slot_start = parse_slot_start(app.date, app.slot)
        base_from_slot = 0

        if slot_start:
            diff = (slot_start - now).total_seconds() / 60
            base_from_slot = max(0, round(diff))

        queue_offset = index * int(doctor.duration)
        cascading_delay += int(app.extra_delay or 0)

        app.serial = index + 1
        app.wait_minutes = base_from_slot + queue_offset + cascading_delay
        app.save(update_fields=["serial", "wait_minutes"])

def doctor_payload(doctor_id):
    doctor = Doctor.objects.get(id=doctor_id)
    appointments = Appointment.objects.filter(doctor_id=doctor_id).order_by("date", "created_at")

    return {
        "type": "doctor_update",
        "doctor_id": doctor.id,
        "doctor_name": doctor.name,
        "duration": doctor.duration,
        "total_delay": sum(a.extra_delay for a in appointments if a.status == "Booked"),
        "appointments": [
            {
                "id": a.id,
                "patient_name": a.patient.name,
                "date": str(a.date),
                "slot": a.slot,
                "serial": a.serial,
                "wait_minutes": a.wait_minutes,
                "extra_delay": a.extra_delay,
                "status": a.status,
            }
            for a in appointments
        ]
    }

def patient_payload(patient_id):
    appointments = Appointment.objects.filter(patient_id=patient_id).order_by("-created_at")
    latest = appointments.filter(status="Booked").first()

    return {
        "type": "patient_update",
        "patient_id": patient_id,
        "latest": (
            {
                "id": latest.id,
                "doctor_name": latest.doctor.name,
                "date": str(latest.date),
                "slot": latest.slot,
                "serial": latest.serial,
                "wait_minutes": latest.wait_minutes,
                "status": latest.status,
            } if latest else None
        )
    }

def broadcast_doctor(doctor_id):
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        f"doctor_{doctor_id}",
        {
            "type": "queue.message",
            "data": doctor_payload(doctor_id),
        }
    )

def broadcast_patient(patient_id):
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        f"patient_{patient_id}",
        {
            "type": "queue.message",
            "data": patient_payload(patient_id),
        }
    )

def broadcast_for_appointment(app):
    broadcast_doctor(app.doctor_id)
    broadcast_patient(app.patient_id)