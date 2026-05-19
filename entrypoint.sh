#!/bin/sh
set -e
envsubst '${GEMINI_API_KEY}' < /usr/share/nginx/html/index.html.template > /usr/share/nginx/html/index.html
exec nginx -g 'daemon off;'
