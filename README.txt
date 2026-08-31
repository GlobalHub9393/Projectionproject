TEAM HUDDLE — FULL REPLACEMENT

Upload/replace these files at the ROOT of GlobalHub9393/Projectionproject:
- index.html
- package.json
- db.js
- huddle.js
- setup.js
- vercel.json

Vercel environment variables:
- DATABASE_URL = Neon connection string
- ADMIN_PHRASE = Hello?

No manual database initialization is required.
The first GET to /api/huddle creates the schema and seeds September automatically.
All September actuals start at zero.
September goals are placeholders and can be edited in Admin.
