@echo off
cd /d "%~dp0"
echo Menjalankan RizchBali di http://localhost:8000
echo Routing URL cantik dari vercel.json diaktifkan.
echo Tekan Ctrl+C untuk menghentikan server.
py local_server.py
if errorlevel 1 (
  echo.
  echo Server berhenti atau gagal dijalankan. Periksa pesan di atas.
  pause
)
