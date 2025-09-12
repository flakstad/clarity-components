/**
 * @jest-environment jsdom
 */

const path = require('path');
require('./setup.js');

describe('Parent Completion Prevention', () => {
  let container, todoList, outlineList;

  beforeEach(() => {
    // Load the web component
    const outlinePath = path.join(__dirname, '..', 'outline.js');
    require(outlinePath);

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function getTodoByText(container, text) {
    const todos = container.querySelectorAll('li');
    return Array.from(todos).find(li => 
      li.querySelector('.outline-text')?.textContent === text
    );
  }

  function createHierarchicalTodos() {
    container.innerHTML = `
      <clarity-outline 
        data-items='[
          {
            "id": "parent",
            "text": "Parent Task",
            "status": "TODO",
            "children": [
              {"id": "child1", "text": "Child 1", "status": "TODO"},
              {"id": "child2", "text": "Child 2", "status": "DONE"}
            ]
          }
        ]'
        options='{"statusLabels": [{"label": "TODO", "isEndState": false}, {"label": "DONE", "isEndState": true}]}'>
      </clarity-outline>
    `;

    const outlineElement = container.querySelector('clarity-outline');
    const shadowRoot = outlineElement.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    
    return {
      outlineElement,
      shadowRoot,
      listElement,
      parent: getTodoByText(listElement, 'Parent Task'),
      child1: getTodoByText(listElement, 'Child 1'),
      child2: getTodoByText(listElement, 'Child 2')
    };
  }

  test('should prevent parent completion when children are incomplete', () => {
    const { parent, child1, child2, outlineElement } = createHierarchicalTodos();
    
    // Verify initial state
    expect(parent.classList.contains('completed')).toBe(false);
    expect(child1.classList.contains('completed')).toBe(false);
    expect(child2.classList.contains('completed')).toBe(true);
    
    // Verify counter shows [1/2]
    const counter = parent.querySelector('.child-count');
    expect(counter.textContent).toBe('[1/2]');

    // Try to complete parent with shift+right arrow
    let permissionDeniedEvent = null;
    outlineElement.addEventListener('outline:permission-denied', (e) => {
      permissionDeniedEvent = e.detail;
    });

    parent.focus();
    parent.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'ArrowRight', 
      shiftKey: true, 
      bubbles: true 
    }));

    // Should show permission denied feedback
    expect(parent.classList.contains('permission-denied')).toBe(true);
    expect(permissionDeniedEvent).not.toBeNull();
    expect(permissionDeniedEvent.action).toBe('complete-with-incomplete-children');
    
    // Parent should still be in TODO state
    expect(parent.classList.contains('completed')).toBe(false);
    const label = parent.querySelector('.outline-label');
    expect(label.textContent).toBe('TODO');
  });

  test('should allow parent completion when all children are complete', () => {
    const { parent, child1, child2, outlineElement } = createHierarchicalTodos();
    
    // Complete the remaining child first
    child1.focus();
    child1.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'ArrowRight', 
      shiftKey: true, 
      bubbles: true 
    }));

    // Verify child1 is now completed
    expect(child1.classList.contains('completed')).toBe(true);
    
    // Verify counter shows [2/2]
    const counter = parent.querySelector('.child-count');
    expect(counter.textContent).toBe('[2/2]');

    // Now try to complete parent
    let toggleEvent = null;
    outlineElement.addEventListener('outline:toggle', (e) => {
      toggleEvent = e.detail;
    });

    parent.focus();
    parent.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'ArrowRight', 
      shiftKey: true, 
      bubbles: true 
    }));

    // Should successfully complete parent
    expect(parent.classList.contains('completed')).toBe(true);
    expect(toggleEvent).not.toBeNull();
    expect(toggleEvent.completed).toBe(true);
    
    const label = parent.querySelector('.outline-label');
    expect(label.textContent).toBe('DONE');
  });

  test('should prevent parent completion via spacebar popup selection', () => {
    const { parent, outlineElement } = createHierarchicalTodos();
    
    let permissionDeniedEvent = null;
    outlineElement.addEventListener('outline:permission-denied', (e) => {
      permissionDeniedEvent = e.detail;
    });

    parent.focus();
    
    // Try to set status directly via setTodoStatus (simulating popup selection)
    const todoListInstance = outlineElement.todoListInstance;
    const success = todoListInstance.setTodoStatus(parent, 'status-1'); // DONE status
    
    // Should return false indicating the action was blocked
    expect(success).toBe(false);

    // Should show permission denied feedback
    expect(parent.classList.contains('permission-denied')).toBe(true);
    expect(permissionDeniedEvent).not.toBeNull();
    expect(permissionDeniedEvent.action).toBe('complete-with-incomplete-children');
    
    // Parent should still be in TODO state
    expect(parent.classList.contains('completed')).toBe(false);
    const label = parent.querySelector('.outline-label');
    expect(label.textContent).toBe('TODO');
  });

  test('should keep status popup open when completion is denied', () => {
    const { parent, child1, child2, outlineElement } = createHierarchicalTodos();
    
    // Verify initial state - parent has incomplete children
    expect(child1.classList.contains('completed')).toBe(false);
    expect(child2.classList.contains('completed')).toBe(true);
    
    const shadowRoot = outlineElement.shadowRoot;
    const todoListInstance = outlineElement.todoListInstance;
    
    // Open status popup
    todoListInstance.showStatusPopup(parent, parent.querySelector('.outline-label'));
    
    // Verify popup is open
    let popup = shadowRoot.querySelector('.outline-popup');
    expect(popup).not.toBeNull();
    
    // Try to select DONE status (should be blocked)
    const doneOption = popup.querySelector('[data-value="status-1"]');
    expect(doneOption).not.toBeNull();
    
    // Simulate clicking the DONE option
    doneOption.click();
    
    // Popup should still be open since the action was denied
    popup = shadowRoot.querySelector('.outline-popup');
    expect(popup).not.toBeNull();
    
    // Parent should still be in TODO state
    expect(parent.classList.contains('completed')).toBe(false);
    const label = parent.querySelector('.outline-label');
    expect(label.textContent).toBe('TODO');
    
    // Now complete the remaining child
    todoListInstance.setTodoStatus(child1, 'status-1');
    
    // Try to select DONE status again (should work now)
    doneOption.click();
    
    // Popup should now be closed
    popup = shadowRoot.querySelector('.outline-popup');
    expect(popup).toBeNull();
    
    // Parent should now be completed
    expect(parent.classList.contains('completed')).toBe(true);
    expect(label.textContent).toBe('DONE');
  });

  test('should allow parent with no completable children to be completed', () => {
    // Create parent with only no-label children (headers)
    container.innerHTML = `
      <clarity-outline 
        data-items='[
          {
            "id": "parent",
            "text": "Parent Task",
            "status": "TODO",
            "children": [
              {"id": "header1", "text": "Header 1", "status": "none", "noLabel": true}
            ]
          }
        ]'
        options='{"statusLabels": [{"label": "TODO", "isEndState": false}, {"label": "DONE", "isEndState": true}]}'>
      </clarity-outline>
    `;

    const outlineElement = container.querySelector('clarity-outline');
    const shadowRoot = outlineElement.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const parent = getTodoByText(listElement, 'Parent Task');

    let toggleEvent = null;
    outlineElement.addEventListener('outline:toggle', (e) => {
      toggleEvent = e.detail;
    });

    // Should allow completion since no completable children
    parent.focus();
    parent.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'ArrowRight', 
      shiftKey: true, 
      bubbles: true 
    }));

    // Should successfully complete parent
    expect(parent.classList.contains('completed')).toBe(true);
    expect(toggleEvent).not.toBeNull();
    expect(toggleEvent.completed).toBe(true);
  });
});
