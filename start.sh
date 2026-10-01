#!/bin/sh
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Chưa cài Node.js (cần bản 18 trở lên). Xem https://nodejs.org"; exit 1; }
while true; do
  ZOLA_SUPERVISED=1 node server.js
  echo; echo "Máy chủ đã dừng. Tự khởi động lại sau 3 giây... (Ctrl+C để thoát)"
  sleep 3
done
