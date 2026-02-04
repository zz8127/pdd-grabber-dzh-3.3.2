@echo off
chcp 65001 > nul
title 拼多多多账号抢购助手 v3.3.0
cls

echo ========================================
echo   拼多多多账号抢购助手 v3.3.0
echo ========================================
echo.

:: 检查Node.js
node --version > nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查node_modules
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖...
    echo.
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo.
    echo [成功] 依赖安装完成
    echo.
)

:: 设置PowerShell执行策略
echo [信息] 检查PowerShell执行策略...
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" > nul 2>&1

echo [信息] 正在启动应用程序...
echo.

:: 启动应用
node start.js

:: 如果启动失败，暂停显示错误信息
if errorlevel 1 (
    echo.
    echo [错误] 应用程序启动失败
    pause
)
