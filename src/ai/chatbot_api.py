"""
SmartBlood Chatbot API Service — HTTP Endpoint for Next.js Integration
========================================================================

This file provides a simple HTTP API that your Next.js app can call.

Usage:
    python src/ai/chatbot_api.py

    Then in Next.js, POST to: http://localhost:5000/chat
    with: {"message": "user question"}
    
ARCHITECTURE:
    - No external dependencies (no Flask, no FastAPI)
    - Pure Python HTTP server
    - Easy to debug and understand
    - Single-threaded (simple but sufficient)
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sys
import os
from datetime import datetime


# Add src/ai to path so we can import our chatbot
sys.path.insert(0, os.path.dirname(__file__))

from chatbot_core import SmartBloodChatBot


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

class Config:
    """Configuration for the chatbot service"""
    
    # Server settings
    HOST = '127.0.0.1'  # Only accept local connections (more secure)
    PORT = 5000
    
    # Dataset location (relative to workspace root)
    DATASET_DIR = 'dataset'
    
    # Logging
    LOG_FILE = 'logs/chatbot_api.log'
    DEBUG = True


# ═══════════════════════════════════════════════════════════════════════════════
# SIMPLE LOGGER - Understand what's happening
# ═══════════════════════════════════════════════════════════════════════════════

class SimpleLogger:
    """Logs events to file and console"""
    
    def __init__(self, log_file: str):
        self.log_file = log_file
        # Ensure log directory exists
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
    
    def log(self, level: str, message: str):
        """Write a log message"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_entry = f"[{timestamp}] {level}: {message}"
        
        # Write to file
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry + '\n')
        except:
            pass  # Fail silently if can't write
        
        # Print to console
        print(log_entry)
    
    def info(self, message: str):
        self.log('INFO', message)
    
    def error(self, message: str):
        self.log('ERROR', message)
    
    def debug(self, message: str):
        if Config.DEBUG:
            self.log('DEBUG', message)


# ═══════════════════════════════════════════════════════════════════════════════
# HTTP Request Handler
# ═══════════════════════════════════════════════════════════════════════════════

class ChatBotHandler(BaseHTTPRequestHandler):
    """
    Handles HTTP requests to the chatbot API.
    
    Supported endpoints:
    - POST /chat          → Chat with user (main endpoint)
    - GET  /health       → Check if service is alive
    - GET  /stats        → Get chatbot statistics
    """
    
    # Class-level chatbot instance (shared across requests)
    chatbot = None
    logger = None
    
    def do_POST(self):
        """Handle POST requests from Next.js"""
        
        if self.path == '/chat':
            self.handle_chat_request()
        else:
            self.send_error(404, 'Not found')
    
    def do_GET(self):
        """Handle GET requests (health check, stats)"""
        
        if self.path == '/health':
            self.handle_health_check()
        elif self.path == '/stats':
            self.handle_stats_request()
        else:
            self.send_error(404, 'Not found')
    
    def handle_chat_request(self):
        """
        Main chatbot endpoint.
        
        Request format:
            POST /chat
            Content-Type: application/json
            
            {"message": "user's question here"}
        
        Response format:
            {"answer": "response", "confidence": 0.85, ...}
        """
        
        try:
            # Step 1: Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            # Step 2: Parse JSON
            request_data = json.loads(body.decode('utf-8'))
            user_message = request_data.get('message', '').strip()
            
            if not user_message:
                self.send_json_response({'error': 'Message is required'}, 400)
                return
            
            # Step 3: Log the request
            self.logger.debug(f"Chat request: {user_message[:50]}...")
            
            # Step 4: Get chatbot response
            chat_response = self.chatbot.chat(user_message)
            
            # Step 5: Format response
            response_data = {
                'answer': chat_response.answer,
                'confidence': chat_response.confidence,
                'matched_question': chat_response.matched_question,
                'category': chat_response.category,
                'language': chat_response.language,
            }
            
            # Step 6: Send response
            self.send_json_response(response_data, 200)
            self.logger.debug(f"Response sent for language: {chat_response.language}")
            
        except json.JSONDecodeError:
            self.send_json_response({'error': 'Invalid JSON'}, 400)
            self.logger.error('Invalid JSON received')
        except Exception as e:
            self.send_json_response({'error': str(e)}, 500)
            self.logger.error(f'Error processing request: {str(e)}')
    
    def handle_health_check(self):
        """Check if API is running"""
        response = {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
        }
        self.send_json_response(response, 200)
    
    def handle_stats_request(self):
        """Return chatbot statistics"""
        
        # Count total Q&A pairs in datasets
        en_dataset = self.chatbot.load_dataset('en')
        si_dataset = self.chatbot.load_dataset('si')
        singlish_dataset = self.chatbot.load_dataset('singlish')
        
        stats = {
            'english_pairs': len(en_dataset),
            'sinhala_pairs': len(si_dataset),
            'singlish_pairs': len(singlish_dataset),
            'total_pairs': len(en_dataset) + len(si_dataset) + len(singlish_dataset),
            'languages_supported': ['en', 'si', 'singlish'],
        }
        
        self.send_json_response(stats, 200)
    
    def send_json_response(self, data: dict, status_code: int):
        """Send JSON response to client"""
        
        response = json.dumps(data, ensure_ascii=False, indent=2)
        
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')  # Allow CORS
        self.end_headers()
        
        self.wfile.write(response.encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override to use our logger instead of default"""
        self.logger.debug(format % args)


# ═══════════════════════════════════════════════════════════════════════════════
# SERVER STARTUP
# ═══════════════════════════════════════════════════════════════════════════════

def start_server():
    """Start the chatbot HTTP server"""
    
    # Initialize logger
    logger = SimpleLogger(Config.LOG_FILE)
    ChatBotHandler.logger = logger
    
    # Initialize chatbot
    logger.info('Initializing SmartBlood Chatbot...')
    try:
        chatbot = SmartBloodChatBot(dataset_dir=Config.DATASET_DIR)
        ChatBotHandler.chatbot = chatbot
        
        # Preload datasets to verify they work
        for lang in ['en', 'si', 'singlish']:
            dataset = chatbot.load_dataset(lang)
            logger.info(f'Loaded {lang} dataset: {len(dataset)} Q&A pairs')
        
    except Exception as e:
        logger.error(f'Failed to initialize chatbot: {str(e)}')
        return
    
    # Start HTTP server
    server_address = (Config.HOST, Config.PORT)
    httpd = HTTPServer(server_address, ChatBotHandler)
    
    logger.info(f'Starting chatbot server on {Config.HOST}:{Config.PORT}')
    logger.info(f'Endpoints:')
    logger.info(f'  - POST http://{Config.HOST}:{Config.PORT}/chat')
    logger.info(f'  - GET  http://{Config.HOST}:{Config.PORT}/health')
    logger.info(f'  - GET  http://{Config.HOST}:{Config.PORT}/stats')
    logger.info('Press Ctrl+C to shutdown')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info('Shutting down...')
        httpd.shutdown()
        logger.info('Server stopped gracefully')


if __name__ == '__main__':
    start_server()
