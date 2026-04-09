"""migrate demographic questions to store their real rendering type

Previously all demographic questions had question_type='demographic'. Now they
store their actual rendering type (text, multiple_choice, select_all) and are
identified as demographics by demographic_key being non-null.

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = '0009'
down_revision: Union[str, None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Questions with options are multiple_choice; questions without are text.
    op.execute(
        """
        UPDATE sensory_questions
        SET question_type = 'multiple_choice'
        WHERE question_type = 'demographic'
          AND options_json IS NOT NULL
          AND options_json != '[]'
          AND options_json != ''
        """
    )
    op.execute(
        """
        UPDATE sensory_questions
        SET question_type = 'text'
        WHERE question_type = 'demographic'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE sensory_questions
        SET question_type = 'demographic'
        WHERE demographic_key IS NOT NULL
        """
    )
