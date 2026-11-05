@echo off
setlocal
cd /d "%~dp0"
"%~dp0.venv\Scripts\dse-pipeline.exe" >> "%~dp0logs\task_output.log" 2>&1
