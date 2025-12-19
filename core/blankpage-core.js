// ═══════════════════════════════════════════════════════════════════════════
// KUMAGAIZO CORE
// 
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  
  let state = {
    currentScreen: 'landing',
    sessionType: null,
    category: null,
    startTime: null,
    currentStep: 0,
    stepResponses: [],
    totalSteps: 0,
    digDeeperMode: false,
    inDeeperQuestions: false,
    deeperResponses: []
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DOM ELEMENTS
  // ─────────────────────────────────────────────────────────────────────────
  
  let elements = {};
  
  function cacheElements() {
    elements = {
      // Screens
      screenLanding: document.getElementById('screen-landing'),
      screenSession: document.getElementById('screen-session'),
      screenComplete: document.getElementById('screen-complete'),
      
      // Session info
      sessionTypeLabel: document.getElementById('session-type-label'),
      
      // Step elements
      stepIndicator: document.getElementById('step-indicator'),
      stepQuestion: document.getElementById('step-question'),
      stepHint: document.getElementById('step-hint'),
      stepTextarea: document.getElementById('step-textarea'),
      wordCount: document.getElementById('word-count'),
      
      // Buttons
      btnPrevStep: document.getElementById('btn-prev-step'),
      btnNextStep: document.getElementById('btn-next-step'),
      btnEndSession: document.getElementById('btn-end-session'),
      btnDigDeeper: document.getElementById('btn-dive-deeper'),
      btnStartAnother: document.getElementById('btn-start-another'),
      btnCopyPrompt: document.getElementById('btn-copy-prompt'),
      
      // Results
      resultTime: document.getElementById('result-time'),
      resultWordCount: document.getElementById('result-word-count'),
      summaryContent: document.getElementById('summary-content'),
      aiPromptContent: document.getElementById('ai-prompt-content'),
      
      // Category items
      sessionTypeItems: document.querySelectorAll('.session-type-item')
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORIES
  // ─────────────────────────────────────────────────────────────────────────
  
  function getCategories() {
    return window.BLANKPAGE_CATEGORIES || {};
  }
  
  function getCategory(typeId) {
    return getCategories()[typeId] || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────────
  
  function showScreen(screenName) {
    const screens = ['screenLanding', 'screenSession', 'screenComplete'];
    
    screens.forEach(screen => {
      const el = elements[screen];
      if (!el) return;
      
      const targetScreen = `screen${screenName.charAt(0).toUpperCase() + screenName.slice(1)}`;
      
      if (screen === targetScreen) {
        el.style.display = 'flex';
        el.style.opacity = '1';
      } else {
        el.style.display = 'none';
        el.style.opacity = '0';
      }
    });
    
    state.currentScreen = screenName;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORD COUNT
  // ─────────────────────────────────────────────────────────────────────────
  
  function getWordCount(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  function updateWordCount() {
    if (!elements.stepTextarea) return;
    
    if (!elements.wordCount) {
      elements.wordCount = document.getElementById('word-count');
    }
    
    const count = getWordCount(elements.stepTextarea.value);
    
    // Update word count display
    if (elements.wordCount) {
      if (count === 0) {
        elements.wordCount.textContent = '';
        elements.wordCount.style.opacity = '0';
      } else {
        elements.wordCount.textContent = `${count} words`;
        elements.wordCount.style.opacity = '0.4';
      }
    }
    
    // Update fidelity ring
    updateFidelityRing(count);
  }
  
  function updateFidelityRing(wordCount) {
    const ring = document.getElementById('fidelity-ring-progress');
    const container = document.querySelector('.fidelity-ring-container');
    
    if (!ring || !container) return;
    
    // Calculate progress (0-100)
    let progress = 0;
    let level = 'thin';
    
    if (wordCount === 0) {
      progress = 0;
      container.classList.remove('visible');
    } else {
      container.classList.add('visible');
      
      if (wordCount >= 100) {
        progress = 100;
        level = 'professional';
      } else if (wordCount >= 50) {
        progress = 50 + ((wordCount - 50) / 50) * 50; // 50-100%
        level = 'adequate';
      } else if (wordCount >= 20) {
        progress = 25 + ((wordCount - 20) / 30) * 25; // 25-50%
        level = 'basic';
      } else {
        progress = (wordCount / 20) * 25; // 0-25%
        level = 'thin';
      }
    }
    
    // Update SVG circle
    const circumference = 2 * Math.PI * 16; // r=16
    const dashArray = (progress / 100) * circumference;
    ring.style.strokeDasharray = `${dashArray} ${circumference}`;
    ring.setAttribute('data-level', level);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  
  function initializeSteps() {
    if (!state.category) return;
    
    state.totalSteps = state.category.steps.length;
    state.currentStep = 0;
    state.stepResponses = new Array(state.totalSteps).fill('');
    state.digDeeperMode = false;
    state.inDeeperQuestions = false;
    state.deeperResponses = [];
    updateStepDisplay();
  }
  
  function updateStepDisplay() {
    if (!state.category) return;
    
    let step;
    let stepIndex;
    let totalDisplay;
    
    if (state.inDeeperQuestions) {
      // In deeper questions mode
      const deeperIndex = state.currentStep - state.totalSteps;
      step = state.category.deeperSteps[deeperIndex];
      stepIndex = deeperIndex + 1;
      totalDisplay = state.category.deeperSteps.length;
      
      if (elements.stepIndicator) {
        elements.stepIndicator.textContent = `Deeper ${stepIndex} of ${totalDisplay}`;
      }
    } else {
      // In base questions mode
      step = state.category.steps[state.currentStep];
      stepIndex = state.currentStep + 1;
      totalDisplay = state.totalSteps;
      
      if (elements.stepIndicator) {
        elements.stepIndicator.textContent = `${stepIndex} of ${totalDisplay}`;
      }
    }
    
    if (!step) return;
    
    if (elements.stepQuestion) {
      elements.stepQuestion.textContent = step.question;
    }
    
    if (elements.stepHint) {
      elements.stepHint.textContent = step.guidance;
    }
    
    if (elements.stepTextarea) {
      if (state.inDeeperQuestions) {
        const deeperIndex = state.currentStep - state.totalSteps;
        elements.stepTextarea.value = state.deeperResponses[deeperIndex] || '';
      } else {
        elements.stepTextarea.value = state.stepResponses[state.currentStep] || '';
      }
      elements.stepTextarea.placeholder = step.placeholder || '';
    }
    
    updateWordCount();
    updateButtonStates();
    
    if (elements.stepTextarea) {
      elements.stepTextarea.focus();
    }
  }
  
  function updateButtonStates() {
    // Previous button
    if (elements.btnPrevStep) {
      const isHidden = state.currentStep === 0 && !state.inDeeperQuestions;
      elements.btnPrevStep.style.opacity = isHidden ? '0' : '1';
      elements.btnPrevStep.style.pointerEvents = isHidden ? 'none' : 'auto';
    }
    
    // Dig deeper button visibility
    const isLastBaseStep = state.currentStep === state.totalSteps - 1 && !state.inDeeperQuestions;
    const hasDeeper = state.category && state.category.deeperSteps && state.category.deeperSteps.length > 0;
    
    if (elements.btnDigDeeper) {
      if (isLastBaseStep && hasDeeper) {
        elements.btnDigDeeper.style.display = 'flex';
        elements.btnDigDeeper.style.opacity = '1';
        elements.btnDigDeeper.style.pointerEvents = 'auto';
      } else {
        elements.btnDigDeeper.style.display = 'none';
        elements.btnDigDeeper.style.opacity = '0';
        elements.btnDigDeeper.style.pointerEvents = 'none';
      }
    }
    
    // Next/Complete button text
    if (elements.btnNextStep) {
      if (state.inDeeperQuestions) {
        const deeperIndex = state.currentStep - state.totalSteps;
        const isLastDeeperStep = deeperIndex === state.category.deeperSteps.length - 1;
        elements.btnNextStep.textContent = isLastDeeperStep ? 'Complete' : 'Continue';
      } else {
        const isLastStep = state.currentStep === state.totalSteps - 1;
        elements.btnNextStep.textContent = isLastStep ? 'Complete' : 'Continue';
      }
    }
  }
  
  function saveCurrentStep() {
    if (!elements.stepTextarea) return;
    
    if (state.inDeeperQuestions) {
      const deeperIndex = state.currentStep - state.totalSteps;
      state.deeperResponses[deeperIndex] = elements.stepTextarea.value;
    } else {
      state.stepResponses[state.currentStep] = elements.stepTextarea.value;
    }
  }
  
  function goToNextStep() {
    saveCurrentStep();
    
    if (state.inDeeperQuestions) {
      // In deeper questions
      const deeperIndex = state.currentStep - state.totalSteps;
      const isLastDeeperStep = deeperIndex === state.category.deeperSteps.length - 1;
      
      if (isLastDeeperStep) {
        endSession();
      } else {
        state.currentStep++;
        updateStepDisplay();
      }
    } else {
      // In base questions
      const isLastBaseStep = state.currentStep === state.totalSteps - 1;
      
      if (isLastBaseStep) {
        endSession();
      } else {
        state.currentStep++;
        updateStepDisplay();
      }
    }
  }
  
  function goToPrevStep() {
    saveCurrentStep();
    
    if (state.inDeeperQuestions) {
      const deeperIndex = state.currentStep - state.totalSteps;
      
      if (deeperIndex === 0) {
        // Go back to last base question
        state.inDeeperQuestions = false;
        state.currentStep = state.totalSteps - 1;
      } else {
        state.currentStep--;
      }
    } else {
      if (state.currentStep > 0) {
        state.currentStep--;
      }
    }
    
    updateStepDisplay();
  }
  
  function activateDigDeeper() {
    saveCurrentStep();
    state.digDeeperMode = true;
    state.inDeeperQuestions = true;
    state.currentStep = state.totalSteps; // Move to first deeper question
    state.deeperResponses = new Array(state.category.deeperSteps.length).fill('');
    updateStepDisplay();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  
  function startSession(typeId) {
    const category = getCategory(typeId);
    if (!category) {
      console.error('ProvenanceAI: Unknown category', typeId);
      return;
    }
    
    state.sessionType = typeId;
    state.category = category;
    state.startTime = Date.now();
    
    if (elements.sessionTypeLabel) {
      elements.sessionTypeLabel.textContent = category.label;
    }
    
    initializeSteps();
    showScreen('session');
  }
  
  function endSession() {
    saveCurrentStep();
    
    const duration = Math.floor((Date.now() - state.startTime) / 1000);
    
    // Calculate total words (base + deeper if activated)
    let totalWords = state.stepResponses.reduce((sum, r) => sum + getWordCount(r), 0);
    if (state.digDeeperMode) {
      totalWords += state.deeperResponses.reduce((sum, r) => sum + getWordCount(r), 0);
    }
    
    // Generate summary
    generateSummary();
    
    if (elements.resultTime) {
      elements.resultTime.textContent = formatTime(duration);
    }
    if (elements.resultWordCount) {
      elements.resultWordCount.textContent = `${totalWords} words`;
    }
    
    showScreen('complete');
  }
  
  function resetToLanding() {
    state.sessionType = null;
    state.category = null;
    state.startTime = null;
    state.currentStep = 0;
    state.stepResponses = [];
    state.digDeeperMode = false;
    state.inDeeperQuestions = false;
    state.deeperResponses = [];
    showScreen('landing');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY GENERATION
  // ─────────────────────────────────────────────────────────────────────────
  
  function generateSummary() {
    if (!elements.summaryContent || !state.category) return;
    
    let html = '';
    
    // Base questions
    state.category.steps.forEach((step, index) => {
      const response = state.stepResponses[index] || '';
      if (response.trim()) {
        html += `
          <div class="summary-item">
            <div class="summary-question">${escapeHTML(step.question)}</div>
            <div class="summary-response">${escapeHTML(response)}</div>
          </div>
        `;
      }
    });
    
    // Deeper questions (if activated)
    if (state.digDeeperMode && state.category.deeperSteps) {
      state.category.deeperSteps.forEach((step, index) => {
        const response = state.deeperResponses[index] || '';
        if (response.trim()) {
          html += `
            <div class="summary-item">
              <div class="summary-question">${escapeHTML(step.question)}</div>
              <div class="summary-response">${escapeHTML(response)}</div>
            </div>
          `;
        }
      });
    }
    
    elements.summaryContent.innerHTML = html || '<p class="summary-empty">No responses recorded.</p>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COPY PROMPT
  // ─────────────────────────────────────────────────────────────────────────
  
  function copyAIPrompt() {
    if (!elements.aiPromptContent) return;
    
    const prompt = elements.aiPromptContent.textContent;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(prompt)
        .then(showCopySuccess)
        .catch(() => fallbackCopy(prompt));
    } else {
      fallbackCopy(prompt);
    }
  }
  
  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      showCopySuccess();
    } catch (e) {
      console.warn('Copy failed:', e);
    }
    document.body.removeChild(textarea);
  }
  
  function showCopySuccess() {
    if (!elements.btnCopyPrompt) return;
    const original = elements.btnCopyPrompt.textContent;
    elements.btnCopyPrompt.textContent = 'Copied prompt to clipboard';
    setTimeout(() => {
      elements.btnCopyPrompt.textContent = original;
    }, 2000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────
  
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KEYBOARD HANDLING
  // ─────────────────────────────────────────────────────────────────────────
  
  function handleKeyboard(e) {
    if (e.target.tagName === 'TEXTAREA') {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        goToNextStep();
      }
      return;
    }
    
    if (e.key === 'Escape') {
      if (state.currentScreen === 'session') {
        endSession();
      } else if (state.currentScreen === 'complete') {
        resetToLanding();
      }
    }
    
    if (state.currentScreen === 'landing') {
      const categories = Object.keys(getCategories());
      const num = parseInt(e.key);
      if (num >= 1 && num <= categories.length) {
        e.preventDefault();
        startSession(categories[num - 1]);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────────────────────────────────
  
  function initEventListeners() {
    elements.sessionTypeItems.forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        const type = this.getAttribute('data-type');
        if (type && getCategory(type)) {
          startSession(type);
        }
      });
    });
    
    if (elements.btnNextStep) {
      elements.btnNextStep.addEventListener('click', (e) => {
        e.preventDefault();
        goToNextStep();
      });
    }
    
    if (elements.btnPrevStep) {
      elements.btnPrevStep.addEventListener('click', (e) => {
        e.preventDefault();
        goToPrevStep();
      });
    }
    
    if (elements.btnDigDeeper) {
      elements.btnDigDeeper.addEventListener('click', (e) => {
        e.preventDefault();
        activateDigDeeper();
      });
    }
    
    if (elements.btnEndSession) {
      elements.btnEndSession.addEventListener('click', (e) => {
        e.preventDefault();
        resetToLanding();
      });
    }
    
    if (elements.stepTextarea) {
      elements.stepTextarea.addEventListener('input', updateWordCount);
    }
    
    if (elements.btnStartAnother) {
      elements.btnStartAnother.addEventListener('click', (e) => {
        e.preventDefault();
        resetToLanding();
      });
    }
    
    if (elements.btnCopyPrompt) {
      elements.btnCopyPrompt.addEventListener('click', (e) => {
        e.preventDefault();
        copyAIPrompt();
      });
    }
    
    document.addEventListener('keydown', handleKeyboard);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }
  
  function setup() {
    if (!window.BLANKPAGE_CATEGORIES) {
      console.error('ProvenanceAI: Categories not found. Load categories file first.');
      return;
    }
    
    cacheElements();
    
    if (!elements.screenLanding || !elements.screenSession) {
      console.error('ProvenanceAI: Missing essential screen elements');
      return;
    }
    
    initEventListeners();
    
    // Initial screen state
    if (elements.screenSession) elements.screenSession.style.display = 'none';
    if (elements.screenComplete) elements.screenComplete.style.display = 'none';
    if (elements.screenLanding) {
      elements.screenLanding.style.display = 'flex';
      elements.screenLanding.style.opacity = '1';
    }
    
    const categoryCount = Object.keys(getCategories()).length;
    console.log(`Kumagaizo Core — ${categoryCount} categories (Dig Deeper enabled)`);
  }

  // Export for Prompt Engine and debugging
  window.BlankPage = {
    version: '6.2',
    getState: () => ({ ...state }),
    getCategories
  };
  
  init();

})();