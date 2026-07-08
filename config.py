import os

# Define the base directory of the project
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    """Base configuration settings."""
    # Secret key for signing session cookies
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-smart-gas-detection-2026')
    
    # SQLite Database connection string
    # Points to gas_monitor.db in the project root
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', 
        f"sqlite:///{os.path.join(BASE_DIR, 'gas_monitor.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Default debug mode
    DEBUG = False
    TESTING = False

class DevelopmentConfig(Config):
    """Development configurations."""
    DEBUG = True

class ProductionConfig(Config):
    """Production configurations."""
    DEBUG = False

class TestingConfig(Config):
    """Testing configurations."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'

# Dictionary to map environment settings
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
