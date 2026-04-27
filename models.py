from django.db import models

class Doctor(models.Model):
    name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    specialty = models.CharField(max_length=200)
    hospital = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True, default="")
    experience = models.CharField(max_length=100, blank=True, default="")
    fee = models.CharField(max_length=50, blank=True, default="")
    diseases = models.TextField(blank=True, default="")
    duration = models.PositiveIntegerField(default=10)

    class Meta:
        app_label = "queuecare"

    def __str__(self):
        return self.name


class Patient(models.Model):
    name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        app_label = "queuecare"

    def __str__(self):
        return self.name


class DoctorSlot(models.Model):
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="slots")
    slot_label = models.CharField(max_length=100)

    class Meta:
        app_label = "queuecare"
        ordering = ["id"]

    def __str__(self):
        return f"{self.doctor.name} - {self.slot_label}"


class Appointment(models.Model):
    STATUS_CHOICES = [
        ("Booked", "Booked"),
        ("Completed", "Completed"),
    ]

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="appointments")
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    date = models.DateField()
    slot = models.CharField(max_length=100)

    serial = models.PositiveIntegerField(default=0)
    wait_minutes = models.FloatField(default=0)
    extra_delay = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Booked")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "queuecare"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.patient.name} -> {self.doctor.name}"