# Rencana Implementasi Observability untuk SuiLens

Dokumen ini adalah rencana implementasi **monitoring + centralized logging + distributed tracing** untuk arsitektur SuiLens (frontend, catalog-service, inventory-service, order-service, notification-service).

## 1) Gambaran Solusi (Tools & Arsitektur)

### Stack observability yang direkomendasikan
- **OpenTelemetry SDK + auto-instrumentation** pada service backend.
- **OpenTelemetry Collector** sebagai pipeline tunggal telemetry.
- **Prometheus** untuk scraping metrics.
- **Grafana** untuk dashboard visual metrics.
- **Loki + Promtail** untuk centralized logging.
- **Tempo** untuk distributed tracing (trace visual via Grafana Explore).

> Alternatif tracing: Jaeger. Namun dengan Grafana stack (Loki/Tempo/Prometheus) operasionalnya lebih sederhana dalam satu UI.

### Alur data telemetry
1. Service mengirim **metrics + traces** ke OTel Collector (OTLP HTTP/gRPC).
2. Collector mengekspor:
   - metrics -> Prometheus (via prometheus exporter atau prometheus remote write).
   - traces -> Tempo.
3. Logs aplikasi ditulis terstruktur (JSON) ke stdout/file.
4. Promtail melakukan shipping logs ke Loki.
5. Grafana mengakses Prometheus, Loki, Tempo untuk visualisasi terpadu.

## 2) Rencana Implementasi Monitoring

### Metrik minimum tugas
Pastikan dashboard menampilkan:
- **Jumlah request** (request rate / total request).
- **Latency request** (p50/p95/p99).
- **Error rate** (5xx atau status error aplikasi).
- **Satu metrik bisnis**, disarankan:
  - `orders_created_total{status="success|failed"}` (paling relevan), atau
  - `inventory_reservation_total{status="success|failed"}`.

### Instrumentasi yang disarankan per service
- Gunakan HTTP server metrics bawaan OTel (request duration histogram, request count, status code).
- Tambahkan **custom counter** di `order-service` saat create order:
  - increment success ketika order sukses.
  - increment failed saat validasi/reservasi gagal.
- Tambahkan labels minimum: `service.name`, `http.method`, `http.route`, `http.status_code`.

### Dashboard Grafana (panel yang wajib)
Buat dashboard “SuiLens Observability” berisi:
1. **RPS per service**
2. **Latency p95 per endpoint**
3. **Error rate (%) per service**
4. **Business KPI: Order Success vs Failed (time series + stat total)**
5. (Opsional bonus) inventory stock low indicator dari query API/DB exporter

## 3) Rencana Implementasi Centralized Logging

### Format log (structured JSON)
Standarkan log minimal memuat:
- `timestamp`
- `level`
- `service`
- `message`
- `endpoint` / `route`
- `method`
- `status_code`
- `request_id` atau `correlation_id`
- `trace_id` dan `span_id` (supaya bisa dikorelasikan dengan tracing)

### Strategy implementasi
- Tambahkan middleware di tiap service untuk:
  - generate/request pass-through `x-request-id`.
  - log request start/end + latency.
- Pastikan logging backend ke stdout JSON agar mudah di-scrape Promtail.
- Konfigurasi Promtail pipeline labels:
  - `service`, `level`, `env`, `container`.
- Di Grafana Loki, siapkan query investigasi contoh:
  - semua error 5xx per service
  - logs by `request_id`
  - logs by `trace_id`

## 4) Rencana Implementasi Distributed Tracing

### Flow utama yang harus bisa ditelusuri
Pilih flow **Create Order**:
1. Frontend -> `order-service` (POST /api/orders)
2. `order-service` -> `catalog-service` (validasi lens)
3. `order-service` -> `inventory-service` (reserve)
4. `order-service` -> RabbitMQ publish `order.placed`
5. `notification-service` consume event dan simpan notifikasi

### Implementasi teknis trace
- Aktifkan OTel tracer provider pada semua backend service.
- Inject/extract context melalui:
  - HTTP headers (W3C trace context).
  - RabbitMQ message headers untuk context propagation async.
- Buat span penting:
  - `create_order`
  - `validate_lens`
  - `reserve_inventory`
  - `publish_order_event`
  - `consume_order_event`
  - `save_notification`
- Tambahkan attributes domain (order_id, lens_id, branch_code, quantity, reservation_status).

## 5) Perubahan Infrastruktur (docker-compose)

Tambahkan service baru di compose:
- `otel-collector`
- `prometheus`
- `grafana`
- `loki`
- `promtail`
- `tempo`

Tambahkan env ke tiap backend:
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317` (atau 4318)
- `OTEL_RESOURCE_ATTRIBUTES=service.version=...,deployment.environment=dev`

Expose port minimal:
- Grafana: `3000`
- Prometheus: `9090`
- Loki: `3100`
- Tempo: `3200` (atau internal)
- OTel Collector: `4317/4318`

## 6) Rencana Dokumen Laporan (PDF)

Struktur laporan yang bisa langsung dipakai:
1. **Pendahuluan singkat**
2. **Arsitektur observability** (+ diagram sederhana)
3. **Langkah implementasi** (monitoring, logging, tracing)
4. **Cara menjalankan**
   - `docker compose up --build`
   - URL Grafana/Prometheus/Loki
   - cara generate traffic (manual UI + skrip curl)
5. **Bukti screenshot**
   - dashboard metrics
   - logs terpusat
   - trace flow create order lintas service
6. **Penjelasan hasil observasi**
   - interpretasi latency/error
   - contoh investigasi issue dengan request_id/trace_id
7. **Kendala & perbaikan lanjutan**

## 7) Checklist Eksekusi Cepat

- [ ] Setup observability stack (collector, prometheus, grafana, loki, promtail, tempo)
- [ ] Instrumentasi metrics backend
- [ ] Tambah business metrics order success/failed
- [ ] Standarisasi structured logs + request_id
- [ ] Propagasi trace context HTTP + RabbitMQ
- [ ] Buat dashboard Grafana
- [ ] Simulasikan beban request dan validasi data muncul
- [ ] Ambil screenshot bukti
- [ ] Susun PDF laporan

## 8) Contoh Skenario Generate Request (untuk demo)

Gunakan kombinasi:
- Manual dari frontend (user flow normal)
- Otomasi curl:
  - 20 request sukses create order
  - 10 request gagal (lens id invalid / qty melebihi stok)

Tujuan:
- Dashboard menunjukkan perubahan request count, latency, error rate.
- Logs menampilkan event sukses/gagal dengan request_id.
- Trace menunjukkan rantai lintas service end-to-end.

---

Jika Anda mau, langkah berikutnya saya bisa bantu lanjutkan ke **blueprint file-by-file** (mis. `docker-compose.yml`, contoh `otel-collector-config.yaml`, `prometheus.yml`, `loki-config.yaml`, `promtail-config.yaml`, plus pseudocode middleware instrumentation untuk tiap service).
