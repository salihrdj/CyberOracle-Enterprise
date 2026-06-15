# Alembic Database Migrations

This directory contains Alembic migration scripts for the CyberOracle Enterprise database schema.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure database:**
   - Set `DATABASE_URL` in your `.env` file
   - Ensure PostgreSQL is running and the database exists

3. **Initialize migrations (first time only):**
   ```bash
   python scripts/init_alembic.py
   ```

## Common Commands

### Create a new migration
```bash
alembic revision --autogenerate -m "description of changes"
```

### Apply migrations
```bash
alembic upgrade head
```

### Rollback one migration
```bash
alembic downgrade -1
```

### Show migration history
```bash
alembic history
```

### Show current revision
```bash
alembic current
```

## Migration Files

Migration files are stored in `alembic/versions/` with timestamps.

## Important Notes

- **Never edit applied migrations** - create new ones instead
- Always test migrations on a copy of production data first
- Backup database before applying migrations in production
- The `alembic.ini` file reads `DATABASE_URL` from environment variables

## Model Changes

When you modify SQLAlchemy models in `database.py`:

1. Make your model changes
2. Run `alembic revision --autogenerate -m "description"`
3. Review the generated migration file
4. Apply with `alembic upgrade head`