# SuiLens Microservices Workspace

Workspace ini berisi frontend observability dashboard dan empat backend service yang saling terhubung melalui HTTP dan event RabbitMQ.

## Ringkasan Arsitektur

Komponen utama:
- Frontend (Vue + Vuetify): dashboard katalog, inventory, order, dan notifikasi realtime.
- Catalog Service: sumber data lensa.
- Inventory Service: stok per cabang + reservasi/release stok.
- Order Service: pembuatan order, validasi katalog, reservasi inventory, publish event.
- Notification Service: konsumsi event order dari RabbitMQ, simpan riwayat, broadcast WebSocket.
- Infrastruktur: 4 Postgres terpisah (per service) + RabbitMQ.

Alur bisnis inti:
1. Frontend membuat order ke Order Service.
2. Order Service validasi lens ke Catalog Service.
3. Order Service reserve stok ke Inventory Service.
4. Jika sukses, order disimpan lalu event order.placed dipublish ke RabbitMQ.
5. Notification Service konsumsi event, simpan notifikasi, lalu kirim realtime ke klien WebSocket.

## Struktur Folder

- frontend/suilens-frontend: aplikasi frontend.
- services/catalog-service: API katalog lensa.
- services/inventory-service: API inventory dan reservasi.
- services/order-service: API order + publisher event.
- services/notification-service: API riwayat notifikasi + WebSocket + consumer event.
- docker-compose.yml: orkestrasi seluruh stack.

## Prasyarat

Untuk menjalankan via Docker Compose:
- Docker
- Docker Compose

Untuk menjalankan lokal tanpa Docker (opsional):
- Bun (disarankan v1.3+)
- Node.js + pnpm untuk frontend
- PostgreSQL dan RabbitMQ lokal (atau gunakan container untuk infra)

## Menjalankan Seluruh Stack (Direkomendasikan)

Dari root project:

1. Build dan start semua service:
```
docker compose up --build
```

2. Akses aplikasi:
- Frontend: http://localhost:5173
- Catalog API: http://localhost:3001
- Order API: http://localhost:3002
- Notification API: http://localhost:3003
- Inventory API: http://localhost:3004
- RabbitMQ Management: http://localhost:15672 (guest/guest)

3. Stop stack:
```
docker compose down
```
4. Stop dan hapus volume database:
```
docker compose down -v
```
Catatan:
- Setiap backend service menjalankan migrasi schema otomatis saat startup.
- Catalog dan Inventory juga melakukan seed data otomatis saat startup.

## Menjalankan Service Secara Lokal (Tanpa Docker Compose)

### 1) Catalog Service

Masuk ke services/catalog-service lalu jalankan:
- bun install
- ./start.sh

Port default: 3001

### 2) Inventory Service

Masuk ke services/inventory-service lalu jalankan:
- bun install
- ./start.sh

Port default: 3004

### 3) Order Service

Masuk ke services/order-service lalu jalankan:
- bun install
- ./start.sh

Port default: 3002

### 4) Notification Service

Masuk ke services/notification-service lalu jalankan:
- bun install
- ./start.sh

Port default: 3003

### 5) Frontend

Masuk ke frontend/suilens-frontend lalu jalankan:
- pnpm install
- pnpm dev

Port default: 5173

## Environment Variables

### Frontend
- VITE_CATALOG_API (default: http://localhost:3001)
- VITE_INVENTORY_API (default: http://localhost:3004)
- VITE_ORDER_API (default: http://localhost:3002)
- VITE_NOTIFICATION_API (default: http://localhost:3003)
- VITE_NOTIFICATION_WS (default: ws://localhost:3003/ws/notifications)

### Catalog Service
- DATABASE_URL

### Inventory Service
- DATABASE_URL
- CATALOG_SERVICE_URL

### Order Service
- DATABASE_URL
- CATALOG_SERVICE_URL
- INVENTORY_SERVICE_URL
- DEFAULT_BRANCH_CODE
- RABBITMQ_URL

### Notification Service
- DATABASE_URL
- RABBITMQ_URL


## Observability Stack (Monitoring, Logging, Tracing)

Project ini sudah disiapkan untuk stack observability berbasis OpenTelemetry + Grafana:
- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090
- Loki API: http://localhost:3100
- Tempo API: http://localhost:3200

Jalankan seluruh stack (aplikasi + observability):
```
docker compose up --build
```

File konfigurasi observability berada di folder `observability/`.
Instrumentasi tracing native OTLP HTTP saat ini berada di:
- `services/order-service/src/otel-native.ts`
- `services/notification-service/src/otel-native.ts`

## Endpoint

### Catalog Service (3001)
- GET /api/lenses
- GET /api/lenses/:id
- GET /docs
- GET /health

### Inventory Service (3004)
- GET /api/branches
- GET /api/inventory/lenses/:lensId
- POST /api/inventory/reserve
- POST /api/inventory/release
- GET /docs
- GET /health

### Order Service (3002)
- POST /api/orders
- GET /api/orders
- GET /api/orders/:id
- GET /metrics
- GET /docs
- GET /health

### Notification Service (3003)
- GET /api/notifications
- WS /ws/notifications
- GET /docs
- GET /health
