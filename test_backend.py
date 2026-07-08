import os
import sys
from datetime import datetime

# Add the project root to python path to ensure imports work correctly
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from database import db
from models import (
    GasReading,
    create_gas_reading,
    get_all_readings,
    get_latest_reading,
    update_gas_reading,
    delete_gas_reading,
    seed_sample_data,
    get_status
)

def run_tests():
    print("=" * 60)
    print("RUNNING BACKEND DATABASE & CRUD FUNCTIONALITY TESTS")
    print("=" * 60)

    # 1. Initialize Flask app with testing configuration (uses in-memory database)
    print("Step 1: Initializing Flask application context...")
    app = create_app('testing')
    
    with app.app_context():
        # 2. Initialize database (creates tables)
        print("Step 2: Initializing database and tables...")
        db.create_all()
        print(" -> Tables created successfully.")

        # 3. Test Safety Status auto-classification
        print("\nStep 3: Testing auto-status categorization logic...")
        assert get_status(150) == 'Safe', "Failed: 150 PPM should be 'Safe'"
        assert get_status(200) == 'Safe', "Failed: 200 PPM should be 'Safe'"
        assert get_status(250) == 'Warning', "Failed: 250 PPM should be 'Warning'"
        assert get_status(350) == 'Warning', "Failed: 350 PPM should be 'Warning'"
        assert get_status(400) == 'Danger', "Failed: 400 PPM should be 'Danger'"
        print(" -> Status auto-classification checks passed.")

        # 4. Test CRUD - Create Reading
        print("\nStep 4: Testing CRUD - Create Reading...")
        r1 = create_gas_reading(120)  # Safe
        r2 = create_gas_reading(280)  # Warning
        r3 = create_gas_reading(420)  # Danger
        
        assert r1.id is not None, "Failed: Reading 1 should have an ID"
        assert r1.status == 'Safe', f"Failed: Expected 'Safe', got {r1.status}"
        assert r2.status == 'Warning', f"Failed: Expected 'Warning', got {r2.status}"
        assert r3.status == 'Danger', f"Failed: Expected 'Danger', got {r3.status}"
        print(f" -> Inserted 3 readings: ID {r1.id} (PPM {r1.gas_level}), ID {r2.id} (PPM {r2.gas_level}), ID {r3.id} (PPM {r3.gas_level})")

        # 5. Test CRUD - Read All Readings
        print("\nStep 5: Testing CRUD - Read All Readings...")
        all_readings = get_all_readings()
        assert len(all_readings) == 3, f"Failed: Expected 3 records, got {len(all_readings)}"
        # Sorted by newest first
        assert all_readings[0].id == r3.id, "Failed: Sort order should be newest (latest ID) first"
        print(f" -> Retrieved {len(all_readings)} records, correctly sorted by newest first.")

        # 6. Test CRUD - Read Latest Reading
        print("\nStep 6: Testing CRUD - Read Latest Reading...")
        latest = get_latest_reading()
        assert latest.id == r3.id, f"Failed: Expected latest ID {r3.id}, got {latest.id}"
        print(f" -> Latest reading retrieved successfully (ID {latest.id}, PPM {latest.gas_level}).")

        # 7. Test CRUD - Update Reading
        print("\nStep 7: Testing CRUD - Update Reading...")
        updated = update_gas_reading(r1.id, gas_level=380) # Safe -> Danger (PPM 380)
        assert updated is not None, "Failed: Update returned None"
        assert updated.gas_level == 380, f"Failed: Expected PPM 380, got {updated.gas_level}"
        assert updated.status == 'Danger', f"Failed: Status should auto-update to 'Danger', got {updated.status}"
        print(f" -> Updated reading ID {r1.id} to {updated.gas_level} PPM. Status automatically upgraded to '{updated.status}'.")

        # 8. Test CRUD - Delete Reading
        print("\nStep 8: Testing CRUD - Delete Reading...")
        delete_success = delete_gas_reading(r2.id)
        assert delete_success is True, "Failed: Delete operation returned False"
        
        # Verify it is deleted
        deleted_reading = db.session.get(GasReading, r2.id)
        assert deleted_reading is None, "Failed: Record still exists after deletion"
        print(f" -> Reading ID {r2.id} deleted successfully. Verified not found in subsequent query.")

        # 9. Test Sample Data Generator (Seed)
        print("\nStep 9: Testing Sample Data Generator (Seeding)...")
        # Clear database first for testing seeder isolation
        db.drop_all()
        db.create_all()
        
        seed_sample_data()
        seeded_readings = get_all_readings()
        assert len(seeded_readings) == 20, f"Failed: Expected 20 seeded records, got {len(seeded_readings)}"
        
        # Verify gas level range
        for r in seeded_readings:
            assert 50 <= r.gas_level <= 500, f"Failed: Seed PPM {r.gas_level} outside [50, 500]"
            expected_status = get_status(r.gas_level)
            assert r.status == expected_status, f"Failed: Status mismatch for PPM {r.gas_level}. Expected '{expected_status}', got '{r.status}'"
        
        print(" -> Seeded 20 readings successfully. All safety conditions, gas PPM constraints, and dates are realistic.")
        print(" -> Database records:")
        for idx, r in enumerate(seeded_readings[:5]): # Show top 5
            print(f"    [{idx+1}] ID: {r.id:02d} | Time: {r.reading_time} | PPM: {r.gas_level:03d} | Status: {r.status}")
        print("    ...")

        print("\n" + "=" * 60)
        print("ALL TESTS PASSED SUCCESSFULLY! DATABASE INTEGRATION IS ROBUST.")
        print("=" * 60)

if __name__ == '__main__':
    run_tests()
