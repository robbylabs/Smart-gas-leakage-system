from datetime import datetime, date, time, timedelta
import random
from database import db

# Why SQLAlchemy is used:
# SQLAlchemy provides a clean, Pythonic object-relational mapping (ORM) layer.
# Instead of writing custom SQL statements, we can define models as Python classes
# and interact with data using database-agnostic code. This automates query building,
# ensures parameter serialization (preventing SQL injections), and simplifies database schema updates.

class GasReading(db.Model):
    """
    GasReading Model: Represents a single gas sensor measurement record in the SQLite database.
    
    Fields:
    - id (Integer, Primary Key): Unique auto-incrementing ID.
    - gas_level (Integer): The gas concentration measured in PPM (Parts Per Million).
    - status (String): Safety status ('Safe', 'Warning', 'Danger') based on the gas level.
    - reading_date (Date): The date when the sensor reading was captured. Defaults to the current date.
    - reading_time (Time): The time when the sensor reading was captured. Defaults to the current local time.
    - created_at (DateTime): Database timestamp of record creation. Defaults to the current timestamp.
    """
    __tablename__ = 'gas_readings'

    id = db.Column(db.Integer, primary_key=True)
    gas_level = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(50), nullable=False)
    reading_date = db.Column(db.Date, nullable=False, default=date.today)
    reading_time = db.Column(db.Time, nullable=False, default=lambda: datetime.now().time())
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    def __repr__(self):
        return f"<GasReading id={self.id} level={self.gas_level} status='{self.status}'>"


def get_status(gas_level):
    """
    Helper Function: Automatically determines safety status category based on gas PPM level.
    - Safe: 0 to 200 PPM
    - Warning: 201 to 350 PPM
    - Danger: Above 350 PPM
    """
    if gas_level <= 200:
        return 'Safe'
    elif gas_level <= 350:
        return 'Warning'
    else:
        return 'Danger'


def create_gas_reading(gas_level, reading_date=None, reading_time=None, created_at=None):
    """
    CRUD Helper: Inserts a new gas reading record into the database.
    - gas_level: Integer PPM value.
    - reading_date: Optional python date. If omitted, defaults to the database creation date (today).
    - reading_time: Optional python time. If omitted, defaults to the database creation time (now).
    - created_at: Optional python datetime. Allows manual backdating of timestamps.
    """
    status = get_status(gas_level)
    
    # If explicit created_at is provided, derive date and time if they are not explicitly set
    if created_at is not None:
        if reading_date is None:
            reading_date = created_at.date()
        if reading_time is None:
            reading_time = created_at.time()

    reading = GasReading(
        gas_level=gas_level,
        status=status,
        reading_date=reading_date,
        reading_time=reading_time,
        created_at=created_at
    )
    
    db.session.add(reading)
    db.session.commit()
    return reading


def get_all_readings():
    """
    CRUD Helper: Retrieves all gas readings from the database, sorted newest first.
    """
    return GasReading.query.order_by(GasReading.created_at.desc()).all()


def get_latest_reading():
    """
    CRUD Helper: Retrieves the single most recent gas reading based on creation timestamp.
    """
    return GasReading.query.order_by(GasReading.created_at.desc()).first()


def update_gas_reading(reading_id, gas_level=None, status=None, reading_date=None, reading_time=None):
    """
    CRUD Helper: Updates fields on an existing gas reading by its primary key ID.
    - If gas_level is updated and status is not specified, status is re-calculated automatically.
    - Returns the updated GasReading object, or None if the record was not found.
    """
    reading = db.session.get(GasReading, reading_id)
    if not reading:
        return None
    
    if gas_level is not None:
        reading.gas_level = gas_level
        # Auto-update status if gas level is modified and status is not overridden
        if status is None:
            reading.status = get_status(gas_level)
            
    if status is not None:
        reading.status = status
        
    if reading_date is not None:
        reading.reading_date = reading_date
        
    if reading_time is not None:
        reading.reading_time = reading_time
        
    db.session.commit()
    return reading


def delete_gas_reading(reading_id):
    """
    CRUD Helper: Deletes a gas reading record from the database by its primary key ID.
    - Returns True if deleted successfully, False if the record was not found.
    """
    reading = db.session.get(GasReading, reading_id)
    if not reading:
        return False
    
    db.session.delete(reading)
    db.session.commit()
    return True


def seed_sample_data():
    """
    Sample Data Generator: Generates and inserts 20 randomized gas readings into the database.
    - Gas values: Randomly range between 50 and 500 PPM.
    - Status values: Derived automatically.
    - Timestamps: Spaced backward at 15-minute intervals starting from the current time.
    """
    base_time = datetime.now()
    for i in range(20):
        gas_level = random.randint(50, 500)
        # Create timestamps backward in 15-minute intervals
        reading_time_offset = base_time - timedelta(minutes=15 * (20 - i))
        create_gas_reading(
            gas_level=gas_level,
            reading_date=reading_time_offset.date(),
            reading_time=reading_time_offset.time(),
            created_at=reading_time_offset
        )
