# TODO

- [ ] Use separate DB users: a privileged migration user (full DDL) and a restricted app user (DML only — SELECT/INSERT/UPDATE/DELETE)
- [ ] Add a column to DB tables with the timestamp of the last update, to make it easier to identify stale data and optimize queries
- [ ] Add a column to DB tables that store non-config data (calories, todo, profile, etc.) indicating how the data was added (MCP, hub, or other), to make it easier to identify the data source and optimize queries
- [x] Redesign main page to show some widgets with data from services, then some cards to click and go to the service page(links APPS now), and ADMIN at the bottom
- [x] Add Terms of Service and Privacy Policy pages, and links to them in the footer
- [x] Add a "Contact Us" page with a form to submit inquiries, and an email address for support(a.alex.alexiuc@gmail.com)
- [x] Add Allowed callback URIs to the OAuth app configuration, and validate them in the MCP server and only allow redirects to those URIs, to prevent open redirect vulnerabilities
- [x] mcp-control: show request logs per user/service — clicking an MCP server card should display its recent api_request_logs entries (user email, time, path, status, duration)
- [ ] Create a dedicated cron job (separate process/container) for api_request_logs retention cleanup and DB backup — the in-app log deletion scheduler was removed in favour of this
- [x] Add turborepo for better monorepo management during builds/checks.
- [ ] Review [CrowdSec](https://www.crowdsec.net/) to be added as a security layer in front of the MCP server, to block malicious IPs and prevent abuse. It can be run as a sidecar container in the same network as the MCP server, and configured to forward allowed requests to it while blocking suspicious ones. This would add an extra layer of protection against attacks like brute-force login attempts, DDoS, and other common web threats.
- [ ] Check calories min max if works properly and makes sense.
- [ ] Enhance Harvesting with a dedicated table for to store harvests(start, end, collection per hive. etc. Add MCP tools for reporting & UI elements)
- [ ] Verify issue with Github PR checks where E2E test action is finished with success but in PR checks it has pending status.
- [ ] Mobile authorization redirects to localhost. Check!
- [x] Add refresh token support to the OAuth implementation. Then increase access token expiration.
- [ ] Wire up MCP Service monitor to HUB UI.
- [ ] **Travel UX:** Allow users to override flight details shown in the UI (fetched from flightDetails table) with user-inserted values (via Hub UI form or MCP). Provide a "Use manual details" toggle or similar UX to let users override auto-fetched flight info (status, gate, terminal, etc.) when manually entered values should take precedence.
- [ ] Use e2e.ts for e2e tests and test for unit tests across all package for consistency
- [ ] Merge e2e tests to seem more natural user flow rather than CRUD-ish test for each separate component.
- [ ] Travel mobile UX: design and implement a touch-friendly replacement for hover-only date/time details (timezone tooltip) without layout shift or duplicate browser/native tooltips.
- [ ] Travel - Navigation does not take lat/lng from flights info, to be fixed
- [ ]Add contact info for reservations. Update mpc server & UI to be able to set & review
  Also add a new action in the Coming Next chips to be able to contact property(do not show for flights)
- [x]Add props to icons to be able to resize and change color, so they can be used in more places across the app, not only in travel. Update existing icons to use the new props. (GoogleIcon is an example)
- [ ]See how to fix graphs not being displayed in email for calories reporting.
- [ ]Consider if moving all Labels objects in hub UI to a single file.
- [ ] If profile is not fully setup, meals chart pear without max color. Maybe we should either add a tooltip to explain or not show the chart at all until profile is complete.
