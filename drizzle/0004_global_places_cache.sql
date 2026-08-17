ALTER TABLE destination_places_cache ADD COLUMN destination_name TEXT NOT NULL DEFAULT '';
ALTER TABLE destination_places_cache ADD COLUMN destination_scope TEXT NOT NULL DEFAULT 'city';
ALTER TABLE destination_places_cache ADD COLUMN country_name TEXT;
ALTER TABLE destination_places_cache ADD COLUMN search_query TEXT NOT NULL DEFAULT '';
ALTER TABLE destination_places_cache ADD COLUMN category_tags TEXT NOT NULL DEFAULT '[]';

UPDATE destination_places_cache
SET destination_name = CASE WHEN destination_name = '' THEN destination_key ELSE destination_name END,
    category_tags = CASE WHEN category_tags = '[]' THEN json_array(request_category) ELSE category_tags END;
