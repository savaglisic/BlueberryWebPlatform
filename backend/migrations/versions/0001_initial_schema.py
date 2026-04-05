"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            user_name VARCHAR(80) NOT NULL,
            email VARCHAR(120) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            user_group VARCHAR(80) NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS email_whitelist (
            id SERIAL PRIMARY KEY,
            email VARCHAR(120) UNIQUE NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS genotypes (
            id SERIAL PRIMARY KEY,
            genotype VARCHAR(255) UNIQUE NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS plant_data (
            id SERIAL PRIMARY KEY,
            barcode VARCHAR(100) UNIQUE NOT NULL,
            genotype VARCHAR(100),
            stage VARCHAR(80),
            site VARCHAR(80),
            block VARCHAR(80),
            project VARCHAR(80),
            post_harvest VARCHAR(80),
            bush_plant_number VARCHAR(80),
            mass DOUBLE PRECISION,
            number_of_berries INTEGER,
            x_berry_mass DOUBLE PRECISION,
            box INTEGER,
            ph DOUBLE PRECISION,
            brix DOUBLE PRECISION,
            juicemass DOUBLE PRECISION,
            tta DOUBLE PRECISION,
            mladded DOUBLE PRECISION,
            avg_firmness DOUBLE PRECISION,
            avg_diameter DOUBLE PRECISION,
            sd_firmness DOUBLE PRECISION,
            sd_diameter DOUBLE PRECISION,
            notes VARCHAR(255),
            timestamp TIMESTAMP,
            fruitfirm_timestamp TIMESTAMP,
            week INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS historical_ranks (
            id SERIAL PRIMARY KEY,
            genotype VARCHAR(50) NOT NULL,
            location VARCHAR(80),
            season VARCHAR(80),
            "Flavor_Mean_plus" DOUBLE PRECISION,
            "Selection_Index_2022" DOUBLE PRECISION,
            "Yield_Greens_plus" DOUBLE PRECISION,
            avg_firm_plus DOUBLE PRECISION,
            brix_plus DOUBLE PRECISION,
            ph_plus DOUBLE PRECISION,
            weight_plus DOUBLE PRECISION,
            ranking_SI22 DOUBLE PRECISION,
            rkn_Flavor_Mean_plus DOUBLE PRECISION,
            rkn_Yield_Greens_plus DOUBLE PRECISION,
            rkn_avg_firm_plus DOUBLE PRECISION,
            rkn_brix_plus DOUBLE PRECISION,
            rkn_ph_plus DOUBLE PRECISION,
            rkn_weight_plus DOUBLE PRECISION
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS historical_yield (
            id SERIAL PRIMARY KEY,
            genotype VARCHAR(50) NOT NULL,
            location VARCHAR(80),
            season VARCHAR(80),
            cumulative DOUBLE PRECISION
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS historical_scores (
            id SERIAL PRIMARY KEY,
            genotype VARCHAR(50) NOT NULL,
            location VARCHAR(80),
            season VARCHAR(80),
            flavor_mean DOUBLE PRECISION
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS historical_fruit_quality (
            id SERIAL PRIMARY KEY,
            genotype VARCHAR(50) NOT NULL,
            location VARCHAR(80),
            season VARCHAR(80),
            avg_firm DOUBLE PRECISION,
            avg_size DOUBLE PRECISION,
            brix DOUBLE PRECISION,
            ph DOUBLE PRECISION,
            tta DOUBLE PRECISION,
            weight DOUBLE PRECISION
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS option_configs (
            id SERIAL PRIMARY KEY,
            option_type VARCHAR(120) NOT NULL,
            option_text VARCHAR(120) NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id SERIAL PRIMARY KEY,
            key VARCHAR(64) UNIQUE NOT NULL,
            description VARCHAR(255)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS sensory_questions (
            id SERIAL PRIMARY KEY,
            order_index INTEGER NOT NULL DEFAULT 0,
            question_type VARCHAR(30) NOT NULL,
            attribute VARCHAR(200),
            wording TEXT,
            options_json TEXT,
            capture_video BOOLEAN NOT NULL DEFAULT FALSE,
            demographic_key VARCHAR(50),
            enabled BOOLEAN NOT NULL DEFAULT TRUE
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS sensory_setup (
            id SERIAL PRIMARY KEY,
            samples_per_panelist INTEGER NOT NULL DEFAULT 5
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS sensory_samples (
            id SERIAL PRIMARY KEY,
            setup_id INTEGER NOT NULL DEFAULT 1 REFERENCES sensory_setup(id) ON DELETE CASCADE,
            order_index INTEGER NOT NULL DEFAULT 0,
            sample_number VARCHAR(50) NOT NULL,
            real_identifier VARCHAR(200)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS sensory_results (
            id SERIAL PRIMARY KEY,
            session_label VARCHAR(200),
            session_date DATE,
            panelist_id VARCHAR(50) NOT NULL,
            sample_number VARCHAR(50),
            question_id INTEGER,
            question_type VARCHAR(30),
            attribute VARCHAR(200),
            wording TEXT,
            demographic_key VARCHAR(50),
            response TEXT,
            recorded_at TIMESTAMP DEFAULT NOW()
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sensory_results")
    op.execute("DROP TABLE IF EXISTS sensory_samples")
    op.execute("DROP TABLE IF EXISTS sensory_setup")
    op.execute("DROP TABLE IF EXISTS sensory_questions")
    op.execute("DROP TABLE IF EXISTS api_keys")
    op.execute("DROP TABLE IF EXISTS option_configs")
    op.execute("DROP TABLE IF EXISTS historical_fruit_quality")
    op.execute("DROP TABLE IF EXISTS historical_scores")
    op.execute("DROP TABLE IF EXISTS historical_yield")
    op.execute("DROP TABLE IF EXISTS historical_ranks")
    op.execute("DROP TABLE IF EXISTS plant_data")
    op.execute("DROP TABLE IF EXISTS genotypes")
    op.execute("DROP TABLE IF EXISTS email_whitelist")
    op.execute("DROP TABLE IF EXISTS users")
