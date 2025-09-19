// Org Mode Capture Buffer Web Component
// Following the same patterns as outline.js

class CaptureBuffer {
  constructor(el, options = {}) {
    this.el = el;
    this.options = {
      templates: options.templates || [],
      ...options
    };
    
    // State machine for navigation
    this.currentState = 'template-selection';
    this.templatePath = [];
    this.currentTemplates = this.options.templates;
    this.selectedTemplate = null;
    this.shortcuts = new Map();
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.registerShortcuts();
    this.render();
  }

  bindEvents() {
    // Global escape key handler
    document.addEventListener("keydown", e => {
      if (e.key === 'Escape') {
        this.handleEscape();
      }
    });

    // Keyboard handling is now done at the web component level
  }

  handleKeydown(e) {
    // Handle Ctrl/Cmd + Enter for form submission
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.handleSubmit();
      return;
    }

    // Handle Escape key for navigation back
    if (e.key === 'Escape') {
      e.preventDefault();
      const shouldClose = this.handleEscape();
      if (!shouldClose) {
        // We handled the escape internally, stop event propagation
        e.stopPropagation();
      }
      return;
    }

    // Handle navigation keys that work in all states
    // Navigation: Back (Ctrl+B always works, h only when not in input)
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      const shouldClose = this.handleEscape();
      if (!shouldClose) {
        e.stopPropagation();
      }
      return;
    }
    
    // h key for back navigation (only when not focused on input/textarea and not in form state)
    if (e.key === 'h' && 
        this.currentState !== 'form' && 
        !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      e.preventDefault();
      const shouldClose = this.handleEscape();
      if (!shouldClose) {
        e.stopPropagation();
      }
      return;
    }

    // ArrowLeft key for back navigation
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const shouldClose = this.handleEscape();
      if (!shouldClose) {
        e.stopPropagation();
      }
      return;
    }

    // Handle navigation keys for template selection
    if (this.currentState === 'template-selection') {
      // Navigation: Up (Ctrl+P, k, ArrowUp)
      if ((e.ctrlKey && e.key === 'p') || e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateTemplates('up');
        return;
      }
      
      // Navigation: Down (Ctrl+N, j, ArrowDown)
      if ((e.ctrlKey && e.key === 'n') || e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateTemplates('down');
        return;
      }
      
      // Navigation: Forward/Select (Ctrl+F, l, Enter, ArrowRight)
      if ((e.ctrlKey && e.key === 'f') || e.key === 'l' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigateTemplates('select');
        return;
      }

      // Handle single-key shortcuts for template selection
      const shortcut = e.key.toLowerCase();
      if (this.shortcuts.has(shortcut)) {
        e.preventDefault();
        this.selectTemplate(shortcut);
      }
    }

    // Handle Tab navigation in forms
    if (this.currentState === 'form' && e.key === 'Tab') {
      // Let default tab behavior handle form navigation
      return;
    }
  }

  registerShortcuts() {
    this.shortcuts.clear();
    this.currentTemplates.forEach(template => {
      if (template.shortcut) {
        this.shortcuts.set(template.shortcut, template);
      }
    });
  }

  navigateTemplates(direction) {
    if (this.currentState !== 'template-selection') return;
    
    const buttons = Array.from(this.el.querySelectorAll('.capture-template-item'));
    if (buttons.length === 0) return;
    
    // Try multiple ways to find the currently focused button
    let currentFocused = this.el.querySelector('.capture-template-item:focus');
    
    // Fallback: check if any button has focus using document.activeElement
    if (!currentFocused) {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.classList.contains('capture-template-item')) {
        currentFocused = activeEl;
      }
    }
    
    // Initialize currentIndex, defaulting to -1 if no button is focused
    let currentIndex = currentFocused ? buttons.indexOf(currentFocused) : -1;
    
    // Track the current index for better navigation
    if (this.currentTemplateIndex === undefined) {
      this.currentTemplateIndex = 0;
    }
    
    if (currentIndex >= 0) {
      this.currentTemplateIndex = currentIndex;
    }
    
    if (direction === 'up') {
      this.currentTemplateIndex = this.currentTemplateIndex <= 0 ? buttons.length - 1 : this.currentTemplateIndex - 1;
      buttons[this.currentTemplateIndex].focus();
    } else if (direction === 'down') {
      this.currentTemplateIndex = this.currentTemplateIndex >= buttons.length - 1 ? 0 : this.currentTemplateIndex + 1;
      buttons[this.currentTemplateIndex].focus();
    } else if (direction === 'select') {
      // Select the currently focused button, or the tracked index
      const targetButton = buttons[this.currentTemplateIndex] || buttons[0];
      if (targetButton) {
        const shortcut = targetButton.dataset.shortcut;
        this.selectTemplate(shortcut);
      }
    }
  }

  selectTemplate(shortcut) {
    const template = this.shortcuts.get(shortcut);
    if (!template) return;

    if (template.children && template.children.length > 0) {
      // Navigate to sub-templates
      this.templatePath.push(template);
      this.currentTemplates = template.children;
      this.currentState = 'template-selection';
      this.registerShortcuts();
      this.render();
    } else {
      // Select final template and show form
      this.selectedTemplate = template;
      this.currentState = 'form';
      this.render();
    }
  }

  handleEscape() {
    if (this.currentState === 'form') {
      // Go back to template selection - don't close modal
      this.currentState = 'template-selection';
      this.selectedTemplate = null;
      this.render();
      return false; // Indicate we handled the escape, don't close modal
    } else if (this.templatePath.length > 0) {
      // Go back to parent template level - don't close modal
      this.templatePath.pop();
      const parent = this.templatePath[this.templatePath.length - 1];
      this.currentTemplates = parent ? parent.children : this.options.templates;
      this.registerShortcuts();
      this.render();
      return false; // Indicate we handled the escape, don't close modal
    } else {
      // Close the capture buffer only if we're at the root level
      this.handleAbort();
      return true; // Allow modal to close
    }
  }

  handleSubmit() {
    if (this.currentState !== 'form' || !this.selectedTemplate) return;

    const formData = this.collectFormData();
    
    // Emit comprehensive capture event
    this.emit('capture:submit', {
      template: this.selectedTemplate,
      templatePath: [...this.templatePath, this.selectedTemplate],
      formData: formData,
      timestamp: new Date().toISOString(),
      templateId: this.selectedTemplate.id,
      templateName: this.selectedTemplate.name
    });
  }


  handleAbort() {
    this.emit('capture:abort', {
      template: this.selectedTemplate,
      templatePath: this.templatePath,
      currentState: this.currentState
    });
  }

  collectFormData() {
    const form = this.el.querySelector('.capture-form');
    if (!form) return {};

    const formData = {};
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      const name = input.name || input.dataset.field;
      if (name) {
        formData[name] = input.value;
      }
    });

    return formData;
  }

  render() {
    if (this.currentState === 'template-selection') {
      this.renderTemplateSelection();
    } else if (this.currentState === 'form') {
      this.renderForm();
    }
  }

  renderTemplateSelection() {
    // Reset template index when rendering
    this.currentTemplateIndex = 0;
    
    const breadcrumb = this.templatePath.map(t => t.name).join(' > ');
    const title = breadcrumb ? `${breadcrumb} >` : 'Select capture template:';

    this.el.innerHTML = `
      <div class="capture-container">
        <div class="capture-header">
          <h3 class="capture-title">${title}</h3>
        </div>
        <div class="capture-templates">
          ${this.currentTemplates.map(template => `
            <button class="capture-template-item" data-shortcut="${template.shortcut}" type="button">
              <span class="capture-shortcut">${template.shortcut}</span>
              <span class="capture-template-name">${template.name}</span>
              ${template.description ? `<span class="capture-template-desc">${template.description}</span>` : ''}
            </button>
          `).join('')}
        </div>
        <div class="capture-help">
          <div class="capture-help-text">
            Press key to select template • Tab/Enter to navigate • 
            <button type="button" class="capture-help-button" data-action="cancel">ESC to ${this.templatePath.length > 0 ? 'go back' : 'cancel'}</button>
          </div>
        </div>
      </div>
    `;

    // Add click and keyboard event listeners to template buttons
    this.bindTemplateEvents();
    
    // Ensure the container can receive focus for keyboard events
    this.el.setAttribute('tabindex', '0');
    this.el.focus();
    
    // Add event listeners to help buttons
    this.el.querySelectorAll('.capture-help-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const action = button.dataset.action;
        if (action === 'cancel') {
          const shouldClose = this.handleEscape();
          if (!shouldClose) {
            e.stopPropagation();
          }
        }
      });
    });

    // Ensure container can receive keyboard events and focus first button
    this.el.setAttribute('tabindex', '0');
    setTimeout(() => {
      const firstButton = this.el.querySelector('.capture-template-item');
      if (firstButton) {
        firstButton.focus();
      } else {
        // Fallback: focus the container itself
        this.el.focus();
      }
    }, 0);
  }

  bindTemplateEvents() {
    const templateButtons = this.el.querySelectorAll('.capture-template-item');
    templateButtons.forEach(button => {
      const shortcut = button.dataset.shortcut;
      
      // Click handler
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectTemplate(shortcut);
      });
      
      // Keyboard handler for Enter and Space
      button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectTemplate(shortcut);
        }
      });
    });
  }

  renderForm() {
    if (!this.selectedTemplate) return;

    const template = this.selectedTemplate;
    const breadcrumb = [...this.templatePath, template].map(t => t.name).join(' > ');

    this.el.innerHTML = `
      <div class="capture-container">
        <div class="capture-header">
          <h3 class="capture-title">${breadcrumb}</h3>
        </div>
        <form class="capture-form">
          ${this.renderFormFields(template.fields || [])}
        </form>
        <div class="capture-help">
          <div class="capture-help-text">
            <button type="button" class="capture-help-button" data-action="submit">Ctrl/Cmd + Enter to submit</button> • 
            <button type="button" class="capture-help-button" data-action="cancel">ESC to cancel</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners to help buttons
    this.el.querySelectorAll('.capture-help-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const action = button.dataset.action;
        if (action === 'submit') {
          this.handleSubmit();
        } else if (action === 'cancel') {
          const shouldClose = this.handleEscape();
          if (!shouldClose) {
            e.stopPropagation();
          }
        }
      });
    });

    // Ensure container can receive keyboard events and focus first field
    this.el.setAttribute('tabindex', '0');
    const firstField = this.el.querySelector('.capture-form textarea, .capture-form input');
    if (firstField) {
      setTimeout(() => firstField.focus(), 0);
    } else {
      // Fallback: focus the container itself
      setTimeout(() => this.el.focus(), 0);
    }
  }

  renderFormFields(fields) {
    if (!fields || fields.length === 0) {
      // Default simple textarea
      return `
        <div class="capture-field">
          <label class="capture-field-label">Content:</label>
          <textarea 
            name="content" 
            class="capture-textarea" 
            rows="10" 
            placeholder="Enter your content here..."
          ></textarea>
        </div>
      `;
    }

    return fields.map(field => {
      switch (field.type) {
        case 'textarea':
          return `
            <div class="capture-field">
              <label class="capture-field-label">${field.label || field.name}:</label>
              <textarea 
                name="${field.name}" 
                class="capture-textarea" 
                rows="${field.rows || 5}"
                placeholder="${field.placeholder || ''}"
              >${field.defaultValue || ''}</textarea>
            </div>
          `;
        case 'text':
          return `
            <div class="capture-field">
              <label class="capture-field-label">${field.label || field.name}:</label>
              <input 
                type="text" 
                name="${field.name}" 
                class="capture-input" 
                value="${field.defaultValue || ''}"
                placeholder="${field.placeholder || ''}"
              />
            </div>
          `;
        default:
          return '';
      }
    }).join('');
  }

  reset() {
    // Reset to initial state
    this.currentState = 'template-selection';
    this.templatePath = [];
    this.currentTemplates = this.options.templates;
    this.selectedTemplate = null;
    this.currentTemplateIndex = 0;
    this.shortcuts.clear();
    this.registerShortcuts();
    this.render();
  }

  emit(eventName, detail) {
    const event = new CustomEvent(eventName, {
      detail: detail,
      bubbles: true,
      composed: true
    });
    this.el.dispatchEvent(event);
  }
}

// Web Component Wrapper
class CaptureElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Add keyboard event listener at the web component level
    this.addEventListener('keydown', (e) => {
      if (this.captureBuffer) {
        this.captureBuffer.handleKeydown(e);
      }
    });
  }

  connectedCallback() {
    this.render();
    this.init();
  }

  static get observedAttributes() {
    return ['data-templates', 'theme'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'data-templates') {
        this.init();
      } else if (name === 'theme') {
        this.applyTheme(newValue);
      }
    }
  }

  parseTemplates() {
    const templatesAttr = this.getAttribute('data-templates');
    if (!templatesAttr) return [];
    
    try {
      return JSON.parse(templatesAttr);
    } catch (e) {
      console.warn('Invalid JSON in data-templates:', e);
      return [];
    }
  }

  init() {
    // Create a container element for the capture buffer
    const container = document.createElement('div');
    this.shadowRoot.appendChild(container);

    const options = {
      templates: this.parseTemplates()
    };

    this.captureBuffer = new CaptureBuffer(container, options);
    this.forwardEvents();
    
    // Make sure the container can receive focus for keyboard events
    container.setAttribute('tabindex', '0');
  }

  // Public method to focus the capture component when modal opens
  focus() {
    if (this.captureBuffer) {
      // Reset the capture buffer to initial state
      this.captureBuffer.reset();
      // Ensure the web component itself can receive keyboard events
      this.setAttribute('tabindex', '0');
      // Focus the web component
      HTMLElement.prototype.focus.call(this);
      // Also ensure the inner container can receive focus as backup
      this.captureBuffer.el.setAttribute('tabindex', '0');
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${this.getStyles()}
      </style>
    `;
    
    // Apply theme
    const theme = this.getAttribute('theme');
    if (theme) {
      this.applyTheme(theme);
    } else {
      this.applyThemeFromParent();
    }
  }

  getStyles() {
    return `
      :host {
        /* Theme variables - matching outline.js patterns */
        
        /* Light theme variables */
        --clarity-capture-light-bg-primary: #ffffff;
        --clarity-capture-light-bg-secondary: #f8f9fa;
        --clarity-capture-light-bg-tertiary: #e9ecef;
        --clarity-capture-light-text-primary: #212529;
        --clarity-capture-light-text-secondary: #6c757d;
        --clarity-capture-light-text-muted: #adb5bd;
        --clarity-capture-light-border: #dee2e6;
        --clarity-capture-light-border-focus: #8a9ba8;
        --clarity-capture-light-hover: rgba(0, 0, 0, 0.05);
        --clarity-capture-light-focus: rgba(0, 0, 0, 0.1);
        --clarity-capture-light-focus-shadow: rgba(138, 155, 168, 0.3);
        --clarity-capture-light-input-bg: #ffffff;
        --clarity-capture-light-input-border: #e1e5e9;
        --clarity-capture-light-popup-bg: #ffffff;
        --clarity-capture-light-popup-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

        /* Dark theme variables */
        --clarity-capture-dark-bg-primary: #1e1e1e;
        --clarity-capture-dark-bg-secondary: #2d2d2d;
        --clarity-capture-dark-bg-tertiary: #333333;
        --clarity-capture-dark-text-primary: #f8f8f2;
        --clarity-capture-dark-text-secondary: #ddd;
        --clarity-capture-dark-text-muted: #888;
        --clarity-capture-dark-border: #555;
        --clarity-capture-dark-border-focus: #b8c5d1;
        --clarity-capture-dark-hover: rgba(255, 255, 255, 0.08);
        --clarity-capture-dark-focus: rgba(255, 255, 255, 0.15);
        --clarity-capture-dark-focus-shadow: rgba(184, 197, 209, 0.4);
        --clarity-capture-dark-input-bg: #2d2d2d;
        --clarity-capture-dark-input-border: #999;
        --clarity-capture-dark-popup-bg: #2d2d2d;
        --clarity-capture-dark-popup-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        /* Active theme variables - default to dark theme */
        --clarity-capture-bg-primary: var(--clarity-capture-dark-bg-primary);
        --clarity-capture-bg-secondary: var(--clarity-capture-dark-bg-secondary);
        --clarity-capture-bg-tertiary: var(--clarity-capture-dark-bg-tertiary);
        --clarity-capture-text-primary: var(--clarity-capture-dark-text-primary);
        --clarity-capture-text-secondary: var(--clarity-capture-dark-text-secondary);
        --clarity-capture-text-muted: var(--clarity-capture-dark-text-muted);
        --clarity-capture-border: var(--clarity-capture-dark-border);
        --clarity-capture-border-focus: var(--clarity-capture-dark-border-focus);
        --clarity-capture-hover: var(--clarity-capture-dark-hover);
        --clarity-capture-focus: var(--clarity-capture-dark-focus);
        --clarity-capture-focus-shadow: var(--clarity-capture-dark-focus-shadow);
        --clarity-capture-input-bg: var(--clarity-capture-dark-input-bg);
        --clarity-capture-input-border: var(--clarity-capture-dark-input-border);
        --clarity-capture-popup-bg: var(--clarity-capture-dark-popup-bg);
        --clarity-capture-popup-shadow: var(--clarity-capture-dark-popup-shadow);

        /* Component customization */
        --clarity-capture-border-radius: 4px;
        --clarity-capture-padding: 1rem;
        --clarity-capture-font-family: inherit;
        --clarity-capture-font-size: inherit;
        
        display: block;
        font-family: var(--clarity-capture-font-family);
        font-size: var(--clarity-capture-font-size);
      }

      /* Light theme support via media query */
      @media (prefers-color-scheme: light) {
        :host {
          --clarity-capture-bg-primary: var(--clarity-capture-light-bg-primary);
          --clarity-capture-bg-secondary: var(--clarity-capture-light-bg-secondary);
          --clarity-capture-bg-tertiary: var(--clarity-capture-light-bg-tertiary);
          --clarity-capture-text-primary: var(--clarity-capture-light-text-primary);
          --clarity-capture-text-secondary: var(--clarity-capture-light-text-secondary);
          --clarity-capture-text-muted: var(--clarity-capture-light-text-muted);
          --clarity-capture-border: var(--clarity-capture-light-border);
          --clarity-capture-border-focus: var(--clarity-capture-light-border-focus);
          --clarity-capture-hover: var(--clarity-capture-light-hover);
          --clarity-capture-focus: var(--clarity-capture-light-focus);
          --clarity-capture-focus-shadow: var(--clarity-capture-light-focus-shadow);
          --clarity-capture-input-bg: var(--clarity-capture-light-input-bg);
          --clarity-capture-input-border: var(--clarity-capture-light-input-border);
          --clarity-capture-popup-bg: var(--clarity-capture-light-popup-bg);
          --clarity-capture-popup-shadow: var(--clarity-capture-light-popup-shadow);
        }
      }

      .capture-container {
        background: var(--clarity-capture-bg-primary);
        border: 1px solid var(--clarity-capture-border);
        border-radius: var(--clarity-capture-border-radius);
        padding: var(--clarity-capture-padding);
        max-width: 600px;
        margin: 0 auto;
        box-shadow: var(--clarity-capture-popup-shadow);
      }

      .capture-header {
        margin-bottom: 0.75rem;
      }

      .capture-title {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 400;
        color: var(--clarity-capture-text-muted);
        opacity: 0.7;
        text-align: center;
      }

      /* Template selection styles */
      .capture-templates {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
      }

      .capture-template-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border: 1px solid var(--clarity-capture-border);
        border-radius: var(--clarity-capture-border-radius);
        cursor: pointer;
        transition: all 0.15s ease;
        background: var(--clarity-capture-bg-secondary);
        width: 100%;
        text-align: left;
        font-family: inherit;
        font-size: inherit;
        color: inherit;
      }

      .capture-template-item:hover {
        background: var(--clarity-capture-hover);
        border-color: var(--clarity-capture-border-focus);
      }

      .capture-template-item:focus {
        outline: none;
        background: var(--clarity-capture-focus);
        border-color: var(--clarity-capture-border-focus);
        box-shadow: 0 0 0 2px var(--clarity-capture-focus-shadow);
      }

      .capture-shortcut {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        background: var(--clarity-capture-bg-tertiary);
        border: 1px solid var(--clarity-capture-border);
        border-radius: var(--clarity-capture-border-radius);
        font-weight: 600;
        font-family: monospace;
        color: var(--clarity-capture-text-primary);
        flex-shrink: 0;
      }

      .capture-template-name {
        font-weight: 500;
        color: var(--clarity-capture-text-primary);
        flex-shrink: 0;
      }

      .capture-template-desc {
        color: var(--clarity-capture-text-secondary);
        font-size: 0.9rem;
      }

      /* Form styles */
      .capture-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .capture-field {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .capture-field-label {
        font-weight: 500;
        color: var(--clarity-capture-text-primary);
        font-size: 0.9rem;
      }

      .capture-textarea,
      .capture-input {
        padding: 0.75rem;
        border: 1px solid var(--clarity-capture-input-border);
        border-radius: var(--clarity-capture-border-radius);
        background: var(--clarity-capture-input-bg);
        color: var(--clarity-capture-text-primary);
        font-family: inherit;
        font-size: inherit;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
        resize: vertical;
      }

      .capture-textarea:focus,
      .capture-input:focus {
        outline: none;
        border-color: var(--clarity-capture-border-focus);
        box-shadow: 0 0 0 2px var(--clarity-capture-focus-shadow);
      }

      .capture-textarea {
        min-height: 200px;
        line-height: 1.5;
      }

      /* Help text styles */
      .capture-help {
        border-top: 1px solid var(--clarity-capture-border);
        padding-top: 0.75rem;
      }

      .capture-help-text {
        font-size: 0.85rem;
        color: var(--clarity-capture-text-muted);
        text-align: center;
      }

      .capture-help-button {
        background: none;
        border: none;
        color: var(--clarity-capture-text-muted);
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
        padding: 0.2rem 0.4rem;
        border-radius: 2px;
        transition: all 0.15s ease;
        text-decoration: none;
      }

      .capture-help-button:hover {
        color: var(--clarity-capture-text-primary);
        background: var(--clarity-capture-hover);
        text-decoration: none;
      }

      .capture-help-button:focus {
        outline: none;
        color: var(--clarity-capture-text-primary);
        background: var(--clarity-capture-focus);
        text-decoration: none;
      }


      /* Responsive design */
      @media (max-width: 768px) {
        .capture-container {
          margin: 0;
          border-radius: 0;
          border-left: none;
          border-right: none;
          max-width: none;
        }

        .capture-template-item {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .capture-shortcut {
          align-self: flex-start;
        }
      }
    `;
  }

  applyThemeFromParent() {
    const parentStyle = getComputedStyle(document.documentElement);
    const properties = [
      '--clarity-capture-bg-primary', '--clarity-capture-bg-secondary', '--clarity-capture-bg-tertiary',
      '--clarity-capture-text-primary', '--clarity-capture-text-secondary', '--clarity-capture-text-muted',
      '--clarity-capture-border', '--clarity-capture-border-focus', '--clarity-capture-hover', '--clarity-capture-focus',
      '--clarity-capture-input-bg', '--clarity-capture-input-border', '--clarity-capture-popup-bg', '--clarity-capture-popup-shadow'
    ];

    properties.forEach(prop => {
      const value = parentStyle.getPropertyValue(prop);
      if (value) {
        this.style.setProperty(prop, value);
      }
    });
  }

  applyTheme(theme) {
    const host = this;
    
    const themeProperties = [
      '--clarity-capture-bg-primary', '--clarity-capture-bg-secondary', '--clarity-capture-bg-tertiary',
      '--clarity-capture-text-primary', '--clarity-capture-text-secondary', '--clarity-capture-text-muted',
      '--clarity-capture-border', '--clarity-capture-border-focus', '--clarity-capture-hover', 
      '--clarity-capture-focus', '--clarity-capture-focus-shadow',
      '--clarity-capture-input-bg', '--clarity-capture-input-border', '--clarity-capture-popup-bg', '--clarity-capture-popup-shadow'
    ];
    
    if (!theme || theme === 'auto') {
      themeProperties.forEach(prop => host.style.removeProperty(prop));
    } else if (theme === 'light') {
      host.style.setProperty('--clarity-capture-bg-primary', '#ffffff');
      host.style.setProperty('--clarity-capture-bg-secondary', '#f8f9fa');
      host.style.setProperty('--clarity-capture-bg-tertiary', '#e9ecef');
      host.style.setProperty('--clarity-capture-text-primary', '#212529');
      host.style.setProperty('--clarity-capture-text-secondary', '#6c757d');
      host.style.setProperty('--clarity-capture-text-muted', '#adb5bd');
      host.style.setProperty('--clarity-capture-border', '#dee2e6');
      host.style.setProperty('--clarity-capture-border-focus', '#8a9ba8');
      host.style.setProperty('--clarity-capture-hover', 'rgba(0, 0, 0, 0.05)');
      host.style.setProperty('--clarity-capture-focus', 'rgba(0, 0, 0, 0.1)');
      host.style.setProperty('--clarity-capture-focus-shadow', 'rgba(138, 155, 168, 0.3)');
      host.style.setProperty('--clarity-capture-input-bg', '#ffffff');
      host.style.setProperty('--clarity-capture-input-border', '#e1e5e9');
      host.style.setProperty('--clarity-capture-popup-bg', '#ffffff');
      host.style.setProperty('--clarity-capture-popup-shadow', '0 4px 12px rgba(0, 0, 0, 0.15)');
    } else if (theme === 'dark') {
      host.style.setProperty('--clarity-capture-bg-primary', '#1e1e1e');
      host.style.setProperty('--clarity-capture-bg-secondary', '#2d2d2d');
      host.style.setProperty('--clarity-capture-bg-tertiary', '#333333');
      host.style.setProperty('--clarity-capture-text-primary', '#f8f8f2');
      host.style.setProperty('--clarity-capture-text-secondary', '#ddd');
      host.style.setProperty('--clarity-capture-text-muted', '#888');
      host.style.setProperty('--clarity-capture-border', '#555');
      host.style.setProperty('--clarity-capture-border-focus', '#b8c5d1');
      host.style.setProperty('--clarity-capture-hover', 'rgba(255, 255, 255, 0.08)');
      host.style.setProperty('--clarity-capture-focus', 'rgba(255, 255, 255, 0.15)');
      host.style.setProperty('--clarity-capture-focus-shadow', 'rgba(184, 197, 209, 0.4)');
      host.style.setProperty('--clarity-capture-input-bg', '#2d2d2d');
      host.style.setProperty('--clarity-capture-input-border', '#999');
      host.style.setProperty('--clarity-capture-popup-bg', '#2d2d2d');
      host.style.setProperty('--clarity-capture-popup-shadow', '0 4px 12px rgba(0, 0, 0, 0.3)');
    }
  }

  forwardEvents() {
    // Forward events from the capture buffer container
    const container = this.shadowRoot.children[this.shadowRoot.children.length - 1]; // Last child is our container
    const events = ['capture:submit', 'capture:abort', 'capture:refile'];

    events.forEach(eventName => {
      container.addEventListener(eventName, (e) => {
        const newEvent = new CustomEvent(eventName, {
          detail: e.detail,
          bubbles: true,
          composed: true
        });
        this.dispatchEvent(newEvent);
      });
    });
  }

  // Public API
  getFormData() {
    return this.captureBuffer ? this.captureBuffer.collectFormData() : {};
  }

  reset() {
    if (this.captureBuffer) {
      this.captureBuffer.currentState = 'template-selection';
      this.captureBuffer.templatePath = [];
      this.captureBuffer.currentTemplates = this.captureBuffer.options.templates;
      this.captureBuffer.selectedTemplate = null;
      this.captureBuffer.registerShortcuts();
      this.captureBuffer.render();
    }
  }
}

// Register the web component
customElements.define('clarity-capture', CaptureElement);

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CaptureElement, CaptureBuffer };
}
