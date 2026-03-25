FROM oven/bun:1.3-alpine
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN chmod +x /app/start.sh
EXPOSE 3004
CMD ["./start.sh"]
