@echo off
setlocal
chcp 65001 >nul
title مكتبنا - تشغيل المنصة
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%PATH%"

echo.
echo  ============================================
echo    مكتبنا - منصة إدارة العمل والشيفتات والكاشير
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [خطأ] Node.js غير موجود على هذا الجهاز.
  echo  من فضلك ثبّت Node.js من https://nodejs.org ثم أعد المحاولة.
  pause
  exit /b 1
)

if not exist node_modules (
  echo  [مكتبنا] جارٍ تثبيت المتطلبات لأول مرة... (مرة واحدة)
  call npm install --omit=dev
)

echo  [مكتبنا] فتح المتصفح وتشغيل الخادم...
start "" cmd /c "ping -n 4 127.0.0.1 >nul & start http://localhost:3000"

echo  [مكتبنا] المنصة تعمل الآن على: http://localhost:3000
echo.
echo  [مكتبنا] أول تسجيل حساب = حساب المدير (صاحب المكتب)
echo  [مكتبنا] بعد كده المدير هو اللي يضيف الأعضاء من صفحة "الفريق"
echo.
echo  [مكتبنا] لإيقاف المنصة: أغلق هذه النافذة.
echo.
call npm start
pause
