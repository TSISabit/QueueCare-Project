from django.urls import re_path
from consumers import QueueConsumer

websocket_urlpatterns = [
    re_path(r"ws/live/(?P<group_name>[^/]+)/$", QueueConsumer.as_asgi()),
]