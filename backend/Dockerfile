# Use Playwright base image which has Python and browser packages pre-configured
FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

WORKDIR /workspace

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Python image has browsers installed, but let's ensure chromium is linked
RUN playwright install chromium

# Copy app code
COPY app/ ./app/

# Expose FastAPI port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Run Uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
