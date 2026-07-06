# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the backend and frontend code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Set the environment variable for Port (default to 5000 if not set)
ENV PORT=5000

# Expose the port
EXPOSE 5000

# Run gunicorn to serve the Flask app
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT --chdir backend app:app"]
