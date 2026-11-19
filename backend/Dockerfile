# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Install system dependencies (needed for compiling Rust, audio tools, cv2, etc.)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    libsndfile1 \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY . .

# Build the Rust extension
RUN cd vocalyze_core && maturin build --release -o dist && pip install dist/*.whl

# Expose the port
EXPOSE ${PORT}

# Run the application using shell variable expansion for the port
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
