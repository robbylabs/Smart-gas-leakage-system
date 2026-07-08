from flask import Blueprint, jsonify, render_template, request
from database import db
from models import (
    GasReading,
    create_gas_reading,
    get_all_readings,
    get_latest_reading,
    delete_gas_reading,
    seed_sample_data
)
import sqlalchemy.exc

# Create a single Blueprint for all routes (UI and API testing)
# Using url_prefix="" ensures the UI routes match the Phase 1 layout perfectly.
main_bp = Blueprint('main', __name__)

# --- UI ROUTES ---

@main_bp.route('/')
@main_bp.route('/dashboard')
def dashboard():
    """Render the main system dashboard."""
    return render_template('dashboard.html', active_page='dashboard')

@main_bp.route('/history')
def history():
    """Render the historical sensor readings page."""
    return render_template('history.html', active_page='history')

@main_bp.route('/analytics')
def analytics():
    """Render the system analytics and metrics page."""
    return render_template('analytics.html', active_page='analytics')

@main_bp.route('/about')
def about():
    """Render the project description and specifications page."""
    return render_template('about.html', active_page='about')


# --- TESTING API ROUTES (Phase 2 Development & Verification) ---

@main_bp.route('/initialize-db', methods=['GET'])
def initialize_db():
    """
    GET /initialize-db: Creates the database file and all required tables.
    - Uses db.create_all() which checks if tables exist.
    - Prevents duplicate initialization errors automatically.
    """
    try:
        db.create_all()
        return jsonify({
            "status": "success",
            "message": "Database and tables initialized successfully."
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Database initialization failed. Check connection configurations.",
            "details": str(e)
        }), 500


@main_bp.route('/seed-data', methods=['GET'])
def seed_data():
    """
    GET /seed-data: Adds 20 realistic, randomized sample sensor readings to the database.
    """
    try:
        seed_sample_data()
        return jsonify({
            "status": "success",
            "message": "Successfully seeded database with 20 sample readings."
        }), 201
    except sqlalchemy.exc.OperationalError as e:
        return jsonify({
            "status": "error",
            "message": "Database tables not found. Please visit /initialize-db first to create the tables.",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to seed database.",
            "details": str(e)
        }), 500


@main_bp.route('/readings', methods=['GET'])
def readings():
    """
    GET /readings: Returns all gas readings sorted by newest first in JSON format.
    """
    try:
        all_readings = get_all_readings()
        readings_list = [
            {
                "id": r.id,
                "gas_level": r.gas_level,
                "status": r.status,
                "reading_date": r.reading_date.isoformat() if r.reading_date else None,
                "reading_time": r.reading_time.isoformat() if r.reading_time else None,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in all_readings
        ]
        return jsonify({
            "status": "success",
            "count": len(readings_list),
            "data": readings_list
        }), 200
    except sqlalchemy.exc.OperationalError as e:
        return jsonify({
            "status": "error",
            "message": "Database table 'gas_readings' does not exist. Please initialize the database via /initialize-db.",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve readings.",
            "details": str(e)
        }), 500


@main_bp.route('/reading/latest', methods=['GET'])
def reading_latest():
    """
    GET /reading/latest: Returns the single most recent gas reading in JSON format.
    """
    try:
        latest = get_latest_reading()
        if not latest:
            return jsonify({
                "status": "success",
                "message": "No readings found in the database. Please visit /seed-data to add records."
            }), 404
        
        return jsonify({
            "status": "success",
            "data": {
                "id": latest.id,
                "gas_level": latest.gas_level,
                "status": latest.status,
                "reading_date": latest.reading_date.isoformat() if latest.reading_date else None,
                "reading_time": latest.reading_time.isoformat() if latest.reading_time else None,
                "created_at": latest.created_at.isoformat() if latest.created_at else None
            }
        }), 200
    except sqlalchemy.exc.OperationalError as e:
        return jsonify({
            "status": "error",
            "message": "Database table 'gas_readings' does not exist. Please initialize the database via /initialize-db.",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve latest reading.",
            "details": str(e)
        }), 500


@main_bp.route('/reading/<int:reading_id>', methods=['DELETE'])
def delete_reading(reading_id):
    """
    DELETE /reading/<id>: Deletes a specific gas reading record by ID.
    - Handles case where reading ID does not exist or is invalid.
    """
    try:
        success = delete_gas_reading(reading_id)
        if not success:
            return jsonify({
                "status": "error",
                "message": f"Reading with ID {reading_id} not found."
            }), 404
            
        return jsonify({
            "status": "success",
            "message": f"Reading with ID {reading_id} deleted successfully."
        }), 200
    except sqlalchemy.exc.OperationalError as e:
        return jsonify({
            "status": "error",
            "message": "Database not initialized. Please visit /initialize-db.",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to delete reading.",
            "details": str(e)
        }), 500


@main_bp.route('/api/simulate', methods=['POST'])
def api_simulate():
    """
    POST /api/simulate: Generates a random gas reading (50-500 PPM),
    stores it in the SQLite database, and returns the updated dashboard metrics.
    """
    try:
        import random
        gas_level = random.randint(50, 500)
        
        # Create and store the reading
        # This automatically determines the status (Safe, Warning, Danger)
        from models.gas_reading import create_gas_reading
        new_reading = create_gas_reading(gas_level=gas_level)
        
        # Return the full updated dashboard data (avoiding double requests)
        total_readings = db.session.query(db.func.count(GasReading.id)).scalar() or 0
        highest_reading = db.session.query(db.func.max(GasReading.gas_level)).scalar() or 0
        average_reading = db.session.query(db.func.avg(GasReading.gas_level)).scalar() or 0
        total_alerts = db.session.query(db.func.count(GasReading.id)).filter(
            GasReading.status.in_(['Warning', 'Danger'])
        ).scalar() or 0
        
        latest_10 = GasReading.query.order_by(GasReading.created_at.desc()).limit(10).all()
        latest_10_list = [
            {
                "id": r.id,
                "gas_level": r.gas_level,
                "status": r.status,
                "reading_date": r.reading_date.isoformat() if r.reading_date else None,
                "reading_time": r.reading_time.isoformat() if r.reading_time else None,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in latest_10
        ]
        
        current_data = {
            "id": new_reading.id,
            "gas_level": new_reading.gas_level,
            "status": new_reading.status,
            "reading_date": new_reading.reading_date.isoformat() if new_reading.reading_date else None,
            "reading_time": new_reading.reading_time.isoformat() if new_reading.reading_time else None,
            "created_at": new_reading.created_at.isoformat() if new_reading.created_at else None
        }
        
        return jsonify({
            "status": "success",
            "message": "Gas reading simulated and stored successfully.",
            "data": {
                "current_reading": current_data,
                "highest_reading": int(highest_reading),
                "average_reading": round(float(average_reading), 1),
                "total_readings": int(total_readings),
                "total_alerts": int(total_alerts),
                "latest_10_readings": latest_10_list
            }
        }), 201
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to simulate gas reading.",
            "details": str(e)
        }), 500


@main_bp.route('/api/dashboard', methods=['GET'])
def api_dashboard():
    """
    GET /api/dashboard: Returns statistics and latest 10 readings in JSON format.
    Handles empty database state gracefully.
    """
    try:
        # Check if table exists by querying or letting SQLAlchemy handle it
        total_readings = db.session.query(db.func.count(GasReading.id)).scalar() or 0
        
        if total_readings == 0:
            return jsonify({
                "status": "success",
                "data": {
                    "current_reading": None,
                    "highest_reading": 0,
                    "average_reading": 0,
                    "total_readings": 0,
                    "total_alerts": 0,
                    "latest_10_readings": []
                }
            }), 200
            
        latest_reading = get_latest_reading()
        highest_reading = db.session.query(db.func.max(GasReading.gas_level)).scalar() or 0
        average_reading = db.session.query(db.func.avg(GasReading.gas_level)).scalar() or 0
        total_alerts = db.session.query(db.func.count(GasReading.id)).filter(
            GasReading.status.in_(['Warning', 'Danger'])
        ).scalar() or 0
        
        latest_10 = GasReading.query.order_by(GasReading.created_at.desc()).limit(10).all()
        
        latest_10_list = [
            {
                "id": r.id,
                "gas_level": r.gas_level,
                "status": r.status,
                "reading_date": r.reading_date.isoformat() if r.reading_date else None,
                "reading_time": r.reading_time.isoformat() if r.reading_time else None,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in latest_10
        ]
        
        current_data = {
            "id": latest_reading.id,
            "gas_level": latest_reading.gas_level,
            "status": latest_reading.status,
            "reading_date": latest_reading.reading_date.isoformat() if latest_reading.reading_date else None,
            "reading_time": latest_reading.reading_time.isoformat() if latest_reading.reading_time else None,
            "created_at": latest_reading.created_at.isoformat() if latest_reading.created_at else None
        } if latest_reading else None

        return jsonify({
            "status": "success",
            "data": {
                "current_reading": current_data,
                "highest_reading": int(highest_reading),
                "average_reading": round(float(average_reading), 1),
                "total_readings": int(total_readings),
                "total_alerts": int(total_alerts),
                "latest_10_readings": latest_10_list
            }
        }), 200
        
    except sqlalchemy.exc.OperationalError as e:
        return jsonify({
            "status": "error",
            "message": "Database table 'gas_readings' does not exist. Please initialize the database via /initialize-db.",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to load dashboard data.",
            "details": str(e)
        }), 500


@main_bp.route('/api/latest', methods=['GET'])
def api_latest():
    """
    GET /api/latest: Returns the single most recent gas reading in JSON format.
    """
    try:
        latest = get_latest_reading()
        if not latest:
            return jsonify({
                "status": "success",
                "data": None,
                "message": "No readings found in the database."
            }), 200
            
        return jsonify({
            "status": "success",
            "data": {
                "id": latest.id,
                "gas_level": latest.gas_level,
                "status": latest.status,
                "reading_date": latest.reading_date.isoformat() if latest.reading_date else None,
                "reading_time": latest.reading_time.isoformat() if latest.reading_time else None,
                "created_at": latest.created_at.isoformat() if latest.created_at else None
            }
        }), 200
    except sqlalchemy.exc.OperationalError as e:
        return jsonify({
            "status": "error",
            "message": "Database table 'gas_readings' does not exist. Please initialize the database via /initialize-db.",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to load latest reading.",
            "details": str(e)
        }), 500


# --- HISTORY MODULE API ENDPOINTS (Phase 5) ---

def paginate_and_format_query(query, page, per_page, sort_option):
    """
    Helper Function: Applies sorting and limit/offset pagination to a SQLAlchemy query
    and formats the results as a standard JSON list container.
    """
    # Apply Sorting logic
    if sort_option == 'oldest':
        query = query.order_by(GasReading.created_at.asc())
    elif sort_option == 'highest':
        query = query.order_by(GasReading.gas_level.desc())
    elif sort_option == 'lowest':
        query = query.order_by(GasReading.gas_level.asc())
    else:  # 'newest' (default)
        query = query.order_by(GasReading.created_at.desc())
        
    total_records = query.count()
    total_pages = (total_records + per_page - 1) // per_page
    
    # Slice using pagination math
    offset = (page - 1) * per_page
    readings = query.offset(offset).limit(per_page).all()
    
    readings_list = [
        {
            "id": r.id,
            "gas_level": r.gas_level,
            "status": r.status,
            "reading_date": r.reading_date.isoformat() if r.reading_date else None,
            "reading_time": r.reading_time.isoformat() if r.reading_time else None,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in readings
    ]
    
    return {
        "readings": readings_list,
        "total_pages": total_pages,
        "current_page": page,
        "total_records": total_records
    }


@main_bp.route('/api/history', methods=['GET'])
def api_history():
    """
    GET /api/history: Returns paginated and sorted list of all gas readings.
    Supports query parameters: page (default 1), sort (default 'newest').
    """
    try:
        page = request.args.get('page', 1, type=int)
        sort_option = request.args.get('sort', 'newest', type=str)
        per_page = 10
        
        base_query = GasReading.query
        result = paginate_and_format_query(base_query, page, per_page, sort_option)
        
        return jsonify({
            "status": "success",
            "data": result
        }), 200
    except sqlalchemy.exc.OperationalError as e:
        return jsonify({
            "status": "error",
            "message": "Database not initialized. Please visit /initialize-db first.",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to load readings history.",
            "details": str(e)
        }), 500


@main_bp.route('/api/history/search', methods=['GET'])
def api_history_search():
    """
    GET /api/history/search: Performs queries on readings matching keywords.
    Matches status text (Safe, Warning, Danger), exact PPM gas levels, or date strings.
    """
    try:
        search_query = request.args.get('q', '', type=str).strip()
        page = request.args.get('page', 1, type=int)
        sort_option = request.args.get('sort', 'newest', type=str)
        per_page = 10
        
        if not search_query:
            result = paginate_and_format_query(GasReading.query, page, per_page, sort_option)
            return jsonify({"status": "success", "data": result}), 200
            
        query = GasReading.query
        
        # Build logical OR query criteria
        # 1. Match status case-insensitively (ilike)
        status_filter = GasReading.status.ilike(f"%{search_query}%")
        filters = [status_filter]
        
        # 2. Match exact gas_level if query string is numeric
        if search_query.isdigit():
            filters.append(GasReading.gas_level == int(search_query))
            
        # 3. Match partial text search on the Date field (stored as SQLite text representation)
        filters.append(GasReading.reading_date.cast(db.String).ilike(f"%{search_query}%"))
        
        query = query.filter(db.or_(*filters))
        result = paginate_and_format_query(query, page, per_page, sort_option)
        
        return jsonify({
            "status": "success",
            "data": result
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to search readings.",
            "details": str(e)
        }), 500


@main_bp.route('/api/history/filter', methods=['GET'])
def api_history_filter():
    """
    GET /api/history/filter: Filters records by a status category (Safe, Warning, Danger)
    and/or a specific calendar date (YYYY-MM-DD).
    """
    try:
        status_filter = request.args.get('status', 'all', type=str).strip().lower()
        date_filter = request.args.get('date', '', type=str).strip()
        page = request.args.get('page', 1, type=int)
        sort_option = request.args.get('sort', 'newest', type=str)
        per_page = 10
        
        query = GasReading.query
        
        # Apply Status filter logic
        if status_filter != 'all' and status_filter != '':
            cap_status = status_filter.capitalize()
            query = query.filter(GasReading.status == cap_status)
            
        # Apply Date filter logic
        if date_filter:
            try:
                from datetime import datetime
                parsed_date = datetime.strptime(date_filter, '%Y-%m-%d').date()
                query = query.filter(GasReading.reading_date == parsed_date)
            except ValueError:
                pass  # Ignore invalid date input format
                
        result = paginate_and_format_query(query, page, per_page, sort_option)
        
        return jsonify({
            "status": "success",
            "data": result
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to filter readings.",
            "details": str(e)
        }), 500


@main_bp.route('/api/history/stats', methods=['GET'])
def api_history_stats():
    """
    GET /api/history/stats: Returns counts of safe, warning, and danger logs.
    """
    try:
        total = db.session.query(db.func.count(GasReading.id)).scalar() or 0
        safe = db.session.query(db.func.count(GasReading.id)).filter(GasReading.status == 'Safe').scalar() or 0
        warning = db.session.query(db.func.count(GasReading.id)).filter(GasReading.status == 'Warning').scalar() or 0
        danger = db.session.query(db.func.count(GasReading.id)).filter(GasReading.status == 'Danger').scalar() or 0
        
        return jsonify({
            "status": "success",
            "data": {
                "total": total,
                "safe": safe,
                "warning": warning,
                "danger": danger
            }
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to load database stats.",
            "details": str(e)
        }), 500


@main_bp.route('/api/history/<int:reading_id>', methods=['DELETE'])
def api_delete_history_reading(reading_id):
    """
    DELETE /api/history/<id>: Deletes a single gas reading record from SQLite by primary key.
    """
    try:
        success = delete_gas_reading(reading_id)
        if not success:
            return jsonify({
                "status": "error",
                "message": f"Reading with ID {reading_id} not found."
            }), 404
            
        return jsonify({
            "status": "success",
            "message": f"Reading with ID {reading_id} was deleted successfully from SQLite."
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to delete reading.",
            "details": str(e)
        }), 500


# --- ANALYTICS MODULE ENDPOINTS (Phase 6) ---

def calculate_median(query):
    """
    Helper Function: Extracts the gas_level readings from a SQLAlchemy query,
    sorts them, and calculates the exact median value (handling odd/even dataset sizes).
    """
    levels = [r.gas_level for r in query.all()]
    if not levels:
        return 0.0
    levels.sort()
    n = len(levels)
    if n % 2 == 1:
        return float(levels[n // 2])
    else:
        return float(levels[n // 2 - 1] + levels[n // 2]) / 2.0


@main_bp.route('/api/analytics', methods=['GET'])
def api_analytics():
    """
    GET /api/analytics: Generates consolidated statistics, status categories counts,
    and median calculations for gas sensor data.
    """
    try:
        total = db.session.query(db.func.count(GasReading.id)).scalar() or 0
        
        if total == 0:
            return jsonify({
                "status": "success",
                "data": {
                    "highest_reading": 0,
                    "lowest_reading": 0,
                    "average_reading": 0.0,
                    "median_reading": 0.0,
                    "total_readings": 0,
                    "safe_count": 0,
                    "warning_count": 0,
                    "danger_count": 0,
                    "total_alerts": 0
                }
            }), 200
            
        highest = db.session.query(db.func.max(GasReading.gas_level)).scalar() or 0
        lowest = db.session.query(db.func.min(GasReading.gas_level)).scalar() or 0
        average = db.session.query(db.func.avg(GasReading.gas_level)).scalar() or 0
        
        safe_count = db.session.query(db.func.count(GasReading.id)).filter(GasReading.status == 'Safe').scalar() or 0
        warning_count = db.session.query(db.func.count(GasReading.id)).filter(GasReading.status == 'Warning').scalar() or 0
        danger_count = db.session.query(db.func.count(GasReading.id)).filter(GasReading.status == 'Danger').scalar() or 0
        
        # Alerts are Warnings (201-350 PPM) and Danger (>350 PPM)
        total_alerts = warning_count + danger_count
        median = calculate_median(GasReading.query)
        
        return jsonify({
            "status": "success",
            "data": {
                "highest_reading": int(highest),
                "lowest_reading": int(lowest),
                "average_reading": round(float(average), 1),
                "median_reading": round(float(median), 1),
                "total_readings": int(total),
                "safe_count": int(safe_count),
                "warning_count": int(warning_count),
                "danger_count": int(danger_count),
                "total_alerts": int(total_alerts)
            }
        }), 200
    except sqlalchemy.exc.OperationalError as e:
        return jsonify({
            "status": "error",
            "message": "Database not initialized. Please visit /initialize-db first.",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to load analytics metrics.",
            "details": str(e)
        }), 500


@main_bp.route('/api/chart-data', methods=['GET'])
def api_chart_data():
    """
    GET /api/chart-data: Returns organized dataset structures ready for Chart.js renders.
    """
    try:
        # 1. Live Gas Level: Latest 20 readings (in chronological order for line graph)
        live_readings = GasReading.query.order_by(GasReading.created_at.desc()).limit(20).all()
        live_readings.reverse() # Sort left-to-right (chronological)
        
        live_chart = [
            {
                "id": r.id,
                "gas_level": r.gas_level,
                "reading_time": r.reading_time.isoformat() if r.reading_time else None
            }
            for r in live_readings
        ]
        
        # 2. Status Distribution (Pie Chart counts)
        safe_count = db.session.query(db.func.count(GasReading.id)).filter(GasReading.status == 'Safe').scalar() or 0
        warning_count = db.session.query(db.func.count(GasReading.id)).filter(GasReading.status == 'Warning').scalar() or 0
        danger_count = db.session.query(db.func.count(GasReading.id)).filter(GasReading.status == 'Danger').scalar() or 0
        
        status_dist = {
            "safe": safe_count,
            "warning": warning_count,
            "danger": danger_count
        }
        
        # 3. Daily Average (grouped by date)
        daily_raw = db.session.query(
            GasReading.reading_date, 
            db.func.avg(GasReading.gas_level)
        ).group_by(
            GasReading.reading_date
        ).order_by(
            GasReading.reading_date.asc()
        ).all()
        
        daily_avg = [
            {
                "date": r[0].isoformat() if r[0] else None,
                "average": round(float(r[1]), 1) if r[1] is not None else 0.0
            }
            for r in daily_raw
        ]
        
        # 4. Weekly Trend (Calculated for the past 7 calendar dates)
        from datetime import date, timedelta
        past_7_days = [date.today() - timedelta(days=i) for i in range(6, -1, -1)]
        weekly_raw = db.session.query(
            GasReading.reading_date, 
            db.func.avg(GasReading.gas_level)
        ).filter(
            GasReading.reading_date >= past_7_days[0]
        ).group_by(
            GasReading.reading_date
        ).all()
        
        weekly_map = {r[0]: round(float(r[1]), 1) for r in weekly_raw if r[0] is not None}
        
        weekly_trend = [
            {
                "date": d.strftime('%b %d'), # Example: "Jul 08"
                "average": weekly_map.get(d, 0.0)
            }
            for d in past_7_days
        ]
        
        # 5. Alert Distribution Doughnut (Warning vs Danger Counts)
        alert_dist = {
            "warnings": warning_count,
            "danger_alerts": danger_count
        }
        
        return jsonify({
            "status": "success",
            "data": {
                "live_chart": live_chart,
                "status_dist": status_dist,
                "daily_avg": daily_avg,
                "weekly_trend": weekly_trend,
                "alert_dist": alert_dist
            }
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to load chart datasets.",
            "details": str(e)
        }), 500


@main_bp.route('/api/recent-alerts', methods=['GET'])
def api_recent_alerts():
    """
    GET /api/recent-alerts: Returns the 5 most recent warning or danger logs.
    """
    try:
        alerts = GasReading.query.filter(
            GasReading.status.in_(['Warning', 'Danger'])
        ).order_by(
            GasReading.created_at.desc()
        ).limit(5).all()
        
        alerts_list = [
            {
                "id": r.id,
                "gas_level": r.gas_level,
                "status": r.status,
                "reading_date": r.reading_date.isoformat() if r.reading_date else None,
                "reading_time": r.reading_time.isoformat() if r.reading_time else None
            }
            for r in alerts
        ]
        
        return jsonify({
            "status": "success",
            "data": alerts_list
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Failed to load recent alerts.",
            "details": str(e)
        }), 500



