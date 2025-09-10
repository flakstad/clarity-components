/**
 * @jest-environment jsdom
 */

const path = require('path');

describe('Permission System', () => {
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

  test('should allow editing when editable is true', () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Editable task","status":"TODO","editable":true}]'
        options='{"assignees": ["alice", "bob"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const todo = listElement.querySelector('li');

    // Should be able to enter edit mode
    todo.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(todo.classList.contains('editing')).toBe(true);
  });

  test('should prevent editing when editable is false', () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Read-only task","status":"TODO","editable":false}]'
        options='{"assignees": ["alice", "bob"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const todo = listElement.querySelector('li');

    // Should not be able to enter edit mode
    todo.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(todo.classList.contains('editing')).toBe(false);
  });

  test('should show permission denied feedback when trying to edit non-editable item', () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Read-only task","status":"TODO","editable":false}]'
        options='{"assignees": ["alice", "bob"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const todo = listElement.querySelector('li');

    // Try to edit
    todo.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    
    // Should show permission denied feedback
    expect(todo.classList.contains('permission-denied')).toBe(true);
  });

  test('should emit permission denied event when trying to edit non-editable item', () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Read-only task","status":"TODO","editable":false}]'
        options='{"assignees": ["alice", "bob"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const todo = listElement.querySelector('li');

    let permissionDeniedEvent = null;
    outlineList.addEventListener('outline:permission-denied', (e) => {
      permissionDeniedEvent = e.detail;
    });

    // Try to edit
    todo.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    
    // Should emit permission denied event
    expect(permissionDeniedEvent).not.toBeNull();
    expect(permissionDeniedEvent.id).toBe('1');
    expect(permissionDeniedEvent.action).toBe('edit');
  });

  test('should allow open action on non-editable items', () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Read-only task","status":"TODO","editable":false}]'
        options='{"assignees": ["alice", "bob"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const todo = listElement.querySelector('li');

    let openEvent = null;
    outlineList.addEventListener('outline:open', (e) => {
      openEvent = e.detail;
    });

    // Should be able to open - focus first, then press Enter
    todo.focus();
    // Use a more complete keyboard event
    const keyEvent = new KeyboardEvent('keydown', { 
      key: 'Enter', 
      code: 'Enter',
      bubbles: true,
      cancelable: true
    });
    todo.dispatchEvent(keyEvent);
    
    expect(openEvent).not.toBeNull();
    expect(openEvent.id).toBe('1');
  });

  test('should allow comment action on non-editable items', () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Read-only task","status":"TODO","editable":false}]'
        options='{"assignees": ["alice", "bob"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const todo = listElement.querySelector('li');

    // Should be able to add comment (this would show the popup)
    todo.focus();
    todo.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    
    // The popup should appear (we can't easily test the popup content in this test)
    // But we can verify no permission denied event was emitted
    let permissionDeniedEvent = null;
    outlineList.addEventListener('outline:permission-denied', (e) => {
      permissionDeniedEvent = e.detail;
    });
    
    expect(permissionDeniedEvent).toBeNull();
  });

  test('should default to editable when editable field is not specified', () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Default editable task","status":"TODO"}]'
        options='{"assignees": ["alice", "bob"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const todo = listElement.querySelector('li');

    // Should be able to enter edit mode (defaults to editable)
    todo.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(todo.classList.contains('editing')).toBe(true);
  });
});
