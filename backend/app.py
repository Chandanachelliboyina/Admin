from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from contextlib import asynccontextmanager
import pymongo

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
    has_access: Optional[bool] = True
    password: Optional[str] = None

class NotificationBase(BaseModel):
    title: str
    message: str
    target_type: str = "all"  # "all" or "individual"
    employee_id: Optional[str] = None

class Notification(NotificationBase):
    id: str
    date: str
    isDeleted: bool = False

class OTPRequest(BaseModel):
    name: str
    email: str
    otp: str

class AdminSendOTPRequest(BaseModel):
    email: str

class AdminResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

class HolidayBase(BaseModel):
    name: str
    from_date: str
    to_date: str
    type: str

class Holiday(HolidayBase):
    id: str
    created_at: str

# ─── In-Memory Fallback ───────────────────────────────────────


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
        "mobileNumber":   doc.get("mobile_number") or doc.get("phone") or doc.get("mobileNumber") or "N/A",
        "gender":         doc.get("gender") or "N/A",
        "dateOfBirth":    doc.get("date_of_birth") or doc.get("dateOfBirth") or "N/A",
        "joiningDate":    doc.get("joining_date") or doc.get("joiningDate") or "N/A",
        "address":        doc.get("office_location") or doc.get("address") or doc.get("location") or "N/A",
        "village":        doc.get("village") or "N/A",
        "mandal":         doc.get("mandal") or "N/A",
        "district":       doc.get("district") or "N/A",
        "profile_picture": doc.get("profile_photo_b64") or doc.get("profile_picture"),
        "has_access":     doc.get("has_access", True),
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
    
    print(f"DEBUG: Generated OTP for {request.email} is {request.otp}")

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


admin_otps_store = {}

@app.post("/api/auth/admin-forgot-password/send-otp")
async def send_admin_reset_otp(request: AdminSendOTPRequest):
    import random, os
    from datetime import datetime, timedelta, timezone
    from dotenv import load_dotenv
    load_dotenv()

    email_clean = request.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address provided.")

    ALLOWED_ADMIN_EMAILS = ["chanduchelliboyina3@gmail.com", "bbmmwdo.org@gmail.com"]
    if email_clean not in ALLOWED_ADMIN_EMAILS:
        raise HTTPException(
            status_code=403,
            detail="Unauthorized: Only authorized admin emails (chanduchelliboyina3@gmail.com, bbmmwdo.org@gmail.com) can request a password reset."
        )

    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    admin_otps_store[email_clean] = {
        "otp": otp_code,
        "expires_at": expires_at
    }

    db = get_db()
    if db is not None:
        try:
            await db.admin_otps.update_one(
                {"email": email_clean},
                {"$set": {"otp": otp_code, "expires_at": expires_at, "created_at": datetime.now(timezone.utc)}},
                upsert=True
            )
        except Exception as e:
            print(f"MongoDB OTP save error: {e}")

    sender_email = os.getenv("SMTP_SENDER_EMAIL")
    sender_password = os.getenv("SMTP_SENDER_PASSWORD")

    smtp_sent = False
    if sender_email and sender_password:
        try:
            msg = MIMEMultipart()
            msg['From'] = f"BMM Admin Portal <{sender_email}>"
            msg['To'] = email_clean
            msg['Subject'] = "BMM Admin - Password Reset OTP"

            body = f"""Hello Admin,

We received a request to reset your password for the BMM Admin Portal ({email_clean}).
Your 6-digit OTP code is: {otp_code}

This code will expire in 10 minutes. If you did not request this password reset, please ignore this email.

Best regards,
BMM System Administrator
"""
            msg.attach(MIMEText(body, 'plain'))
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
            server.quit()
            smtp_sent = True
        except Exception as e:
            print(f"SMTP Error: {str(e)}")

    print(f"DEBUG: Admin Reset OTP generated for {email_clean}: {otp_code} (SMTP Sent: {smtp_sent})")

    return {
        "success": True,
        "message": f"OTP sent to {email_clean}",
        "otp": otp_code,
        "smtp_sent": smtp_sent
    }


@app.post("/api/auth/admin-forgot-password/reset")
async def reset_admin_password(request: AdminResetPasswordRequest):
    from datetime import datetime, timezone
    email_clean = request.email.strip().lower()
    otp_code = request.otp.strip()
    new_password = request.new_password.strip()

    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    record = admin_otps_store.get(email_clean)
    db = get_db()
    
    if not record and db is not None:
        try:
            db_doc = await db.admin_otps.find_one({"email": email_clean})
            if db_doc:
                record = {
                    "otp": db_doc.get("otp"),
                    "expires_at": db_doc.get("expires_at")
                }
        except Exception as e:
            print(f"MongoDB OTP lookup error: {e}")

    if not record:
        raise HTTPException(status_code=400, detail="No OTP requested for this email or OTP has expired.")

    if record["otp"] != otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please try again.")

    exp = record.get("expires_at")
    if exp:
        now = datetime.now(timezone.utc)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now > exp:
            raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")

    if db is not None:
        try:
            await db.admins.update_one(
                {"email": email_clean},
                {"$set": {"password": new_password, "updated_at": datetime.now(timezone.utc)}},
                upsert=True
            )
        except Exception as e:
            print(f"MongoDB admin password update error: {e}")

    prev_db = get_previous_db()
    if prev_db is not None:
        try:
            await prev_db.employees.update_many(
                {"email": email_clean},
                {"$set": {"password": new_password}}
            )
        except Exception as e:
            print(f"Previous DB employee password update error: {e}")

    if email_clean in admin_otps_store:
        del admin_otps_store[email_clean]
    if db is not None:
        try:
            await db.admin_otps.delete_one({"email": email_clean})
        except Exception as e:
            pass

    return {
        "success": True,
        "message": "Admin password reset successfully."
    }


# ─── Employee Endpoints ───────────────────────────────────────
@app.get("/api/employees", response_model=List[Employee])
async def get_all_employees():
    """Fetch all employees from MongoDB."""
    db = get_previous_db()
    if db is None:
        return []

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
        raise HTTPException(status_code=500, detail="Database connection not active")

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
        raise HTTPException(status_code=500, detail="Database connection not active")
        
    doc = employee.model_dump()
    doc["employee_id"] = doc.pop("id", "")
    doc["full_name"] = doc.pop("name", "")
    doc["role"] = doc.pop("position", "")
    doc["phone"] = doc.pop("mobileNumber", "")
    doc["date_of_birth"] = doc.pop("dateOfBirth", "")
    doc["joining_date"] = doc.pop("joiningDate", "")
    try:
        await db.employees.insert_one(doc)
    except pymongo.errors.DuplicateKeyError:
        raise HTTPException(status_code=400, detail=f"Employee ID '{employee.id}' already exists")
        
    return {"message": "Employee added successfully", "id": employee.id}


@app.put("/api/employees/{employee_id}")
async def update_employee(employee_id: str, employee: Employee):
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")

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

@app.put("/api/employees/{employee_id}/allow-late-signin")
async def toggle_late_signin(employee_id: str, request: Request):
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")
        
    try:
        payload = await request.json()
    except Exception:
        payload = {}
        
    allowed_until = payload.get("allowed_until", "10:30")
    
    clean_id = employee_id.strip()
    doc = None
    for field in ("employee_id", "id", "empId", "employeeId"):
        doc = await db.employees.find_one({field: clean_id})
        if doc:
            break
            
    if not doc:
        try:
            from bson import ObjectId
            doc = await db.employees.find_one({"_id": ObjectId(clean_id)})
        except Exception:
            pass
            
    if not doc:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    await db.employees.update_one(
        {"_id": doc["_id"]},
        {"$set": {"allow_late_signin": allowed_until}}
    )
        
    return {"message": f"Late sign-in access granted for today until {allowed_until}"}

class AccessToggle(BaseModel):
    has_access: bool

@app.put("/api/employees/{employee_id}/access")
async def toggle_employee_access(employee_id: str, access_data: AccessToggle):
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")
    
    result = await db.employees.update_one(
        {"$or": [{"employee_id": employee_id}, {"id": employee_id}]},
        {"$set": {"has_access": access_data.has_access}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": f"Employee access updated to {access_data.has_access}"}


@app.delete("/api/employees/{employee_id}")
async def delete_employee(employee_id: str):
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")

    query = {"$or": [{"employee_id": employee_id}, {"id": employee_id}]}
    
    result = await db.employees.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")

    clean_id = employee_id.strip()
    id_query = {"$or": [{"employee_id": clean_id}, {"id": clean_id}]}
    
    await db.attendance.delete_many(id_query)
    await db.activities.delete_many(id_query)
    await db.leaves.delete_many(id_query)
    await db.work_updates.delete_many(id_query)
    await db.work_info.delete_many(id_query)
    await db.leave_balances.delete_many(id_query)
    await db.notifications.delete_many(id_query)

    return {"message": "Employee and all associated data deleted successfully"}


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
from datetime import timezone, timedelta

def parse_time_and_calc_hrs(login_str, logout_str):
    check_in_time = "N/A"
    check_out_time = "N/A"
    hrs_worked = "N/A"
    fmt = "%I:%M %p"
    dt_in = None
    dt_out = None
    
    # IST is UTC+5:30
    ist_tz = timezone(timedelta(hours=5, minutes=30))

    try:
        if login_str and str(login_str).lower() != "none" and login_str != "N/A":
            dt_in = datetime.fromisoformat(str(login_str).replace('Z', '+00:00'))
            check_in_time = dt_in.astimezone(ist_tz).strftime(fmt)
    except:
        check_in_time = str(login_str)

    try:
        if logout_str and str(logout_str).lower() != "none" and logout_str != "N/A":
            dt_out = datetime.fromisoformat(str(logout_str).replace('Z', '+00:00'))
            check_out_time = dt_out.astimezone(ist_tz).strftime(fmt)
    except:
        check_out_time = str(logout_str)

    if dt_in and dt_out:
        # Calculate exact duration
        diff = dt_out - dt_in
        total_seconds = diff.total_seconds()
        
        # Format as Xh Ym
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        hrs_worked = f"{hours}h {minutes}m"

    return check_in_time, check_out_time, hrs_worked


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
        login_val = att.get("login_time", "N/A")
        logout_val = att.get("logout_time", "N/A")
        
        check_in_time, check_out_time, hrs_worked = parse_time_and_calc_hrs(login_val, logout_val)
        
        # fallback to db hrs if we couldn't calculate it
        if hrs_worked == "N/A":
            hrs_worked = att.get("hrs", "N/A")
            
        # Holiday override check for single employee attendance
        today_str = att.get("login_date", att.get("date", "N/A"))
        is_holiday = False
        if today_str != "N/A":
            main_db = get_previous_db()
            if main_db is not None:
                holiday = await main_db.holidays.find_one({
                    "from_date": {"$lte": today_str},
                    "to_date": {"$gte": today_str}
                })
                if holiday:
                    is_holiday = True

        if is_holiday:
            status_val = "Holiday"
        elif check_in_time != "N/A" and check_out_time != "N/A":
            status_val = "Present"
        elif check_in_time != "N/A" and check_out_time == "N/A":
            status_val = "Check-in (Absent)"
        elif check_in_time == "N/A" and check_out_time != "N/A":
            status_val = "Check-out (Absent)"
        else:
            status_val = "Absent"

        records.append({
            "date":     att.get("login_date", att.get("date", "N/A")),
            "status":   status_val,
            "checkIn":  check_in_time,
            "checkOut": check_out_time,
            "hrs":      hrs_worked,
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

    # Fetch employee default location/mandal/village/address if doc location is empty
    emp_doc = await db.employees.find_one(
        {"$or": [{"employee_id": regex_id}, {"id": regex_id}, {"empId": regex_id}]}
    )
    emp_default_loc = ""
    if emp_doc:
        emp_default_loc = (
            emp_doc.get("office_location") or 
            emp_doc.get("mandal") or 
            emp_doc.get("village") or 
            emp_doc.get("address") or ""
        )

    cursor = db.daily_updates.find(
        {"$or": [{"employee_id": regex_id}, {"id": regex_id}, {"empId": regex_id}]}
    ).sort("created_at", -1)
    updates = []
    from datetime import timezone, timedelta
    ist = timezone(timedelta(hours=5, minutes=30))

    async for doc in cursor:
        created = doc.get("created_at") or doc.get("timestamp")
        doc_time = doc.get("time") or doc.get("time_str")
        doc_date = doc.get("date") or doc.get("date_str")

        parsed_dt = None
        if created:
            if isinstance(created, datetime):
                parsed_dt = created
            elif isinstance(created, str) and created.strip():
                clean_c = created.strip().replace("Z", "+00:00")
                for fmt in (
                    "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z",
                    "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
                    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"
                ):
                    try:
                        parsed_dt = datetime.strptime(clean_c, fmt)
                        break
                    except Exception:
                        pass

        if parsed_dt:
            if parsed_dt.tzinfo is None:
                parsed_dt = parsed_dt.replace(tzinfo=timezone.utc).astimezone(ist)
            else:
                parsed_dt = parsed_dt.astimezone(ist)
            date_str = parsed_dt.strftime("%d/%m/%Y")
            time_str = parsed_dt.strftime("%I:%M:%S %p")
        elif doc_time and str(doc_time).strip():
            raw_t = str(doc_time).strip()
            t_parsed = None
            for fmt in ("%I:%M:%S %p", "%I:%M %p", "%H:%M:%S", "%H:%M"):
                try:
                    t_parsed = datetime.strptime(raw_t, fmt)
                    break
                except Exception:
                    pass
            if t_parsed:
                now_utc = datetime.now(timezone.utc)
                dt_utc = datetime(now_utc.year, now_utc.month, now_utc.day, t_parsed.hour, t_parsed.minute, t_parsed.second, tzinfo=timezone.utc)
                dt_ist = dt_utc.astimezone(ist)
                date_str = str(doc_date) if doc_date else dt_ist.strftime("%d/%m/%Y")
                time_str = dt_ist.strftime("%I:%M:%S %p")
            else:
                date_str = str(doc_date) if doc_date else datetime.now(ist).strftime("%d/%m/%Y")
                time_str = raw_t
        else:
            now_ist = datetime.now(ist)
            date_str = str(doc_date) if doc_date else now_ist.strftime("%d/%m/%Y")
            time_str = now_ist.strftime("%I:%M:%S %p")

        lat = doc.get("latitude") or doc.get("lat")
        lng = doc.get("longitude") or doc.get("lng")

        location = ""
        if lat and lng:
            location = f"Lat: {lat}, Lng: {lng}"
        else:
            loc_val = (
                doc.get("location") or 
                doc.get("location_name") or 
                doc.get("address") or 
                doc.get("place") or 
                doc.get("loc") or 
                emp_default_loc
            )
            if loc_val:
                location = str(loc_val)

        description = (
            doc.get("notes") or 
            doc.get("description") or 
            doc.get("update") or 
            doc.get("content") or 
            doc.get("title") or ""
        )

        images = doc.get("images") or doc.get("image") or doc.get("imageUrl") or []
        image_url = ""
        if isinstance(images, list) and len(images) > 0:
            image_url = str(images[0])
        elif isinstance(images, str):
            image_url = images

        updates.append({
            "id":          str(doc["_id"]),
            "date":        date_str,
            "time":        time_str,
            "location":    location or "N/A",
            "description": description,
            "imageUrl":    image_url,
        })
    return updates


# ─── Activities ───────────────────────────────────────────────
@app.get("/api/employees/{employee_id}/activities")
async def get_employee_activities(employee_id: str):
    db = get_previous_db()
    if db is None:
        return []
    import re
    regex_id = re.compile(f"^{re.escape(employee_id)}$", re.IGNORECASE)
    cursor = db.activities.find(
        {"$or": [{"employee_id": regex_id}, {"id": regex_id}, {"empId": regex_id}]}
    ).sort("created_at", -1)
    activities = []
    async for doc in cursor:
        created = doc.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d") if isinstance(created, datetime) else str(created)[:10]
        activities.append({
            "id":          str(doc["_id"]),
            "date":        date_str or str(doc.get("time", ""))[:10],
            "title":       doc.get("title", doc.get("type", "Activity").capitalize()),
            "description": doc.get("description", doc.get("notes", doc.get("remarks", doc.get("action", "")))),
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
            "attachment": doc.get("image_b64", doc.get("attachment", "")),
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
        login_val = att.get("login_time", "N/A")
        logout_val = att.get("logout_time", "N/A")
        
        check_in_time, check_out_time, hrs_worked = parse_time_and_calc_hrs(login_val, logout_val)
        
        if hrs_worked == "N/A":
            hrs_worked = att.get("hrs", "N/A")
            
        emp_id = att.get("employee_id", "Unknown")
        emp_name = att.get("employee_name", att.get("full_name", "Unknown"))
        
        # fallback to fetch employee name if not present in attendance doc
        if emp_name == "Unknown":
            emp_doc = await db.employees.find_one({"$or": [{"employee_id": emp_id}, {"id": emp_id}]})
            if emp_doc:
                emp_name = emp_doc.get("full_name", emp_doc.get("name", "Unknown"))
                
        # Holiday override check for all attendance
        today_str = att.get("login_date", att.get("date", "N/A"))
        is_holiday = False
        if today_str != "N/A":
            main_db = get_previous_db()
            if main_db is not None:
                holiday = await main_db.holidays.find_one({
                    "from_date": {"$lte": today_str},
                    "to_date": {"$gte": today_str}
                })
                if holiday:
                    is_holiday = True

        if is_holiday:
            status_val = "Holiday"
        elif check_in_time != "N/A" and check_out_time != "N/A":
            status_val = "Present"
        elif check_in_time != "N/A" and check_out_time == "N/A":
            status_val = "Check-in (Absent)"
        elif check_in_time == "N/A" and check_out_time != "N/A":
            status_val = "Check-out (Absent)"
        else:
            status_val = "Absent"

        records.append({
            "id":       str(att.get("_id", "")),
            "empId":    emp_id,
            "empName":  emp_name,
            "date":     att.get("login_date", att.get("date", "N/A")),
            "status":   status_val,
            "checkIn":  check_in_time,
            "checkOut": check_out_time,
            "hrs":      hrs_worked,
            "startLoc": att.get("full_address", att.get("start", "N/A")),
            "endLoc":   att.get("logout_full_address", att.get("end", "N/A")),
            "selfie":   att.get("selfie_b64", att.get("login_selfie", "")),
            "loginLoc": {
                "lat": float(att.get("gps_latitude") or 0),
                "lng": float(att.get("gps_longitude") or 0),
                "address": att.get("full_address")
            } if att.get("gps_latitude") else None,
            "logoutLoc": {
                "lat": float(att.get("logout_gps_latitude") or 0),
                "lng": float(att.get("logout_gps_longitude") or 0),
                "address": att.get("logout_full_address")
            } if att.get("logout_gps_latitude") else None,
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
    
    # Pre-fetch employee names to map IDs to Names
    employees_cursor = db.employees.find({}, {"employee_id": 1, "id": 1, "name": 1})
    emp_map = {}
    async for emp in employees_cursor:
        eid = emp.get("employee_id") or emp.get("id")
        if eid:
            emp_map[str(eid)] = emp.get("name", str(eid))
            

    # Get recent attendance check-ins
    att_cursor = db.attendance.find({}).sort("login_date", -1).limit(20)
    async for att in att_cursor:
        emp_id = att.get("employee_id", "Unknown")
        emp_name = emp_map.get(str(emp_id), emp_id)
        time_str = att.get("login_time", "N/A")
        date_str = att.get("login_date", "N/A")
        logs.append({
            "action": f"{emp_name} checked in",
            "time": f"{date_str} {time_str}",
            "type": "attendance"
        })
        if att.get("logout_time") and str(att.get("logout_time")).lower() != "none":
            logs.append({
                "action": f"{emp_name} checked out",
                "time": f"{date_str} {att.get('logout_time')}",
                "type": "attendance"
            })
            
    # Get recent general activities
    act_cursor = db.activities.find({}).sort("created_at", -1).limit(20)
    async for act in act_cursor:
        created = act.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created)[:16]
        emp_id = act.get("employee_id", "Unknown")
        emp_name = emp_map.get(str(emp_id), emp_id)
        title = act.get("title", "Updated Activity")
        logs.append({
            "action": f"{emp_name} - {title}",
            "time": date_str,
            "type": "system"
        })
        
    # Get recent leaves
    leaves_cursor = db.leaves.find({}).sort("created_at", -1).limit(20)
    async for lv in leaves_cursor:
        created = lv.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created)[:16]
        emp_id = lv.get("employee_id", "Unknown")
        emp_name = emp_map.get(str(emp_id), emp_id)
        type_str = lv.get("leave_type", "Leave")
        status = lv.get("status", "Pending")
        logs.append({
            "action": f"{emp_name} applied for {type_str} ({status})",
            "time": date_str,
            "type": "leave"
        })
        
    # Get recent updates
    updates_cursor = db.daily_updates.find({}).sort("created_at", -1).limit(20)
    async for upd in updates_cursor:
        created = upd.get("created_at", "")
        date_str = created.strftime("%Y-%m-%d %H:%M") if isinstance(created, datetime) else str(created)[:16]
        emp_id = upd.get("employee_id", "Unknown")
        emp_name = emp_map.get(str(emp_id), emp_id)
        logs.append({
            "action": f"{emp_name} posted a daily update",
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
            "totalEmployees": 0,
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
            "attachment":   doc.get("image_b64", doc.get("attachment", "")),
        })
    return leaves


# ─── Leave Monthly Report (per employee) ──────────────────────
@app.get("/api/employees/{employee_id}/leaves/monthly-report")
async def get_employee_monthly_leave_report(employee_id: str, year: Optional[int] = None, month: Optional[int] = None):
    """Return a per-month leave summary for a single employee for the given year (default: current financial year)."""
    db = get_previous_db()
    if db is None:
        return []

    import re
    from datetime import timedelta
    regex_id = re.compile(f"^{re.escape(employee_id)}$", re.IGNORECASE)

    # Default to current financial year (April–March)
    now = datetime.now()
    if year is None:
        year = now.year if now.month >= 4 else now.year - 1

    # Build 12 months: Apr(year) to Mar(year+1)
    months = []
    for m in range(4, 13):
        months.append((year, m))
    for m in range(1, 4):
        months.append((year + 1, m))

    cursor = db.leaves.find(
        {"$or": [{"employee_id": regex_id}, {"id": regex_id}]}
    )

    all_leaves = []
    async for doc in cursor:
        start_str = str(doc.get("start_date", doc.get("leave_date", "")))[:10]
        end_str = str(doc.get("end_date", doc.get("leave_date", start_str)))[:10]
        all_leaves.append({
            "type": doc.get("leave_type", "Leave"),
            "status": doc.get("status", "Pending"),
            "startDate": start_str,
            "endDate": end_str,
        })

    def count_days(start_str, end_str, target_year, target_month):
        """Count working days (exclude Sundays) within a specific month from a leave range."""
        try:
            start = datetime.strptime(start_str, "%Y-%m-%d")
            end = datetime.strptime(end_str, "%Y-%m-%d")
        except Exception:
            return 0
        days = 0
        current = start
        while current <= end:
            if current.year == target_year and current.month == target_month:
                if current.weekday() != 6:  # not Sunday
                    days += 1
            current += timedelta(days=1)
        return days

    result = []
    for (yr, mo) in months:
        import calendar
        month_name = calendar.month_abbr[mo]
        total_days = 0
        approved_days = 0
        pending_days = 0
        casual_days = 0
        sick_days = 0

        for lv in all_leaves:
            d = count_days(lv["startDate"], lv["endDate"], yr, mo)
            if d == 0:
                continue
            total_days += d
            if lv["status"] == "Approved":
                approved_days += d
            elif lv["status"] == "Pending":
                pending_days += d
            if "Sick" in lv["type"]:
                sick_days += d
            else:
                casual_days += d

        result.append({
            "month": month_name,
            "year": yr,
            "monthYear": f"{month_name} {yr}",
            "totalDays": total_days,
            "approvedDays": approved_days,
            "pendingDays": pending_days,
            "casualDays": casual_days,
            "sickDays": sick_days,
        })

    return result


# ─── Leave Yearly Report (admin, all employees by month) ──────
@app.get("/api/leaves/yearly-report")
async def get_yearly_leave_report(year: Optional[int] = None):
    """Return a per-month leave summary across all employees for the financial year."""
    db = get_previous_db()
    if db is None:
        return []

    from datetime import timedelta
    import calendar

    now = datetime.now()
    if year is None:
        year = now.year if now.month >= 4 else now.year - 1

    # Financial year months: April(year) → March(year+1)
    months = []
    for m in range(4, 13):
        months.append((year, m))
    for m in range(1, 4):
        months.append((year + 1, m))

    cursor = db.leaves.find({})
    all_leaves = []
    async for doc in cursor:
        start_str = str(doc.get("start_date", doc.get("leave_date", "")))[:10]
        end_str = str(doc.get("end_date", doc.get("leave_date", start_str)))[:10]
        all_leaves.append({
            "employee_id": doc.get("employee_id", ""),
            "type": doc.get("leave_type", "Leave"),
            "status": doc.get("status", "Pending"),
            "startDate": start_str,
            "endDate": end_str,
        })

    def count_days_in_month(start_str, end_str, target_year, target_month):
        try:
            start = datetime.strptime(start_str, "%Y-%m-%d")
            end = datetime.strptime(end_str, "%Y-%m-%d")
        except Exception:
            return 0
        days = 0
        current = start
        while current <= end:
            if current.year == target_year and current.month == target_month:
                if current.weekday() != 6:
                    days += 1
            current += timedelta(days=1)
        return days

    result = []
    for (yr, mo) in months:
        total = 0
        approved = 0
        pending = 0
        rejected = 0
        casual = 0
        sick = 0
        employees_on_leave = set()

        for lv in all_leaves:
            d = count_days_in_month(lv["startDate"], lv["endDate"], yr, mo)
            if d == 0:
                continue
            total += d
            status = lv["status"]
            if status == "Approved":
                approved += d
                employees_on_leave.add(lv["employee_id"])
            elif status == "Pending":
                pending += d
            elif status == "Rejected":
                rejected += d
            if "Sick" in lv["type"]:
                sick += d
            else:
                casual += d

        result.append({
            "month": calendar.month_abbr[mo],
            "year": yr,
            "monthYear": f"{calendar.month_abbr[mo]} {yr}",
            "totalDays": total,
            "approvedDays": approved,
            "pendingDays": pending,
            "rejectedDays": rejected,
            "casualDays": casual,
            "sickDays": sick,
            "employeesOnLeave": len(employees_on_leave),
        })

    return result


@app.get("/api/leaves/monthly-report")
async def get_monthly_leave_report(year: Optional[int] = None, month: Optional[int] = None):
    """Return a detailed leave report across all employees for a specific month and year."""
    db = get_previous_db()
    if db is None:
        return {"summary": {}, "leaves": []}

    from datetime import timedelta
    import calendar

    now = datetime.now()
    if year is None:
        year = now.year
    if month is None:
        month = now.month

    cursor = db.leaves.find({})
    leaves = []
    
    total_days = 0
    approved_days = 0
    pending_days = 0
    rejected_days = 0
    casual_days = 0
    sick_days = 0
    employees_on_leave = set()

    async for doc in cursor:
        start_str = str(doc.get("start_date", doc.get("leave_date", "")))[:10]
        end_str = str(doc.get("end_date", doc.get("leave_date", start_str)))[:10]
        
        try:
            start = datetime.strptime(start_str, "%Y-%m-%d")
            end = datetime.strptime(end_str, "%Y-%m-%d")
        except Exception:
            continue
            
        days_in_month = 0
        current = start
        while current <= end:
            if current.year == year and current.month == month:
                if current.weekday() != 6:
                    days_in_month += 1
            current += timedelta(days=1)
            
        if days_in_month > 0:
            status = doc.get("status", "Pending")
            leave_type = doc.get("leave_type", doc.get("type", "Leave"))
            emp_id = doc.get("employee_id", doc.get("employeeId", ""))
            emp_name = doc.get("employee_name", doc.get("employeeName", "N/A"))
            
            total_days += days_in_month
            if status == "Approved":
                approved_days += days_in_month
                if emp_id: employees_on_leave.add(emp_id)
            elif status == "Pending":
                pending_days += days_in_month
            elif status == "Rejected":
                rejected_days += days_in_month
                
            if "Sick" in leave_type:
                sick_days += days_in_month
            else:
                casual_days += days_in_month

            leaves.append({
                "id": str(doc.get("_id")),
                "employeeId": emp_id,
                "employeeName": emp_name,
                "type": leave_type,
                "startDate": start_str,
                "endDate": end_str,
                "daysCount": days_in_month,
                "reason": doc.get("reason", "N/A"),
                "status": status,
                "attachment": doc.get("image_b64", doc.get("attachment", ""))
            })

    return {
        "year": year,
        "month": month,
        "monthName": calendar.month_name[month],
        "monthYear": f"{calendar.month_name[month]} {year}",
        "summary": {
            "totalDays": total_days,
            "approvedDays": approved_days,
            "pendingDays": pending_days,
            "rejectedDays": rejected_days,
            "casualDays": casual_days,
            "sickDays": sick_days,
            "employeesOnLeave": len(employees_on_leave),
            "totalRequests": len(leaves)
        },
        "leaves": leaves
    }


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
    import re
    regex_id = re.compile(f"^{re.escape(employee_id)}$", re.IGNORECASE)
    doc = await db.work_info.find_one(
        {"$or": [{"employee_id": regex_id}, {"empId": regex_id}, {"id": regex_id}]},
        {"_id": 0}
    )
    if doc:
        return doc
        
    emp_doc = await db.employees.find_one(
        {"$or": [{"employee_id": regex_id}, {"id": regex_id}]},
        {"_id": 0}
    )
    if emp_doc:
        return {
            "head": emp_doc.get("head", ""),
            "donorName": emp_doc.get("donor_name", ""),
            "department": emp_doc.get("department", ""),
            "targetVillages": emp_doc.get("target_villages", ""),
            "targetMandal": emp_doc.get("target_mandals", emp_doc.get("target_mandal", "")),
            "targets": emp_doc.get("targets", "")
        }
        
    return {}

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
    if db is None:
        return {"casualTotal": 12, "casualTaken": 0, "casualRemaining": 12, "sickTotal": 12, "sickTaken": 0, "sickRemaining": 12}
    
    import re
    from datetime import datetime, timedelta
    regex_id = re.compile(f"^{re.escape(employee_id)}$", re.IGNORECASE)

    emp_doc = await db.employees.find_one({"$or": [{"employee_id": regex_id}, {"id": regex_id}, {"empId": regex_id}]})
    default_leaves = 12
    if emp_doc and emp_doc.get("joining_date") and emp_doc.get("joining_date") != "N/A":
        default_leaves = calculate_prorated_leaves(emp_doc["joining_date"])

    bal_doc = await db.leave_balances.find_one({"$or": [{"employee_id": regex_id}, {"employee_id": employee_id}]}, {"_id": 0})
    casual_total = bal_doc.get("casualTotal", default_leaves) if bal_doc else default_leaves
    sick_total = bal_doc.get("sickTotal", default_leaves) if bal_doc else default_leaves

    # Count ONLY Approved leave requests for this employee (excluding Pending/Rejected)
    cursor = db.leaves.find({"$or": [{"employee_id": regex_id}, {"id": regex_id}], "status": "Approved"})
    casual_taken = 0
    sick_taken = 0

    async for lv in cursor:
        leave_type = lv.get("leave_type", lv.get("type", "Leave"))
        start_str = str(lv.get("start_date", lv.get("leave_date", "")))[:10]
        end_str = str(lv.get("end_date", lv.get("leave_date", start_str)))[:10]

        days = 0
        if start_str and end_str:
            try:
                current_date = datetime.strptime(start_str, "%Y-%m-%d")
                end_date = datetime.strptime(end_str, "%Y-%m-%d")
                while current_date <= end_date:
                    if current_date.weekday() != 6:  # Skip Sunday
                        days += 1
                    current_date += timedelta(days=1)
            except Exception:
                days = 1
        else:
            days = 1

        if "Sick" in leave_type:
            sick_taken += days
        else:
            casual_taken += days

    casual_remaining = max(0, casual_total - casual_taken)
    sick_remaining = max(0, sick_total - sick_taken)

    result_doc = {
        "employee_id": employee_id,
        "casualTotal": casual_total,
        "casualTaken": casual_taken,
        "casualRemaining": casual_remaining,
        "sickTotal": sick_total,
        "sickTaken": sick_taken,
        "sickRemaining": sick_remaining
    }

    await db.leave_balances.update_one(
        {"employee_id": employee_id},
        {"$set": result_doc},
        upsert=True
    )
    return result_doc

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

@app.get("/api/leave-balances/summary")
async def get_all_leave_balances_summary():
    db = get_previous_db()
    if db is None:
        return {"casualTotal": 0, "casualTaken": 0, "casualRemaining": 0, "sickTotal": 0, "sickTaken": 0, "sickRemaining": 0}
    
    total_casual = 0
    taken_casual = 0
    remaining_casual = 0
    total_sick = 0
    taken_sick = 0
    remaining_sick = 0
    
    employees_cursor = db.employees.find({})
    async for emp in employees_cursor:
        emp_id = str(emp.get("employee_id") or emp.get("id") or emp.get("_id", ""))
        if not emp_id: continue
        
        doc = await db.leave_balances.find_one({"employee_id": emp_id})
        if doc:
            total_casual += doc.get("casualTotal", 12)
            taken_casual += doc.get("casualTaken", 0)
            remaining_casual += doc.get("casualRemaining", 12)
            total_sick += doc.get("sickTotal", 12)
            taken_sick += doc.get("sickTaken", 0)
            remaining_sick += doc.get("sickRemaining", 12)
        else:
            default_leaves = 12
            if emp.get("joining_date") and emp.get("joining_date") != "N/A":
                default_leaves = calculate_prorated_leaves(emp["joining_date"])
            
            total_casual += default_leaves
            taken_casual += 0
            remaining_casual += default_leaves
            total_sick += default_leaves
            taken_sick += 0
            remaining_sick += default_leaves

    return {
        "casualTotal": total_casual,
        "casualTaken": taken_casual,
        "casualRemaining": remaining_casual,
        "sickTotal": total_sick,
        "sickTaken": taken_sick,
        "sickRemaining": remaining_sick
    }

class LeaveStatusUpdate(BaseModel):
    status: str

@app.put("/api/leaves/{leave_id}/status")
async def update_leave_status(leave_id: str, status_update: LeaveStatusUpdate):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    from datetime import datetime, timedelta
    try:
        query = {"_id": ObjectId(leave_id)}
    except Exception:
        query = {"_id": leave_id}
        
    leave_doc = await db.leaves.find_one(query)
    if not leave_doc:
        return {"message": "Leave not found"}
        
    old_status = leave_doc.get("status", "Pending")
    new_status = status_update.status
    
    await db.leaves.update_one(query, {"$set": {"status": new_status}})
    
    emp_id = leave_doc.get("employee_id")
    if emp_id and old_status != new_status:
        # Calculate days
        leave_type = leave_doc.get("leave_type", leave_doc.get("type", "Leave"))
        start_str = leave_doc.get("start_date", leave_doc.get("leave_date"))
        end_str = leave_doc.get("end_date", leave_doc.get("leave_date"))
        
        days = 0
        if start_str and end_str:
            try:
                current_date = datetime.strptime(str(start_str)[:10], "%Y-%m-%d")
                end_date = datetime.strptime(str(end_str)[:10], "%Y-%m-%d")
                while current_date <= end_date:
                    if current_date.weekday() != 6: # Skip Sunday
                        days += 1
                    current_date += timedelta(days=1)
            except Exception as e:
                print("Error calculating days:", e)
                days = 1
        
        if days > 0:
            bal_doc = await db.leave_balances.find_one({"employee_id": emp_id})
            if not bal_doc:
                emp_doc = await db.employees.find_one({"$or": [{"employee_id": emp_id}, {"id": emp_id}]})
                default_leaves = 12
                if emp_doc and emp_doc.get("joining_date") and emp_doc.get("joining_date") != "N/A":
                    default_leaves = calculate_prorated_leaves(emp_doc["joining_date"])
                
                bal_doc = {
                    "employee_id": emp_id,
                    "casualTotal": default_leaves,
                    "casualTaken": 0,
                    "casualRemaining": default_leaves,
                    "sickTotal": default_leaves,
                    "sickTaken": 0,
                    "sickRemaining": default_leaves
                }
                await db.leave_balances.insert_one(bal_doc.copy())

            is_sick = "Sick" in leave_type
            if new_status == "Approved":
                # Deduct balance ONLY when Approved
                if is_sick:
                    taken = bal_doc.get("sickTaken", 0) + days
                    remaining = max(0, bal_doc.get("sickTotal", 12) - taken)
                    await db.leave_balances.update_one({"employee_id": emp_id}, {"$set": {"sickTaken": taken, "sickRemaining": remaining}})
                else:
                    taken = bal_doc.get("casualTaken", 0) + days
                    remaining = max(0, bal_doc.get("casualTotal", 12) - taken)
                    await db.leave_balances.update_one({"employee_id": emp_id}, {"$set": {"casualTaken": taken, "casualRemaining": remaining}})
            elif old_status == "Approved" and (new_status == "Rejected" or new_status == "Pending"):
                # If changed from Approved to Pending or Rejected, restore balance
                if is_sick:
                    taken = max(0, bal_doc.get("sickTaken", 0) - days)
                    remaining = bal_doc.get("sickTotal", 12) - taken
                    await db.leave_balances.update_one({"employee_id": emp_id}, {"$set": {"sickTaken": taken, "sickRemaining": remaining}})
                else:
                    taken = max(0, bal_doc.get("casualTaken", 0) - days)
                    remaining = bal_doc.get("casualTotal", 12) - taken
                    await db.leave_balances.update_one({"employee_id": emp_id}, {"$set": {"casualTaken": taken, "casualRemaining": remaining}})
    
    # Auto-generate notification for the employee
    if emp_id:
        notif_doc = {
            "title": f"Leave Request {status_update.status}",
            "message": f"Your leave request has been {status_update.status.lower()}.",
            "target_type": "individual",
            "targetType": "individual",
            "employee_id": emp_id,
            "employeeId": emp_id,
            "created_at": datetime.now(),
            "isDeleted": False
        }
        await db.notifications.insert_one(notif_doc)
        
    return {"message": "Leave status updated"}


@app.delete("/api/leaves/{leave_id}")
async def delete_leave_request(leave_id: str):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    from datetime import datetime, timedelta
    try:
        query = {"_id": ObjectId(leave_id)}
    except Exception:
        query = {"_id": leave_id}
        
    leave_doc = await db.leaves.find_one(query)
    if not leave_doc:
        return {"message": "Leave request not found"}
        
    status = leave_doc.get("status", "Pending")
    emp_id = leave_doc.get("employee_id")
    
    # If the leave was Approved, restore balance before deleting
    if status == "Approved" and emp_id:
        leave_type = leave_doc.get("leave_type", "Leave")
        start_str = leave_doc.get("start_date", leave_doc.get("leave_date"))
        end_str = leave_doc.get("end_date", leave_doc.get("leave_date"))
        
        days = 0
        if start_str and end_str:
            try:
                current_date = datetime.strptime(str(start_str)[:10], "%Y-%m-%d")
                end_date = datetime.strptime(str(end_str)[:10], "%Y-%m-%d")
                while current_date <= end_date:
                    if current_date.weekday() != 6:
                        days += 1
                    current_date += timedelta(days=1)
            except Exception:
                days = 1
                
        if days > 0:
            bal_doc = await db.leave_balances.find_one({"employee_id": emp_id})
            if bal_doc:
                is_sick = "Sick" in leave_type
                if is_sick:
                    taken = max(0, bal_doc.get("sickTaken", 0) - days)
                    remaining = bal_doc.get("sickTotal", 12) - taken
                    await db.leave_balances.update_one({"employee_id": emp_id}, {"$set": {"sickTaken": taken, "sickRemaining": remaining}})
                else:
                    taken = max(0, bal_doc.get("casualTaken", 0) - days)
                    remaining = bal_doc.get("casualTotal", 12) - taken
                    await db.leave_balances.update_one({"employee_id": emp_id}, {"$set": {"casualTaken": taken, "casualRemaining": remaining}})
                    
    await db.leaves.delete_one(query)
    return {"message": "Leave request deleted"}

# ─── Daily Updates & Activities Mutations ─────────────────────
class DailyUpdateCreate(BaseModel):
    description: str
    imageUrl: str = ""
    location: str = ""

class DailyUpdateEdit(BaseModel):
    description: str
    location: str = ""

@app.post("/api/employees/{employee_id}/updates")
async def create_daily_update(employee_id: str, update: DailyUpdateCreate):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from datetime import timezone, timedelta
    ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(ist)

    doc = {
        "employee_id": employee_id,
        "notes": update.description,
        "description": update.description,
        "location": update.location,
        "images": [update.imageUrl] if update.imageUrl else [],
        "date": now_ist.strftime("%d/%m/%Y"),
        "time": now_ist.strftime("%I:%M:%S %p"),
        "created_at": now_ist
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
    payload = {"notes": update.description, "description": update.description}
    if update.location:
        payload["location"] = update.location
    await db.daily_updates.update_one(
        {"_id": ObjectId(update_id)},
        {"$set": payload}
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
            "target_type": doc.get("target_type", "all"),
            "employee_id": doc.get("employee_id"),
            "date": created.strftime("%b %d, %Y, %I:%M %p") if isinstance(created, datetime) else str(created)[:16],
            "isDeleted": doc.get("isDeleted", False)
        })
    return notifs

@app.post("/api/notifications")
async def create_notification(notif: NotificationBase):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    
    if notif.target_type == "all":
        employees_cursor = db.employees.find({})
        inserted_docs = []
        async for emp in employees_cursor:
            emp_id = emp.get("employee_id") or emp.get("id")
            if emp_id:
                inserted_docs.append({
                    "title": notif.title,
                    "message": notif.message,
                    "target_type": "individual",
                    "targetType": "individual",
                    "employee_id": emp_id,
                    "employeeId": emp_id,
                    "created_at": datetime.now(),
                    "isDeleted": False
                })
        
        if inserted_docs:
            await db.notifications.insert_many(inserted_docs)
            # Create a "global" one just for the admin UI record
            global_doc = {
                "title": notif.title,
                "message": notif.message,
                "target_type": "all",
                "targetType": "all",
                "employee_id": None,
                "employeeId": None,
                "created_at": datetime.now(),
                "isDeleted": False
            }
            result = await db.notifications.insert_one(global_doc)
            return {
                "id": str(result.inserted_id),
                "title": global_doc["title"],
                "message": global_doc["message"],
                "target_type": global_doc["target_type"],
                "employee_id": global_doc["employee_id"],
                "date": global_doc["created_at"].strftime("%b %d, %Y, %I:%M %p")
            }
        return {"message": "No employees found"}
    else:
        doc = {
            "title": notif.title,
            "message": notif.message,
            "target_type": notif.target_type,
            "targetType": notif.target_type,
            "employee_id": notif.employee_id,
            "employeeId": notif.employee_id,
            "created_at": datetime.now(),
            "isDeleted": False
        }
        result = await db.notifications.insert_one(doc)
        return {
            "id": str(result.inserted_id),
            "title": doc["title"],
            "message": doc["message"],
            "target_type": doc["target_type"],
            "employee_id": doc["employee_id"],
            "date": doc["created_at"].strftime("%b %d, %Y, %I:%M %p")
        }

@app.put("/api/notifications/{notif_id}")
async def update_notification(notif_id: str, notif: NotificationBase):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.notifications.update_one(
        {"_id": ObjectId(notif_id)},
        {"$set": {
            "title": notif.title, 
            "message": notif.message,
            "target_type": notif.target_type,
            "targetType": notif.target_type,
            "employee_id": notif.employee_id,
            "employeeId": notif.employee_id
        }}
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


# ─── Holidays API ─────────────────────────────────────────────
@app.get("/api/holidays")
async def get_holidays():
    db = get_previous_db()
    if db is None: return []
    cursor = db.holidays.find().sort("from_date", 1)
    holidays = []
    async for doc in cursor:
        holidays.append({
            "id": str(doc["_id"]),
            "name": doc.get("name"),
            "from_date": doc.get("from_date"),
            "to_date": doc.get("to_date"),
            "type": doc.get("type"),
            "created_at": doc.get("created_at")
        })
    return holidays

@app.post("/api/holidays")
async def create_holiday(holiday: HolidayBase):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    doc = {
        "name": holiday.name,
        "from_date": holiday.from_date,
        "to_date": holiday.to_date,
        "type": holiday.type,
        "created_at": datetime.now().isoformat()
    }
    result = await db.holidays.insert_one(doc)
    return {"message": "Holiday created successfully", "id": str(result.inserted_id)}

@app.delete("/api/holidays/{holiday_id}")
async def delete_holiday(holiday_id: str):
    db = get_previous_db()
    if db is None: return {"message": "Mock mode"}
    from bson.objectid import ObjectId
    await db.holidays.delete_one({"_id": ObjectId(holiday_id)})
    return {"message": "Holiday deleted"}

@app.get("/api/holidays/active")
async def check_active_holiday(date: Optional[str] = None):
    db = get_previous_db()
    if db is None: return {"isHoliday": False}
    
    target_date = date
    if not target_date:
        import pytz
        ist_tz = pytz.timezone('Asia/Kolkata')
        target_date = datetime.now(ist_tz).strftime('%Y-%m-%d')
        
    holiday = await db.holidays.find_one({
        "from_date": {"$lte": target_date},
        "to_date": {"$gte": target_date}
    })
    
    if holiday:
        return {
            "isHoliday": True,
            "holidayName": holiday.get("name"),
            "holidayType": holiday.get("type")
        }
    return {"isHoliday": False}


# ─── Password Reset Requests ──────────────────────────────────

class PasswordResetRequest(BaseModel):
    employee_id: str
    employee_name: str
    email: str
    reason: Optional[str] = ""
    new_password: str  # Employee sets their own desired new password

class PasswordResetAction(BaseModel):
    action: str  # "approve" or "reject"
    rejection_reason: Optional[str] = ""

@app.post("/api/password-reset-requests")
async def submit_password_reset_request(req: PasswordResetRequest):
    """Employee submits a password reset request for admin approval."""
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")

    # Check if there's already a pending request from this employee
    existing = await db.password_reset_requests.find_one({
        "employee_id": req.employee_id,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="A pending reset request already exists for this employee.")

    doc = {
        "employee_id": req.employee_id,
        "employee_name": req.employee_name,
        "email": req.email,
        "reason": req.reason or "",
        "status": "pending",  # pending | approved | rejected
        "created_at": datetime.now(),
        "resolved_at": None,
        "rejection_reason": "",
        "new_password": req.new_password,  # stored from employee's submission
    }
    result = await db.password_reset_requests.insert_one(doc)
    return {"message": "Password reset request submitted. Awaiting admin approval.", "id": str(result.inserted_id)}


@app.get("/api/password-reset-requests")
async def get_all_password_reset_requests(status: Optional[str] = None):
    """Admin fetches all password reset requests, optionally filtered by status."""
    db = get_previous_db()
    if db is None:
        return []

    query = {}
    if status:
        query["status"] = status

    cursor = db.password_reset_requests.find(query).sort("created_at", -1)
    requests_list = []
    async for doc in cursor:
        created = doc.get("created_at")
        created_str = created.strftime("%b %d, %Y %I:%M %p") if isinstance(created, datetime) else str(created)[:16]
        resolved = doc.get("resolved_at")
        resolved_str = resolved.strftime("%b %d, %Y %I:%M %p") if isinstance(resolved, datetime) else (str(resolved)[:16] if resolved else None)
        requests_list.append({
            "id": str(doc["_id"]),
            "employee_id": doc.get("employee_id"),
            "employee_name": doc.get("employee_name"),
            "email": doc.get("email"),
            "reason": doc.get("reason", ""),
            "status": doc.get("status", "pending"),
            "created_at": created_str,
            "resolved_at": resolved_str,
            "rejection_reason": doc.get("rejection_reason", ""),
        })
    return requests_list


@app.put("/api/password-reset-requests/{request_id}/action")
async def handle_password_reset_request(request_id: str, action_data: PasswordResetAction):
    """Admin approves or rejects a password reset request."""
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")

    from bson.objectid import ObjectId
    try:
        obj_id = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    req_doc = await db.password_reset_requests.find_one({"_id": obj_id})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Password reset request not found")

    if req_doc.get("status") != "pending":
        raise HTTPException(status_code=400, detail="This request has already been resolved.")

    if action_data.action == "approve":
        employee_id = req_doc.get("employee_id")
        new_password = req_doc.get("new_password")
        employee_updated = False

        # If employee set a new_password in the request, apply it to employees collection
        if new_password:
            result = await db.employees.update_one(
                {"$or": [{"employee_id": employee_id}, {"id": employee_id}]},
                {"$set": {"password": new_password}}
            )
            employee_updated = result.modified_count > 0

        # Mark request as approved
        await db.password_reset_requests.update_one(
            {"_id": obj_id},
            {"$set": {
                "status": "approved",
                "resolved_at": datetime.now(),
            }}
        )
        return {"message": "Password reset approved.", "employee_updated": employee_updated}

    elif action_data.action == "reject":
        await db.password_reset_requests.update_one(
            {"_id": obj_id},
            {"$set": {
                "status": "rejected",
                "resolved_at": datetime.now(),
                "rejection_reason": action_data.rejection_reason or "",
            }}
        )
        return {"message": "Password reset request rejected."}

    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'.")


@app.delete("/api/password-reset-requests/{request_id}")
async def delete_password_reset_request(request_id: str):
    """Admin deletes a resolved password reset request."""
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")

    from bson.objectid import ObjectId
    try:
        obj_id = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    result = await db.password_reset_requests.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"message": "Password reset request deleted."}


@app.get("/api/password-reset-requests/employee/{employee_id}")
async def get_employee_reset_requests(employee_id: str):
    """Employee checks the status of their own password reset request."""
    db = get_previous_db()
    if db is None:
        return []

    cursor = db.password_reset_requests.find({"employee_id": employee_id}).sort("created_at", -1)
    requests_list = []
    async for doc in cursor:
        created = doc.get("created_at")
        created_str = created.strftime("%b %d, %Y %I:%M %p") if isinstance(created, datetime) else str(created)[:16]
        requests_list.append({
            "id": str(doc["_id"]),
            "status": doc.get("status", "pending"),
            "created_at": created_str,
            "rejection_reason": doc.get("rejection_reason", ""),
            "has_new_password": bool(doc.get("new_password")),
        })
    return requests_list


class SetEmployeePasswordSchema(BaseModel):
    employee_id: str
    new_password: str

@app.post("/api/password-reset-requests/set-password")
async def employee_set_new_password(data: SetEmployeePasswordSchema):
    """Employee sets/updates password for an approved reset request."""
    db = get_previous_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not active")

    req = await db.password_reset_requests.find_one({
        "employee_id": data.employee_id,
        "status": "approved"
    })
    if not req:
        raise HTTPException(status_code=400, detail="No approved password reset request found for this employee.")

    result = await db.employees.update_one(
        {"$or": [{"employee_id": data.employee_id}, {"id": data.employee_id}]},
        {"$set": {"password": data.new_password}}
    )

    await db.password_reset_requests.update_one(
        {"_id": req["_id"]},
        {"$set": {"new_password": data.new_password}}
    )

    return {"message": "Password updated successfully!", "updated": result.modified_count > 0}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8081, reload=True)

