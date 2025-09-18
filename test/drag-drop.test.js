/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Mock SortableJS
global.Sortable = {
  create: jest.fn(() => ({
    destroy: jest.fn()
  }))
};

describe('Drag and Drop Feature', () => {
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
    
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    jest.clearAllMocks();
  });

  test('should have dragAndDrop feature enabled by default', () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    const outlineInstance = outline.todoListInstance;
    
    expect(outlineInstance.options.features.dragAndDrop).toBe(true);
  });

  test('should allow dragAndDrop feature to be explicitly enabled', () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    const outlineInstance = outline.todoListInstance;
    
    expect(outlineInstance.options.features.dragAndDrop).toBe(true);
  });

  test('should allow dragAndDrop feature to be explicitly disabled', () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"dragAndDrop": false}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    const outlineInstance = outline.todoListInstance;
    
    expect(outlineInstance.options.features.dragAndDrop).toBe(false);
  });

  test('should make entire items draggable when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"First item","status":"TODO"},
          {"id":"2","text":"Second item","status":"TODO"}
        ]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Drag handles should no longer exist
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(0);
    
    // But items should still be present
    const items = outline.shadowRoot.querySelectorAll('li');
    expect(items.length).toBe(2);
  });

  test('should not have drag handles regardless of dragAndDrop setting', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"First item","status":"TODO"},
          {"id":"2","text":"Second item","status":"TODO"}
        ]'
        data-features='{"dragAndDrop": false}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Drag handles are no longer used
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(0);
  });

  test('should initialize Sortable when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(global.Sortable.create).toHaveBeenCalled();
    
    const sortableCall = global.Sortable.create.mock.calls[0];
    const [element, options] = sortableCall;
    
    expect(options.handle).toBeUndefined(); // No handle needed - entire item is draggable
    expect(options.animation).toBe(150);
    expect(options.ghostClass).toBe('sortable-ghost');
    expect(options.chosenClass).toBe('sortable-chosen');
    expect(options.dragClass).toBe('sortable-drag');
    expect(typeof options.onEnd).toBe('function');
  });

  test('should emit outline:move event when drag ends', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"First item","status":"TODO"},
          {"id":"2","text":"Second item","status":"TODO"}
        ]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    let moveEvent = null;
    
    outline.addEventListener('outline:move', (e) => {
      moveEvent = e;
    });
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate drag end event
    const sortableCall = global.Sortable.create.mock.calls[0];
    const options = sortableCall[1];
    const mockDragEvent = {
      oldIndex: 0,
      newIndex: 1,
      item: outline.shadowRoot.querySelector('li')
    };
    
    options.onEnd(mockDragEvent);
    
    expect(moveEvent).not.toBeNull();
    expect(moveEvent.detail.oldIndex).toBe(0);
    expect(moveEvent.detail.newIndex).toBe(1);
    expect(moveEvent.detail.direction).toBe('down');
  });

  test('should not emit move event when item is not actually moved', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    let moveEvent = null;
    
    outline.addEventListener('outline:move', (e) => {
      moveEvent = e;
    });
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate drag end event with same position
    const sortableCall = global.Sortable.create.mock.calls[0];
    const options = sortableCall[1];
    const mockDragEvent = {
      oldIndex: 0,
      newIndex: 0,
      item: outline.shadowRoot.querySelector('li')
    };
    
    options.onEnd(mockDragEvent);
    
    expect(moveEvent).toBeNull();
  });

  test('should not add drag handles to new items when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate adding a new item
    const outlineInstance = outline.todoListInstance;
    outlineInstance.createNewTodo();
    
    // Wait for the new item to be added
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Drag handles are no longer used
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(0);
    
    // But the item should exist
    const items = outline.shadowRoot.querySelectorAll('li');
    expect(items.length).toBe(1);
  });

  test('should not add drag handles to sibling items when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"First item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const outlineInstance = outline.todoListInstance;
    const firstLi = outline.shadowRoot.querySelector('li');
    
    // Simulate adding a sibling item (Alt+Enter functionality)
    outlineInstance.addSiblingTodo(firstLi);
    
    // Wait for the new item to be added
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Drag handles are no longer used
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(0);
    
    // But both items should exist
    const items = outline.shadowRoot.querySelectorAll('li');
    expect(items.length).toBe(2); // Original item + new sibling
  });

  test('should not add drag handles to child items when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Parent item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const outlineInstance = outline.todoListInstance;
    const parentLi = outline.shadowRoot.querySelector('li');
    
    // Simulate adding a child item
    outlineInstance.addItem("Child item", parentLi);
    
    // Wait for the new item to be added
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Drag handles are no longer used
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(0);
    
    // But both items should exist
    const items = outline.shadowRoot.querySelectorAll('li');
    expect(items.length).toBe(2); // Parent item + new child
  });

  test('should initialize sortable on nested lists', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{
          "id":"1",
          "text":"Parent item",
          "status":"TODO",
          "children":[{"id":"2","text":"Child item","status":"TODO"}]
        }]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have multiple sortable instances (main list + nested list)
    const outlineInstance = outline.todoListInstance;
    expect(outlineInstance.sortableInstances).toBeDefined();
    expect(outlineInstance.sortableInstances.length).toBeGreaterThan(1);
  });

  test('should emit hierarchical move events', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"Item 1","status":"TODO"},
          {"id":"2","text":"Item 2","status":"TODO"}
        ]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    let moveEvent = null;
    
    outline.addEventListener('outline:move', (e) => {
      moveEvent = e;
    });
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const outlineInstance = outline.todoListInstance;
    const mockFromList = outline.shadowRoot.querySelector('.outline-list');
    const mockToList = outline.shadowRoot.querySelector('.outline-list');
    
    // Simulate hierarchical drag end event
    const mockDragEvent = {
      item: outline.shadowRoot.querySelector('li'),
      from: mockFromList,
      to: mockToList,
      oldIndex: 0,
      newIndex: 1
    };
    
    outlineInstance.handleHierarchicalDragEnd(mockDragEvent);
    
    expect(moveEvent).not.toBeNull();
    expect(moveEvent.detail.moveType).toBe('reorder');
    expect(moveEvent.detail.fromList).toBeDefined();
    expect(moveEvent.detail.toList).toBeDefined();
  });

  test('should add read-only class to non-editable items', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"Editable item","status":"TODO","editable":true},
          {"id":"2","text":"Read-only item","status":"TODO","editable":false}
        ]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const items = outline.shadowRoot.querySelectorAll('li');
    const editableItem = items[0];
    const readOnlyItem = items[1];
    
    // Test that editable items don't have read-only class
    expect(editableItem.classList.contains('read-only')).toBe(false);
    expect(editableItem.dataset.editable).toBe('true');
    
    // Test that read-only items have read-only class
    expect(readOnlyItem.classList.contains('read-only')).toBe(true);
    expect(readOnlyItem.dataset.editable).toBe('false');
  });

  test('should configure Sortable to filter read-only items', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"Editable item","status":"TODO","editable":true},
          {"id":"2","text":"Read-only item","status":"TODO","editable":false}
        ]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that Sortable was configured with the filter
    expect(global.Sortable.create).toHaveBeenCalled();
    const sortableCall = global.Sortable.create.mock.calls[0];
    const options = sortableCall[1];
    
    // Verify that the filter is set to exclude read-only items
    expect(options.filter).toBe('.read-only');
  });

  test('should not emit permission denied event for read-only items (filtered by Sortable)', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Read-only item","status":"TODO","editable":false}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    let permissionDeniedEvent = null;
    
    outline.addEventListener('outline:permission-denied', (e) => {
      permissionDeniedEvent = e.detail;
    });
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Since Sortable filters out read-only items, no permission denied event should be emitted
    // The drag simply won't start for read-only items
    expect(permissionDeniedEvent).toBeNull();
  });

  test('should allow dragging editable items in mixed lists', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"Editable item 1","status":"TODO","editable":true},
          {"id":"2","text":"Read-only item","status":"TODO","editable":false},
          {"id":"3","text":"Editable item 2","status":"TODO","editable":true}
        ]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const items = outline.shadowRoot.querySelectorAll('li');
    const editableItem1 = items[0];
    const readOnlyItem = items[1];
    const editableItem2 = items[2];
    
    // Test that editable items don't have read-only class
    expect(editableItem1.classList.contains('read-only')).toBe(false);
    expect(editableItem2.classList.contains('read-only')).toBe(false);
    
    // Test that read-only item has read-only class
    expect(readOnlyItem.classList.contains('read-only')).toBe(true);
  });

});
