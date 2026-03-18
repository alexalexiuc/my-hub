# TODO

- [ ] Use separate DB users: a privileged migration user (full DDL) and a restricted app user (DML only — SELECT/INSERT/UPDATE/DELETE)
- [ ] Add a column to DB tables with the timestamp of the last update, to make it easier to identify stale data and optimize queries
- [ ] Add a column to DB tables with that store non-config data(calories, todo, profile etc) a colmn indicateing how data was added, mcp, hub, or other, to make it easier to identify the source of data and optimize queries
