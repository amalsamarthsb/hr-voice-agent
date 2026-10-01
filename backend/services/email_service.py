import os
import smtplib
from email.message import EmailMessage

from dotenv import load_dotenv


load_dotenv()


class EmailConfigurationError(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


def send_candidate_email(
    recipient: str,
    subject: str,
    body: str,
) -> None:
    host = os.getenv("SMTP_HOST")
    sender = os.getenv("SMTP_FROM_EMAIL")
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError as error:
        raise EmailConfigurationError(
            "SMTP_PORT must be a valid TCP port number."
        ) from error
    if not 1 <= port <= 65535:
        raise EmailConfigurationError(
            "SMTP_PORT must be between 1 and 65535."
        )
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {
        "1",
        "true",
        "yes",
    }

    if not host or not sender:
        raise EmailConfigurationError(
            "SMTP_HOST and SMTP_FROM_EMAIL must be configured."
        )

    if bool(username) != bool(password):
        raise EmailConfigurationError(
            "Configure both SMTP_USERNAME and SMTP_PASSWORD, or neither."
        )

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=20) as server:
            if use_tls:
                server.starttls()
                server.ehlo()
            if username and password:
                server.login(username, password)
            server.send_message(message)
    except (OSError, smtplib.SMTPException) as error:
        raise EmailDeliveryError(
            "SMTP delivery failed. Check the SMTP server, port, TLS, and credentials."
        ) from error
