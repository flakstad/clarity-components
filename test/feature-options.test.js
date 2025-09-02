/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Feature Options', () => {
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
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  });

  test('should enable all features by default', async () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        options='{"assignees": ["alice"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const li = listElement.querySelector('li');
    
    // Check that all feature buttons are present
    const buttons = li.querySelectorAll('.hover-button');
    expect(buttons.length).toBeGreaterThan(0);
    
    const buttonTypes = Array.from(buttons).map(btn => btn.getAttribute('data-type'));
    expect(buttonTypes).toContain('priority');
    expect(buttonTypes).toContain('blocked');
    expect(buttonTypes).toContain('schedule');
    expect(buttonTypes).toContain('assign');
    expect(buttonTypes).toContain('tags');
    expect(buttonTypes).toContain('state');
    expect(buttonTypes).toContain('edit');
    expect(buttonTypes).toContain('open');
  });

  test('should disable specific features when configured', async () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"priority": false, "blocked": false, "dueDate": false, "assign": false, "tags": false}'
        options='{"assignees": ["alice"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const li = listElement.querySelector('li');
    
    // Check that only always-enabled buttons are present
    const buttons = li.querySelectorAll('.hover-button');
    const buttonTypes = Array.from(buttons).map(btn => btn.getAttribute('data-type'));
    
    // These should be present (always enabled)
    expect(buttonTypes).toContain('state');
    expect(buttonTypes).toContain('edit');
    expect(buttonTypes).toContain('open');
    
    // These should be absent (disabled)
    expect(buttonTypes).not.toContain('priority');
    expect(buttonTypes).not.toContain('blocked');
    expect(buttonTypes).not.toContain('schedule');
    expect(buttonTypes).not.toContain('assign');
    expect(buttonTypes).not.toContain('tags');
  });

  test('should enable only selected features', async () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"priority": true, "blocked": false, "dueDate": true, "assign": false, "tags": true}'
        options='{"assignees": ["alice"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const li = listElement.querySelector('li');
    
    const buttons = li.querySelectorAll('.hover-button');
    const buttonTypes = Array.from(buttons).map(btn => btn.getAttribute('data-type'));
    
    // These should be present
    expect(buttonTypes).toContain('priority');
    expect(buttonTypes).toContain('schedule');
    expect(buttonTypes).toContain('tags');
    expect(buttonTypes).toContain('state');
    expect(buttonTypes).toContain('edit');
    expect(buttonTypes).toContain('open');
    
    // These should be absent
    expect(buttonTypes).not.toContain('blocked');
    expect(buttonTypes).not.toContain('assign');
  });

  test('should handle keyboard shortcuts correctly for enabled features', async () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"priority": true, "blocked": false, "dueDate": true, "assign": false, "tags": true}'
        options='{"assignees": ["alice"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const li = listElement.querySelector('li');
    
    // Focus the item
    li.focus();

    // Test that enabled feature shortcuts work
    const priorityEvent = new KeyboardEvent('keydown', { key: 'p', bubbles: true });
    const blockedEvent = new KeyboardEvent('keydown', { key: 'b', bubbles: true });
    const dueDateEvent = new KeyboardEvent('keydown', { key: 'd', bubbles: true });
    const tagsEvent = new KeyboardEvent('keydown', { key: 't', bubbles: true });

    // Priority should work (enabled)
    const prioritySpy = jest.spyOn(outlineList.todoListInstance, 'togglePriority');
    li.dispatchEvent(priorityEvent);
    expect(prioritySpy).toHaveBeenCalled();

    // Blocked should not work (disabled)
    const blockedSpy = jest.spyOn(outlineList.todoListInstance, 'toggleBlocked');
    li.dispatchEvent(blockedEvent);
    expect(blockedSpy).not.toHaveBeenCalled();

    // Due date should work (enabled)
    const dueDateSpy = jest.spyOn(outlineList.todoListInstance, 'showSchedulePopup');
    li.dispatchEvent(dueDateEvent);
    expect(dueDateSpy).toHaveBeenCalled();

    // Tags should work (enabled)
    const tagsSpy = jest.spyOn(outlineList.todoListInstance, 'showTagsPopup');
    li.dispatchEvent(tagsEvent);
    expect(tagsSpy).toHaveBeenCalled();
  });

  test('should handle feature options via options attribute', async () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        options='{"features": {"priority": true, "blocked": false, "dueDate": true, "assign": false, "tags": true}, "assignees": ["alice"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const li = listElement.querySelector('li');
    
    const buttons = li.querySelectorAll('.hover-button');
    const buttonTypes = Array.from(buttons).map(btn => btn.getAttribute('data-type'));
    
    // These should be present
    expect(buttonTypes).toContain('priority');
    expect(buttonTypes).toContain('schedule');
    expect(buttonTypes).toContain('tags');
    expect(buttonTypes).toContain('state');
    expect(buttonTypes).toContain('edit');
    expect(buttonTypes).toContain('open');
    
    // These should be absent
    expect(buttonTypes).not.toContain('blocked');
    expect(buttonTypes).not.toContain('assign');
  });

  test('should maintain backward compatibility with default features', async () => {
    container.innerHTML = `
      <clarity-outline 
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        options='{"assignees": ["alice"], "tags": ["urgent"]}'>
      </clarity-outline>
    `;

    const outlineList = container.querySelector('clarity-outline');
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const shadowRoot = outlineList.shadowRoot;
    const listElement = shadowRoot.querySelector('.outline-list');
    const li = listElement.querySelector('li');
    
    // All features should be enabled by default
    const buttons = li.querySelectorAll('.hover-button');
    const buttonTypes = Array.from(buttons).map(btn => btn.getAttribute('data-type'));
    
    expect(buttonTypes).toContain('priority');
    expect(buttonTypes).toContain('blocked');
    expect(buttonTypes).toContain('schedule');
    expect(buttonTypes).toContain('assign');
    expect(buttonTypes).toContain('tags');
    expect(buttonTypes).toContain('state');
    expect(buttonTypes).toContain('edit');
    expect(buttonTypes).toContain('open');
  });
});
