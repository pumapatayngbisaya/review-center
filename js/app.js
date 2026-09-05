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


// Navigation controls
const sidebarToggle = document.getElementById('sidebarToggle');
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

sidebarToggle.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-collapsed');
  sidebarToggle.textContent = document.body.classList.contains('sidebar-collapsed') ? '›' : '‹';
  sidebarToggle.setAttribute(
    'aria-label',
    document.body.classList.contains('sidebar-collapsed')
      ? 'Expand navigation'
      : 'Collapse navigation'
  );
});

// ─── Suggestion Modal ────────────────────────
const suggestBtn = document.getElementById('suggestBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const closeSuggestBtn = document.getElementById('closeSuggestBtn');
const copySuggestBtn = document.getElementById('copySuggestBtn');
const suggestionText = document.getElementById('suggestionText');
const copyConfirm = document.getElementById('copyConfirm');
const newUploadBtn = document.getElementById('newUploadBtn');


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

  const subject = encodeURIComponent('GeraBananini Feature Suggestion');
  const body = encodeURIComponent(text);
  window.open(
    `https://mail.google.com/mail/?view=cm&fs=1&to=johngeraban30@gmail.com&su=${subject}&body=${body}`,
    '_blank',
    'noopener,noreferrer'
  );
  copyConfirm.textContent = '✅ Your email app is opening.';
  copyConfirm.style.display = 'block';
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
  const allowed = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
  const ext = file.name.split('.').pop().toLowerCase();
  const isImage = file.type.startsWith('image/');
  const isOfficeFile = ext === 'docx' || ext === 'pptx';

  if (!allowed.includes(file.type) && !['txt', 'pdf', 'docx', 'pptx'].includes(ext) && !isImage) {
    alert('Please upload a .txt, .pdf, .docx, .pptx, or image file.');
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
  } else if (isOfficeFile) {
    readOfficeFile(file, ext);
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

// ─── DOCX/PPTX Reading ────────────────────────
async function readOfficeFile(file, extension) {
  loadingOverlay.style.display = 'flex';
  loadingOverlay.querySelector('p').textContent = `Reading ${extension.toUpperCase()} lesson...`;

  try {
    if (extension === 'docx') {
      if (typeof mammoth === 'undefined') {
        throw new Error('DOCX reader is unavailable.');
      }

      const result = await mammoth.extractRawText({
        arrayBuffer: await file.arrayBuffer()
      });
      state.rawText = result.value.trim();
    } else {
      if (typeof JSZip === 'undefined') {
        throw new Error('PPTX reader is unavailable.');
      }

      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const slideNames = Object.keys(zip.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const number = name => Number(name.match(/slide(\d+)/)[1]);
          return number(a) - number(b);
        });
      const parser = new DOMParser();
      const slideTexts = [];

      for (const name of slideNames) {
        const xml = await zip.files[name].async('text');
        const document = parser.parseFromString(xml, 'application/xml');
        const text = [...document.getElementsByTagName('a:t')]
          .map(node => node.textContent || '')
          .join(' ')
          .trim();
        if (text) slideTexts.push(text);
      }

      state.rawText = slideTexts.join('\n\n').trim();
    }

    if (!state.rawText) {
      throw new Error('No readable text was found.');
    }
    showContent();
  } catch (error) {
    console.error(`${extension.toUpperCase()} reading error:`, error);
    alert(`⚠️ Could not read text from this ${extension.toUpperCase()} file. It may contain only images or unsupported formatting.`);
    resetUpload();
  } finally {
    loadingOverlay.style.display = 'none';
    loadingOverlay.querySelector('p').textContent = 'Crunching your document...';
  }
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
  // Hide institutional headers from the user-facing preview as well as the review.
  state.rawText = filterAcademicContent(state.rawText);
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
      const sourceText = state.rawText.toLowerCase();
      const subjectHints = [];

      if (/\bc\+\+|cpp\b/.test(sourceText)) subjectHints.push('C++');
      if (/\bhtml\b/.test(sourceText)) subjectHints.push('HTML');
      if (/\bcss\b/.test(sourceText)) subjectHints.push('CSS');
      if (/\bjavascript|java script\b/.test(sourceText)) subjectHints.push('JavaScript');
      if (/\brecursion|recursive\b/.test(sourceText)) subjectHints.push('recursion');
      if (/\bfunction|parameter|return value\b/.test(sourceText)) subjectHints.push('functions');

      const query = [...subjectHints, ...keywords.slice(0, 4)]
        .filter(Boolean)
        .join(' ')
        .slice(0, 180);
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
  const academicText = filterAcademicContent(text);
  const units = splitAcademicUnits(academicText);
  const sentences = splitSentences(academicText);

  const words =
    academicText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];

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


  const keySentences = sentences
    .map(s => ({
      text: s.trim(),
      score: topWords.filter(w =>
        s.toLowerCase().includes(w)
      ).length
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(s => s.text);

  const intro =
    keySentences[0] ||
    units[0] ||
    '';

  const mainPoints =
    keySentences.slice(1, 8);

  const conclusion =
    keySentences[5] ||
    keySentences[keySentences.length - 1] ||
    '';

  return {
    intro,
    mainPoints,
    conclusion,
    topWords,
    totalWords: words.length,
    cleanedText: academicText,
    units,
    codeBlocks: extractCodeBlocks(academicText),
    references: getReferences(academicText)
  };
}


function renderReview(data) {
  const div = document.getElementById('reviewText');
  const detailedUnits = data.units.length
    ? data.units.map(unit => `<li>${escHtml(makePlainLanguage(unit))}</li>`).join('')
    : '<li>No academic text could be separated from this file.</li>';
  const codeBlocks = data.codeBlocks.length
    ? data.codeBlocks.map(code => `<pre><code>${escHtml(code)}</code></pre>`).join('')
    : '<p>No code examples were found in the source.</p>';
  const references = data.references
    .map(reference => `
      <li><a href="${reference.url}" target="_blank" rel="noopener noreferrer">
        ${escHtml(reference.label)}
      </a></li>
    `)
    .join('');

  div.innerHTML = `
    <h3>SECTION 1: FULL DETAILED REVIEWER</h3>
    <p><strong>What this means:</strong> ${escHtml(makePlainLanguage(data.intro))}</p>
    <p>This section keeps every academic sentence found in the source after removing school names, page labels, and other document clutter.</p>
    <ul>${detailedUnits}</ul>
    <h4>Code and syntax found in the lesson</h4>
    ${codeBlocks}

    <h3>SECTION 2: EXECUTIVE REVIEW SUMMARY</h3>
    <ul>
      ${data.mainPoints.map(point => `<li>${escHtml(makePlainLanguage(point))}</li>`).join('')}
    </ul>
    <p><strong>Main idea:</strong> ${escHtml(makePlainLanguage(data.conclusion))}</p>
    <p><strong>Words processed:</strong> ${data.totalWords.toLocaleString()}</p>
    <p style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
      ${data.topWords
        .map(
          w =>
            `<span style="background:#FFD60A22;color:#0F1B2D;padding:3px 10px;border-radius:20px;font-size:.82rem;font-weight:700;">${escHtml(w)}</span>`
        )
        .join('')}
    </p>

    <h3>SECTION 3: CURATED HIGH-VALUE REFERENCES</h3>
    <ul>${references}</ul>

    <h3>SECTION 4: SYSTEM RE-RUN TRIGGER</h3>
    <div class="review-trigger">
      <button class="btn btn-primary" id="rewriteInlineBtn">↻ Rewrite Again</button>
    </div>
  `;

  reviewSection.style.display = 'block';
  document.getElementById('rewriteInlineBtn').addEventListener('click', rerunReview);

  document
    .getElementById('reviewSection')
    .scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
}

function rerunReview() {
  if (!state.rawText.trim()) return;
  state.reviewData = generateReview(state.rawText);
  state.quizData = generateQuiz(state.rawText);
  renderReview(state.reviewData);
  saveSession();
  loadRelatedSources(state.reviewData.topWords);
}

document.getElementById('rewriteBtn').addEventListener('click', rerunReview);


document
  .getElementById('goToQuizBtn')
  .addEventListener('click', () => {
    navigateTo('quiz');
  });

newUploadBtn.addEventListener('click', () => {
  resetUpload();
  navigateTo('upload');
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
    score: existing >= 0 ? sessions[existing].score : null,
    rawText: state.rawText,
    reviewData: state.reviewData,
    quizData: state.quizData,

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


  try {
    localStorage.setItem(
      'gera_sessions',
      JSON.stringify(sessions.slice(0, 20))
    );
  } catch (error) {
    console.error('Could not save study session:', error);
    alert('⚠️ This lesson is too large to save in browser history. You can still use the current review.');
  }
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

    localStorage.setItem('gera_sessions', JSON.stringify(sessions));
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

      <div class="history-actions">
        <button class="btn btn-sm btn-primary session-open">Open</button>
        <button class="btn btn-sm btn-ghost session-delete">Delete</button>
      </div>
      <span class="history-score">
        ${
          s.score !== null
            ? s.score + '%'
            : 'No quiz yet'
        }
      </span>
    `;

    el.querySelector('.session-open').addEventListener('click', () => openSession(s));
    el.querySelector('.session-delete').addEventListener('click', () => {
        const remaining = getSessions().filter(session => session !== s);
      localStorage.setItem('gera_sessions', JSON.stringify(remaining));
      renderHistory();
    });
    list.appendChild(el);
  });
}

function openSession(session) {
  if (!session.rawText || !session.reviewData) {
    alert('This older session does not contain a saved review. Please upload the file again.');
    return;
  }

  state.fileName = session.name;
  state.rawText = session.rawText;
  state.reviewData = session.reviewData && session.reviewData.units
    ? session.reviewData
    : generateReview(session.rawText);
  state.quizData = session.quizData || generateQuiz(session.rawText);
  fileNameEl.textContent = '📄 ' + session.name;
  fileInfo.style.display = 'flex';
  showContent();
  renderReview(state.reviewData);
  loadRelatedSources(state.reviewData.topWords);
  navigateTo('upload');
}


// ─── Review extraction utilities ─────────────
function filterAcademicContent(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/(?:CITY\s+OF\s+MALABON\s+UNIVERSITY\s+FOUNDED\s+1994|CITY\s+OF\s+MALABON\s+UNIVERSITY|COLLEGE\s+OF\s+COMPUTER\s+STUDIES)/gi, '')
    .replace(/\bCMU\b/gi, '')
    .replace(/\b(?:CC\d{2,4}\s+)?Computer\s+Programming\s*\d*\b/gi, '')
    .replace(/\b(?:Lesson\s+\d+|Chapter\s+\d+|Course\s+Code\s*[:#]?\s*\S+)\b/gi, '')
    .replace(/(?:page|slide)\s*\d+\s*(?:of\s*\d+)?/gi, '')
    .replace(/\b(?:professor|instructor|teacher)\s*[:\-].*?(?=\n|$)/gi, '')
    .replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/gi, '')
    .split('\n')
    .map(line => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

function splitAcademicUnits(text) {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(/;\s+/g, ';\n')
    .split(/\n+/)
    .map(unit => unit.trim())
    .filter(unit => unit.length > 10);
}

function extractCodeBlocks(text) {
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const codeLines = lines.filter(line =>
    /#include|using namespace|int main|void \w+\s*\(|\breturn\s+[^.]+;|<\w+[^>]*>|[.#][\w-]+\s*\{|[a-z-]+\s*:\s*[^;]+;/.test(line)
  );

  return codeLines.length ? [codeLines.join('\n')] : [];
}

function getReferences(text) {
  const lower = text.toLowerCase();
  const references = [];
  if (/\bc\+\+|recursion|function|parameter|return value/.test(lower)) {
    references.push(
      { label: 'cppreference: Functions', url: 'https://en.cppreference.com/w/cpp/language/functions' },
      { label: 'cppreference: Recursion', url: 'https://en.cppreference.com/w/cpp/language/functions' }
    );
  }
  if (/\bhtml|element|tag|markup/.test(lower)) {
    references.push({ label: 'MDN Web Docs: HTML', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' });
  }
  if (/\bcss|selector|property|style/.test(lower)) {
    references.push({ label: 'MDN Web Docs: CSS', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS' });
  }
  if (/\bjavascript|function|array|dom/.test(lower)) {
    references.push({ label: 'MDN Web Docs: JavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' });
  }

  if (references.length < 3) {
    references.push(
      { label: 'Khan Academy: Study and learning resources', url: 'https://www.khanacademy.org/' },
      { label: 'Wikipedia: Search the lesson topic', url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(text.split(/\s+/).slice(0, 6).join(' '))}` }
    );
  }

  return references.slice(0, 5);
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

function makePlainLanguage(sentence) {
  return sentence
    .replace(/\butilize\b/gi, 'use')
    .replace(/\bapproximately\b/gi, 'about')
    .replace(/\bdemonstrate\b/gi, 'show')
    .replace(/\bin order to\b/gi, 'to')
    .replace(/\ba significant number of\b/gi, 'many')
    .replace(/\bprior to\b/gi, 'before')
    .replace(/\bsubsequent to\b/gi, 'after')
    .replace(/\s+/g, ' ')
    .trim();
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