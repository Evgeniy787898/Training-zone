-- name: Achievement feed (paged)
SELECT id, profile_id, created_at, metadata
FROM achievements
WHERE profile_id = $1
ORDER BY created_at DESC
LIMIT 20;

-- name: Exercise catalog (disciplines)
SELECT key, title, muscle_group, difficulty, updated_at
FROM exercises
WHERE discipline_key = $1
ORDER BY title ASC
LIMIT 50;

-- name: Session timeline (profile)
SELECT id, profile_id, planned_at, status, metadata
FROM training_sessions
WHERE profile_id = $1
  AND planned_at BETWEEN $2 AND $3
ORDER BY planned_at DESC
LIMIT 200;
