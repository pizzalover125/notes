import sys
import os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root)
os.chdir(root)

from app import app

app.template_folder = os.path.join(root, 'templates')
app.static_folder = os.path.join(root, 'static')
