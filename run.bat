@echo off
title QueueCare Project

echo Starting QueueCare setup...

if not exist venv (
    python -m venv venv
)

call venv\Scripts\activate

python -m pip install -r requirements.txt

python manage.py migrate --run-syncdb

start cmd /k "call venv\Scripts\activate && python manage.py runserver"

timeout /t 3

start cmd /k "python -m http.server 5500"

timeout /t 2

start http://127.0.0.1:5500/index.html

echo QueueCare is running...
pause