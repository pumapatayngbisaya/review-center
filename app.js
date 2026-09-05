/* ============================================
   GeraBananini Review Station — app.js
   All logic: navigation, file reading,
   review generation, quiz engine, history
   ============================================ */

// ─── State ──────────────────────────────────
const state = {
  rawText: '',
  fileName: '',
  reviewData: null,
  quizData: null,
  currentQuestion: 0,
  score: 0,
  answered: false,
};


// ─── Navigation ──────────────────────────────
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');

  const link = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (link) link.classList.add('active');

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');

  // Special: when navigating to quiz, render it
  if (pageId === 'quiz') renderQuiz();
  if (pageId === 'history') renderHistory();

  window.scrollTo(0, 0);
}


document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(link.dataset.page);
  });
});


// Mobile hamburger
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});


// ─── Suggestion Modal ────────────────────────
const suggestBtn = document.getElementById('suggestBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const closeSuggestBtn = document.getElementById('closeSuggestBtn');
const copySuggestBtn = document.getElementById('copySuggestBtn');
const suggestionText = document.getElementById('suggestionText');
const copyConfirm = document.getElementById('copyConfirm');


suggestBtn.addEventListener('click', () => {
  modalOverlay.style.display = 'flex';
  copyConfirm.style.display = 'none';
});


[modalClose, closeSuggestBtn].forEach(el => {
  el.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
  });
});


modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) modalOverlay.style.display = 'none';
});


// Chips auto-fill prefix
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const val = chip.dataset.val;

    if (!suggestionText.value.startsWith(val)) {
      suggestionText.value =
        val +
        suggestionText.value.replace(
          /^(Feature idea: |Bug report: |UI improvement: |Other: )/,
          ''
        );
    }

    suggestionText.focus();
  });
});


copySuggestBtn.addEventListener('click', () => {
  const text = suggestionText.value.trim();

  if (!text) {
    suggestionText.focus();
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    copyConfirm.style.display = 'block';

    setTimeout(() => {
      copyConfirm.style.display = 'none';
    }, 3000);

  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');

    ta.value = text;
    document.body.appendChild(ta);

    ta.select();
    document.execCommand('copy');

    document.body.removeChild(ta);

    copyConfirm.style.display = 'block';

    setTimeout(() => {
      copyConfirm.style.display = 'none';
    }, 3000);
  });
});


// ─── File Upload ─────────────────────────────
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileNameEl = document.getElementById('fileName');
const clearFileBtn = document.getElementById('clearFile');
const contentArea = document.getElementById('contentArea');
const contentRaw = document.getElementById('contentRaw');
const contentStats = document.getElementById('contentStats');
const generateBtn = document.getElementById('generateBtn');
const reviewSection = document.getElementById('reviewSection');
const sourcesSection = document.getElementById('sourcesSection');
const sourcesList = document.getElementById('sourcesList');
const loadingOverlay = document.getElementById('loadingOverlay');


// Drag events
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});


uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});


uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];

  if (file) {
    handleFile(file);
  }
});


fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    handleFile(fileInput.files[0]);
  }
});


clearFileBtn.addEventListener('click', () => {
  resetUpload();
});


function handleFile(file) {
  const allowed = ['text/plain', 'application/pdf'];
  const ext = file.name.split('.').pop().toLowerCase();
  const isImage = file.type.startsWith('image/');

  if (!allowed.includes(file.type) && ext !== 'txt' && ext !== 'pdf' && !isImage) {
    alert('Please upload a .txt, .pdf, or image file.');
    return;
  }

  state.fileName = file.name;

  fileNameEl.textContent = '📄 ' + file.name;
  fileInfo.style.display = 'flex';
  reviewSection.style.display = 'none';

  if (isImage) {
    readImage(file);
  } else if (file.type === 'application/pdf' || ext === 'pdf') {
    readPDF(file);
  } else {
    readText(file);
  }
}

// ─── Image Reading (OCR) ──────────────────────
async function readImage(file) {
  if (typeof Tesseract === 'undefined') {
    alert('⚠️ OCR is unavailable because the OCR library could not be loaded.');
    resetUpload();
    return;
  }

  loadingOverlay.style.display = 'flex';

  try {
    const result = await Tesseract.recognize(file, 'eng', {
      logger: message => {
        if (message.status === 'recognizing text') {
          const progress = Math.round(message.progress * 100);
          loadingOverlay.querySelector('p').textContent =
            `Reading lesson image... ${progress}%`;
        }
      }
    });

    state.rawText = result.data.text.trim();
    if (!state.rawText) {
      throw new Error('No readable text was found in the image.');
    }

    showContent();
  } catch (error) {
    console.error('Image reading error:', error);
    alert('⚠️ Could not read text from this image. Use a clearer image with selectable-looking text.');
    resetUpload();
  } finally {
    loadingOverlay.style.display = 'none';
    loadingOverlay.querySelector('p').textContent = 'Crunching your document...';
  }
}


// ─── TXT Reading ─────────────────────────────
function readText(file) {
  const reader = new FileReader();

  reader.onload = e => {
    if (typeof e.target.result !== 'string') {
      alert('⚠️ Could not read this text file.');
      resetUpload();
      return;
    }

    state.rawText = e.target.result;
    showContent();
  };

  reader.onerror = () => {
    alert('⚠️ Could not read this text file. Please try again.');
    resetUpload();
  };

  reader.readAsText(file);
}


// ─── PDF Reading — FIXED ─────────────────────
async function readPDF(file) {
  try {
    // Read the PDF as an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Make sure PDF.js is loaded
    if (typeof pdfjsLib === 'undefined') {
      alert(
        '⚠️ PDF.js is not loaded. Please make sure the PDF.js script ' +
        'is included before app.js in your HTML.'
      );

      resetUpload();
      return;
    }

    // Load the PDF
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer
    }).promise;

    let extractedText = '';

    // Extract text from every page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);

      const textContent = await page.getTextContent();

      // Extract actual readable text
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');

      extractedText += pageText + '\n\n';
    }

    extractedText = cleanExtractedText(extractedText);

    // Make sure enough text was extracted
    if (extractedText.length > 30) {
      state.rawText = extractedText;
      showContent();
    } else {
      alert(
        '⚠️ This PDF appears to be image-based or scanned. ' +
        'GeraBananini can only read PDFs with selectable text. ' +
        'Please try a text-based PDF or a .txt file.'
      );

      resetUpload();
    }

  } catch (error) {
    console.error('PDF reading error:', error);

    alert(
      '⚠️ Could not read this PDF.\n\n' +
      'Please make sure the file is a valid PDF with selectable text.'
    );

    resetUpload();
  }
}


// Clean the text extracted by PDF.js
function cleanExtractedText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


function showContent() {
  contentArea.style.display = 'block';

  const wordCount = state.rawText.trim()
    ? state.rawText.trim().split(/\s+/).length
    : 0;

  contentStats.textContent =
    `${state.rawText.length.toLocaleString()} characters • ` +
    `${wordCount.toLocaleString()} words loaded`;

  // Keep the full extracted content available in the scrollable preview.
  contentRaw.textContent = state.rawText;
}


function resetUpload() {
  state.rawText = '';
  state.fileName = '';
  state.reviewData = null;
  state.quizData = null;

  fileInput.value = '';

  fileInfo.style.display = 'none';
  contentArea.style.display = 'none';
  contentStats.textContent = '';
  reviewSection.style.display = 'none';
  sourcesSection.style.display = 'none';
  sourcesList.textContent = '';
}


// ─── Review Generation ───────────────────────
generateBtn.addEventListener('click', async () => {
  if (!state.rawText.trim()) return;

  loadingOverlay.style.display = 'flex';

  setTimeout(async () => {
    state.reviewData = generateReview(state.rawText);
    state.quizData = generateQuiz(state.rawText);

    loadingOverlay.style.display = 'none';

    renderReview(state.reviewData);
    saveSession();
    await loadRelatedSources(state.reviewData.topWords);
  }, 1200);
});

async function loadRelatedSources(keywords) {
  sourcesSection.style.display = 'block';
  sourcesList.textContent = 'Finding related sources...';

  try {
    const query = keywords.slice(0, 3).join(' ');
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`
    );

    if (!response.ok) {
      throw new Error(`Source search failed with status ${response.status}`);
    }

    const data = await response.json();
    const results = data.query && data.query.search ? data.query.search : [];
    if (!results.length) {
      sourcesList.textContent = 'No related sources found.';
      return;
    }

    sourcesList.innerHTML = results.map(result => {
      const title = result.title;
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      const excerpt = result.snippet.replace(/<[^>]+>/g, '');
      return `
        <article class="source-item">
          <a href="${url}" target="_blank" rel="noopener noreferrer">${escHtml(title)}</a>
          <p>${escHtml(excerpt)}...</p>
        </article>
      `;
    }).join('');
  } catch (error) {
    console.error('Related source error:', error);
    sourcesList.textContent = 'Related sources are temporarily unavailable. Your local review is still ready.';
  }
}


function generateReview(text) {
  const sentences = splitSentences(text);

  const words =
    text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];

  // Word frequency
  const freq = {};

  const stopWords = new Set([
    'this',
    'that',
    'with',
    'from',
    'they',
    'their',
    'have',
    'been',
    'were',
    'will',
    'would',
    'could',
    'should',
    'which',
    'these',
    'those',
    'about',
    'there',
    'than',
    'then',
    'when',
    'also',
    'some',
    'more',
    'other',
    'into',
    'each',
    'very',
    'just',
    'only',
    'even',
    'such',
    'most',
    'much',
    'many',
    'both',
    'over',
    'after',
    'before',
    'while',
    'where',
    'through',
    'between',
    'however',
    'therefore',
    'because',
    'although',
    'within',
    'without',
    'during',
    'against',
    'already',
    'always',
    'never',
    'often',
    'every',
    'still',
    'again',
    'back',
    'away',
    'here',
    'what',
    'your',
    'make',
    'made',
    'take',
    'taken',
    'come',
    'came',
    'know',
    'known',
    'well',
    'said',
    'want',
    'need',
    'time',
    'year',
    'way',
    'day',
    'use',
    'used'
  ]);

  words.forEach(w => {
    if (!stopWords.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });


  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(e => e[0]);


  // Key sentences = those containing top words
  const keySentences = sentences
    .filter(s => {
      const wordCount = s.split(/\s+/).length;

      return wordCount > 6 && wordCount < 60;
    })
    .map(s => ({
      text: s.trim(),
      score: topWords.filter(w =>
        s.toLowerCase().includes(w)
      ).length
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(s => s.text);


  // Group into a mini review structure
  const intro =
    keySentences[0] ||
    sentences[0] ||
    '';

  const mainPoints =
    keySentences.slice(1, 5);

  const conclusion =
    keySentences[5] ||
    keySentences[keySentences.length - 1] ||
    '';


  return {
    intro,
    mainPoints,
    conclusion,
    topWords,
    totalWords: words.length
  };
}


function renderReview(data) {
  const div = document.getElementById('reviewText');

  div.innerHTML = `
    <h3>🔍 Overview</h3>
    <p>${escHtml(data.intro)}</p>

    <h3>📌 Key Points</h3>
    <ul>
      ${data.mainPoints
        .map(p => `<li>${escHtml(p)}</li>`)
        .join('')}
    </ul>

    <h3>💡 Conclusion</h3>
    <p>${escHtml(data.conclusion)}</p>

    <h3>🔑 Key Terms</h3>
    <p style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
      ${data.topWords
        .map(
          w =>
            `<span style="background:#FFD60A22;color:#0F1B2D;padding:3px 10px;border-radius:20px;font-size:.82rem;font-weight:700;">${escHtml(w)}</span>`
        )
        .join('')}
    </p>

    <p style="margin-top:20px;font-size:.8rem;color:#A0AEC0;">
      📊 ${data.totalWords.toLocaleString()} words processed
    </p>
  `;

  reviewSection.style.display = 'block';

  document
    .getElementById('reviewSection')
    .scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
}


document
  .getElementById('goToQuizBtn')
  .addEventListener('click', () => {
    navigateTo('quiz');
  });


// ─── Quiz Generation ─────────────────────────
function generateQuiz(text) {
  const sentences = splitSentences(text)
    .map(s => s.trim())
    .filter(s => {
      const wordCount = s.split(/\s+/).length;

      return wordCount >= 8 && wordCount <= 45;
    })
    .filter(s => /[A-Z]/.test(s[0]));


  if (sentences.length < 4) {
    return [];
  }


  const questions = [];
  const used = new Set();


  // Strategy 1: Fill-in-the-blank
  sentences.forEach(sentence => {
    if (questions.length >= 7) return;

    const words = sentence.split(/\s+/);

    // Find a content word
    const candidates = words
      .map((w, i) => ({
        w: w.replace(/[^a-zA-Z]/g, ''),
        i
      }))
      .filter(
        ({ w }) =>
          w.length >= 5 &&
          /^[A-Za-z]+$/.test(w)
      );


    if (candidates.length === 0) return;


    const pick =
      candidates[Math.floor(candidates.length / 2)];


    if (used.has(pick.w.toLowerCase())) {
      return;
    }

    used.add(pick.w.toLowerCase());


    const blank = words
      .map((w, i) =>
        i === pick.i ? '______' : w
      )
      .join(' ');


    // Generate distractors
    const distractors = sentences
      .flatMap(s => s.split(/\s+/))
      .map(w => w.replace(/[^a-zA-Z]/g, ''))
      .filter(
        w =>
          w.length >= 5 &&
          w.toLowerCase() !== pick.w.toLowerCase() &&
          /^[A-Za-z]+$/.test(w)
      );


    const uniqueDistractors = [
      ...new Set(distractors)
    ].slice(0, 10);


    const chosen = shuffle(
      uniqueDistractors
    ).slice(0, 3);


    if (chosen.length < 3) {
      return;
    }


    const options = shuffle([
      pick.w,
      ...chosen
    ]);


    questions.push({
      question: `Fill in the blank: "${blank}"`,
      options,
      answer: pick.w,
      explanation:
        `The correct word is "${pick.w}". ` +
        `The full sentence: "${sentence}"`
    });
  });


  // Strategy 2: Text comprehension
  const extraSentences =
    sentences.filter((s, i) => i < 12);


  extraSentences.forEach((s, i) => {
    if (questions.length >= 10) return;

    const words = s.split(/\s+/);

    if (words.length < 10) return;


    // Scramble to make a false version
    const falseVersion =
      makeFalseStatement(
        s,
        sentences
      );


    if (!falseVersion) return;


    const qa = Math.random() < 0.5;

    const correct =
      qa ? s : falseVersion;

    const wrong =
      qa ? falseVersion : s;


    // Make it a 4-option question
    const others = sentences
      .filter(
        (_, j) =>
          j !== i &&
          j !== i + 1 &&
          j !== i + 2
      )
      .slice(0, 2);


    if (others.length < 2) return;


    const allOptions = shuffle([
      correct,
      wrong,
      ...others.slice(0, 2)
    ]).slice(0, 4);


    questions.push({
      question:
        'Which of the following is directly stated or most accurately reflects the text?',
      options: allOptions,
      answer: s,
      explanation:
        `The text directly states: "${s}"`
    });
  });


  return shuffle(questions).slice(0, 5);
}


function makeFalseStatement(
  sentence,
  allSentences
) {
  const words = sentence.split(/\s+/);

  if (words.length < 8) {
    return null;
  }


  // Swap a key word from another sentence
  const other = allSentences.find(
    s =>
      s !== sentence &&
      s.split(/\s+/).length > 6
  );


  if (!other) {
    return null;
  }


  const otherWords = other
    .split(/\s+/)
    .filter(
      w =>
        w
          .replace(/[^a-zA-Z]/g, '')
          .length > 5
    );


  if (!otherWords.length) {
    return null;
  }


  const targetIdx =
    Math.floor(words.length * 0.4);


  const replacement =
    otherWords[0].replace(
      /[^a-zA-Z]/g,
      ''
    );


  const clone = [...words];

  clone[targetIdx] = replacement;

  return clone.join(' ');
}


// ─── Quiz Rendering ──────────────────────────
function renderQuiz() {
  const placeholder =
    document.getElementById(
      'quizPlaceholder'
    );

  const container =
    document.getElementById(
      'quizContainer'
    );


  if (
    !state.quizData ||
    state.quizData.length === 0
  ) {
    placeholder.style.display = 'block';
    container.style.display = 'none';

    return;
  }


  placeholder.style.display = 'none';
  container.style.display = 'block';


  state.currentQuestion = 0;
  state.score = 0;
  state.answered = false;


  document.getElementById(
    'quizResult'
  ).style.display = 'none';


  document.getElementById(
    'questionCard'
  ).style.display = 'block';


  showQuestion();
}


function showQuestion() {
  const q =
    state.quizData[
      state.currentQuestion
    ];

  const total =
    state.quizData.length;


  document.getElementById(
    'quizProgress'
  ).textContent =
    `Question ${state.currentQuestion + 1} of ${total}`;


  document.getElementById(
    'scoreDisplay'
  ).textContent =
    `Score: ${state.score}`;


  const pct =
    (state.currentQuestion / total) * 100;


  document.getElementById(
    'progressBar'
  ).style.width =
    pct + '%';


  document.getElementById(
    'questionText'
  ).textContent =
    q.question;


  const grid =
    document.getElementById(
      'optionsGrid'
    );

  grid.innerHTML = '';


  q.options.forEach(opt => {
    const btn =
      document.createElement(
        'button'
      );

    btn.className =
      'option-btn';

    btn.textContent = opt;

    btn.addEventListener(
      'click',
      () =>
        handleAnswer(
          opt,
          q.answer,
          q.explanation
        )
    );

    grid.appendChild(btn);
  });


  const feedback =
    document.getElementById(
      'feedback'
    );

  feedback.style.display = 'none';
  feedback.textContent = '';
  feedback.className = 'feedback';


  const nextBtn =
    document.getElementById(
      'nextBtn'
    );

  nextBtn.style.display = 'none';

  nextBtn.onclick = () =>
    advanceQuestion();


  state.answered = false;
}


function handleAnswer(
  chosen,
  correct,
  explanation
) {
  if (state.answered) {
    return;
  }

  state.answered = true;


  const isCorrect =
    chosen === correct;


  if (isCorrect) {
    state.score++;
  }


  // Color options
  document
    .querySelectorAll(
      '.option-btn'
    )
    .forEach(btn => {
      btn.disabled = true;

      if (
        btn.textContent === correct
      ) {
        btn.classList.add(
          'correct'
        );
      }

      if (
        btn.textContent === chosen &&
        !isCorrect
      ) {
        btn.classList.add(
          'wrong'
        );
      }
    });


  // Show feedback
  const feedback =
    document.getElementById(
      'feedback'
    );

  feedback.style.display = 'block';


  if (isCorrect) {
    feedback.textContent =
      '✅ Correct! ' +
      explanation;

    feedback.className =
      'feedback correct';

  } else {
    feedback.textContent =
      `❌ Not quite. ${explanation}`;

    feedback.className =
      'feedback wrong';
  }


  document.getElementById(
    'nextBtn'
  ).style.display =
    'inline-flex';


  document.getElementById(
    'scoreDisplay'
  ).textContent =
    `Score: ${state.score}`;
}


function advanceQuestion() {
  state.currentQuestion++;


  if (
    state.currentQuestion >=
    state.quizData.length
  ) {
    showResult();
  } else {
    showQuestion();
  }
}


function showResult() {
  document.getElementById(
    'questionCard'
  ).style.display = 'none';


  const result =
    document.getElementById(
      'quizResult'
    );

  result.style.display = 'block';


  const total =
    state.quizData.length;


  const pct =
    Math.round(
      (state.score / total) * 100
    );


  document.getElementById(
    'progressBar'
  ).style.width = '100%';


  let icon;
  let title;
  let msg;


  if (pct >= 80) {
    icon = '🏆';
    title = 'Excellent!';
    msg =
      'You really know your material. GeraBananini is proud of you!';

  } else if (pct >= 60) {
    icon = '👍';
    title = 'Good Job!';
    msg =
      'Solid performance. A quick re-read of the review will get you to 100%.';

  } else if (pct >= 40) {
    icon = '📖';
    title = 'Keep Studying!';
    msg =
      'Not bad for a first try. Review the summary and try again!';

  } else {
    icon = '🍌';
    title = "Let's Try Again!";
    msg =
      'Everyone starts somewhere. Read the review carefully and give it another shot!';
  }


  document.getElementById(
    'resultIcon'
  ).textContent = icon;


  document.getElementById(
    'resultTitle'
  ).textContent = title;


  document.getElementById(
    'resultMessage'
  ).textContent = msg;


  document.getElementById(
    'resultScore'
  ).textContent =
    `${state.score} / ${total} (${pct}%)`;


  // Update session score in history
  updateSessionScore(
    state.fileName,
    pct
  );


  document.getElementById(
    'retryBtn'
  ).onclick = () => {
    state.currentQuestion = 0;
    state.score = 0;
    state.answered = false;

    result.style.display = 'none';

    document.getElementById(
      'questionCard'
    ).style.display = 'block';

    document.getElementById(
      'progressBar'
    ).style.width = '0%';

    showQuestion();
  };
}


// ─── History ─────────────────────────────────
function saveSession() {
  if (!state.fileName) {
    return;
  }


  const sessions = getSessions();


  const existing =
    sessions.findIndex(
      s =>
        s.name === state.fileName
    );


  const entry = {
    name: state.fileName,
    date: new Date().toLocaleString(),
    score: null,

    keyTerms:
      state.reviewData
        ? state.reviewData.topWords
            .slice(0, 5)
            .join(', ')
        : ''
  };


  if (existing >= 0) {
    sessions[existing] = entry;
  } else {
    sessions.unshift(entry);
  }


  localStorage.setItem(
    'gera_sessions',
    JSON.stringify(
      sessions.slice(0, 20)
    )
  );
}


function updateSessionScore(
  fileName,
  pct
) {
  const sessions =
    getSessions();


  const idx =
    sessions.findIndex(
      s =>
        s.name === fileName
    );


  if (idx >= 0) {
    sessions[idx].score = pct;

    localStorage.setItem(
      'gera_sessions',
      JSON.stringify(sessions)
    );
  }
}


function getSessions() {
  try {
    return (
      JSON.parse(
        localStorage.getItem(
          'gera_sessions'
        )
      ) || []
    );

  } catch {
    return [];
  }
}


function renderHistory() {
  const list =
    document.getElementById(
      'historyList'
    );

  const empty =
    document.getElementById(
      'historyEmpty'
    );


  const sessions =
    getSessions();


  list.innerHTML = '';


  if (sessions.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';

    return;
  }


  list.style.display = 'flex';
  empty.style.display = 'none';


  sessions.forEach(s => {
    const el =
      document.createElement(
        'div'
      );

    el.className =
      'history-item';


    el.innerHTML = `
      <div class="history-meta">

        <span class="history-name">
          📄 ${escHtml(s.name)}
        </span>

        <span class="history-date">
          🕐 ${escHtml(s.date)}
        </span>

        ${
          s.keyTerms
            ? `<span style="font-size:.78rem;color:#A0AEC0;margin-top:2px;">
                🔑 ${escHtml(s.keyTerms)}
              </span>`
            : ''
        }

      </div>

      <span class="history-score">
        ${
          s.score !== null
            ? s.score + '%'
            : 'No quiz yet'
        }
      </span>
    `;


    list.appendChild(el);
  });
}


// ─── Utilities ───────────────────────────────
function splitSentences(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 15);
}


function shuffle(arr) {
  const a = [...arr];

  for (
    let i = a.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [a[i], a[j]] =
      [a[j], a[i]];
  }

  return a;
}


function escHtml(str) {
  return String(str)
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    );
}


// ─── Init ────────────────────────────────────
(function init() {
  renderHistory();
})();