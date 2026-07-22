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
        f"{doc.get('role') or ''} {doc.get('department') or ''}".strip()
        or doc.get("position") or "Employee"
    )
    return {
        "id":             emp_id,
        "name":           doc.get("full_name") or doc.get("name") or "Unknown Name",
        "position":       position_str,
        "email":          doc.get("email") or "N/A",
        "mobileNumber":   doc.get("phone") or doc.get("mobileNumber") or "N/A",
        "gender":         doc.get("gender") or "N/A",
        "dateOfBirth":    doc.get("date_of_birth") or doc.get("dateOfBirth") or "N/A",
        "joiningDate":    doc.get("joining_date") or doc.get("joiningDate") or "N/A",
        "address":        doc.get("address") or doc.get("location") or "N/A",
        "village":        doc.get("village") or "N/A",
        "mandal":         doc.get("mandal") or "N/A",
        "district":       doc.get("district") or "N/A",
        "profile_picture": doc.get("profile_photo_b64") or doc.get("profile_picture"),
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


@app.post("/api/employees")
async def create_employee(employee: Employee):
    db = get_previous_db()
    if db is None:
        mock_employees[employee.id] = employee
        return {"message": "Employee added successfully (mock)", "id": employee.id}
        
    doc = employee.model_dump()
    doc["employee_id"] = doc.pop("id", "")
    doc["full_name"] = doc.pop("name", "")
    doc["role"] = doc.pop("position", "")
    doc["phone"] = doc.pop("mobileNumber", "")
    doc["date_of_birth"] = doc.pop("dateOfBirth", "")
    doc["joining_date"] = doc.pop("joiningDate", "")
    
    await db.employees.insert_one(doc)
    return {"message": "Employee added successfully", "id": employee.id}


@app.put("/api/employees/{employee_id}")
async def update_employee(employee_id: str, employee: Employee):
    db = get_previous_db()
    if db is None:
        if employee_id in mock_employees:
            mock_employees[employee_id] = employee
            return {"message": "Employee updated successfully (mock)"}
        raise HTTPException(status_code=404, detail="Employee not found")

    doc = employee.model_dump()
    doc["employee_id"] = doc.pop("id", "")
    doc["full_name"] = doc.pop("name", "")
    doc["role"] = doc.pop("position", "")
    doc["phone"] = doc.pop("mobileNumber", "")
    doc["date_of_birth"] = doc.pop("dateOfBirth", "")
    doc["joining_date"] = doc.pop("joiningDate", "")

    result = await db.employees.update_one(
        {"$or": [{"employee_id": employee_id}, {"id": employee_id}]},
        {"$set": doc}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee updated successfully"}


@app.delete("/api/employees/{employee_id}")
async def delete_employee(employee_id: str):
    db = get_previous_db()
    if db is None:
        if employee_id in mock_employees:
            del mock_employees[employee_id]
            return {"message": "Employee deleted successfully (mock)"}
        raise HTTPException(status_code=404, detail="Employee not found")

    result = await db.employees.delete_one(
        {"$or": [{"employee_id": employee_id}, {"id": employee_id}]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted successfully"}


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

    import re
    regex_id = re.compile(f"^{re.escape(employee_id)}$", re.IGNORECASE)
    cursor = db.attendance.find({"$or": [{"employee_id": regex_id}, {"empId": regex_id}]}).sort("date", -1).limit(90)
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
    import re
    regex_id = re.compile(f"^{re.escape(employee_id)}$", re.IGNORECASE)
    cursor = db.daily_updates.find(
        {"$or": [{"employee_id": regex_id}, {"id": regex_id}, {"empId": regex_id}]}
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
    import re
    regex_id = re.compile(f"^{re.escape(employee_id)}", re.IGNORECASE)
    cursor = db.activities.find(
        {"$or": [{"employee_id": regex_id}, {"id": regex_id}, {"empId": regex_id}, {"action": regex_id}]}
    ).sort("created_at", -1)
    activities = []
    async for doc in cursor:
        created = doc.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d") if isinstance(created, datetime) else str(created)[:10]
        activities.append({
            "id":          str(doc["_id"]),
            "date":        date_str or str(doc.get("time", ""))[:10],
            "title":       doc.get("title", doc.get("type", "Activity").capitalize()),
            "description": doc.get("description", doc.get("notes", doc.get("action", ""))),
        })
    return activities


# ─── Leaves ───────────────────────────────────────────────────
@app.get("/api/employees/{employee_id}/leaves")
async def get_employee_leaves(employee_id: str):
    db = get_previous_db()
    if db is None:
        return []
    import re
    regex_id = re.compile(f"^{re.escape(employee_id)}$", re.IGNORECASE)
    cursor = db.leaves.find(
        {"$or": [{"employee_id": regex_id}, {"id": regex_id}]}
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


# ─── Global Attendance ──────────────────────────────────────────
@app.get("/api/attendance")
async def get_all_attendance():
    """Fetch all attendance records for all employees."""
    db = get_previous_db()
    if db is None:
        return []

    cursor = db.attendance.find({}).sort("date", -1).limit(200)
    records = []
    async for att in cursor:
        check_out = att.get("logout_time")
        if not check_out or str(check_out).lower() == "none":
            check_out = "N/A"
            
        emp_id = att.get("employee_id", "Unknown")
        emp_name = att.get("employee_name", att.get("full_name", "Unknown"))
        
        # fallback to fetch employee name if not present in attendance doc
        if emp_name == "Unknown":
            emp_doc = await db.employees.find_one({"$or": [{"employee_id": emp_id}, {"id": emp_id}]})
            if emp_doc:
                emp_name = emp_doc.get("full_name", emp_doc.get("name", "Unknown"))
                
        records.append({
            "id":       str(att.get("_id", "")),
            "empId":    emp_id,
            "empName":  emp_name,
            "date":     att.get("login_date", att.get("date", "N/A")),
            "status":   att.get("attendance_status", "Present"),
            "checkIn":  att.get("login_time", "N/A"),
            "checkOut": check_out,
            "hrs":      att.get("hrs", "N/A"),
            "startLoc": att.get("full_address", att.get("start", "N/A")),
            "endLoc":   att.get("logout_full_address", att.get("end", "N/A")),
            "selfie":   att.get("login_selfie", ""),
            "loginLoc": {
                "lat": att.get("login_lat"),
                "lng": att.get("login_lng"),
                "address": att.get("full_address")
            } if att.get("login_lat") else None,
            "logoutLoc": {
                "lat": att.get("logout_lat"),
                "lng": att.get("logout_lng"),
                "address": att.get("logout_full_address")
            } if att.get("logout_lat") else None,
        })
    return records


# ─── Global Activities ────────────────────────────────────────
@app.get("/api/activities")
async def get_all_activities():
    """Fetch recent activities (from attendance and activities collections)."""
    db = get_previous_db()
    if db is None:
        return []
    
    logs = []
    
    # Get recent attendance check-ins
    att_cursor = db.attendance.find({}).sort("login_date", -1).limit(20)
    async for att in att_cursor:
        emp_id = att.get("employee_id", "Unknown")
        time_str = att.get("login_time", "N/A")
        date_str = att.get("login_date", "N/A")
        logs.append({
            "action": f"{emp_id} checked in",
            "time": f"{date_str} {time_str}",
            "type": "attendance"
        })
        if att.get("logout_time") and str(att.get("logout_time")).lower() != "none":
            logs.append({
                "action": f"{emp_id} checked out",
                "time": f"{date_str} {att.get('logout_time')}",
                "type": "attendance"
            })
            
    # Get recent general activities
    act_cursor = db.activities.find({}).sort("created_at", -1).limit(20)
    async for act in act_cursor:
        created = act.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created)[:16]
        emp_id = act.get("employee_id", "Unknown")
        title = act.get("title", "Updated Activity")
        logs.append({
            "action": f"{emp_id} - {title}",
            "time": date_str,
            "type": "system"
        })
        
    # Get recent leaves
    leaves_cursor = db.leaves.find({}).sort("created_at", -1).limit(20)
    async for lv in leaves_cursor:
        created = lv.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created)[:16]
        emp_id = lv.get("employee_id", "Unknown")
        type_str = lv.get("leave_type", "Leave")
        status = lv.get("status", "Pending")
        logs.append({
            "action": f"{emp_id} applied for {type_str} ({status})",
            "time": date_str,
            "type": "leave"
        })
        
    # Get recent updates
    updates_cursor = db.daily_updates.find({}).sort("created_at", -1).limit(20)
    async for upd in updates_cursor:
        created = upd.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created)[:16]
        emp_id = upd.get("employee_id", "Unknown")
        logs.append({
            "action": f"{emp_id} posted a daily update",
            "time": date_str,
            "type": "update"
        })
        
    # Sort logs by time descending (simple string sort for now)
    logs.sort(key=lambda x: x["time"], reverse=True)
    return logs[:50]

# ─── Dashboard Stats ──────────────────────────────────────────
@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    db = get_previous_db()
    if db is None:
        return {
            "totalEmployees": len(mock_employees),
            "presentToday": 0,
            "activeLocations": 1
        }
        
    total_employees = await db.employees.count_documents({})
    
    today_str = datetime.now().strftime("%Y-%m-%d")
    present_today = len(await db.attendance.distinct("employee_id", {"login_date": today_str}))
    if present_today == 0:
        present_today = len(await db.attendance.distinct("employee_id", {"date": today_str}))
        
    locations = await db.employees.distinct("mandal")
    active_locations = len([loc for loc in locations if loc and loc != "N/A"])
    
    return {
        "totalEmployees": total_employees,
        "presentToday": present_today,
        "activeLocations": active_locations if active_locations > 0 else 1
    }


# ─── Global Leaves ────────────────────────────────────────────
@app.get("/api/leaves")
async def get_all_leaves():
    """Fetch all leave requests for all employees."""
    db = get_previous_db()
    if db is None:
        return []
        
    cursor = db.leaves.find({}).sort("created_at", -1).limit(200)
    leaves = []
    async for doc in cursor:
        created = doc.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d") if isinstance(created, datetime) else str(created)[:10]
        
        emp_id = doc.get("employee_id", "Unknown")
        emp_name = "Unknown"
        
        # Try fetching employee name
        emp_doc = await db.employees.find_one({"$or": [{"employee_id": emp_id}, {"id": emp_id}]})
        if emp_doc:
            emp_name = emp_doc.get("full_name", emp_doc.get("name", "Unknown"))
            
        leaves.append({
            "id":           str(doc["_id"]),
            "employeeName": emp_name,
            "employeeId":   emp_id,
            "type":         doc.get("leave_type", "Leave"),
            "startDate":    str(doc.get("start_date", doc.get("leave_date", date_str)))[:10],
            "endDate":      str(doc.get("end_date",   doc.get("leave_date", date_str)))[:10],
            "reason":       doc.get("reason", ""),
            "status":       doc.get("status", "Pending"),
        })
    return leaves


# ─── Work Information ─────────────────────────────────────────
class WorkInfo(BaseModel):
    head: str = ""
    donorName: str = ""
    department: str = ""
    targetVillages: str = ""
    targetMandal: str = ""
    targets: str = ""

@app.get("/api/employees/{employee_id}/work-info")
async def get_work_info(employee_id: str):
    db = get_previous_db()
    if db is None: return {}
    doc = await db.work_info.find_one({"employee_id": employee_id}, {"_id": 0})
    return doc if doc else {}

@app.put("/api/employees/{employee_id}/work-info")
async def update_work_info(employee_id: str, info: WorkInfo):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    await db.work_info.update_one(
        {"employee_id": employee_id},
        {"$set": info.model_dump()},
        upsert=True
    )
    return {"message": "Work info updated"}

# ─── Leave Balances ───────────────────────────────────────────
class LeaveBalances(BaseModel):
    casualTotal: int
    casualTaken: int
    casualRemaining: int
    sickTotal: int
    sickTaken: int
    sickRemaining: int

def calculate_prorated_leaves(joining_date_str: str) -> int:
    try:
        joining_date = datetime.strptime(joining_date_str, "%Y-%m-%d")
        month = joining_date.month
        # Financial year: April (4) to March (3)
        if month >= 4:
            months_remaining = 12 - month + 4
        else:
            months_remaining = 4 - month
        return months_remaining
    except Exception:
        return 12

@app.get("/api/employees/{employee_id}/leave-balances")
async def get_leave_balances(employee_id: str):
    db = get_previous_db()
    if db is None: return {"casualTotal": 12, "casualTaken": 0, "casualRemaining": 12, "sickTotal": 12, "sickTaken": 0, "sickRemaining": 12}
    doc = await db.leave_balances.find_one({"employee_id": employee_id}, {"_id": 0})
    if doc:
        return doc
    
    # Calculate default based on joining date
    emp_doc = await db.employees.find_one({"$or": [{"employee_id": employee_id}, {"id": employee_id}]})
    default_leaves = 12
    if emp_doc and emp_doc.get("joining_date") and emp_doc.get("joining_date") != "N/A":
        default_leaves = calculate_prorated_leaves(emp_doc["joining_date"])
    
    default_doc = {
        "employee_id": employee_id,
        "casualTotal": default_leaves,
        "casualTaken": 0,
        "casualRemaining": default_leaves,
        "sickTotal": default_leaves,
        "sickTaken": 0,
        "sickRemaining": default_leaves
    }
    await db.leave_balances.insert_one(default_doc.copy())
    default_doc.pop("_id", None)
    return default_doc

@app.put("/api/employees/{employee_id}/leave-balances")
async def update_leave_balances(employee_id: str, balances: LeaveBalances):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    await db.leave_balances.update_one(
        {"employee_id": employee_id},
        {"$set": balances.model_dump()},
        upsert=True
    )
    return {"message": "Leave balances updated"}

class LeaveStatusUpdate(BaseModel):
    status: str

@app.put("/api/leaves/{leave_id}/status")
async def update_leave_status(leave_id: str, status_update: LeaveStatusUpdate):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.leaves.update_one(
        {"_id": ObjectId(leave_id)},
        {"$set": {"status": status_update.status}}
    )
    return {"message": "Leave status updated"}

# ─── Daily Updates & Activities Mutations ─────────────────────
class DailyUpdateCreate(BaseModel):
    description: str
    imageUrl: str = ""

class DailyUpdateEdit(BaseModel):
    description: str

@app.post("/api/employees/{employee_id}/updates")
async def create_daily_update(employee_id: str, update: DailyUpdateCreate):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    doc = {
        "employee_id": employee_id,
        "notes": update.description,
        "images": [update.imageUrl] if update.imageUrl else [],
        "created_at": datetime.now()
    }
    await db.daily_updates.insert_one(doc)
    return {"message": "Update created"}

@app.delete("/api/employees/{employee_id}/updates/{update_id}")
async def delete_daily_update(employee_id: str, update_id: str):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.daily_updates.delete_one({"_id": ObjectId(update_id)})
    return {"message": "Update deleted"}

@app.put("/api/employees/{employee_id}/updates/{update_id}")
async def edit_daily_update(employee_id: str, update_id: str, update: DailyUpdateEdit):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.daily_updates.update_one(
        {"_id": ObjectId(update_id)},
        {"$set": {"notes": update.description}}
    )
    return {"message": "Update edited"}

class ActivityEdit(BaseModel):
    description: str

@app.delete("/api/employees/{employee_id}/activities/{activity_id}")
async def delete_activity(employee_id: str, activity_id: str):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.activities.delete_one({"_id": ObjectId(activity_id)})
    return {"message": "Activity deleted"}

@app.put("/api/employees/{employee_id}/activities/{activity_id}")
async def edit_activity(employee_id: str, activity_id: str, activity: ActivityEdit):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.activities.update_one(
        {"_id": ObjectId(activity_id)},
        {"$set": {"description": activity.description, "notes": activity.description}}
    )
    return {"message": "Activity edited"}


# ─── Notifications ────────────────────────────────────────────
@app.get("/api/notifications")
async def get_notifications(include_deleted: bool = False):
    db = get_previous_db()
    if db is None: return []
    query = {} if include_deleted else {"isDeleted": {"$ne": True}}
    cursor = db.notifications.find(query).sort("created_at", -1)
    notifs = []
    async for doc in cursor:
        created = doc.get("created_at", datetime.now())
        notifs.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "message": doc.get("message", ""),
            "date": created.strftime("%b %d, %Y, %I:%M %p") if isinstance(created, datetime) else str(created)[:16],
            "isDeleted": doc.get("isDeleted", False)
        })
    return notifs

@app.post("/api/notifications")
async def create_notification(notif: NotificationBase):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    doc = {
        "title": notif.title,
        "message": notif.message,
        "created_at": datetime.now(),
        "isDeleted": False
    }
    result = await db.notifications.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["date"] = doc["created_at"].strftime("%b %d, %Y, %I:%M %p")
    return doc

@app.put("/api/notifications/{notif_id}")
async def update_notification(notif_id: str, notif: NotificationBase):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.notifications.update_one(
        {"_id": ObjectId(notif_id)},
        {"$set": {"title": notif.title, "message": notif.message}}
    )
    return {"message": "Notification updated"}

@app.delete("/api/notifications/{notif_id}")
async def delete_notification(notif_id: str):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.notifications.update_one({"_id": ObjectId(notif_id)}, {"$set": {"isDeleted": True}})
    return {"message": "Notification soft-deleted"}

@app.post("/api/notifications/{notif_id}/undo")
async def undo_delete_notification(notif_id: str):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.notifications.update_one({"_id": ObjectId(notif_id)}, {"$set": {"isDeleted": False}})
    return {"message": "Notification restored"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8080, reload=True)
