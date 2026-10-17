@echo off
echo ========================================
echo   SK-Coder Secret Generator
echo ========================================
echo.

echo Generating JWT_SECRET...
for /f "delims=" %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JWT_SECRET=%%i

echo JWT_SECRET: %JWT_SECRET%
echo.

set /p ADMIN_PASSWORD="Enter your ADMIN_PASSWORD: "

echo.
echo ========================================
echo   Copy these values to .env.production
echo ========================================
echo.
echo ADMIN_USERNAME=Admin-SK
echo ADMIN_PASSWORD=%ADMIN_PASSWORD%
echo JWT_SECRET=%JWT_SECRET%
echo.
echo Now open .env.production and paste these values!
echo.
pause
