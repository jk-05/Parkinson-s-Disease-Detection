from app import app, db

with app.app_context():
    print("Dropping all tables...")
    db.drop_all()
    print("Tables dropped.")
    print("Creating all tables with new schema...")
    db.create_all()
    print("Tables created.")
    
    # Run the seeding logic (since it's inside app.py's app_context block which runs on import? 
    # No, app.py runs that block under `if __name__ == '__main__':` usually or explicitly? 
    # Checking app.py content... 
    # app.py has `with app.app_context():` block at top level. 
    # So importing app might run it? No, usually imports don't run side effects unless top level.
    # The seeding logic in app.py is inside `with app.app_context():` at module level, so it runs on import if not careful, 
    # but let's just manually seed here to be sure, or rely on app.py restart.
    
    # Actually, viewing app.py showed:
    # with app.app_context():
    #    try:
    #        db.create_all()
    #        ... seeding ...
    
    # This block at module level runs when app is imported? 
    # If I import app, that block *will* run.
    # But since I just dropped tables *after* import (if I import first, then drop), I need to re-seed.
    
    # Let's just define the seeding here to be safe and immediate.
    from app import Doctor, Patient
    
    if not Doctor.query.filter_by(username='doctor').first():
        db.session.add(Doctor(username='doctor', password='password', name="Dr. Strange"))
        print("Doctor seeded.")

    if not Patient.query.filter_by(username='patient').first():
        db.session.add(Patient(username='patient', password='password', name="John Doe", age=65, contact="1234567890"))
        print("Patient seeded.")
        
    db.session.commit()
    print("Database reset and seeded successfully.")
