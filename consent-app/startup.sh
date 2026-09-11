#!/usr/bin/env bash
set -e

cd /home/site/wwwroot

if [ -d ".next/static" ]; then
  mkdir -p .next/standalone/.next
  cp -R .next/static .next/standalone/.next/static
fi

if [ -d "public" ]; then
  cp -R public .next/standalone/public
fi

exec node .next/standalone/server.js
