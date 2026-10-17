#!/bin/bash
set -euo pipefail
export DISPLAY=:99
Xvfb :99 -screen 0 "${GUI_DISPLAY_WIDTH:-1024}x${GUI_DISPLAY_HEIGHT:-768}x24" -nolisten tcp &
openbox-session >/tmp/skcoder-openbox.log 2>&1 &
x11vnc -display :99 -forever -shared -nopw -localhost -rfbport 5900 >/tmp/skcoder-vnc.log 2>&1 &
exec websockify --web=/usr/share/novnc 6901 127.0.0.1:5900
