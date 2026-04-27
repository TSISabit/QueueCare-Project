from django.contrib import admin
from models import Doctor, Patient, DoctorSlot, Appointment

admin.site.register(Doctor)
admin.site.register(Patient)
admin.site.register(DoctorSlot)
admin.site.register(Appointment)