-- SYNTHETIC DEMO WORK SAMPLE: Task Management Web Application.
-- Newly authored illustration of the university project in David Liu's fictional CV.
-- Static review only. This is application-data retrieval, not a completed analytics project.
-- users(id PRIMARY KEY, display_name)
-- tasks(id PRIMARY KEY, creator_id REFERENCES users(id), title, status, created_at)
-- tasks.status is one of: todo, in_progress, done.
-- One output row per task; users.id is unique, so this join is many-to-one.
-- Bind :current_user_id using the application driver's parameter mechanism.
SELECT t.id, t.title, t.status, t.created_at, u.display_name AS creator_name
FROM tasks AS t
LEFT JOIN users AS u ON u.id = t.creator_id
WHERE t.creator_id = :current_user_id
ORDER BY t.created_at DESC, t.id DESC;

-- Proposed functional checks (not recorded execution results):
-- A user with no tasks receives an empty result.
-- A task with a valid creator should appear once, not once per other task.
-- The returned task IDs should match the user's task IDs in the source table.
-- A missing display name should not remove a task from the result.
-- Access enforcement is checked separately in the authenticated API handler;
-- the named parameter itself is not proof that authorisation was implemented.
