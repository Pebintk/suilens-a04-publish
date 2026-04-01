# Blueprint Implementasi Observability (File-by-File)

Dokumen ini adalah lanjutan implementasi praktis dari plan sebelumnya. Fokusnya: **file apa saja yang ditambahkan/diubah** dan langkah lanjut untuk instrumentasi service.

## A. Infrastruktur Observability yang sudah ditambahkan

### 1) `docker-compose.yml`
Sudah ditambahkan service observability berikut:
- `otel-collector`
- `prometheus`
- `loki`
- `promtail`
- `tempo`
- `grafana`

Juga sudah ditambahkan env OTel ke semua backend service:
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_PROTOCOL`

### 2) `observability/otel-collector-config.yaml`
- Menerima telemetry OTLP (`4317/4318`)
- Export metrics ke endpoint Prometheus (`9464`)
- Export traces ke Tempo

### 3) `observability/prometheus.yml`
- Scrape Prometheus sendiri
- Scrape metrics dari OTel Collector

### 4) `observability/loki-config.yml`
- Konfigurasi Loki single-node local untuk centralized logs.

### 5) `observability/promtail-config.yml`
- Scrape Docker container logs via Docker socket.
- Label dasar: `container`, `service`.

### 6) `observability/tempo.yml`
- Menerima OTLP traces
- Menyimpan trace secara local backend

### 7) Grafana provisioning
- `observability/grafana/provisioning/datasources/datasources.yml`
- `observability/grafana/provisioning/dashboards/dashboards.yml`
- `observability/grafana/dashboards/suilens-observability.json`

Dashboard awal berisi panel:
- request rate
- latency p95
- error rate
- business metric `orders_created_total` (success vs failed)

## B. Langkah berikutnya untuk kode service (wajib agar data benar-benar muncul)

> Catatan: konfigurasi infra sudah siap, tapi metrik/log/trace tetap perlu di-emit dari aplikasi.

### Status update implementasi tahap lanjut (sudah dikerjakan)
- `order-service`:
  - menambahkan propagasi `x-request-id` + `traceparent` ke `catalog-service`, `inventory-service`, dan event RabbitMQ.
  - menambahkan structured log JSON di flow create order.
  - menambahkan endpoint `/metrics` (implementasi in-process saat ini) dengan metrik request, error, latency bucket, dan business metric `orders_created_total`.
- `inventory-service`:
  - menambahkan structured log JSON pada reserve/release.
  - membaca header `x-request-id` + `traceparent` untuk korelasi.
- `catalog-service`:
  - menambahkan structured log saat lens tidak ditemukan (404) dengan request/trace context.
- `notification-service`:
  - menambahkan structured log saat consume event dan saat notifikasi berhasil direkam, termasuk request/trace context dari metadata event.
  - menambahkan span export OTLP HTTP native (manual) untuk flow consume event.
- `OpenTelemetry native`:
  - menambahkan util `otel-native.ts` di `order-service` dan `notification-service` untuk mengirim span langsung ke OTel Collector (`/v1/traces`) tanpa dependency tambahan.

### Keputusan prom-client (jawaban desain)
- `prom-client` saat ini ditempatkan di **`services/order-service/src/metrics.ts`**.
- Alasan: endpoint bisnis utama (`POST /api/orders`) dan KPI assignment (`orders_created_total`) berasal dari order-service, jadi implementasi paling cepat dan relevan dimulai dari sini.
- Ke depan, pola ini bisa direplikasi ke service lain (`catalog`, `inventory`, `notification`) dengan menambahkan file `src/metrics.ts` masing-masing service agar metrik request/latency/error tersedia per service secara konsisten.

## 1) Catalog Service (`services/catalog-service/index.ts`)
Tambahkan:
- OTel SDK init (NodeSDK)
- Auto HTTP instrumentation
- Structured logger middleware
- Request ID middleware

Target output:
- metrics HTTP ke collector
- logs JSON dengan `service=catalog-service`
- trace span inbound request

## 2) Inventory Service (`services/inventory-service/index.ts`)
Tambahkan:
- OTel SDK init
- middleware request logging JSON
- propagate `x-request-id`
- span untuk endpoint reserve/release

Target output:
- trace untuk reserve/release stok
- logs investigatif untuk perubahan stok

## 3) Order Service (`services/order-service/index.ts`)
Tambahkan:
- OTel SDK init + outbound HTTP instrumentation
- custom metrics bisnis:
  - `orders_created_total{status="success|failed"}`
- span internal:
  - `validate_lens`
  - `reserve_inventory`
  - `publish_order_event`
- structured logs termasuk `order_id`, `lens_id`, `branch_code`, `request_id`, `trace_id`

Ini service paling penting karena jadi sumber metrik bisnis assignment.

## 4) Notification Service (`services/notification-service/index.ts`)
Tambahkan:
- OTel SDK init
- context extraction dari header RabbitMQ saat consume
- span:
  - `consume_order_event`
  - `save_notification`
  - `broadcast_ws_notification`
- logs JSON untuk event consume dan status penyimpanan notifikasi

## C. Urutan eksekusi yang direkomendasikan

1. `docker compose up --build -d`
2. Buka:
   - Grafana: `http://localhost:3000` (admin/admin)
   - Prometheus: `http://localhost:9090`
3. Generate traffic create order (sukses + gagal).
4. Validasi:
   - Metrics muncul di dashboard Grafana
   - Logs semua service terlihat di Explore Loki
   - Trace flow create order terlihat di Tempo

## D. Query cepat untuk validasi di Grafana

### Metrics (Prometheus)
- Request rate:
  - `sum(rate(http_server_request_duration_seconds_count[5m])) by (service_name)`
- p95 latency:
  - `histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le, service_name))`
- Error rate:
  - `100 * sum(rate(http_server_request_duration_seconds_count{http_status_code=~"5.."}[5m])) by (service_name) / sum(rate(http_server_request_duration_seconds_count[5m])) by (service_name)`
- Business KPI:
  - `sum(rate(orders_created_total[5m])) by (status)`

### Logs (Loki)
- Semua error:
  - `{service=~".*service.*"} |= "error"`
- Per request id:
  - `{service="order-service"} |= "<request_id>"`
- Per trace id:
  - `{service="order-service"} |= "<trace_id>"`

## E. Checklist bukti laporan

- [ ] Screenshot dashboard monitoring
- [ ] Screenshot centralized logs (lebih dari 1 service)
- [ ] Screenshot trace end-to-end create order
- [ ] Penjelasan metrik + log field + trace flow pada PDF
