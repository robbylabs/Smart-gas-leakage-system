import os
from flask import Flask
from config import config_by_name
from database import db
from routes import main_bp

def create_app(config_name=None):
    """
    Application factory pattern to create and configure the Flask application.
    """
    app = Flask(__name__)
    
    # Load configuration based on active environment (defaults to development)
    if not config_name:
        config_name = os.environ.get('FLASK_ENV', 'development')
    
    app.config.from_object(config_by_name.get(config_name, config_by_name['default']))
    
    # Initialize the database with the Flask app context
    db.init_app(app)
    
    # Register the main blueprint containing all UI and test API routes
    app.register_blueprint(main_bp)
    
    # Context processor to inject common variables into templates
    @app.context_processor
    def inject_now():
        return {'active_page': active_page_context()}

    def active_page_context():
        return None

    return app

app = create_app()

if __name__ == '__main__':
    # Run the application locally
    # Port is set to 5000; debug is loaded from config
    app.run(host='0.0.0.0', port=5000, debug=app.config.get('DEBUG', True))

