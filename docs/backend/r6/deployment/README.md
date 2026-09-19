# Gateway English-only patch — NOT DEPLOYED

This patch only translates the existing write-login page and the `WRITE_AUTH_REQUIRED` JSON message. No secret is included. The recorded IP is the existing deployment host, not a new target. Apply only after separately authorized release and only if the deployed source matches this patch. Save the active site and page first, dry-run the patch, run `nginx -t`, then reload only after success; restore the saved files if validation fails.

Preserve method-variable Basic Auth (`GET/HEAD/OPTIONS: off`, other methods: protected), exact origin and cross-site checks in the same location, TLS, loopback API and reset exclusion. Do not change to a nested limit_except block that may alter rewrite inheritance. Public read does not imply role authorization; a shared password grants shared write access.

Local verification: static patch application, JSON parsing/English string checks and preservation of all non-copy configuration. Nginx is not installed locally; a real Nginx configuration/reload and HTTPS browser test remain release checks. No server connection, reload, database mutation or deployment was performed for this patch.

Release checks: guest read200, guest/wrong-credential write401, valid-credential invalid-body400 (no valid mutation), foreign Origin/cross-site403, reset404; login succeeds then return to existing page and manually retry. Never embed credentials in code or logs.
