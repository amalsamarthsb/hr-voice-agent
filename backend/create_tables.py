from sqlalchemy import inspect, text

from database import engine, Base
import models


Base.metadata.create_all(
    bind=engine
)

with engine.begin() as connection:
    interview_columns = {
        column["name"]
        for column in inspect(connection).get_columns("interviews")
    }
    if "resume_id" not in interview_columns:
        connection.execute(
            text(
                "ALTER TABLE interviews "
                "ADD COLUMN resume_id INTEGER "
                "REFERENCES resumes(id)"
            )
        )

print("Database tables created successfully")