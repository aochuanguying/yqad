-- +migrate Up
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success', 'failed') DEFAULT 'success',
  execution_time_ms INT,
  error_message TEXT
);

-- +migrate Down
DROP TABLE IF EXISTS schema_migrations;
