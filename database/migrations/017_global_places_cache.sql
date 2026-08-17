ALTER TABLE destination_places_cache
  ADD COLUMN destination_name VARCHAR(160) NOT NULL DEFAULT '' AFTER destination_key,
  ADD COLUMN destination_scope ENUM('country', 'city') NOT NULL DEFAULT 'city' AFTER destination_name,
  ADD COLUMN country_name VARCHAR(160) NULL AFTER destination_scope,
  MODIFY request_category VARCHAR(80) NOT NULL,
  ADD COLUMN search_query VARCHAR(500) NOT NULL DEFAULT '' AFTER request_category,
  ADD COLUMN category_tags JSON NULL AFTER search_query;

UPDATE destination_places_cache
SET destination_name = destination_key,
    category_tags = JSON_ARRAY(request_category)
WHERE destination_name = '' OR category_tags IS NULL;

ALTER TABLE destination_places_cache
  MODIFY category_tags JSON NOT NULL;
