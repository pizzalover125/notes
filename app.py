from flask import Flask, render_template, request, jsonify # type: ignore
import requests # type: ignore
import json
import base64
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
            pdf_base64 = f"data:application/pdf;base64,{base64.b64encode(file.read()).decode()}"

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
                                    "Your task is to help me create clear, concise, and well-organized notes based on the attached PDF. "
                                    "Organize the content into a logical structure with main topics and subtopics. "
                                    "Use bullet points, numbering, and indentation to improve readability. "
                                    "Highlight key concepts, definitions, and important facts in bold. "
                                    "Create mnemonics or memory aids for difficult-to-remember information. "
                                    "Identify any formulas, equations, or statistical data, and format them clearly. "
                                    "Please format the notes in visually appealing Markdown, using appropriate headings, subheadings, and spacing. "
                                    "Do not include any other information or explanations, just the notes in Markdown format."
                                ),
                            },
                            {
                                "type": "file",
                                "file": {
                                    "filename": file.filename,
                                    "file_data": pdf_base64
                                }
                            }
                        ],
                    }
                ],
                "plugins": [
                    {
                        "id": "file-parser",
                        "pdf": {"engine": "native"}
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

@app.route('/flashcards', methods=['POST'])
def generate_flashcards():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.pdf'):
        try:
            pdf_base64 = f"data:application/pdf;base64,{base64.b64encode(file.read()).decode()}"

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
                                    "You are a flashcard generator. Based on the attached PDF, "
                                    "create a set of flashcards for studying. Each flashcard should have a "
                                    "question on the front and a concise answer on the back. "
                                    "Cover all key concepts, definitions, formulas, and important facts. "
                                    "Return ONLY a valid JSON array with no other text, no markdown fences, no explanation. "
                                    "Each element must have \"front\" and \"back\" keys. "
                                    "Example: [{\"front\": \"What is X?\", \"back\": \"X is ...\"}, ...] "
                                ),
                            },
                            {
                                "type": "file",
                                "file": {
                                    "filename": file.filename,
                                    "file_data": pdf_base64
                                }
                            }
                        ],
                    }
                ],
                "plugins": [
                    {
                        "id": "file-parser",
                        "pdf": {"engine": "native"}
                    }
                ],
            }

            response = requests.post(API_URL, headers=headers, json=data)
            response.raise_for_status()

            raw = response.json()["choices"][0]["message"]["content"]
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            flashcards = json.loads(cleaned.strip())

            return jsonify({'flashcards': flashcards})

        except json.JSONDecodeError:
            return jsonify({'error': 'Failed to parse flashcards from AI response.'}), 500
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400

@app.route('/quiz', methods=['POST'])
def generate_quiz():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and file.filename.endswith('.pdf'):
        try:
            pdf_base64 = f"data:application/pdf;base64,{base64.b64encode(file.read()).decode()}"

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
                                    "You are a quiz generator. Based on the attached PDF, "
                                    "create exactly 10 multiple choice questions to test understanding. "
                                    "Each question must have exactly 4 answer options labeled A, B, C, D. "
                                    "Only one option should be correct. "
                                    "Return ONLY a valid JSON array with no other text, no markdown fences, no explanation. "
                                    "Each element must have: "
                                    '"question" (string), '
                                    '"options" (object with keys "A", "B", "C", "D"), '
                                    '"answer" (string, the correct letter e.g. "A"). '
                                    'Example: [{"question": "What is X?", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "answer": "B"}]'
                                ),
                            },
                            {
                                "type": "file",
                                "file": {
                                    "filename": file.filename,
                                    "file_data": pdf_base64
                                }
                            }
                        ],
                    }
                ],
                "plugins": [
                    {
                        "id": "file-parser",
                        "pdf": {"engine": "native"}
                    }
                ],
            }

            response = requests.post(API_URL, headers=headers, json=data)
            response.raise_for_status()

            raw = response.json()["choices"][0]["message"]["content"]
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            quiz = json.loads(cleaned.strip())

            for q in quiz:
                q['options'] = {k: v for k, v in q.get('options', {}).items() if k in ('A', 'B', 'C', 'D')}
                q['answer'] = q.get('answer', '').strip()[:1].upper()

            return jsonify({'quiz': quiz})

        except json.JSONDecodeError:
            return jsonify({'error': 'Failed to parse quiz from AI response.'}), 500
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400

if __name__ == '__main__':
    app.run(debug=True, port=8080)
