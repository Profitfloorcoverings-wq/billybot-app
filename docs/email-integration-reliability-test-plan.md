# Email integration reliability test plan

## Gmail
1. Connect a Gmail account from `/account`.
2. Confirm `email_accounts.gmail_watch_expires_at` and `gmail_history_id` are populated.
3. Call `POST /api/email/watchdog` with `x-internal-token` and confirm no failure rows.
4. Backdate `gmail_watch_expires_at` in DB to <24h and run watchdog again.
5. Confirm watch is recreated and `email_connection_status` is `ok`.
6. Simulate refresh failure by nulling `refresh_token_enc`, trigger inbound processing, and confirm account status becomes `needs_reconnect`/`refresh_failed` with `last_error`.

## Microsoft
1. Connect Outlook account from `/account`.
2. Confirm `ms_subscription_id` and `ms_subscription_expires_at` are populated.
3. Run `POST /api/email/microsoft/renew` and verify renewed/recreated counters.
4. Backdate `ms_subscription_expires_at`, run watchdog, confirm recreated subscription + `email_connection_status=ok`.
5. Simulate revoked token and confirm account status is actionable (`provider_revoked`/`needs_reconnect`).

## UI
1. Visit `/account` with stale or failed account states.
2. Verify status badge shows reconnect-required states and Connect button appears as Reconnect.
3. Verify disconnect clears lifecycle metadata and marks account inactive.
