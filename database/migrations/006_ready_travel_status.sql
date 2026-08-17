ALTER TABLE trip_sessions
  MODIFY status ENUM('draft', 'planned', 'ready', 'completed', 'archived')
  NOT NULL DEFAULT 'draft';

UPDATE trip_sessions
SET status = 'ready'
WHERE status = 'completed';

