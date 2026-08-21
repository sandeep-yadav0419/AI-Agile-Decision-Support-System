"""Establish the existing AI-DSS schema as the Alembic baseline."""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect

from app import models  # noqa: F401
from app.database import Base

revision: str = "20260821_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("users"):
        Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    # A baseline migration must not drop a pre-existing production schema.
    pass
