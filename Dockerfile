FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=4173 DATA_DIR=/app/data
EXPOSE 4173
VOLUME ["/app/data"]
CMD ["node","server/index.mjs"]
