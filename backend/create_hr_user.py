import os

from dotenv import load_dotenv

from database import SessionLocal
from models import User
from services.auth_services import hash_password

load_dotenv()


def main():
    email = os.getenv("HR_EMAIL")
    password = os.getenv("HR_PASSWORD")

    if not email or not password:
        raise RuntimeError(
            "HR_EMAIL and HR_PASSWORD must be set in .env"
        )

    db = SessionLocal()

    try:
        existing = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if existing:
            existing.role = "hr"
            existing.password = hash_password(password)
        else:
            user = User(
                email=email,
                password=hash_password(password),
                role="hr",
            )

            db.add(user)

        db.commit()

        print(f"HR account ready: {email}")

    finally:
        db.close()


if __name__ == "__main__":
    main()