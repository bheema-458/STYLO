
@echo off

cd /d "C:\Users\i\Desktop\BROTOTYPE\STYLO\backend"

"C:\Users\i\Desktop\BROTOTYPE\STYLO\backend\venv\Scripts\python.exe" manage.py check_alerts >> check_alerts.log 2>&1
