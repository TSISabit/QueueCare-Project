from django.apps import AppConfig

class RootAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps"
    label = "queuecare"

    def ready(self):
        import models  # noqa