@echo off
cd /d "%~dp0"
echo Adding all changes...
git add .
echo.
set /p msg="Commit message (Enter for 'update'): "
if "%msg%"=="" set msg=update
echo.
echo Committing: %msg%
git commit -m "%msg%"
echo.
echo Pushing to GitHub...
git push
echo.
echo Done!
pause
