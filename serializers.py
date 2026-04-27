from rest_framework import serializers
from models import Doctor, Patient, DoctorSlot, Appointment


class DoctorSerializer(serializers.ModelSerializer):
    disease_list = serializers.SerializerMethodField()
    slots = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = [
            "id", "name", "email", "specialty", "hospital", "location",
            "experience", "fee", "duration", "disease_list", "slots"
        ]

    def get_disease_list(self, obj):
        return [item.strip() for item in obj.diseases.split(",") if item.strip()]

    def get_slots(self, obj):
        return [slot.slot_label for slot in obj.slots.all()]


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ["id", "name", "email", "phone"]


class AppointmentSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="doctor.name", read_only=True)
    patient_name = serializers.CharField(source="patient.name", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id", "doctor", "doctor_name", "patient", "patient_name",
            "date", "slot", "serial", "wait_minutes", "extra_delay",
            "status", "created_at"
        ]