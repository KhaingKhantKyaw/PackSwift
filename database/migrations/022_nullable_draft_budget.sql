-- An unfinished planning estimate is unknown, not zero.
ALTER TABLE trip_sessions MODIFY budget_amount DECIMAL(12, 2) NULL;
