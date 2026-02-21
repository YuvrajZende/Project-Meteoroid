@echo off
cd packages\tui
go build -o meteoroid.exe . 2>nul
meteoroid.exe
