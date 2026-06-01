FROM node:20-alpine
WORKDIR /app
COPY index.html reports.html server.js reviews.json ./
RUN mkdir -p scrap
COPY scrap/momo-reviews.json ./scrap/
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
