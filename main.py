import requests # type: ignore

url = "https://ai.hackclub.com/proxy/v1/chat/completions"

api_key = "sk-hc-v1-535600788f5e472cbb9c5ee65108ddfeb5d193e7ce7c4e7d9c16dd127a201eee"

headers = {
    "Authorization": f"Bearer {api_key}",
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
                        "Your task is to help me create clear, concise, and well-organized notes. "
                        "I will provide you with the lecture in PDF format. Your task is to return "
                        "a markdown file with the notes. Organize the content into a logical structure "
                        "with main topics and subtopics. Use bullet points, numbering, and indentation "
                        "to improve readability. Highlight key concepts, definitions, and important facts "
                        "in bold. Create mnemonics or memory aids for difficult-to-remember information. "
                        "Identify any formulas, equations, or statistical data, and format them clearly. "
                        "Please format the notes in a visually appealing manner, using appropriate headings, "
                        "subheadings, and spacing."
                    ),
                },
                {
                    "type": "file",
                    "file": {
                        "filename": "lecture.pdf",
                        "file_data": "https://cdn.hackclub.com/019c5d80-4e23-7e4e-8a43-55e6a94057f3/3_non-mendelian_and_linked_inheritance_lecture.pdf",
                    },
                },
            ],
        }
    ],
    "plugins": [
        {
            "id": "file-parser",
            "pdf": {"engine": "pdf-text"},
        }
    ],
}

response = requests.post(url, headers=headers, json=data)
response.raise_for_status()

print(response.json()["choices"][0]["message"]["content"])
