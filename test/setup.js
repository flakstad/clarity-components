/**
 * Jest Setup File
 * 
 * This file sets up the test environment for the Outline web component tests.
 * It handles loading the web component and setting up global mocks.
 */

const fs = require('fs');
const path = require('path');

// Mock crypto.randomUUID for consistent test IDs
global.crypto = {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
};

// Mock console.log to reduce noise in tests
global.console.log = jest.fn();
global.console.warn = jest.fn();
global.console.error = jest.fn();
global.console.info = jest.fn();
global.console.debug = jest.fn();

// Mock window.open for external link tests
global.window.open = jest.fn();

// Load the web component
const outlinePath = path.join(process.cwd(), 'outline.js');
const outlineCode = fs.readFileSync(outlinePath, 'utf8');

// Create a global function to evaluate the code
global.loadOutlineComponent = () => {
  // Temporarily override customElements.define to prevent registration errors
  const originalDefine = customElements.define;
  customElements.define = (name, constructor) => {
    try {
      originalDefine.call(customElements, name, constructor);
    } catch (error) {
      // Ignore "already registered" errors
      if (!error.message.includes('already been registered')) {
        throw error;
      }
    }
  };
  
  // Use Function constructor instead of eval to avoid Jest deep copying issues
  const loadFunction = new Function('customElements', outlineCode);
  loadFunction(customElements);
  
  // Restore original customElements.define
  customElements.define = originalDefine;
  
  return customElements.get('clarity-outline');
};

// Setup global test utilities
global.createTestOutlineList = (options = {}) => {
  // Load the web component
  global.loadOutlineComponent();
  
  // Create a fresh container
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  
  // Create the web component with test options
  const outlineList = document.createElement('clarity-outline');
  
  // Set options as JSON string
  const testOptions = {
    assignees: ['alice', 'bob', 'charlie'],
    tags: ['urgent', 'bug', 'feature'],
    statusLabels: [
      { label: 'TODO', isEndState: false },
      { label: 'IN PROGRESS', isEndState: false },
      { label: 'DONE', isEndState: true }
    ],
    ...options
  };
  
  outlineList.setAttribute('options', JSON.stringify(testOptions));
  container.appendChild(outlineList);
  
  // Wait for the component to be connected
  return new Promise((resolve) => {
    setTimeout(() => {
      const todoList = outlineList.todoListInstance;
      resolve({ todoList, outlineList, container });
    }, 10);
  });
};

global.cleanupTestOutlineList = (container) => {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
};

// Helper function to create keyboard events
global.createKeyEvent = (key, options = {}) => {
  // Map common keys to their code values
  const keyToCode = {
    'n': 'KeyN',
    'p': 'KeyP',
    'f': 'KeyF',
    'b': 'KeyB',
    'j': 'KeyJ',
    'k': 'KeyK',
    'l': 'KeyL',
    'h': 'KeyH',
    'ArrowUp': 'ArrowUp',
    'ArrowDown': 'ArrowDown',
    'ArrowLeft': 'ArrowLeft',
    'ArrowRight': 'ArrowRight'
  };
  
  return new KeyboardEvent('keydown', {
    key,
    code: keyToCode[key] || key,
    bubbles: true,
    cancelable: true,
    ...options
  });
};

// Helper function to create mouse events
global.createClickEvent = (options = {}) => {
  return new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    ...options
  });
};

// Helper function to wait for DOM updates
global.waitForDOMUpdate = () => {
  return new Promise(resolve => {
    setTimeout(resolve, 10);
  });
};

// Helper function to wait for specific condition
global.waitFor = (condition, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 10);
      }
    };
    
    check();
  });
};

// Helper function to wait for element to exist
global.waitForElement = (selector, timeout = 1000) => {
  return waitFor(() => document.querySelector(selector), timeout);
};

// Helper function to wait for class to be applied
global.waitForClass = (element, className, timeout = 1000) => {
  return waitFor(() => element.classList.contains(className), timeout);
};

// Helper function to get all todos from web component
global.getAllTodos = (outlineList) => {
  console.log('getAllTodos called with:', outlineList);
  console.log('outlineList.tagName:', outlineList.tagName);
  console.log('outlineList.shadowRoot:', outlineList.shadowRoot);
  
  const shadowRoot = outlineList.shadowRoot;
  if (!shadowRoot) {
    console.log('No shadow root found!');
    return [];
  }
  
  const listElement = shadowRoot.querySelector('.outline-list');
  console.log('listElement:', listElement);
  console.log('listElement.tagName:', listElement?.tagName);
  
  if (!listElement) {
    console.log('No .outline-list element found!');
    return [];
  }
  
  // Get li elements - either direct children or inside task-item web components
  const directLiElements = Array.from(listElement.children).filter(child => child.tagName === 'LI');
  const taskItemElements = Array.from(listElement.children).filter(child => child.tagName === 'TASK-ITEM');
  const taskItemLiElements = taskItemElements.map(taskItem => taskItem.querySelector('li')).filter(Boolean);
  
  const allLiElements = [...directLiElements, ...taskItemLiElements];
  
  console.log('directLiElements found:', directLiElements.length);
  console.log('taskItemElements found:', taskItemElements.length);
  console.log('taskItemLiElements found:', taskItemLiElements.length);
  console.log('total liElements:', allLiElements.length);
  console.log('allLiElements:', allLiElements.map(el => ({
    tagName: el.tagName,
    textContent: el.querySelector('.outline-text')?.textContent
  })));
  
  return allLiElements;
};

// Helper function to get todo by text from web component
global.getTodoByText = (outlineList, text) => {
  const shadowRoot = outlineList.shadowRoot;
  if (!shadowRoot) {
    return null;
  }
  
  const listElement = shadowRoot.querySelector('.outline-list');
  if (!listElement) {
    return null;
  }
  
  // Search all li elements recursively, not just top-level ones
  const allLiElements = listElement.querySelectorAll('li');
  return Array.from(allLiElements).find(li => 
    li.querySelector('.outline-text')?.textContent === text
  );
};

// Helper function to get the active element considering shadow DOM
global.getActiveElement = (outlineList) => {
  // First check if the outline list itself has focus
  if (document.activeElement === outlineList && outlineList.shadowRoot) {
    // If so, check the shadow root's active element
    return outlineList.shadowRoot.activeElement;
  }
  // Otherwise return the document's active element
  return document.activeElement;
};

// Helper function to get popup from web component
global.getPopup = (outlineList) => {
  const shadowRoot = outlineList.shadowRoot;
  return shadowRoot.querySelector('.outline-popup');
};

// Helper function to close all popups in web component
global.closeAllPopups = (outlineList) => {
  const shadowRoot = outlineList.shadowRoot;
  const popups = shadowRoot.querySelectorAll('.outline-popup');
  popups.forEach(popup => popup.remove());
};

// Helper function to mock navigation for tests
global.mockNavigation = (todoList) => {
  let navigatedUrl = null;
      const originalOpenItem = todoList.openItem;
    
    // Mock the openItem method
    todoList.openItem = jest.fn((li) => {
    const todoId = li.dataset.id;
    const todoText = li.querySelector(".outline-text")?.textContent;
    const todoStatus = li.classList.contains("completed") ? "completed" : 
                      li.classList.contains("no-label") ? "heading" : "todo";
    
    // Navigation removed - todo.html no longer exists
// navigatedUrl = `demos/todo.html?id=${encodeURIComponent(todoId)}&text=${encodeURIComponent(todoText)}&status=${encodeURIComponent(todoStatus)}`;
    
    // Still emit the event
    todoList.emit("outline:open", {
      id: li.dataset.id,
      text: li.querySelector(".outline-text")?.textContent
    });
  });
  
  return {
    getNavigatedUrl: () => navigatedUrl,
    setNavigatedUrl: (url) => { navigatedUrl = url; },
    restore: () => {
      todoList.openItem = originalOpenItem;
    }
  };
};
