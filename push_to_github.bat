@echo off
color 0B
echo ===================================================
echo     Starting GitHub Push/Update Process
echo ===================================================
echo.

set REPO_URL=https://github.com/Farouk-eladawy/Meusem-Tiqets.git

:: Check if git repo exists
if not exist ".git" (
    echo [1/5] Initializing Git repository...
    git init
) else (
    echo [1/5] Git repository already exists.
)

:: Add files
echo [2/5] Adding modified files...
git add .

:: Create commit with date and time
set d=%date:~-4,4%-%date:~-10,2%-%date:~-7,2%
set t=%time:~0,2%:%time:~3,2%
set t=%t: =0%
set COMMIT_MSG=Auto Update: %d% %t%

echo [3/5] Committing changes...
git commit -m "%COMMIT_MSG%"

:: Rename branch to main
git branch -M main

:: Check remote origin
echo [4/5] Checking remote origin...
git remote | findstr "origin" >nul
if errorlevel 1 (
    echo      - Adding remote origin...
    git remote add origin %REPO_URL%
) else (
    echo      - Updating remote origin...
    git remote set-url origin %REPO_URL%
)

:: Push to GitHub
echo [5/5] Pushing to GitHub...
git push -u origin main

echo.
if %errorlevel% equ 0 (
    color 0A
    echo ===================================================
    echo      SUCCESS! Files pushed to GitHub.
    echo ===================================================
) else (
    color 0C
    echo ===================================================
    echo      ERROR! Failed to push. Please check the logs.
    echo ===================================================
)

echo.
pause