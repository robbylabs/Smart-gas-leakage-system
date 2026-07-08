from flask_sqlalchemy import SQLAlchemy

# Why SQLAlchemy is used:
# SQLAlchemy is a powerful SQL Toolkit and Object-Relational Mapper (ORM) for Python.
# It allows developers to interact with the database using Python objects and queries
# rather than writing raw SQL. This improves security (auto-prevents SQL injection),
# maintainability, and code readability, and provides a database-agnostic interface.

db = SQLAlchemy()
