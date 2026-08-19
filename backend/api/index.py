import sys
import os

# Add parent directory (backend root) to Python search path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
