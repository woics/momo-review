# Etapa 1: Imagen base con Node.js
FROM node:20-slim

# Instalar dependencias del sistema necesarias para Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Decirle a Puppeteer que use el Chromium del sistema (no descargue uno extra)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (caché de capas)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar el resto del proyecto
COPY . .

# Exponer el puerto del servidor
EXPOSE 4000

# Comando de arranque
CMD ["node", "server.js"]
