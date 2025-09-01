/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Outline Web Component', () => {
  let container;

  beforeEach(() => {
    // Load the web component
    const outlinePath = path.join(process.cwd(), 'outline.js');
    const outlineCode = fs.readFileSync(outlinePath, 'utf8');
    
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
    
    // Evaluate the code in the current context
    eval(outlineCode);
    
    // Restore original customElements.define
    customElements.define = originalDefine;
    
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('should register the web component', () => {
    expect(customElements.get('clarity-outline')).toBeDefined();
  });

  test('should create outline list with JSON data', async () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Buy groceries","status":"TODO"},{"id":"2","text":"Review code","status":"DONE"}]'
        options='{"assignees": ["alice", "bob"], "tags": ["urgent", "bug"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    expect(outlineList).toBeDefined();
    
    // Wait for the component to be connected
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that the shadow DOM contains the list
    const shadowRoot = outlineList.shadowRoot;
    expect(shadowRoot).toBeDefined();
    
    const listElement = shadowRoot.querySelector('.outline-list');
    expect(listElement).toBeDefined();
    
    // Check that items were created
    const listItems = listElement.querySelectorAll('li');
    expect(listItems.length).toBe(2);
  });

  test('should handle empty outline list', async () => {
    container.innerHTML = `
      <clarity-outline 
        options='{"assignees": ["alice", "bob"], "tags": ["urgent", "bug"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    expect(outlineList).toBeDefined();
    
    // Wait for the component to be connected
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    expect(listElement).toBeDefined();
    
    // Should have no items initially
    const listItems = listElement.querySelectorAll('li');
    expect(listItems.length).toBe(0);
  });

  test('should emit events', async () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Buy groceries","status":"TODO"}]'
        options='{"assignees": ["alice"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    
    // Wait for the component to be connected
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Listen for add event
    let eventEmitted = false;
    outlineList.addEventListener('outline:add', (e) => {
      expect(e.detail).toBeDefined();
      expect(e.detail.text).toBe('New todo');
      eventEmitted = true;
    });
    
    // Trigger add by clicking the add button
    const shadowRoot = outlineList.shadowRoot;
    const addButton = shadowRoot.querySelector('.outline-add-button');
    addButton.click();
    
    // Wait for event to be emitted
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(eventEmitted).toBe(true);
  });

  test('should support dynamic updates', async () => {
    container.innerHTML = `
      <clarity-outline 
        options='{"assignees": ["alice"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    
    // Wait for the component to be connected
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Initially empty
    let todos = outlineList.getTodos();
    expect(todos.length).toBe(0);
    
    // Update with new todos
    const newTodos = [
      { id: "1", text: "New task 1", status: "TODO" },
      { id: "2", text: "New task 2", status: "DONE" }
    ];
    
    outlineList.setTodos(newTodos);
    
    // Check that todos were updated
    todos = outlineList.getTodos();
    expect(todos.length).toBe(2);
    expect(todos[0].text).toBe("New task 1");
    expect(todos[1].text).toBe("New task 2");
  });

  test('should have embedded CSS', async () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Buy groceries","status":"TODO"}]'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    
    // Wait for the component to be connected
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const shadowRoot = outlineList.shadowRoot;
    
    // Check that CSS is embedded
    const styleElement = shadowRoot.querySelector('style');
    expect(styleElement).toBeDefined();
    expect(styleElement.textContent).toContain('.outline-list');
    expect(styleElement.textContent).toContain('--clarity-outline-color-todo');
  });

  test('should not expose TodoList class globally', () => {
    // The TodoList class should not be available globally
    expect(window.TodoList).toBeUndefined();
    
    // Only the web component should be registered
    expect(customElements.get('clarity-outline')).toBeDefined();
  });
});
