"""Baseline — marks existing Prisma-managed schema as applied.

No DDL is emitted. Alembic takes over schema management from this point.
Future revisions will use autogenerate against the ORM models.

Revision ID: 001_baseline
Revises:
Create Date: 2026-01-01 00:00:00.000000
"""
from alembic import op

revision = "001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing schema is owned by Prisma — nothing to create.
    # This revision simply records that the schema is in sync.
    pass


def downgrade() -> None:
    # Downgrading past the baseline is not supported.
    pass
