from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from contextlib import asynccontextmanager

from database import connect_to_mongo, close_mongo_connection, get_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB
    await connect_to_mongo()
    yield
    # Shutdown: Close MongoDB connection
    await close_mongo_connection()

app = FastAPI(
    title="BMM Admin API",
    description="Backend for BMM Admin Employee Management Portal with MongoDB",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS to allow the React frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"], # Restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models (Data Validation) ---

class Employee(BaseModel):
    id: str
    name: str
    position: str
    email: str
    mobileNumber: str
    gender: str
    dateOfBirth: str
    joiningDate: str
    address: str

class NotificationBase(BaseModel):
    title: str
    message: str

class Notification(NotificationBase):
    id: str
    date: str
    isDeleted: bool = False

class OTPRequest(BaseModel):
    name: str
    email: str
    otp: str

# --- In-Memory Database (Replace with PostgreSQL/SQLAlchemy later) ---

mock_employees = {
    "EMP001": Employee(
        id="EMP001",
        name="Venkatesh Rao",
        position="Field Coordinator",
        email="venkatesh.r@bmm.org",
        mobileNumber="+91 98765 43210",
        gender="Male",
        dateOfBirth="1990-05-15",
        joiningDate="2024-01-10",
        address="123 Gandhi Road, Village A, Mandal HQ"
    )
}

mock_notifications = []

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"message": "Welcome to the BMM Admin FastAPI Backend!"}

# --- Auth / Email Endpoints ---

@app.post("/api/auth/send-otp")
def send_otp_email(request: OTPRequest):
    """Send an OTP verification email using SMTP."""
    import os
    from dotenv import load_dotenv
    load_dotenv()

    # Load SMTP credentials from .env
    sender_email = os.getenv("SMTP_SENDER_EMAIL")
    sender_password = os.getenv("SMTP_SENDER_PASSWORD")
    
    if not sender_email or not sender_password:
        raise HTTPException(status_code=500, detail="SMTP credentials not configured in backend")
    msg['From'] = f"BMM Admin Portal <{sender_email}>"
    msg['To'] = request.email
    msg['Subject'] = "BMM Admin - Your Verification OTP"

    body = f"""Hello {request.name},

You have requested to create an account on the BMM Admin Portal.
Your 6-digit verification code is: {request.otp}

Please enter this code on the registration page to activate your account.
If you did not request this, please ignore this email.

Best regards,
BMM System Administrator
"""
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()
        return {"success": True, "message": "Email sent successfully"}
    except Exception as e:
        print(f"SMTP Error: {str(e)}")
        # Raise HTTP 500 if email fails to send (e.g. invalid credentials)
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# --- Employee Endpoints ---

@app.get("/api/employees/{employee_id}", response_model=Employee)
def get_employee(employee_id: str):
    if employee_id not in mock_employees:
        raise HTTPException(status_code=404, detail="Employee not found")
    return mock_employees[employee_id]

# --- Notification Endpoints ---

@app.get("/api/notifications", response_model=List[Notification])
def get_notifications(include_deleted: bool = False):
    """Fetch all notifications. Optionally include soft-deleted ones (for the trash view)."""
    if include_deleted:
        return mock_notifications
    return [n for n in mock_notifications if not n.isDeleted]

@app.post("/api/notifications", response_model=Notification)
def create_notification(notif: NotificationBase):
    """Create a new global notification."""
    new_notif = Notification(
        id=str(len(mock_notifications) + 1),
        title=notif.title,
        message=notif.message,
        date=datetime.now().strftime("%b %d, %Y, %I:%M %p"),
        isDeleted=False
    )
    mock_notifications.insert(0, new_notif) # Insert at beginning
    return new_notif

@app.delete("/api/notifications/{notif_id}")
def delete_notification(notif_id: str):
    """Soft-delete a notification."""
    for n in mock_notifications:
        if n.id == notif_id:
            n.isDeleted = True
            return {"message": "Notification soft-deleted successfully (7-day retention started)"}
    raise HTTPException(status_code=404, detail="Notification not found")

@app.post("/api/notifications/{notif_id}/undo")
def undo_delete_notification(notif_id: str):
    """Restore a soft-deleted notification."""
    for n in mock_notifications:
        if n.id == notif_id:
            n.isDeleted = False
            return {"message": "Notification restored successfully"}
    raise HTTPException(status_code=404, detail="Notification not found")

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
