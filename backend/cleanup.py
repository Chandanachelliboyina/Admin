import os
from datetime import datetime, timedelta
from pymongo import MongoClient

# MongoDB connection strings (from your app.py)
MAIN_DB_URI = "mongodb+srv://chanduchelliboyina3_db_user:TQAgn6iQQf7GfHrb@cluster0.ena8z6v.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
PREV_EMP_DB_URI = "mongodb+srv://chanduchelliboyina3_db_user:wWp8HDSftQ3ZmGhT@cluster0.owpohu3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

def run_cleanup():
    print("Connecting to databases...")
    client_main = MongoClient(MAIN_DB_URI)
    db = client_main["bmm_database"]
    
    client_prev = MongoClient(PREV_EMP_DB_URI)
    prev_db = client_prev["bmm_database"]

    now = datetime.utcnow()
    twenty_days_ago = now - timedelta(days=20)
    six_months_ago = now - timedelta(days=180)
    
    print(f"20 Days Ago: {twenty_days_ago}")
    print(f"6 Months Ago: {six_months_ago}")
    
    print("\n--- Running Updates (20 Days) ---")
    
    # Update leaves (Leaves are in prev_db according to app.py logic for get_employee_leaves, but let's do both to be safe or just main db if they are there)
    # Actually, your script used 'db.leaves', so we'll run it on the main db.
    res = db.leaves.update_many(
        {"created_at": {"$lt": twenty_days_ago}},
        {"$unset": {"image_b64": ""}}
    )
    print(f"Leaves updated: {res.modified_count}")

    res = db.attendance.update_many(
        {"created_at": {"$lt": twenty_days_ago}},
        {"$unset": {"selfie_b64": "", "logout_selfie_b64": ""}}
    )
    print(f"Attendance updated: {res.modified_count}")

    res = db.daily_updates.update_many(
        {"created_at": {"$lt": twenty_days_ago}},
        {"$set": {"images": []}}
    )
    print(f"Daily Updates updated: {res.modified_count}")

    res = db.reports.update_many(
        {"created_at": {"$lt": twenty_days_ago}},
        {"$unset": {"image_url_1": "", "image_url_2": ""}}
    )
    print(f"Reports updated: {res.modified_count}")

    print("\n--- Running Deletions (6 Months) ---")
    
    res = db.leaves.delete_many({"created_at": {"$lt": six_months_ago}})
    print(f"Leaves deleted: {res.deleted_count}")

    res = db.attendance.delete_many({"created_at": {"$lt": six_months_ago}})
    print(f"Attendance deleted: {res.deleted_count}")

    res = db.activities.delete_many({"created_at": {"$lt": six_months_ago}})
    print(f"Activities deleted: {res.deleted_count}")

    res = db.daily_updates.delete_many({"created_at": {"$lt": six_months_ago}})
    print(f"Daily Updates deleted: {res.deleted_count}")

    res = db.reports.delete_many({"created_at": {"$lt": six_months_ago}})
    print(f"Reports deleted: {res.deleted_count}")
    
    print("\nCleanup Complete!")

if __name__ == "__main__":
    run_cleanup()
