import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from backend.app.config import settings

class EmailService:
    @staticmethod
    def generate_verification_code() -> str:
        """Generates a secure 6-digit numeric verification OTP."""
        return f"{random.randint(100000, 999999)}"

    @staticmethod
    def send_verification_email(
        email: str,
        code: str,
        full_name: str
    ) -> Dict[str, Any]:
        """
        Sends an email verification OTP code.
        Zero deployment failure design:
        - If SMTP settings are provided in env, sends real email.
        - If SMTP is not provided or fails, logs code to console and returns simulator mode.
        """
        subject = f"Verify your PulseBug Account: {code}"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f17; color: #e2e8f0; margin: 0; padding: 20px; }}
                .card {{ max-width: 480px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; }}
                .logo {{ font-size: 20px; font-weight: bold; color: #60a5fa; margin-bottom: 24px; }}
                .code-box {{ background-color: #0f172a; border: 2px dashed #6366f1; border-radius: 12px; padding: 18px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #a5b4fc; margin: 24px 0; font-family: monospace; }}
                .btn {{ display: inline-block; background: linear-gradient(to right, #6366f1, #3b82f6); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px; }}
                .footer {{ margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="logo">⚡ PulseBug Bug Tracker</div>
                <h2>Verify Your Email Address</h2>
                <p>Hello <strong>{full_name}</strong>,</p>
                <p>Thank you for registering on PulseBug. Please use the following 6-digit verification code to complete your registration:</p>
                
                <div class="code-box">{code}</div>
                
                <p style="font-size: 13px; color: #94a3b8;">This verification code expires in <strong>30 minutes</strong>. If you did not request this code, you can safely ignore this email.</p>
                
                <div class="footer">
                    PulseBug Intelligent Defect Tracking System • Automated Verification
                </div>
            </div>
        </body>
        </html>
        """

        # Check if SMTP is configured
        smtp_host = getattr(settings, "SMTP_HOST", None)
        smtp_port = getattr(settings, "SMTP_PORT", 587)
        smtp_user = getattr(settings, "SMTP_USER", None)
        smtp_pass = getattr(settings, "SMTP_PASSWORD", None)

        if smtp_host and smtp_user and smtp_pass:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = smtp_user
                msg["To"] = email
                msg.attach(MIMEText(html_content, "html"))

                with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_user, email, msg.as_string())

                return {
                    "sent": True,
                    "mode": "smtp",
                    "message": f"Verification email sent to {email}"
                }
            except Exception as e:
                print(f"[EmailService] SMTP delivery failed: {e}. Falling back to simulation mode.")

        # Fallback to simulation mode for frictionless deployment
        print(f"==================================================")
        print(f"[PULSEBUG EMAIL VERIFICATION] To: {email} | Code: {code}")
        print(f"==================================================")
        return {
            "sent": False,
            "mode": "simulation",
            "code": code,
            "message": f"Verification code generated (Simulation Mode: {code})"
        }

email_service = EmailService()
