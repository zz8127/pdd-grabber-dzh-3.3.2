@echo off
chcp 65001 > nul
title 拼多多抢购助手 - 打包工具
cls

echo ========================================
echo   拼多多多账号抢购助手 - 打包工具
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

:: 清理残留进程
echo [信息] 检查并清理残留进程...
taskkill /F /IM electron.exe 2>nul >nul
taskkill /F /IM "拼多多多账号抢购助手.exe" 2>nul >nul
echo [成功] 进程清理完成
echo.

:: 清理旧的构建目录
if exist "dist" (
    echo [信息] 清理旧的构建目录...
    rmdir /S /Q "dist" 2>nul
    if exist "dist" (
        echo [警告] 无法删除dist目录，尝试重命名...
        set "backup_name=dist_backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
        set "backup_name=!backup_name: =0!"
        rename "dist" "!backup_name!" 2>nul
        if exist "dist" (
            echo [错误] 无法清理dist目录，请手动删除后重试
            pause
            exit /b 1
        )
        echo [成功] 已重命名旧目录为: !backup_name!
    ) else (
        echo [成功] 清理完成
    )
    echo.
)

:: 显示菜单
:menu
cls
echo ========================================
echo   拼多多多账号抢购助手 - 打包工具
echo ========================================
echo.
echo 请选择打包平台:
echo.
echo   [1] Windows (NSIS安装包)
echo   [2] Windows (便携版)
echo   [3] macOS
echo   [4] Linux
echo   [5] 所有平台
echo.
echo   [0] 退出
echo.
echo ========================================
echo.

set /p choice="请输入选项 (0-5): "

if "%choice%"=="1" goto build_win
if "%choice%"=="2" goto build_win_portable
if "%choice%"=="3" goto build_mac
if "%choice%"=="4" goto build_linux
if "%choice%"=="5" goto build_all
if "%choice%"=="0" goto exit

echo [错误] 无效选项，请重新选择
pause
goto menu

:build_win
echo.
echo [信息] 开始打包 Windows 版本...
echo [信息] 执行: npm run build:win
echo.
call npm run build:win
if errorlevel 1 (
    echo.
    echo [错误] 打包失败
    echo.
    echo 可能的解决方案:
    echo   1. 确保已安装所有依赖: npm install
    echo   2. 关闭所有正在运行的应用实例
    echo   3. 手动删除 dist 目录后重试
    echo   4. 重启电脑后重试
    echo.
    pause
    goto menu
)
echo.
echo [成功] Windows 版本打包完成！
echo.
:: 显示生成的文件
if exist "dist" (
    echo 生成的文件:
    dir /B "dist" 2>nul
    echo.
)
pause
goto menu

:build_win_portable
echo.
echo [信息] 开始打包 Windows 便携版...
echo [信息] 执行: npm run build:win:portable
echo.
call npm run build:win:portable
if errorlevel 1 (
    echo.
    echo [错误] 打包失败
    echo.
    echo 可能的解决方案:
    echo   1. 确保已安装所有依赖: npm install
    echo   2. 关闭所有正在运行的应用实例
    echo   3. 手动删除 dist 目录后重试
    echo.
    pause
    goto menu
)
echo.
echo [成功] Windows 便携版打包完成！
echo.
if exist "dist" (
    echo 生成的文件:
    dir /B "dist" 2>nul
    echo.
)
pause
goto menu

:build_mac
echo.
echo [信息] 开始打包 macOS 版本...
echo [信息] 执行: node build.js mac
echo.
node build.js mac
if errorlevel 1 (
    echo.
    echo [错误] 打包失败
    pause
    goto menu
)
echo.
echo [成功] macOS 版本打包完成！
pause
goto menu

:build_linux
echo.
echo [信息] 开始打包 Linux 版本...
echo [信息] 执行: node build.js linux
echo.
node build.js linux
if errorlevel 1 (
    echo.
    echo [错误] 打包失败
    pause
    goto menu
)
echo.
echo [成功] Linux 版本打包完成！
pause
goto menu

:build_all
echo.
echo [信息] 开始打包所有平台...
echo [信息] 执行: node build.js all
echo.
node build.js all
if errorlevel 1 (
    echo.
    echo [错误] 打包失败
    pause
    goto menu
)
echo.
echo [成功] 所有平台打包完成！
pause
goto menu

:exit
echo.
echo 感谢使用，再见！
timeout /t 2 > nul
exit /b 0
