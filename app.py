from flask import Flask, render_template, request, jsonify
import requests
import json
import base64
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import re
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

API_URL = "https://ai.hackclub.com/proxy/v1/chat/completions"
API_KEY = os.getenv("API_KEY")
DEFAULT_MODEL = "google/gemini-3-flash-preview"

AVAILABLE_MODELS = [
    {"id": "google/gemini-3-flash-preview", "name": "Gemini 3 Flash"},
    {"id": "openai/gpt-5-mini", "name": "GPT-5 Mini"},
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/models', methods=['GET'])
def get_models():
    return jsonify({'models': AVAILABLE_MODELS, 'default': DEFAULT_MODEL})

def get_model_from_request():
    """Extract model from form data or JSON body, falling back to default."""
    model = request.form.get('model') or DEFAULT_MODEL
    if not any(m['id'] == model for m in AVAILABLE_MODELS):
        model = DEFAULT_MODEL
    return model

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.pdf'):
        try:
            model = get_model_from_request()
            pdf_base64 = f"data:application/pdf;base64,{base64.b64encode(file.read()).decode()}"

            headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            }
            
            data = {
                "model": model,
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
            notes = _strip_think_tags(notes)
            notes = _strip_markdown_fences(notes)
            
            return jsonify({'notes': notes})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400

def _strip_think_tags(text):
    """Remove <think>...</think> blocks from reasoning model output."""
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()

def _strip_markdown_fences(text):
    """Remove wrapping code fences (```markdown ... ```) from AI output."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.rstrip().endswith("```"):
        text = text.rstrip()[:-3]
    return text.strip()

def _call_ai(headers, model, pdf_base64, filename, prompt):
    """Helper to make one AI API call."""
    data = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "file", "file": {"filename": filename, "file_data": pdf_base64}},
                ],
            }
        ],
        "plugins": [{"id": "file-parser", "pdf": {"engine": "native"}}],
    }
    response = requests.post(API_URL, headers=headers, json=data)
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    content = _strip_think_tags(content)
    return content

def _parse_json_response(raw):
    """Strip markdown fences and parse JSON."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    return json.loads(cleaned.strip())

NOTES_PROMPT = (
    "You are now my personal AI note-taking assistant for lectures. "
    "Your task is to help me create clear, concise, and well-organized notes based on the attached PDF. "
    "Organize the content into a logical structure with main topics and subtopics. "
    "Use bullet points, numbering, and indentation to improve readability. "
    "Highlight key concepts, definitions, and important facts in bold. "
    "Create mnemonics or memory aids for difficult-to-remember information. "
    "Identify any formulas, equations, or statistical data, and format them clearly. "
    "Please format the notes in visually appealing Markdown, using appropriate headings, subheadings, and spacing. "
    "Do not include any other information or explanations, just the notes in Markdown format."
)

FLASHCARDS_PROMPT = (
    "You are a flashcard generator. Based on the attached PDF, "
    "create a set of flashcards for studying. Each flashcard should have a "
    "question on the front and a concise answer on the back. "
    "Cover all key concepts, definitions, formulas, and important facts. "
    "Return ONLY a valid JSON array with no other text, no markdown fences, no explanation. "
    "Each element must have \"front\" and \"back\" keys. "
    "Example: [{\"front\": \"What is X?\", \"back\": \"X is ...\"}, ...] "
)

QUIZ_PROMPT = (
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
)

@app.route('/generate-all', methods=['POST'])
def generate_all():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not (file and file.filename.endswith('.pdf')):
        return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400

    try:
        model = get_model_from_request()
        pdf_base64 = f"data:application/pdf;base64,{base64.b64encode(file.read()).decode()}"
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        }

        results = {}
        errors = {}

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(_call_ai, headers, model, pdf_base64, file.filename, NOTES_PROMPT): "notes",
                executor.submit(_call_ai, headers, model, pdf_base64, file.filename, FLASHCARDS_PROMPT): "flashcards",
                executor.submit(_call_ai, headers, model, pdf_base64, file.filename, QUIZ_PROMPT): "quiz",
            }

            for future in as_completed(futures):
                key = futures[future]
                try:
                    raw = future.result()
                    if key == "notes":
                        results["notes"] = _strip_markdown_fences(raw)
                    elif key == "flashcards":
                        results["flashcards"] = _parse_json_response(raw)
                    elif key == "quiz":
                        quiz = _parse_json_response(raw)
                        for q in quiz:
                            q['options'] = {k: v for k, v in q.get('options', {}).items() if k in ('A', 'B', 'C', 'D')}
                            q['answer'] = q.get('answer', '').strip()[:1].upper()
                        results["quiz"] = quiz
                except Exception as e:
                    errors[key] = str(e)

        if errors:
            results["errors"] = errors

        return jsonify(results)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/flashcards', methods=['POST'])
def generate_flashcards():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.pdf'):
        try:
            model = get_model_from_request()
            pdf_base64 = f"data:application/pdf;base64,{base64.b64encode(file.read()).decode()}"

            headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            }

            data = {
                "model": model,
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
            raw = _strip_think_tags(raw)
            flashcards = _parse_json_response(raw)

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
            model = get_model_from_request()
            pdf_base64 = f"data:application/pdf;base64,{base64.b64encode(file.read()).decode()}"

            headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            }

            data = {
                "model": model,
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
            raw = _strip_think_tags(raw)
            quiz = _parse_json_response(raw)

            for q in quiz:
                q['options'] = {k: v for k, v in q.get('options', {}).items() if k in ('A', 'B', 'C', 'D')}
                q['answer'] = q.get('answer', '').strip()[:1].upper()

            return jsonify({'quiz': quiz})

        except json.JSONDecodeError:
            return jsonify({'error': 'Failed to parse quiz from AI response.'}), 500
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    user_message = data.get('message', '').strip()
    notes_context = data.get('notes', '').strip()
    history = data.get('history', [])
    model = data.get('model', DEFAULT_MODEL)
    if not any(m['id'] == model for m in AVAILABLE_MODELS):
        model = DEFAULT_MODEL

    if not user_message:
        return jsonify({'error': 'Message cannot be empty'}), 400

    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        }

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful study assistant. The student has uploaded lecture notes and may ask "
                    "questions about them. Answer clearly and concisely using Markdown formatting. "
                    "If the question relates to the notes, base your answer on them. "
                    "If the question is outside the notes, you may still answer but mention that it goes beyond the provided material.\n\n"
                    f"--- BEGIN NOTES ---\n{notes_context}\n--- END NOTES ---"
                ),
            }
        ]

        for msg in history[-20:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": model,
            "messages": messages,
        }

        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()

        reply = response.json()["choices"][0]["message"]["content"]
        reply = _strip_think_tags(reply)
        return jsonify({'reply': reply})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/explain', methods=['POST'])
def explain_question():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    question = data.get('question', '')
    options = data.get('options', {})
    answer = data.get('answer', '')
    chosen = data.get('chosen', '')
    model = data.get('model', DEFAULT_MODEL)
    if not any(m['id'] == model for m in AVAILABLE_MODELS):
        model = DEFAULT_MODEL

    options_text = '\n'.join(f"{k}. {v}" for k, v in options.items())

    try:
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": (
                        "You are a helpful tutor. A student just answered a quiz question. "
                        "Explain why the correct answer is correct and, if the student chose wrong, "
                        "why their choice was incorrect. Be concise but clear. Use Markdown formatting.\n\n"
                        f"Question: {question}\n\n"
                        f"Options:\n{options_text}\n\n"
                        f"Correct answer: {answer}\n"
                        f"Student chose: {chosen}"
                    ),
                }
            ],
        }

        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()

        explanation = response.json()["choices"][0]["message"]["content"]
        explanation = _strip_think_tags(explanation)
        return jsonify({'explanation': explanation})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8080)
