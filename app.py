from flask import Flask, render_template, request, jsonify # type: ignore
import requests # type: ignore
import json
from pypdf import PdfReader # type: ignore
import io
import os
from dotenv import load_dotenv # type: ignore

load_dotenv()

app = Flask(__name__)

API_URL = "https://ai.hackclub.com/proxy/v1/chat/completions"
API_KEY = os.getenv("API_KEY")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.pdf'):
        try:
            pdf_reader = PdfReader(file)
            text_content = ""
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\n"
            
            headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            }
            
            data = {
                "model": "google/gemini-2.5-flash",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "You are now my personal AI note-taking assistant for lectures. "
                                    "Your task is to help me create clear, concise, and well-organized notes based on the text provided below. "
                                    "Organize the content into a logical structure with main topics and subtopics. "
                                    "Use bullet points, numbering, and indentation to improve readability. "
                                    "Highlight key concepts, definitions, and important facts in bold. "
                                    "Create mnemonics or memory aids for difficult-to-remember information. "
                                    "Identify any formulas, equations, or statistical data, and format them clearly. "
                                    "Please format the notes in visually appealing Markdown, using appropriate headings, subheadings, and spacing."
                                    "Do not include any other information or explanations, just the notes in Markdown format."
                                ),
                            },
                            {
                                "type": "text",
                                "text": f"Here is the lecture content:\n\n{text_content}"
                            }
                        ],
                    }
                ],
            }
            
            response = requests.post(API_URL, headers=headers, json=data)
            response.raise_for_status()
            
            notes = response.json()["choices"][0]["message"]["content"]
            
            return jsonify({'notes': notes})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400

if __name__ == '__main__':
    app.run(debug=True, port=8080)
