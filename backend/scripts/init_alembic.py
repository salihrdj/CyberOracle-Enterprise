#!/usr/bin/env python3
"""
Initialize Alembic migrations and create initial schema.
Run this after setting up PostgreSQL database.
"""
import os
import sys
import subprocess

def run_command(cmd: list, cwd: str = None) -> bool:
    """Run a command and return success status."""
    try:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Command failed: {' '.join(cmd)}")
            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
            return False
        print(result.stdout)
        return True
    except Exception as e:
        print(f"Error running command: {e}")
        return False

def main():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    print("=== Alembic Initialization ===")
    print(f"Backend directory: {backend_dir}")
    
    # Check DATABASE_URL
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        print("Set it in .env file or export it")
        return 1
    
    print(f"Database URL: {database_url}")
    
    # Create initial migration
    print("\n--- Creating initial migration ---")
    if not run_command(["alembic", "revision", "--autogenerate", "-m", "initial schema"], cwd=backend_dir):
        print("Failed to create migration. Database may not exist yet.")
        print("Please create the database first:")
        print("  CREATE DATABASE cyber_enterprise;")
        return 1
    
    # Apply migrations
    print("\n--- Applying migrations ---")
    if not run_command(["alembic", "upgrade", "head"], cwd=backend_dir):
        print("Failed to apply migrations.")
        return 1
    
    print("\n=== Alembic initialization complete ===")
    return 0

if __name__ == "__main__":
    sys.exit(main())