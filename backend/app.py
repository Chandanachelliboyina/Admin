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
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(
    title="BMM Admin API",
    description="Backend for BMM Admin Employee Management Portal with MongoDB",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ──────────────────────────────────────────
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
    village: Optional[str] = "N/A"
    mandal: Optional[str] = "N/A"
    district: Optional[str] = "N/A"
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

# ─── In-Memory Fallback ───────────────────────────────────────
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
        address="123 Gandhi Road, Village A, Mandal HQ",
        village="Village A",
        mandal="Mandal HQ",
    )
}

mock_notifications = []

# ─── Helper: map a MongoDB employee doc to the API schema ─────
def _map_employee(doc: dict, fallback_id: str = "") -> dict:
    emp_id = str(
        doc.get("employee_id") or
        doc.get("id") or
        doc.get("_id") or
        fallback_id or
        "Unknown"
    )
    position_str = (
        f"{doc.get('role', '')} {doc.get('department', '')}".strip()
        or doc.get("position", "Employee")
    )
    return {
        "id":             emp_id,
        "name":           doc.get("full_name", doc.get("name", "Unknown Name")),
        "position":       position_str,
        "email":          doc.get("email", "N/A"),
        "mobileNumber":   doc.get("phone", doc.get("mobileNumber", "N/A")),
        "gender":         doc.get("gender", "N/A"),
        "dateOfBirth":    doc.get("date_of_birth", doc.get("dateOfBirth", "N/A")),
        "joiningDate":    doc.get("joining_date", doc.get("joiningDate", "N/A")),
        "address":        doc.get("address", doc.get("location", "N/A")),
        "village":        doc.get("village", "N/A"),
        "mandal":         doc.get("mandal", "N/A"),
        "district":       doc.get("district", "N/A"),
        "profile_picture": doc.get("profile_photo_b64", doc.get("profile_picture")),
    }

# ─── Root ─────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"message": "Welcome to the BMM Admin FastAPI Backend!"}

# ─── Auth / OTP ───────────────────────────────────────────────
@app.post("/api/auth/send-otp")
def send_otp_email(request: OTPRequest):
    import os
    from dotenv import load_dotenv
    load_dotenv()

    sender_email = os.getenv("SMTP_SENDER_EMAIL")
    sender_password = os.getenv("SMTP_SENDER_PASSWORD")

    if not sender_email or not sender_password:
        raise HTTPException(status_code=500, detail="SMTP credentials not configured in backend")

    msg = MIMEMultipart()
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
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# ─── Employee Endpoints ───────────────────────────────────────
@app.get("/api/employees", response_model=List[Employee])
async def get_all_employees():
    """Fetch all employees from MongoDB."""
    db = get_previous_db()
    if db is None:
        return list(mock_employees.values())

    employees = []
    cursor = db.employees.find({})
    async for doc in cursor:
        try:
            employees.append(Employee(**_map_employee(doc)))
        except Exception as e:
            print(f"Skipping employee due to validation error: {e}")

    return employees


@app.get("/api/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str):
    """Fetch a single employee by ID from MongoDB."""
    db = get_previous_db()
    if db is None:
        if employee_id not in mock_employees:
            raise HTTPException(status_code=404, detail="Employee not found")
        return mock_employees[employee_id]

    clean_id = employee_id.strip()
    doc = None

    # Try all possible ID field names
    for field in ("employee_id", "id", "empId", "employeeId"):
        doc = await db.employees.find_one({field: clean_id})
        if doc:
            break

    # Case-insensitive fallback
    if not doc:
        import re
        regex_id = re.compile(f"^{re.escape(clean_id)}$", re.IGNORECASE)
        for field in ("employee_id", "id", "empId", "employeeId"):
            doc = await db.employees.find_one({field: regex_id})
            if doc:
                break

    # ObjectId fallback
    if not doc and len(employee_id) == 24:
        from bson.objectid import ObjectId
        try:
            doc = await db.employees.find_one({"_id": ObjectId(employee_id)})
        except Exception:
            pass

    if not doc:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} not found in database")

    return Employee(**_map_employee(doc, fallback_id=employee_id))


class ProfilePictureUpload(BaseModel):
    image_b64: str

@app.post("/api/employees/{employee_id}/profile-picture")
async def upload_profile_picture(employee_id: str, payload: ProfilePictureUpload):
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")

    doc = None
    for field in ("employee_id", "id", "_id"):
        doc = await db.employees.find_one({field: employee_id})
        if doc:
            break

    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")

    result = await db.employees.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "profile_picture":   payload.image_b64,
            "profile_photo_b64": payload.image_b64
        }}
    )
    if result.modified_count == 1:
        return {"message": "Profile picture updated successfully"}
    return {"message": "Profile picture remained the same"}


# ─── Attendance ───────────────────────────────────────────────
@app.get("/api/employees/{employee_id}/attendance")
async def get_employee_attendance(employee_id: str):
    """Fetch attendance records from the 'attendance' collection."""
    db = get_previous_db()
    if db is None:
        return [
            {"date": "2026-07-15", "status": "Present", "checkIn": "09:00 AM", "checkOut": "05:30 PM", "hrs": "8.5 hrs", "start": "Office", "end": "Field"},
            {"date": "2026-07-14", "status": "Present", "checkIn": "08:55 AM", "checkOut": "05:40 PM", "hrs": "8.7 hrs", "start": "Office", "end": "Field"},
        ]

    # FIX: use 'attendance' collection (not 'employee_attendance')
    cursor = db.attendance.find({"employee_id": employee_id}).sort("date", -1).limit(90)
    records = []
    async for att in cursor:
        check_out = att.get("logout_time")
        if not check_out or str(check_out).lower() == "none":
            check_out = "N/A"
        records.append({
            "date":     att.get("login_date", att.get("date", "N/A")),
            "status":   att.get("attendance_status", "Present"),
            "checkIn":  att.get("login_time", "N/A"),
            "checkOut": check_out,
            "hrs":      att.get("hrs", "N/A"),
            "start":    att.get("full_address", att.get("start", "N/A")),
            "end":      att.get("logout_full_address", att.get("end", "N/A")),
        })
    return records


# ─── Daily Updates ────────────────────────────────────────────
@app.get("/api/employees/{employee_id}/updates")
async def get_employee_updates(employee_id: str):
    db = get_previous_db()
    if db is None:
        return []
    cursor = db.daily_updates.find(
        {"$or": [{"employee_id": employee_id}, {"id": employee_id}]}
    ).sort("created_at", -1)
    updates = []
    async for doc in cursor:
        created = doc.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d") if isinstance(created, datetime) else str(created)[:10]
        updates.append({
            "id":          str(doc["_id"]),
            "date":        date_str,
            "description": doc.get("notes", ""),
            "imageUrl":    (doc.get("images") or [""])[0] if doc.get("images") else "",
        })
    return updates


# ─── Activities ───────────────────────────────────────────────
@app.get("/api/employees/{employee_id}/activities")
async def get_employee_activities(employee_id: str):
    db = get_previous_db()
    if db is None:
        return []
    cursor = db.activities.find(
        {"$or": [{"employee_id": employee_id}, {"id": employee_id}]}
    ).sort("created_at", -1)
    activities = []
    async for doc in cursor:
        created = doc.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d") if isinstance(created, datetime) else str(created)[:10]
        activities.append({
            "id":          str(doc["_id"]),
            "date":        date_str,
            "title":       doc.get("title", ""),
            "description": doc.get("description", doc.get("notes", "")),
        })
    return activities


# ─── Leaves ───────────────────────────────────────────────────
@app.get("/api/employees/{employee_id}/leaves")
async def get_employee_leaves(employee_id: str):
    db = get_previous_db()
    if db is None:
        return []
    cursor = db.leaves.find(
        {"$or": [{"employee_id": employee_id}, {"id": employee_id}]}
    ).sort("created_at", -1)
    leaves = []
    async for doc in cursor:
        created = doc.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d") if isinstance(created, datetime) else str(created)[:10]
        leaves.append({
            "id":        str(doc["_id"]),
            "type":      doc.get("leave_type", "Leave"),
            "startDate": str(doc.get("start_date", doc.get("leave_date", date_str)))[:10],
            "endDate":   str(doc.get("end_date",   doc.get("leave_date", date_str)))[:10],
            "reason":    doc.get("reason", ""),
            "status":    doc.get("status", "Pending"),
        })
    return leaves


# ─── Notifications ────────────────────────────────────────────
@app.get("/api/notifications", response_model=List[Notification])
def get_notifications(include_deleted: bool = False):
    if include_deleted:
        return mock_notifications
    return [n for n in mock_notifications if not n.isDeleted]

@app.post("/api/notifications", response_model=Notification)
def create_notification(notif: NotificationBase):
    new_notif = Notification(
        id=str(len(mock_notifications) + 1),
        title=notif.title,
        message=notif.message,
        date=datetime.now().strftime("%b %d, %Y, %I:%M %p"),
        isDeleted=False
    )
    mock_notifications.insert(0, new_notif)
    return new_notif

@app.delete("/api/notifications/{notif_id}")
def delete_notification(notif_id: str):
    for n in mock_notifications:
        if n.id == notif_id:
            n.isDeleted = True
            return {"message": "Notification soft-deleted"}
    raise HTTPException(status_code=404, detail="Notification not found")

@app.post("/api/notifications/{notif_id}/undo")
def undo_delete_notification(notif_id: str):
    for n in mock_notifications:
        if n.id == notif_id:
            n.isDeleted = False
            return {"message": "Notification restored"}
    raise HTTPException(status_code=404, detail="Notification not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
