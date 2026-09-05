# 🍌 GeraBananini Review Station

A browser-based study tool that reads your documents and generates review summaries and quizzes — no server required, no data leaves your device.

---

## ✨ Features

- 📄 **Upload & Review** — Drop in a `.txt` or text-based `.pdf` file and get a smart review summary with key points and key terms
- 🧠 **Quiz Mode** — Auto-generated multiple-choice quiz based directly on your document content
- 📊 **Score Tracking** — See your quiz score and keep a session history per file
- 📚 **My Sessions** — History of all files you've reviewed and your quiz scores
- 💡 **Suggest a Feature** — Built-in suggestion panel for feedback and ideas
- 🔒 **100% Private** — Everything runs in your browser; files are never uploaded anywhere

---

## 🚀 Getting Started

1. **Clone the repo:**
   ```bash
   git clone https://github.com/yourusername/gerabananini.git
   cd gerabananini
   ```

2. **Open in browser:**
   Just open `index.html` directly in your browser — no build step, no server needed.

   Or serve it locally:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8080
   ```

3. **Upload a file**, read the review, take the quiz. That's it!

---

## 📁 File Structure

```
gerabananini/
├── index.html        ← Main app shell + all pages
├── css/
│   └── style.css     ← All styles
├── js/
│   └── app.js        ← Navigation, file reading, review & quiz logic
└── README.md
```

---

## 📋 Supported File Types

| Type | Support |
|------|---------|
| `.txt` | ✅ Full support |
| `.pdf` (text-based) | ✅ Supported |
| `.pdf` (scanned/image) | ❌ Not supported (needs OCR) |
| `.docx` | 🔜 Planned |

---

## 🛠️ Planned Features

- 🌙 Dark / light theme toggle
- 🃏 Flashcard mode
- 📤 Export quiz as PDF
- 🌐 Multilingual support (Filipino, etc.)
- 🔤 Key term highlighting in the review
- 📊 Score history chart over time

---

## 🤝 Contributing

Pull requests are welcome! Open an issue first for major changes.

---

## 📄 License

MIT — free to use, modify, and share.
