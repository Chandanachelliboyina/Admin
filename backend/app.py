from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from contextlib import asynccontextmanager

from database import connect_to_mongo, close_mongo_connection, get_db, get_previous_db

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
    profile_picture: Optional[str] = None

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

@app.get("/api/employees", response_model=List[Employee])
async def get_all_employees():
    """Fetch all employees from Previous MongoDB."""
    db = get_previous_db()
    if db is None:
        # Fallback to mock data if DB isn't connected
        return list(mock_employees.values())
    
    employees = []
    # Query the 'employees' collection
    cursor = db.employees.find({})
    async for doc in cursor:
        emp_id = str(doc.get("employee_id") or doc.get("_id") or doc.get("id") or "Unknown")
        employee_data = {
            "id": emp_id,
            "name": doc.get("full_name", doc.get("name", "Unknown Name")),
            "position": f"{doc.get('role', '')} {doc.get('department', '')}".strip() or doc.get("position", "Employee"),
            "email": doc.get("email", "N/A"),
            "mobileNumber": doc.get("phone", doc.get("mobileNumber", "N/A")),
            "gender": doc.get("gender", "N/A"),
            "dateOfBirth": doc.get("date_of_birth", doc.get("dateOfBirth", "N/A")),
            "joiningDate": doc.get("joining_date", doc.get("joiningDate", "N/A")),
            "address": doc.get("address", doc.get("location", "N/A")),
            "profile_picture": doc.get("profile_picture")
        }
        try:
            employees.append(Employee(**employee_data))
        except Exception as e:
            print(f"Skipping employee due to validation error: {e}")
            
    return employees

@app.get("/api/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str):
    """Fetch a single employee by ID from Previous MongoDB."""
    db = get_previous_db()
    if db is None:
        if employee_id not in mock_employees:
            raise HTTPException(status_code=404, detail="Employee not found")
        return mock_employees[employee_id]
        
    # Strip whitespace from the requested ID just in case
    clean_id = employee_id.strip()
    
    # Try exact match first
    doc = await db.employees.find_one({"employee_id": clean_id})
    if not doc:
        doc = await db.employees.find_one({"id": clean_id})
    if not doc:
        doc = await db.employees.find_one({"_id": clean_id})
    if not doc:
        doc = await db.employees.find_one({"empId": clean_id})
    if not doc:
        doc = await db.employees.find_one({"employeeId": clean_id})
        
    # If exact match fails, try case-insensitive regex match
    if not doc:
        import re
        regex_id = re.compile(f"^{clean_id}$", re.IGNORECASE)
        doc = await db.employees.find_one({"employee_id": regex_id})
    if not doc:
        doc = await db.employees.find_one({"id": regex_id})
    if not doc:
        doc = await db.employees.find_one({"_id": regex_id})
    if not doc:
        doc = await db.employees.find_one({"empId": regex_id})
    if not doc:
        doc = await db.employees.find_one({"employeeId": regex_id})
        
    if not doc:
        # 4. Try matching _id if they passed a 24-char hex string (ObjectId)
        from bson.objectid import ObjectId
        if len(employee_id) == 24:
            try:
                doc = await db.employees.find_one({"_id": ObjectId(employee_id)})
            except Exception:
                pass
    
    if not doc:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} not found in database")
        
    doc["id"] = str(doc.get("employee_id") or doc.get("_id") or doc.get("id") or employee_id)
    
    # Fill in missing Pydantic model fields to prevent validation errors
    employee_data = {
        "id": doc["id"],
        "name": doc.get("full_name", doc.get("name", "Unknown Name")),
        "position": f"{doc.get('role', '')} {doc.get('department', '')}".strip() or doc.get("position", "Employee"),
        "email": doc.get("email", "N/A"),
        "mobileNumber": doc.get("phone", doc.get("mobileNumber", "N/A")),
        "gender": doc.get("gender", "N/A"),
        "dateOfBirth": doc.get("date_of_birth", doc.get("dateOfBirth", "N/A")),
        "joiningDate": doc.get("joining_date", doc.get("joiningDate", "N/A")),
        "address": doc.get("address", doc.get("location", "N/A")),
        "profile_picture": doc.get("profile_picture")
    }
    
    return Employee(**employee_data)

class ProfilePictureUpload(BaseModel):
    image_b64: str

@app.post("/api/employees/{employee_id}/profile-picture")
async def upload_profile_picture(employee_id: str, payload: ProfilePictureUpload):
    """Upload a new profile picture for the given employee."""
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")
        
    # Find employee to get their actual _id
    doc = await db.employees.find_one({"employee_id": employee_id})
    if not doc:
        doc = await db.employees.find_one({"id": employee_id})
    if not doc:
        doc = await db.employees.find_one({"_id": employee_id})
        
    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Update profile picture
    result = await db.employees.update_one(
        {"_id": doc["_id"]},
        {"$set": {"profile_picture": payload.image_b64}}
    )
    
    if result.modified_count == 1:
        return {"message": "Profile picture updated successfully"}
    return {"message": "Profile picture remained the same"}

@app.get("/api/employees/{employee_id}/attendance")
async def get_employee_attendance(employee_id: str):
    """Fetch real attendance records for an employee."""
    db = get_previous_db()
    if db is None:
        # Mock fallback
        return [
            {"date": "2026-07-15", "status": "Present", "checkIn": "09:00 AM", "checkOut": "05:30 PM"},
            {"date": "2026-07-14", "status": "Present", "checkIn": "08:55 AM", "checkOut": "05:40 PM"}
        ]
        
    # Look in the employee_attendance collection
    cursor = db.employee_attendance.find({"employee_id": employee_id}).sort("date", -1).limit(30)
    attendance_records = []
    
    async for att in cursor:
        check_in = att.get("login_time", "N/A")
        check_out = att.get("logout_time", "N/A")
        if check_out == "None" or not check_out:
            check_out = "N/A"
            
        attendance_records.append({
            "date": att.get("date", "N/A"),
            "status": att.get("attendance_status", "Present"),
            "checkIn": check_in,
            "checkOut": check_out
        })
        
    return attendance_records

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
